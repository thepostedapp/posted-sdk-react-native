/**
 * Deprecated Detour* re-export shim coverage — POS-54
 *
 * Asserts every deprecated alias in src/index.ts is exported and
 * identity-equal to its new Posted* symbol. These tests serve as the
 * removal checklist: when the shims are dropped next minor, delete the
 * corresponding assertions here too.
 *
 * Removal checklist:
 *   - DetourProvider          → PostedProvider
 *   - useDetourContext         → usePostedContext
 *   - DETOUR_LINKING_PREFIX    → POSTED_LINKING_PREFIX
 *   - Detour                  → Posted
 *   - DetourAnalytics         → PostedAnalytics
 *   - DetourEventNames        → PostedEventNames
 *   Types (compile-time only):
 *   - DetourContextType       → PostedContextType
 *   - DetourLink              → PostedLink
 *   - DetourUrlEvent          → PostedUrlEvent
 *   - DetourUrlSubscription   → PostedUrlSubscription
 *   - DetourStorage           → PostedStorage
 */

// ---- Module mocks (hoisted by jest before imports) ----

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

// ---- SDK imports ----

import * as SDK from "../index";

// ---- Type-level assertions (compile-time only, tsc) ----
// These bidirectional casts fail to compile (tsc) if any deprecated type alias diverges
// from its Posted* counterpart. verbatimModuleSyntax requires `import type`.

import type {
  DetourContextType,
  DetourLink,
  DetourStorage,
  DetourUrlEvent,
  DetourUrlSubscription,
  PostedContextType,
  PostedLink,
  PostedStorage,
  PostedUrlEvent,
  PostedUrlSubscription,
} from "../index";

// Bidirectional assignability checks — each cast is a compile error if types diverge.
// The function is exported so tsc doesn't prune it as dead code.
export const _shimTypeChecks = {
  ctxFwd: (x: PostedContextType): DetourContextType => x,
  ctxRev: (x: DetourContextType): PostedContextType => x,
  linkFwd: (x: PostedLink): DetourLink => x,
  linkRev: (x: DetourLink): PostedLink => x,
  evtFwd: (x: PostedUrlEvent): DetourUrlEvent => x,
  evtRev: (x: DetourUrlEvent): PostedUrlEvent => x,
  subFwd: (x: PostedUrlSubscription): DetourUrlSubscription => x,
  subRev: (x: DetourUrlSubscription): PostedUrlSubscription => x,
  storageFwd: (x: PostedStorage): DetourStorage => x,
  storageRev: (x: DetourStorage): PostedStorage => x,
};

// ---- Runtime suite ----

describe("Deprecated Detour* re-export shims", () => {
  describe("DetourProvider", () => {
    it("is exported from the package", () => {
      expect(SDK.DetourProvider).toBeDefined();
    });
    it("is identity-equal to PostedProvider", () => {
      expect(SDK.DetourProvider).toBe(SDK.PostedProvider);
    });
  });

  describe("useDetourContext", () => {
    it("is exported from the package", () => {
      expect(SDK.useDetourContext).toBeDefined();
    });
    it("is identity-equal to usePostedContext", () => {
      expect(SDK.useDetourContext).toBe(SDK.usePostedContext);
    });
  });

  describe("DETOUR_LINKING_PREFIX", () => {
    it("is exported from the package", () => {
      expect(SDK.DETOUR_LINKING_PREFIX).toBeDefined();
    });
    it("is identity-equal to POSTED_LINKING_PREFIX", () => {
      expect(SDK.DETOUR_LINKING_PREFIX).toBe(SDK.POSTED_LINKING_PREFIX);
    });
  });

  describe("Detour", () => {
    it("is exported from the package", () => {
      expect(SDK.Detour).toBeDefined();
    });
    it("is identity-equal to Posted", () => {
      expect(SDK.Detour).toBe(SDK.Posted);
    });
  });

  describe("DetourAnalytics", () => {
    it("is exported from the package", () => {
      expect(SDK.DetourAnalytics).toBeDefined();
    });
    it("is identity-equal to PostedAnalytics", () => {
      expect(SDK.DetourAnalytics).toBe(SDK.PostedAnalytics);
    });
  });

  describe("DetourEventNames", () => {
    it("is exported from the package", () => {
      expect(SDK.DetourEventNames).toBeDefined();
    });
    it("is identity-equal to PostedEventNames", () => {
      expect(SDK.DetourEventNames).toBe(SDK.PostedEventNames);
    });
  });
});
