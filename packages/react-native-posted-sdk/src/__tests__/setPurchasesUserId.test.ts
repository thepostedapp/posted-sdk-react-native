// ---- Imports ----
import { setPurchasesUserId } from "../setPurchasesUserId";
import type { PostedStorage } from "../types";
import { SDK_HEADER_VALUE } from "../version";

/**
 * setPurchasesUserId — links the RevenueCat or Superwall user id to the install.
 *
 * Covers:
 *   1. POST /api/purchasesUser with SDK auth, the install's device_id and purchases_user_id
 *   2. The install is reported first; nothing is sent while it stays unreported
 *   3. Sent once: the flag is armed only on a 2xx, so failures retry
 *   4. Never throws; concurrent calls share one request
 *   5. An empty id sends nothing
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
  NativeModules: {},
  Platform: { OS: "ios" },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 390, height: 844 }),
  },
  PixelRatio: { get: jest.fn().mockReturnValue(3) },
}));

// ---- Helpers ----

const INSTALL_URL = "https://attr.postedapp.com/api/install";
const PURCHASES_USER_URL = "https://attr.postedapp.com/api/purchasesUser";
const INSTALL_FLAG_KEY = "Posted_installReported";
const FLAG_KEY = "Posted_revenueCatUserReported";

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

describe("setPurchasesUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    respond(200);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("reports the install, then posts the device id and user id with SDK auth and arms the flag", async () => {
    const storage = makeStorage();
    await setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(INSTALL_URL);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(PURCHASES_USER_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual(fetchMock.mock.calls[0][1].headers);
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer key",
      "X-App-ID": "app_ios",
      "X-SDK": SDK_HEADER_VALUE,
    });
    expect(sentBody(1)).toEqual({
      device_id: sentBody(0).device_id,
      purchases_user_id: "rc-user-1",
    });
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("skips the install report when it was already reported", async () => {
    const storage = makeStorage({ [INSTALL_FLAG_KEY]: "true" });
    await setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(PURCHASES_USER_URL);
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("sends nothing while the install is unreported", async () => {
    const storage = makeStorage();
    respond(500);
    await setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(INSTALL_URL);
    expect(storage._store[FLAG_KEY]).toBeUndefined();
  });

  it("sends nothing once the user was reported", async () => {
    await setPurchasesUserId(
      { apiKey: "key", appID: "app_ios", storage: makeStorage({ [FLAG_KEY]: "true" }) },
      "rc-user-1",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves the flag unarmed on a non-2xx, so the next call retries", async () => {
    const storage = makeStorage({ [INSTALL_FLAG_KEY]: "true" });
    respond(404);
    await setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1");
    expect(storage._store[FLAG_KEY]).toBeUndefined();

    respond(200);
    await setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("never throws on a network error", async () => {
    const storage = makeStorage({ [INSTALL_FLAG_KEY]: "true" });
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(
      setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1"),
    ).resolves.toBeUndefined();
    expect(storage._store[FLAG_KEY]).toBeUndefined();
  });

  it("sends nothing for an empty id", async () => {
    const storage = makeStorage();
    await setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage._store[FLAG_KEY]).toBeUndefined();
  });

  it("is exported from the package entry point", async () => {
    const { setPurchasesUserId: publicSetPurchasesUserId } = await import("../index");
    const storage = makeStorage({ [INSTALL_FLAG_KEY]: "true" });
    await publicSetPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1");
    expect(fetchMock.mock.calls[0][0]).toBe(PURCHASES_USER_URL);
    expect(storage._store[FLAG_KEY]).toBe("true");
  });

  it("shares one request between concurrent calls", async () => {
    const storage = makeStorage({ [INSTALL_FLAG_KEY]: "true" });
    await Promise.all([
      setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1"),
      setPurchasesUserId({ apiKey: "key", appID: "app_ios", storage }, "rc-user-1"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
