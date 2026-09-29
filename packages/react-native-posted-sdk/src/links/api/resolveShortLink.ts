import { SDK_HEADER_VALUE } from "../../version";
import type { RequiredConfig } from "../types";

// Backend API base: attr.postedapp.com (canonical per POS-312 V3; ratified by POS-540).
const API_URL = "https://attr.postedapp.com/api/link/resolve-short";

export type ResolveShortLinkResponse = {
  link: string;
  route: string;
  parameters: string;
};

export const resolveShortLink = async ({
  apiKey: API_KEY,
  appID,
  url,
}: Pick<RequiredConfig, "apiKey" | "appID"> & {
  url: string;
}): Promise<ResolveShortLinkResponse | null> => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "X-App-ID": appID,
        "X-SDK": SDK_HEADER_VALUE,
      },
      body: JSON.stringify({ url }),
    });

    if (response.status === 404) return null;
    if (!response.ok) return null;

    return (await response.json()) as ResolveShortLinkResponse;
  } catch {
    return null;
  }
};
