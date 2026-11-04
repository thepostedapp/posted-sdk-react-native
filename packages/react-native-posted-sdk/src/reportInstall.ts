import type { Config } from "./types";
import { prepareDeviceIdForApi } from "./utils/deviceId";
import { getInstallContext } from "./utils/installContext";
import { getInstallReferrerClickId } from "./utils/installReferrer";
import { StorageKeys, resolveStorage } from "./utils/storage";
import { SDK_HEADER_VALUE } from "./version";

const INSTALL_API_URL = "https://attr.postedapp.com/api/install";

let inFlight: Promise<void> | null = null;

export const reportInstall = (config: Config): Promise<void> => {
  inFlight ??= send(config).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const send = async ({ apiKey, appID, storage: userStorage }: Config) => {
  try {
    const storage = resolveStorage(userStorage);
    if (await storage.getItem(StorageKeys.INSTALL_REPORTED_FLAG_KEY)) return;

    const [clickId, installContext, deviceId] = await Promise.all([
      getInstallReferrerClickId(),
      getInstallContext(),
      prepareDeviceIdForApi(storage),
    ]);

    const response = await fetch(INSTALL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-App-ID": appID,
        "X-SDK": SDK_HEADER_VALUE,
      },
      body: JSON.stringify({
        ...installContext,
        device_id: deviceId,
        ...(clickId ? { clickId } : {}),
      }),
    });

    if (!response.ok) {
      console.warn(`🔗[Posted:INSTALL_ERROR] Failed to report install: ${response.status}`);
      return;
    }
    await storage.setItem(StorageKeys.INSTALL_REPORTED_FLAG_KEY, "true");
  } catch (error) {
    console.error("🔗[Posted:INSTALL_ERROR] Error reporting install:", error);
  }
};
