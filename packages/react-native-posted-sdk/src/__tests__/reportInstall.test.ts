// ---- Imports ----
import * as Application from "expo-application";

import { reportInstall } from "../reportInstall";
import type { PostedStorage } from "../types";
import { SDK_HEADER_VALUE } from "../version";

/**
 * reportInstall — first-launch install report for ad attribution.
 *
 * Covers:
 *   1. POST /api/install with SDK auth, the fingerprint and device_id
 *   2. Play referrer click id included when present
 *   3. Sent once: the flag is armed only on a 2xx, so failures retry
 *   4. Never throws; concurrent calls share one request
 */

// ---- Module mocks ----

jest.mock("expo-application", () => ({
  __esModule: true,
  getInstallReferrerAsync: jest.fn().mockResolvedValue(null),
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
  Platform: { OS: "ios" },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 390, height: 844 }),
  },
  PixelRatio: { get: jest.fn().mockReturnValue(3) },
}));

// ---- Helpers ----

const INSTALL_URL = "https://attr.postedapp.com/api/install";
const FLAG_KEY = "Posted_installReported";

function makeStorage(seed: Record<string, string> = {}): PostedStorage & {
  _store: Record<string, string>;
} {
  const _store: Record<string, string> = { ...seed };
  return {
    _store,
    getItem: jest.fn(async (key: string) => _store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      _store[key] = value;
    }),
  };
}

const fetchMock = jest.fn();

function respond(status: number) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status });
}

function sentBody(call = 0): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

// ---- Tests ----

describe("reportInstall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    respond(200);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("posts the fingerprint and device id with SDK auth, then arms the flag", async () => {
    const storage = makeStorage();
    await reportInstall({ apiKey: "key", appID: "app_ios", storage });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(INSTALL_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer key",
      "X-App-ID": "app_ios",
      "X-SDK": SDK_HEADER_VALUE,
    });
    expect(sentBody()).toMatchObject({
      platform: "ios",
      model: "iPhone 14",
      manufacturer: "Apple",
      systemVersion: "17.0.0",
      screenWidth: 390,
      screenHeight: 844,
      scale: 3,
      locale: [{ languageTag: "en-US" }],
      timezone: "America/New_York",
      userAgent: "TestAgent/1.0",
      device_id: expect.any(String),
    });
    expect(sentBody()).not.toHaveProperty("clickId");
    expect(sentBody()).not.toHaveProperty("pastedLink");
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("includes the Play referrer click id", async () => {
    (Application.getInstallReferrerAsync as jest.Mock).mockResolvedValueOnce(
      "utm_source=posted&click_id=0192-bridge-click",
    );
    await reportInstall({ apiKey: "key", appID: "app_android", storage: makeStorage() });
    expect(sentBody().clickId).toBe("0192-bridge-click");
  });

  it("sends nothing once the install was reported", async () => {
    await reportInstall({
      apiKey: "key",
      appID: "app_ios",
      storage: makeStorage({ [FLAG_KEY]: "true" }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves the flag unarmed on a non-2xx, so the next launch retries", async () => {
    const storage = makeStorage();
    respond(500);
    await reportInstall({ apiKey: "key", appID: "app_ios", storage });
    expect(storage._store[FLAG_KEY]).toBeUndefined();

    respond(200);
    await reportInstall({ apiKey: "key", appID: "app_ios", storage });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("never throws on a network error", async () => {
    const storage = makeStorage();
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(
      reportInstall({ apiKey: "key", appID: "app_ios", storage }),
    ).resolves.toBeUndefined();
    expect(storage._store[FLAG_KEY]).toBeUndefined();
  });

  it("is exported from the package entry point", async () => {
    const { reportInstall: publicReportInstall } = await import("../index");
    const storage = makeStorage();
    await publicReportInstall({ apiKey: "key", appID: "app_ios", storage });
    expect(fetchMock.mock.calls[0][0]).toBe(INSTALL_URL);
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("shares one request between concurrent calls", async () => {
    const storage = makeStorage();
    await Promise.all([
      reportInstall({ apiKey: "key", appID: "app_ios", storage }),
      reportInstall({ apiKey: "key", appID: "app_ios", storage }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
