/**
 * Whole-file contract drift guard — POS-579 / POS-283
 *
 * contract-conformance.test.ts validates request shapes against schemas pulled
 * out of the vendored contract. This guards the vendored file itself: it must
 * stay byte-identical to the canonical contract owned by posted-sdk-admin at
 * contract/posted-backend-contract.yaml.
 *
 * TO RE-VENDOR after the canonical contract changes:
 *   1. copy canonical over src/__tests__/__fixtures__/posted-backend-contract.yaml
 *   2. shasum -a 256 src/__tests__/__fixtures__/posted-backend-contract.yaml
 *   3. update CANONICAL_SHA256 below
 *   4. move the sibling pins in the same change (Flutter
 *      test/contract_drift_test.dart, Android ContractFixtureChecksumTest.kt,
 *      iOS ContractConformanceTests.swift)
 *
 * KNOWN LIMITATION: a pinned checksum detects this vendored copy being edited,
 * but NOT the canonical contract drifting ahead of it. That needs cross-repo
 * read access in CI and is deliberately out of scope.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

/** Canonical contract v1.1.0 digest. */
const CANONICAL_SHA256 =
  "9a6d4ce0013d4b9de4f2199ce603855890c39e93d605c7195dd8b8275a088bde";

const fixturePath = path.join(
  __dirname,
  "__fixtures__",
  "posted-backend-contract.yaml"
);

describe("contract drift guard", () => {
  it("vendored contract matches the pinned canonical checksum", () => {
    const bytes = fs.readFileSync(fixturePath);
    const actual = crypto.createHash("sha256").update(bytes).digest("hex");
    expect(actual).toBe(CANONICAL_SHA256);
  });

  it("vendored contract declares version 1.1.0", () => {
    const text = fs.readFileSync(fixturePath, "utf-8");
    expect(text).toContain("version: 1.1.0");
  });

  it("vendored contract targets the postedapp.com API host", () => {
    const text = fs.readFileSync(fixturePath, "utf-8");
    expect(text).toContain("https://attr.postedapp.com");
    expect(text).not.toContain("godetour.dev");
  });
});
