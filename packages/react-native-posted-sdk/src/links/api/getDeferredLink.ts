import * as Application from "expo-application";

import { SDK_HEADER_VALUE } from "../../version";
import type { RequiredConfig } from "../types";
import {
  type DeterministicFingerprint,
  type ProbabilisticFingerprint,
  getDeterministicFingerprint,
  getProbabilisticFingerprint,
} from "../utils/fingerprint";

// Backend API base: attr.postedapp.com (canonical per POS-312 V3; ratified by POS-540).
const API_URL = "https://attr.postedapp.com/api/link/match-link";

const sendFingerprint = async ({
  API_KEY,
  appID,
  requestBody,
}: {
  API_KEY: string;
  appID: string;
  requestBody: ProbabilisticFingerprint | DeterministicFingerprint;
}): Promise<Response> => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "X-App-ID": appID,
      "X-SDK": SDK_HEADER_VALUE,
    },
    body: JSON.stringify(requestBody),
  });

  return response;
};

export const getDeferredLink = async ({
  apiKey: API_KEY,
  appID,
  shouldUseClipboard,
}: Pick<RequiredConfig, "apiKey" | "appID" | "shouldUseClipboard">) => {
  let referrer: string | null = null;
  try {
    referrer = await Application.getInstallReferrerAsync();
  } catch {
    referrer = null;
  }

  const decodedReferrer = decodeURIComponent(referrer ?? "");
  const matchClickId = decodedReferrer.match(/(?:^|&)click_id=([^&]+)/);
  const referrerClickId = matchClickId ? matchClickId[1] : null;

  let response;
  if (referrerClickId?.length) {
    response = await sendFingerprint({
      API_KEY,
      appID,
      requestBody: getDeterministicFingerprint(referrerClickId),
    });
  } else {
    const probabilisticFingerprint = await getProbabilisticFingerprint(shouldUseClipboard);

    response = await sendFingerprint({
      API_KEY,
      appID,
      requestBody: probabilisticFingerprint,
    });
  }

  if (!response.ok) {
    if (response.status === 404) {
      console.warn("🔗[Posted:WARNING] No matching deferred link found");
      return null;
    }

    let errorMessage = "Request failed";

    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        errorMessage =
          typeof errorBody.error === "string" ? errorBody.error : JSON.stringify(errorBody.error);
      }
    } catch {
      // If the response isn't JSON (e.g., 500 Internal Server Error HTML),
      // fall back to the generic status code message.
    }

    // Genuine failure (non-404 non-2xx): rethrow so doResolve()'s catch treats
    // this as a transient error and does NOT arm fire-once. See POS-460/POS-465.
    throw new Error(`[${response.status}] ${errorMessage}`);
  }

  try {
    const data = await response.json();
    return data.link || null;
  } catch (error) {
    // Decode failure on a 2xx body is a genuine failure, not a legitimate empty
    // match — rethrow so fire-once is NOT armed. See POS-460/POS-465.
    console.error("🔗[Posted:NETWORK_ERROR] Error decoding deferred link response:", error);
    throw error;
  }
};
