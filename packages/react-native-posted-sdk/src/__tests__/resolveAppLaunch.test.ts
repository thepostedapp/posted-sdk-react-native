/**
 * resolveAppLaunch facade — POS-129
 *
 * Covers:
 *   1. Link-present branch (Linking.getInitialURL returns a URL)
 *   2. Deferred branch (no initial URL → match-link fingerprint)
 *   3. Fire-once cache: second call short-circuits with zero network calls
 *   4. Re-arm via resetSession(): next call performs fresh resolution
 *   5. Infrastructure URLs are ignored → deferred branch is used
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
  Linking: {
    getInitialURL: jest.fn().mockResolvedValue(null),
  },
  Platform: { OS: "ios" },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 390, height: 844 }),
  },
  PixelRatio: { get: jest.fn().mockReturnValue(3) },
}));

// ---- Imports ----

import { Linking } from "react-native";
import { resolveAppLaunch, resetSession } from "../attribution/resolveAppLaunch";
import { clearGlobalConfig } from "../attribution/configure";
import type { PostedStorage } from "../links/types";

// ---- Helpers ----

const API_KEY = "test-api-key";
const APP_ID = "test-app-id";

function makeStorage(): PostedStorage & {
  _store: Record<string, string>;
} {
  const _store: Record<string, string> = {};
  return {
    _store,
    getItem: jest.fn(async (key: string) => _store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      _store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete _store[key];
    }),
  };
}

function makeConfig(storage: PostedStorage) {
  return { apiKey: API_KEY, appID: APP_ID, storage };
}

type FetchCall = { url: string; method: string; body: unknown };

function mockFetch(responseBody: object, status = 200): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn().mockImplementation(async (url: string, opts: RequestInit = {}) => {
    calls.push({ url, method: opts.method ?? "GET", body: opts.body ? JSON.parse(opts.body as string) : undefined });
    return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(responseBody) };
  }) as jest.Mock;
  return calls;
}

// ---- Suite ----

describe("resolveAppLaunch", () => {
  const mockLinking = Linking as jest.Mocked<typeof Linking>;

  beforeEach(async () => {
    jest.clearAllMocks();
    clearGlobalConfig();
    // Clear in-memory cache between tests (memoryCache is module-level; resetSession without
    // storage clears it unconditionally).
    await resetSession();
  });

  // -----------------------------------------------------------------------
  // 1. Deferred branch — no initial URL
  // -----------------------------------------------------------------------
  describe("deferred branch (no launch URL)", () => {
    it("calls match-link and returns the link string", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const calls = mockFetch({ link: "https://example.com/promo" });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe("https://example.com/promo");
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe("https://godetour.dev/api/link/match-link");
    });

    it("returns null when match-link returns no link", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const calls = mockFetch({ link: null });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBeNull();
      expect(calls).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Link-present branch — initial URL present
  // -----------------------------------------------------------------------
  describe("link-present branch (launch URL present)", () => {
    it("calls universal-link-click and returns the URL", async () => {
      const launchUrl = "https://godetour.dev/u/launch?ref=ad";
      mockLinking.getInitialURL.mockResolvedValue(launchUrl);
      const calls = mockFetch({ allowed: true, clickId: "clk_abc" });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe(launchUrl);
      const clickCall = calls.find((c) => c.url === "https://godetour.dev/api/link/universal-link-click");
      expect(clickCall).toBeDefined();
      // match-link must NOT be called for link-present launches
      const matchCall = calls.find((c) => c.url === "https://godetour.dev/api/link/match-link");
      expect(matchCall).toBeUndefined();
    });

    it("resolves short link before returning the URL", async () => {
      // Single-segment path → short link resolution attempted
      const shortUrl = "https://godetour.dev/x9Az";
      const fullLink = "https://godetour.dev/app/summer-sale?utm_campaign=sm";
      mockLinking.getInitialURL.mockResolvedValue(shortUrl);

      const calls = mockFetch({ link: fullLink, allowed: true, clickId: null });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe(fullLink);
      const resolveCall = calls.find((c) => c.url === "https://godetour.dev/api/link/resolve-short");
      expect(resolveCall).toBeDefined();
      expect(resolveCall!.body).toEqual({ url: shortUrl });
    });

    it("falls back to original URL when short link API returns no link", async () => {
      const shortUrl = "https://godetour.dev/abc1";
      mockLinking.getInitialURL.mockResolvedValue(shortUrl);
      // resolve-short returns no link; universal-link-click succeeds
      const calls = mockFetch({ link: null, allowed: true });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe(shortUrl);
      expect(calls.some((c) => c.url === "https://godetour.dev/api/link/resolve-short")).toBe(true);
    });

    it("ignores infrastructure URLs and falls through to deferred branch", async () => {
      mockLinking.getInitialURL.mockResolvedValue("exp://localhost:8081/--/path");
      const calls = mockFetch({ link: "https://example.com/fallback" });
      const storage = makeStorage();

      await resolveAppLaunch(makeConfig(storage));

      // Only match-link should be called (deferred), NOT universal-link-click
      expect(calls.some((c) => c.url === "https://godetour.dev/api/link/match-link")).toBe(true);
      expect(calls.some((c) => c.url === "https://godetour.dev/api/link/universal-link-click")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Fire-once cache — second call returns cached result, zero network
  // -----------------------------------------------------------------------
  describe("fire-once cache", () => {
    it("short-circuits on second call with no network requests", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      const firstCalls = mockFetch({ link: "https://example.com/first" });

      const first = await resolveAppLaunch(makeConfig(storage));
      expect(first).toBe("https://example.com/first");
      expect(firstCalls).toHaveLength(1);

      // Second call — in-memory cache hit, no new network call
      const secondCalls = mockFetch({});
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBe("https://example.com/first");
      expect(secondCalls).toHaveLength(0);
    });

    it("returns cached null without network on second call when first resolved to null", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: null });

      const first = await resolveAppLaunch(makeConfig(storage));
      expect(first).toBeNull();

      const secondCalls = mockFetch({});
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBeNull();
      expect(secondCalls).toHaveLength(0);
    });

    it("reads from persistent storage after process restart (new memoryCache, same storage)", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: "https://example.com/cached" });

      // First call: network resolution + storage write
      await resolveAppLaunch(makeConfig(storage));

      // Simulate process restart: clear in-memory cache
      await resetSession(); // only clears memoryCache; re-add persistent flag manually
      // Re-write the persistent state to simulate what a real "restart" would see
      // (we cleared it above, so re-seed the storage directly)
      await storage.setItem("Posted_attributionResolved", "true");
      await storage.setItem("Posted_attributionResult", "https://example.com/cached");

      const secondCalls = mockFetch({});
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBe("https://example.com/cached");
      expect(secondCalls).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 3b. Storage write failure — observability (POS-153)
  // -----------------------------------------------------------------------
  describe("storage write failure observability", () => {
    it("logs a debug-level message when the fire-once flag cannot be persisted", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // setItem throws → writeCache rejects → fire-once flag never arms
      (storage.setItem as jest.Mock).mockRejectedValue(new Error("disk full"));
      mockFetch({ link: "https://example.com/promo" });

      const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});

      // Resolution still succeeds (write failure is non-fatal)
      const result = await resolveAppLaunch(makeConfig(storage));
      expect(result).toBe("https://example.com/promo");

      // The failure is surfaced at debug level with the 🔗[Posted] prefix
      expect(debugSpy).toHaveBeenCalledTimes(1);
      const [message, error] = debugSpy.mock.calls[0]!;
      expect(message).toContain("🔗[Posted:STORAGE_WRITE_FAILED]");
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("disk full");

      debugSpy.mockRestore();
    });

    it("does not log on a successful storage write", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: "https://example.com/promo" });

      const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});

      await resolveAppLaunch(makeConfig(storage));

      expect(debugSpy).not.toHaveBeenCalled();

      debugSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Concurrent calls — single-flight guard
  // -----------------------------------------------------------------------
  describe("single-flight guard (concurrent calls)", () => {
    it("two overlapping calls share a single network resolution", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();

      let resolveFetch!: (value: object) => void;
      const pendingFetch = new Promise<object>((resolve) => {
        resolveFetch = resolve;
      });
      let fetchCallCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++;
        return pendingFetch.then((body) => ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        }));
      }) as jest.Mock;

      // Fire both calls before the network responds
      const call1 = resolveAppLaunch(makeConfig(storage));
      const call2 = resolveAppLaunch(makeConfig(storage));

      // Unblock the single network call
      resolveFetch({ link: "https://example.com/concurrent" });

      const [result1, result2] = await Promise.all([call1, call2]);

      expect(result1).toBe("https://example.com/concurrent");
      expect(result2).toBe("https://example.com/concurrent");
      // Only ONE network call must have been made
      expect(fetchCallCount).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Error path — transient failures must not arm fire-once
  // -----------------------------------------------------------------------
  describe("error path does not arm fire-once", () => {
    it("a thrown branch error does not persist fire-once — next launch retries", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();

      // First call: network throws
      global.fetch = jest.fn().mockRejectedValue(new Error("network error")) as jest.Mock;
      const first = await resolveAppLaunch(makeConfig(storage));

      expect(first).toBeNull();
      // Fire-once flag must NOT be armed after a transient error
      expect(await storage.getItem("Posted_attributionResolved")).toBeNull();

      // Second call: network recovers → must retry (not short-circuit to null)
      const secondCalls = mockFetch({ link: "https://example.com/retry" });
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBe("https://example.com/retry");
      expect(secondCalls).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Re-arm via resetSession()
  // -----------------------------------------------------------------------
  describe("resetSession re-arms fire-once", () => {
    it("after resetSession, next resolveAppLaunch makes a fresh network call", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: "https://example.com/original" });

      const first = await resolveAppLaunch(makeConfig(storage));
      expect(first).toBe("https://example.com/original");

      // Re-arm
      await resetSession(makeConfig(storage));

      const freshCalls = mockFetch({ link: "https://example.com/refreshed" });
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBe("https://example.com/refreshed");
      expect(freshCalls).toHaveLength(1);
    });

    it("resetSession clears both in-memory cache and persistent storage", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: "https://example.com/item" });

      await resolveAppLaunch(makeConfig(storage));

      await resetSession(makeConfig(storage));

      expect(await storage.getItem("Posted_attributionResolved")).toBeNull();
      expect(await storage.getItem("Posted_attributionResult")).toBeNull();
    });
  });
});
