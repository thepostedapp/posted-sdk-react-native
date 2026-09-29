import { Platform } from "react-native";

import { SDK_HEADER_VALUE } from "../../version";
import type { PostedEvent } from "../types";

// Backend API base: attr.postedapp.com (canonical per POS-312 V3; ratified by POS-540).
const EVENT_API_URL = "https://attr.postedapp.com/api/analytics/event";

export const sendEvent = async ({
  apiKey,
  appID,
  deviceId,
  event,
}: {
  apiKey: string;
  appID: string;
  event: PostedEvent;
  deviceId: string;
}) => {
  try {
    const response = await fetch(EVENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-App-ID": appID,
        "X-SDK": SDK_HEADER_VALUE,
      },
      body: JSON.stringify({
        event_name: event.eventName,
        data: event.data,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        device_id: deviceId,
      }),
    });

    if (!response.ok) {
      console.warn(`🔗[Posted:ANALYTICS_ERROR] Failed to log event: ${response.status}`);
    }
  } catch (error) {
    console.error("🔗[Posted:ANALYTICS_ERROR] Network error logging event:", error);
  }
};
