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
      expect(calls[0]!.url).toBe("https://api.posted.app/api/link/match-link");
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
      const launchUrl = "https://posted.link/u/launch?ref=ad";
      mockLinking.getInitialURL.mockResolvedValue(launchUrl);
      const calls = mockFetch({ allowed: true, clickId: "clk_abc" });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe(launchUrl);
      const clickCall = calls.find((c) => c.url === "https://api.posted.app/api/link/universal-link-click");
      expect(clickCall).toBeDefined();
      // match-link must NOT be called for link-present launches
      const matchCall = calls.find((c) => c.url === "https://api.posted.app/api/link/match-link");
      expect(matchCall).toBeUndefined();
    });

    it("resolves short link before returning the URL", async () => {
      // Single-segment path → short link resolution attempted
      const shortUrl = "https://posted.link/x9Az";
      const fullLink = "https://posted.link/app/summer-sale?utm_campaign=sm";
      mockLinking.getInitialURL.mockResolvedValue(shortUrl);

      const calls = mockFetch({ link: fullLink, allowed: true, clickId: null });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe(fullLink);
      const resolveCall = calls.find((c) => c.url === "https://api.posted.app/api/link/resolve-short");
      expect(resolveCall).toBeDefined();
      expect(resolveCall!.body).toEqual({ url: shortUrl });
    });

    it("falls back to original URL when short link API returns no link", async () => {
      const shortUrl = "https://posted.link/abc1";
      mockLinking.getInitialURL.mockResolvedValue(shortUrl);
      // resolve-short returns no link; universal-link-click succeeds
      const calls = mockFetch({ link: null, allowed: true });
      const storage = makeStorage();

      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe(shortUrl);
      expect(calls.some((c) => c.url === "https://api.posted.app/api/link/resolve-short")).toBe(true);
    });

    it("ignores infrastructure URLs and falls through to deferred branch", async () => {
      mockLinking.getInitialURL.mockResolvedValue("exp://localhost:8081/--/path");
      const calls = mockFetch({ link: "https://example.com/fallback" });
      const storage = makeStorage();

      await resolveAppLaunch(makeConfig(storage));

      // Only match-link should be called (deferred), NOT universal-link-click
      expect(calls.some((c) => c.url === "https://api.posted.app/api/link/match-link")).toBe(true);
      expect(calls.some((c) => c.url === "https://api.posted.app/api/link/universal-link-click")).toBe(false);
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

  // -----------------------------------------------------------------------
  // 7. Cached-result JSON envelope (POS-152)
  // -----------------------------------------------------------------------
  describe("cached-result JSON envelope", () => {
    const RESULT_KEY = "Posted_attributionResult";
    const FLAG_KEY = "Posted_attributionResolved";
    const NULL_SENTINEL = "\x00";

    it("persists a non-null result as a JSON envelope and round-trips it", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: "https://example.com/envelope" });

      const first = await resolveAppLaunch(makeConfig(storage));
      expect(first).toBe("https://example.com/envelope");
      // Stored form is a self-describing, versioned JSON envelope, not a bare string.
      expect(await storage.getItem(RESULT_KEY)).toBe(
        JSON.stringify({ version: 1, result: "https://example.com/envelope" }),
      );

      // Round-trip: fresh runtime (memory cleared, storage kept) reads it back with no network.
      await resetSession();
      const rereadCalls = mockFetch({});
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBe("https://example.com/envelope");
      expect(rereadCalls).toHaveLength(0);
    });

    it('persists a null result as {"result":null} and round-trips it', async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: null });

      const first = await resolveAppLaunch(makeConfig(storage));
      expect(first).toBeNull();
      expect(await storage.getItem(RESULT_KEY)).toBe(JSON.stringify({ version: 1, result: null }));

      // Round-trip: fresh runtime reads the null envelope back with no network.
      await resetSession();
      const rereadCalls = mockFetch({});
      const second = await resolveAppLaunch(makeConfig(storage));

      expect(second).toBeNull();
      expect(rereadCalls).toHaveLength(0);
    });

    it("migration: reads a legacy NULL_SENTINEL result as null with no network", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // Simulate an install upgraded from a pre-envelope version.
      await storage.setItem(FLAG_KEY, "true");
      await storage.setItem(RESULT_KEY, NULL_SENTINEL);

      const calls = mockFetch({});
      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBeNull();
      expect(calls).toHaveLength(0);
    });

    it("migration: reads a legacy bare-string result with no network", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // Legacy installs stored the raw URL string directly (no envelope).
      await storage.setItem(FLAG_KEY, "true");
      await storage.setItem(RESULT_KEY, "https://example.com/legacy");

      const calls = mockFetch({});
      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe("https://example.com/legacy");
      expect(calls).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Schema versioning & defensive persistence (POS-162)
  // -----------------------------------------------------------------------
  describe("schema versioning & defensive persistence", () => {
    const RESULT_KEY = "Posted_attributionResult";
    const FLAG_KEY = "Posted_attributionResolved";

    it("stamps the current schema version on the persisted envelope", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      mockFetch({ link: "https://example.com/versioned" });

      await resolveAppLaunch(makeConfig(storage));

      const stored = JSON.parse((await storage.getItem(RESULT_KEY))!) as {
        version: number;
        result: string | null;
      };
      expect(stored.version).toBe(1);
      expect(stored.result).toBe("https://example.com/versioned");
    });

    it("drops a blob with an unrecognised version and re-resolves", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // A future/unknown schema version — must not be trusted.
      await storage.setItem(FLAG_KEY, "true");
      await storage.setItem(
        RESULT_KEY,
        JSON.stringify({ version: 99, result: "https://example.com/stale" }),
      );

      const calls = mockFetch({ link: "https://example.com/fresh" });
      const result = await resolveAppLaunch(makeConfig(storage));

      // Re-resolved rather than returning the stale, unrecognised-version blob.
      expect(result).toBe("https://example.com/fresh");
      expect(calls).toHaveLength(1);
      // And the re-resolution rewrites the blob at the current version.
      expect(await storage.getItem(RESULT_KEY)).toBe(
        JSON.stringify({ version: 1, result: "https://example.com/fresh" }),
      );
    });

    it("re-resolves when the flag is set but the blob is absent (flag-without-blob)", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // Simulate the iOS POS-140 failure mode: flag armed, no cached result.
      await storage.setItem(FLAG_KEY, "true");

      const calls = mockFetch({ link: "https://example.com/recovered" });
      const result = await resolveAppLaunch(makeConfig(storage));

      // Does not short-circuit to a phantom null — it re-resolves.
      expect(result).toBe("https://example.com/recovered");
      expect(calls).toHaveLength(1);
    });

    it("tolerates a legacy unversioned envelope with no network", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // POS-152 transitional envelope: {"result": ...} with no version field.
      await storage.setItem(FLAG_KEY, "true");
      await storage.setItem(RESULT_KEY, JSON.stringify({ result: "https://example.com/pos152" }));

      const calls = mockFetch({});
      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe("https://example.com/pos152");
      expect(calls).toHaveLength(0);
    });

    it("drops a corrupt non-URL blob and re-resolves (POS-262)", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // A truncated/garbled storage half-write: fails JSON.parse and doesn't
      // look like a URL, so it can't be a genuine legacy bare-string result.
      await storage.setItem(FLAG_KEY, "true");
      await storage.setItem(RESULT_KEY, "{corrupt-blob-not-json-or-a-url");

      const calls = mockFetch({ link: "https://example.com/recovered-from-corruption" });
      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe("https://example.com/recovered-from-corruption");
      expect(calls).toHaveLength(1);
    });

    it("still tolerates a legacy bare-string URL that fails JSON.parse (POS-262)", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // Pre-envelope installs stored the raw URL string directly; it must
      // still be trusted since it looks like a URL.
      await storage.setItem(FLAG_KEY, "true");
      await storage.setItem(RESULT_KEY, "posted://legacy/bare-string");

      const calls = mockFetch({});
      const result = await resolveAppLaunch(makeConfig(storage));

      expect(result).toBe("posted://legacy/bare-string");
      expect(calls).toHaveLength(0);
    });

    it("does not arm the fire-once flag when persisting the blob fails", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();
      // Blob write rejects (e.g. disk full / quota). Flag must never be set.
      // Non-blob writes still persist, so the flag assertion below is meaningful:
      // it proves the flag was never *attempted*, not merely dropped by the mock.
      (storage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
        if (key === RESULT_KEY) throw new Error("persist failure");
        storage._store[key] = value;
      });
      const calls = mockFetch({ link: "https://example.com/unpersisted" });

      // Result is still returned to the caller for this launch.
      const result = await resolveAppLaunch(makeConfig(storage));
      expect(result).toBe("https://example.com/unpersisted");
      expect(calls).toHaveLength(1);

      // But the flag was never armed → next launch re-resolves.
      expect(storage._store[FLAG_KEY]).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 9. resetSession vs in-flight resolution race (POS-154)
  // -----------------------------------------------------------------------
  describe("resetSession vs in-flight resolution (POS-154)", () => {
    it("a resolution started before resetSession does not persist or re-populate the cache", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();

      // A deferred network call whose completion we control.
      let resolveFetch!: (value: object) => void;
      const pendingFetch = new Promise<object>((resolve) => {
        resolveFetch = resolve;
      });
      global.fetch = jest.fn().mockImplementation(() =>
        pendingFetch.then((body) => ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })),
      ) as jest.Mock;

      // Start a resolution; it parks on the network call.
      const inflight = resolveAppLaunch(makeConfig(storage));

      // Reset while that resolution is still in flight.
      await resetSession(makeConfig(storage));

      // Now let the original network call complete.
      resolveFetch({ link: "https://example.com/stale" });
      const result = await inflight;

      // The original caller still receives its resolved value...
      expect(result).toBe("https://example.com/stale");

      // ...but the reset must have won: fire-once flag NOT armed, result not cached.
      expect(await storage.getItem("Posted_attributionResolved")).toBeNull();
      expect(await storage.getItem("Posted_attributionResult")).toBeNull();

      // And the in-memory cache is clean: a subsequent call performs a FRESH
      // network resolution rather than short-circuiting on the stale result.
      const freshCalls = mockFetch({ link: "https://example.com/fresh" });
      const next = await resolveAppLaunch(makeConfig(storage));

      expect(next).toBe("https://example.com/fresh");
      expect(freshCalls).toHaveLength(1);
    });

    it("a fresh resolution started after resetSession is not clobbered by the stale one settling", async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const storage = makeStorage();

      // First (stale) and second (fresh) network calls — completion controlled.
      let resolveStale!: (value: object) => void;
      const stalePending = new Promise<object>((resolve) => {
        resolveStale = resolve;
      });
      let resolveFresh!: (value: object) => void;
      const freshPending = new Promise<object>((resolve) => {
        resolveFresh = resolve;
      });

      let fetchCallCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++;
        const pending = fetchCallCount === 1 ? stalePending : freshPending;
        return pending.then((body) => ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        }));
      }) as jest.Mock;

      // Stale resolution starts and parks.
      const stale = resolveAppLaunch(makeConfig(storage));

      // Reset, then start a fresh resolution while the stale one is still pending.
      await resetSession(makeConfig(storage));
      const fresh = resolveAppLaunch(makeConfig(storage));

      // Settle the stale call first — its finally must NOT clear the fresh in-flight.
      resolveStale({ link: "https://example.com/stale" });
      await stale;

      // Settle the fresh call.
      resolveFresh({ link: "https://example.com/fresh" });
      expect(await fresh).toBe("https://example.com/fresh");

      // Exactly two network calls: one stale, one fresh — no third double-fire.
      expect(fetchCallCount).toBe(2);

      // Only the fresh result is cached/armed. Stored form is the versioned
      // JSON envelope introduced by POS-152/POS-162, not a bare string.
      expect(await storage.getItem("Posted_attributionResolved")).toBe("true");
      expect(await storage.getItem("Posted_attributionResult")).toBe(
        JSON.stringify({ version: 1, result: "https://example.com/fresh" }),
      );
    });
  });
});
