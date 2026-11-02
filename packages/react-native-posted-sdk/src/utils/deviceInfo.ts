import { expoConstants, expoDevice, reactNativeDeviceInfo } from "./optionalModules";

type DeviceInfo = {
  model: string;
  manufacturer: string;
  osVersion: string;
};

const UNKNOWN = "unknown";

const normalizeValue = (value: unknown): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return UNKNOWN;
};

const firstKnown = (...candidates: (() => unknown)[]): string => {
  for (const fn of candidates) {
    const value = normalizeValue(fn());
    if (value !== UNKNOWN) {
      return value;
    }
  }

  return UNKNOWN;
};

const firstKnownAsync = async (
  ...candidates: (() => unknown | Promise<unknown>)[]
): Promise<string> => {
  for (const fn of candidates) {
    const value = normalizeValue(await fn());
    if (value !== UNKNOWN) {
      return value;
    }
  }

  return UNKNOWN;
};

const getModel = (): string => {
  return firstKnown(
    () => expoDevice?.modelName,
    () => reactNativeDeviceInfo?.getModel?.(),
  );
};

const getOsVersion = (): string => {
  return firstKnown(
    () => expoDevice?.osVersion,
    () => reactNativeDeviceInfo?.getSystemVersion?.(),
  );
};

const getManufacturer = async (): Promise<string> => {
  return firstKnownAsync(
    () => expoDevice?.manufacturer,
    async () => {
      try {
        return await reactNativeDeviceInfo?.getManufacturer?.();
      } catch {
        return UNKNOWN;
      }
    },
    () => reactNativeDeviceInfo?.getManufacturerSync?.(),
  );
};

const assertDeviceInfoLibraryAvailable = (): void => {
  if (!expoDevice && !reactNativeDeviceInfo) {
    throw new Error(
      '[react-native-posted-sdk] No device info library found. Install either "expo-device" or "react-native-device-info".',
    );
  }
};

export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  assertDeviceInfoLibraryAvailable();

  const manufacturer = await getManufacturer();

  return {
    model: getModel(),
    manufacturer,
    osVersion: getOsVersion(),
  };
};

export const getUserAgent = async (): Promise<string> => {
  return firstKnownAsync(
    () => expoConstants?.getWebViewUserAgentAsync?.().catch(() => null),
    () => reactNativeDeviceInfo?.getUserAgent?.().catch(() => null),
  );
};
