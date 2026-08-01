// ---- Imports ----
import * as fs from "fs";
import * as path from "path";

import * as DeprecatedShims from "../attribution/deprecatedShims";
import * as SDK from "../index";

// ---- Module mocks ----
// deprecatedShims -> resolveAppLaunch pulls in native/Expo modules that Jest
// can't transform as-is; stub them the same way deprecatedShims3.test.ts does.

jest.mock("expo-application", () => ({
  __esModule: true,
  getInstallReferrerAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("expo-clipboard", () => ({
  __esModule: true,
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    nativeAppVersion: "1.0.0",
    getWebViewUserAgentAsync: jest.fn().mockResolvedValue("TestAgent/1.0"),
  },
}));

jest.mock("expo-localization", () => ({
  __esModule: true,
  getLocales: jest.fn().mockReturnValue([{ languageTag: "en-US" }]),
  getCalendars: jest.fn().mockReturnValue([{ timeZone: "America/New_York" }]),
}));

jest.mock("expo-device", () => ({
  modelName: "iPhone 14",
  manufacturer: "Apple",
  osVersion: "17.0.0",
}));

jest.mock("react-native", () => ({
  Linking: { getInitialURL: jest.fn().mockResolvedValue(null) },
  Platform: { OS: "ios" },
  Dimensions: { get: jest.fn().mockReturnValue({ width: 390, height: 844 }) },
  PixelRatio: { get: jest.fn().mockReturnValue(3) },
}));

/**
 * Docs-drift guard — POS-260
 *
 * MIGRATION.md §7 hand-maintains a table mapping each deprecated 3.0.0 link
 * method to `resolveAppLaunch()`. Nothing else ties that table to the real
 * exports, so it can silently drift — e.g. a shim gets removed at the next
 * major (§9) but the doc still lists it, or a shim is renamed without the
 * table following.
 *
 * This test extracts the "Old method" column of the §7 table and asserts,
 * in both directions, that it exactly matches the set of deprecated
 * forwarding shims actually exported from the package (excluding
 * `resetDeprecationWarnings`, which is a test/QA helper, not a migrated
 * public method).
 */

const MIGRATION_PATH = path.resolve(__dirname, "../../MIGRATION.md");

function extractSection7MethodNames(migrationDoc: string): string[] {
  const section7Match = migrationDoc.match(/## 7\. Method mapping\n([\s\S]*?)\n## 8\./);
  if (!section7Match) {
    throw new Error(
      "MIGRATION.md: could not find '## 7. Method mapping' section (heading renamed or removed?)",
    );
  }

  const tableRows = section7Match[1]!.split("\n").filter((line) => line.startsWith("| `"));
  if (tableRows.length === 0) {
    throw new Error("MIGRATION.md §7: found the section but no `| \\`method(...)\\`` table rows");
  }

  return tableRows.map((row) => {
    const cell = row.match(/^\|\s*`([a-zA-Z0-9_]+)\(/);
    if (!cell) {
      throw new Error(`MIGRATION.md §7: could not parse method name from table row: ${row}`);
    }
    return cell[1]!;
  });
}

describe("MIGRATION.md §7 docs-drift guard", () => {
  const migrationDoc = fs.readFileSync(MIGRATION_PATH, "utf8");
  const docMethodNames = extractSection7MethodNames(migrationDoc);

  // Source of truth for "what's actually deprecated": every named export of
  // deprecatedShims.ts other than the resetDeprecationWarnings test helper.
  const shimMethodNames = Object.keys(DeprecatedShims).filter(
    (name) => name !== "resetDeprecationWarnings",
  );

  it("§7 table is non-empty and lists the four known deprecated methods", () => {
    expect(docMethodNames.sort()).toEqual(
      ["getDeferredLink", "processLink", "resolveInitialLink", "resolveShortLink"].sort(),
    );
  });

  it("every method named in §7 is still exported from the package's public entrypoint", () => {
    for (const method of docMethodNames) {
      expect(typeof (SDK as Record<string, unknown>)[method]).toBe("function");
    }
  });

  it("every method named in §7 is still exported from the deprecatedShims module and forwards to resolveAppLaunch", () => {
    expect(docMethodNames.sort()).toEqual(shimMethodNames.sort());
  });

  it("every deprecated shim export is named in the §7 table (no undocumented shim)", () => {
    for (const method of shimMethodNames) {
      expect(docMethodNames).toContain(method);
    }
  });
});
