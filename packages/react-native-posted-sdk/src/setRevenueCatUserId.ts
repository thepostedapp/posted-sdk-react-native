import { reportInstall } from "./reportInstall";
import type { Config } from "./types";
import { prepareDeviceIdForApi } from "./utils/deviceId";
import { StorageKeys, resolveStorage } from "./utils/storage";
import { SDK_HEADER_VALUE } from "./version";

const REVENUECAT_USER_API_URL = "https://attr.postedapp.com/api/revenueCatUser";

let inFlight: Promise<void> | null = null;

export const setRevenueCatUserId = (config: Config, id: string): Promise<void> => {
  inFlight ??= send(config, id).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const send = async (config: Config, id: string) => {
  try {
    if (!id) return;
    const storage = resolveStorage(config.storage);
    if (await storage.getItem(StorageKeys.REVENUECAT_USER_REPORTED_FLAG_KEY)) return;

    // The backend links the id to an existing install, so the install goes first.
    await reportInstall(config);
    if (!(await storage.getItem(StorageKeys.INSTALL_REPORTED_FLAG_KEY))) return;

    const response = await fetch(REVENUECAT_USER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "X-App-ID": config.appID,
        "X-SDK": SDK_HEADER_VALUE,
      },
      body: JSON.stringify({
        device_id: await prepareDeviceIdForApi(storage),
        rc_user_id: id,
      }),
    });

    if (!response.ok) {
      console.warn(
        `🔗[Posted:REVENUECAT_ERROR] Failed to report RevenueCat user: ${response.status}`,
      );
      return;
    }
    await storage.setItem(StorageKeys.REVENUECAT_USER_REPORTED_FLAG_KEY, "true");
  } catch (error) {
    console.error("🔗[Posted:REVENUECAT_ERROR] Error reporting RevenueCat user:", error);
  }
};
