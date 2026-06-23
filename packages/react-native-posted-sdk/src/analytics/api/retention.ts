import { Platform } from "react-native";

import { SDK_HEADER_VALUE } from "../../version";

// TODO(B3): update to new backend domain once confirmed — https://github.com/posted-attribution/react-native-posted-sdk/issues
const RETENTION_API_URL = "https://godetour.dev/api/analytics/retention";

export const sendRetentionEvent = async ({
  apiKey,
  appID,
  deviceId,
  eventName,
}: {
  apiKey: string;
  appID: string;
  eventName: string;
  deviceId: string;
}) => {
  try {
    const response = await fetch(RETENTION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-App-ID": appID,
        "X-SDK": SDK_HEADER_VALUE,
      },
      body: JSON.stringify({
        event_name: eventName,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        device_id: deviceId,
      }),
    });

    if (!response.ok) {
      console.warn(`🔗[Posted:ANALYTICS_ERROR] Failed to log retention event: ${response.status}`);
    }
  } catch (error) {
    console.error("🔗[Posted:ANALYTICS_ERROR] Network error logging retention event:", error);
  }
};
