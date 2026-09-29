/**
 * Vendored contract fixture drift guard — POS-579
 *
 * The conformance suite (contract-conformance.test.ts) validates that the RN
 * SDK's wire format matches the vendored OpenAPI contract. This test guards a
 * different failure mode: silent drift of the *vendored file itself* away from
 * the canonical source. It pins the whole-file sha256 of the fixture so any
 * edit — intentional or accidental — trips CI until the pin is deliberately
 * re-vendored.
 *
 * Pinned fixture: src/__tests__/__fixtures__/posted-backend-contract.yaml
 * Canonical source: posted-sdk-admin/contract/posted-backend-contract.yaml (v1.1.0)
 *
 * Re-vendor procedure (when the canonical contract legitimately changes):
 *   1. cp ../posted-sdk-admin/contract/posted-backend-contract.yaml \
 *        packages/react-native-posted-sdk/src/__tests__/__fixtures__/posted-backend-contract.yaml
 *   2. Recompute the digest:
 *        shasum -a 256 packages/react-native-posted-sdk/src/__tests__/__fixtures__/posted-backend-contract.yaml
 *   3. Update EXPECTED_SHA256 below to the new digest.
 *   4. Re-run the conformance suite to confirm the SDK still satisfies the new contract.
 *
 * No new dependency (Node built-in crypto/fs); no PAT; no cross-repo checkout.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

// Canonical posted-backend-contract.yaml v1.1.0 whole-file sha256 (CTO, 2026-09-29).
const EXPECTED_SHA256 =
  "9a6d4ce0013d4b9de4f2199ce603855890c39e93d605c7195dd8b8275a088bde";

const fixturePath = path.join(
  __dirname,
  "__fixtures__",
  "posted-backend-contract.yaml",
);

describe("vendored backend-contract fixture drift guard", () => {
  it("fixture sha256 matches the pinned canonical digest", () => {
    const bytes = fs.readFileSync(fixturePath);
    const actual = crypto.createHash("sha256").update(bytes).digest("hex");

    if (actual !== EXPECTED_SHA256) {
      throw new Error(
        [
          "Vendored backend-contract fixture has drifted from the pinned canonical digest.",
          `  EXPECTED sha256: ${EXPECTED_SHA256}`,
          `  ACTUAL   sha256: ${actual}`,
          `  FIXTURE: ${fixturePath}`,
          "",
          "If the canonical contract legitimately changed, re-vendor it:",
          "  cp ../posted-sdk-admin/contract/posted-backend-contract.yaml \\",
          "     packages/react-native-posted-sdk/src/__tests__/__fixtures__/posted-backend-contract.yaml",
          "then update EXPECTED_SHA256 in this file to the new digest",
          "(shasum -a 256 <fixture>) and re-run the conformance suite.",
        ].join("\n"),
      );
    }

    expect(actual).toBe(EXPECTED_SHA256);
  });
});
