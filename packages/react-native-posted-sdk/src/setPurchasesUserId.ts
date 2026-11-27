import { reportInstall } from "./reportInstall";
import type { Config } from "./types";
import { prepareDeviceIdForApi } from "./utils/deviceId";
import { StorageKeys, resolveStorage } from "./utils/storage";
import { SDK_HEADER_VALUE } from "./version";

const PURCHASES_USER_API_URL = "https://attr.postedapp.com/api/purchasesUser";

let inFlight: Promise<void> | null = null;

export const setPurchasesUserId = (config: Config, id: string): Promise<void> => {
  inFlight ??= send(config, id).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const send = async (config: Config, id: string) => {
  try {
    if (!id) return;
    const storage = resolveStorage(config.storage);
    if (await storage.getItem(StorageKeys.PURCHASES_USER_REPORTED_FLAG_KEY)) return;

    // The backend links the id to an existing install, so the install goes first.
    await reportInstall(config);
    if (!(await storage.getItem(StorageKeys.INSTALL_REPORTED_FLAG_KEY))) return;

    const response = await fetch(PURCHASES_USER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "X-App-ID": config.appID,
        "X-SDK": SDK_HEADER_VALUE,
      },
      body: JSON.stringify({
        device_id: await prepareDeviceIdForApi(storage),
        purchases_user_id: id,
      }),
    });

    if (!response.ok) {
      console.warn(
        `🔗[Posted:PURCHASES_ERROR] Failed to report purchases user: ${response.status}`,
      );
      return;
    }
    await storage.setItem(StorageKeys.PURCHASES_USER_REPORTED_FLAG_KEY, "true");
  } catch (error) {
    console.error("🔗[Posted:PURCHASES_ERROR] Error reporting purchases user:", error);
  }
};
