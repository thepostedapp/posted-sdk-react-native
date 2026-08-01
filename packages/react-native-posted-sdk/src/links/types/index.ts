export type Config = {
  appID: string;
  apiKey: string;
  shouldUseClipboard?: boolean;
  storage?: PostedStorage;
  /**
   * Controls which link sources are handled by the SDK.
   * - `all`: deferred links + runtime Universal/App links + initial URL + custom scheme links (default)
   * - `web-only`: deferred links + runtime Universal/App links + initial URL, but NOT custom scheme links
   * - `deferred-only`: only deferred links — no runtime listener, no initial URL check, no scheme links
   *   (recommended when Expo Router native-intent handler already resolves runtime/initial links)
   */
  linkProcessingMode?: LinkProcessingMode;
};

export type LinkProcessingMode = "all" | "web-only" | "deferred-only";

export type RequiredConfig = Omit<
  Config,
  "shouldUseClipboard" | "storage" | "linkProcessingMode"
> & {
  shouldUseClipboard: boolean;
  storage: PostedStorage;
  linkProcessingMode: LinkProcessingMode;
};

export type LinkType = "deferred" | "verified" | "scheme";

export type PostedLink = {
  url: string | URL;
  route: string;
  pathname: string;
  params: Record<string, string>;
  type: LinkType;
} | null;

export type PostedContextType = {
  isLinkProcessed: boolean;
  link: PostedLink;
  clearLink: () => void;
};

export interface PostedStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem?(key: string): Promise<void> | void;
  /**
   * Optional atomic batch removal (e.g. AsyncStorage.multiRemove). When present,
   * resetSession() uses it instead of sequential removeItem calls so the
   * fire-once flag and cached result clear in one commit. See POS-477.
   */
  multiRemove?(keys: string[]): Promise<void> | void;
}

export type PostedUrlEvent = {
  url: string;
};

export type PostedUrlSubscription = {
  remove: () => void;
};

/**
 * Attribution result returned by resolveAppLaunch.
 * The string is the resolved link URL (deep link for deferred, launch URL for link-present).
 * null means no attribution link was found for this install/launch.
 */
export type PostedResult = string | null;
