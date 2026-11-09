/**
 * Native packages the SDK can read device data from. All are optional peer
 * dependencies: Expo apps use the Expo packages, bare React Native apps can use
 * react-native-device-info instead. A missing package resolves to null.
 *
 * Metro needs a string literal in each require() at bundle time.
 */

export type ExpoDeviceModule = {
  modelName?: string | null;
  manufacturer?: string | null;
  osVersion?: string | null;
};

export type ReactNativeDeviceInfoModule = {
  getModel?: () => string;
  getSystemVersion?: () => string;
  getManufacturerSync?: () => string;
  getManufacturer?: () => Promise<string>;
  getUserAgent?: () => Promise<string>;
  getInstallReferrer?: () => Promise<string>;
};

type ExpoConstantsModule = {
  executionEnvironment?: string;
  getWebViewUserAgentAsync?: () => Promise<string | null>;
};

type ExpoLocalizationModule = {
  getLocales: () => { languageTag: string }[];
  getCalendars: () => { timeZone?: string | null }[];
};

type ExpoApplicationModule = {
  getInstallReferrerAsync: () => Promise<string>;
};

export const expoDevice = (() => {
  try {
    return require("expo-device") as ExpoDeviceModule;
  } catch {
    return null;
  }
})();

export const reactNativeDeviceInfo = (() => {
  try {
    const module = require("react-native-device-info");
    return (module.default ?? module) as ReactNativeDeviceInfoModule;
  } catch {
    return null;
  }
})();

export const expoConstants = (() => {
  try {
    const module = require("expo-constants");
    return (module.default ?? module) as ExpoConstantsModule;
  } catch {
    return null;
  }
})();

export const expoLocalization = (() => {
  try {
    return require("expo-localization") as ExpoLocalizationModule;
  } catch {
    return null;
  }
})();

export const expoApplication = (() => {
  try {
    return require("expo-application") as ExpoApplicationModule;
  } catch {
    return null;
  }
})();
