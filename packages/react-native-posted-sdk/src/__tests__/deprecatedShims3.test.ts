// ---- Imports ----
import { clearGlobalConfig } from "../attribution/configure";
import { resetDeprecationWarnings } from "../attribution/deprecatedShims";
import { resetSession } from "../attribution/resolveAppLaunch";
import * as SDK from "../index";
import type { PostedStorage } from "../links/types";

/**
 * Deprecated 3.0.0 public-surface shims — POS-130
 *
 * Asserts that every shim added in POS-130:
 *   - Is exported from the public index
 *   - Emits a console.warn deprecation message
 *   - Delegates to resolveAppLaunch() (i.e. makes the expected network call)
 *
 * Removal checklist (next major):
 *   - resolveInitialLink → resolveAppLaunch
 *   - processLink        → resolveAppLaunch
 *   - getDeferredLink    → resolveAppLaunch
 *   - resolveShortLink   → resolveAppLaunch
 */

// ---- Module mocks ----

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

// ---- Helpers ----

const API_KEY = "test-api-key";
const APP_ID = "test-app-id";

function makeStorage(): PostedStorage {
  const _store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (k: string) => _store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      _store[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete _store[k];
    }),
  };
}

function makeConfig(storage: PostedStorage) {
  return { apiKey: API_KEY, appID: APP_ID, storage };
}

function mockFetch(body: object, status = 200) {
  global.fetch = jest.fn().mockImplementation(async (url: string) => ({
    ok: status >= 200 && status < 300,
    status,
    url,
    json: () => Promise.resolve(body),
  })) as jest.Mock;
}

// ---- Suite ----

describe("Deprecated 3.0.0 shims", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearGlobalConfig();
    resetDeprecationWarnings();
    await resetSession();
  });

  // -----------------------------------------------------------------------
  // Exports
  // -----------------------------------------------------------------------
  describe("exports from public index", () => {
    it("resolveInitialLink is exported", () => {
      expect(typeof SDK.resolveInitialLink).toBe("function");
    });
    it("processLink is exported", () => {
      expect(typeof SDK.processLink).toBe("function");
    });
    it("getDeferredLink is exported", () => {
      expect(typeof SDK.getDeferredLink).toBe("function");
    });
    it("resolveShortLink is exported", () => {
      expect(typeof SDK.resolveShortLink).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // Deprecation warnings
  // -----------------------------------------------------------------------
  describe("deprecation warnings", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      mockFetch({ link: null });
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("resolveInitialLink emits a deprecation warning", async () => {
      await SDK.resolveInitialLink(makeConfig(makeStorage()));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("resolveInitialLink"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATED"));
    });

    it("processLink emits a deprecation warning", async () => {
      await SDK.processLink(makeConfig(makeStorage()));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("processLink"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATED"));
    });

    it("getDeferredLink emits a deprecation warning", async () => {
      await SDK.getDeferredLink(makeConfig(makeStorage()));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("getDeferredLink"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATED"));
    });

    it("resolveShortLink emits a deprecation warning", async () => {
      await SDK.resolveShortLink(makeConfig(makeStorage()));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("resolveShortLink"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATED"));
    });
  });

  // -----------------------------------------------------------------------
  // Once-per-session de-duplication (POS-177)
  // -----------------------------------------------------------------------
  describe("deprecation warnings are de-duplicated per session", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      mockFetch({ link: null });
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("warns only once across repeated calls to the same shim", async () => {
      await SDK.resolveInitialLink(makeConfig(makeStorage()));
      await SDK.resolveInitialLink(makeConfig(makeStorage()));
      await SDK.resolveInitialLink(makeConfig(makeStorage()));

      const initialLinkWarnings = warnSpy.mock.calls.filter(
        ([msg]) => typeof msg === "string" && msg.includes("resolveInitialLink"),
      );
      expect(initialLinkWarnings).toHaveLength(1);
    });

    it("each shim keeps its own independent once-per-session guard", async () => {
      // Two calls each — expect exactly one warning per distinct method.
      await SDK.resolveInitialLink(makeConfig(makeStorage()));
      await SDK.resolveInitialLink(makeConfig(makeStorage()));
      await SDK.processLink(makeConfig(makeStorage()));
      await SDK.processLink(makeConfig(makeStorage()));
      await SDK.getDeferredLink(makeConfig(makeStorage()));
      await SDK.getDeferredLink(makeConfig(makeStorage()));
      await SDK.resolveShortLink(makeConfig(makeStorage()));
      await SDK.resolveShortLink(makeConfig(makeStorage()));

      for (const method of [
        "resolveInitialLink",
        "processLink",
        "getDeferredLink",
        "resolveShortLink",
      ]) {
        const perMethod = warnSpy.mock.calls.filter(
          ([msg]) => typeof msg === "string" && msg.includes(`${method}()`),
        );
        expect(perMethod).toHaveLength(1);
      }
    });

    it("resetDeprecationWarnings re-arms the warning for a fresh session", async () => {
      await SDK.resolveInitialLink(makeConfig(makeStorage()));
      resetDeprecationWarnings();
      await SDK.resolveInitialLink(makeConfig(makeStorage()));

      const initialLinkWarnings = warnSpy.mock.calls.filter(
        ([msg]) => typeof msg === "string" && msg.includes("resolveInitialLink"),
      );
      expect(initialLinkWarnings).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Delegation to resolveAppLaunch (deferred branch with no launch URL)
  // -----------------------------------------------------------------------
  describe("delegates to resolveAppLaunch", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("resolveInitialLink returns PostedResult from match-link", async () => {
      mockFetch({ link: "https://example.com/promo" });
      const result = await SDK.resolveInitialLink(makeConfig(makeStorage()));
      expect(result).toBe("https://example.com/promo");
      expect((global.fetch as jest.Mock).mock.calls[0]![0]).toBe(
        "https://godetour.dev/api/link/match-link",
      );
    });

    it("processLink delegates to resolveAppLaunch (url arg is ignored)", async () => {
      mockFetch({ link: "https://example.com/link" });
      const result = await SDK.processLink(
        makeConfig(makeStorage()),
        "https://ignored.example.com/x",
      );
      expect(result).toBe("https://example.com/link");
      // Should call match-link (deferred branch, no Linking URL)
      expect((global.fetch as jest.Mock).mock.calls[0]![0]).toBe(
        "https://godetour.dev/api/link/match-link",
      );
    });

    it("getDeferredLink delegates to resolveAppLaunch", async () => {
      mockFetch({ link: "https://example.com/deferred" });
      const result = await SDK.getDeferredLink(makeConfig(makeStorage()));
      expect(result).toBe("https://example.com/deferred");
    });

    it("resolveShortLink delegates to resolveAppLaunch (url arg is ignored)", async () => {
      mockFetch({ link: "https://example.com/full" });
      const result = await SDK.resolveShortLink(
        makeConfig(makeStorage()),
        "https://ignored.example.com/short",
      );
      expect(result).toBe("https://example.com/full");
    });
  });
});
