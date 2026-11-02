import { expoApplication, reactNativeDeviceInfo } from "./optionalModules";

/**
 * The click id carried through the Play Store install referrer (`click_id=…`),
 * or null — always null on iOS, where the App Store passes nothing through.
 */
export const getInstallReferrerClickId = async (): Promise<string | null> => {
  let referrer: string | null = null;
  try {
    referrer =
      (await (expoApplication?.getInstallReferrerAsync() ??
        reactNativeDeviceInfo?.getInstallReferrer?.())) ?? null;
  } catch {
    referrer = null;
  }

  const match = decodeURIComponent(referrer ?? "").match(/(?:^|&)click_id=([^&]+)/);
  return match?.[1] || null;
};
