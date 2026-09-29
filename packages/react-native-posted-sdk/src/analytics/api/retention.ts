import { Platform } from "react-native";

import { SDK_HEADER_VALUE } from "../../version";

// Backend API base: attr.postedapp.com (canonical per POS-312 V3; ratified by POS-540).
const RETENTION_API_URL = "https://attr.postedapp.com/api/analytics/retention";

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
