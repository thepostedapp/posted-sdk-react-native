import { Dimensions, PixelRatio, Platform } from "react-native";

import { getDeviceInfo, getUserAgent } from "./deviceInfo";
import { expoLocalization } from "./optionalModules";

const intlOptions = (): Intl.ResolvedDateTimeFormatOptions | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions();
  } catch {
    return null;
  }
};

export type InstallContext = {
  platform: string;
  model: string;
  manufacturer: string;
  systemVersion: string;
  screenWidth: number;
  screenHeight: number;
  scale: number;
  locale: { languageTag: string }[];
  timezone: string | null | undefined;
  userAgent: string;
  timestamp: number;
};

// No clipboard read: it shows an iOS paste banner and install matching doesn't use it.
export const getInstallContext = async (): Promise<InstallContext> => {
  const { width, height } = Dimensions.get("screen");
  const localeLanguageTags = expoLocalization
    ? expoLocalization.getLocales().map((locale) => ({ languageTag: locale.languageTag }))
    : [{ languageTag: intlOptions()?.locale ?? "unknown" }];

  const { model, manufacturer, osVersion: systemVersion } = await getDeviceInfo();
  const userAgent = await getUserAgent();

  return {
    platform: Platform.OS,
    model,
    manufacturer,
    systemVersion,
    screenWidth: width,
    screenHeight: height,
    scale: PixelRatio.get(),
    locale: localeLanguageTags,
    timezone: expoLocalization
      ? expoLocalization.getCalendars()[0]?.timeZone
      : intlOptions()?.timeZone,
    userAgent,
    timestamp: Date.now(),
  };
};
