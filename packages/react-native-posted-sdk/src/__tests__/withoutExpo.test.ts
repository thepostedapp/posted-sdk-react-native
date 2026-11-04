/**
 * Bare React Native apps: no Expo packages, device data from
 * react-native-device-info and Intl.
 */

jest.mock("expo-application", () => {
  throw new Error("Cannot find module");
});
jest.mock("expo-constants", () => {
  throw new Error("Cannot find module");
});
jest.mock("expo-localization", () => {
  throw new Error("Cannot find module");
});
jest.mock("expo-device", () => {
  throw new Error("Cannot find module");
});

jest.mock("react-native-device-info", () => ({
  __esModule: true,
  default: {
    getModel: () => "Pixel 8",
    getSystemVersion: () => "15",
    getManufacturer: async () => "Google",
    getUserAgent: async () => "TestAgent/1.0",
    getInstallReferrer: async () => "utm_source=posted&click_id=0192-bridge-click",
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  Dimensions: { get: () => ({ width: 412, height: 915 }) },
  PixelRatio: { get: () => 2.625 },
}));

describe("without Expo", () => {
  it("builds the install context from react-native-device-info and Intl", async () => {
    const { getInstallContext } = await import("../utils/installContext");
    const installContext = await getInstallContext();

    expect(installContext).toMatchObject({
      platform: "android",
      model: "Pixel 8",
      manufacturer: "Google",
      systemVersion: "15",
      userAgent: "TestAgent/1.0",
      locale: [{ languageTag: Intl.DateTimeFormat().resolvedOptions().locale }],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it("reads the Play referrer click id", async () => {
    const { getInstallReferrerClickId } = await import("../utils/installReferrer");
    expect(await getInstallReferrerClickId()).toBe("0192-bridge-click");
  });
});
