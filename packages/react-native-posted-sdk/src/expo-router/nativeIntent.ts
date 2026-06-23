import { resolveShortLink } from "../links/api/resolveShortLink";
import { sendUniversalLinkClick } from "../links/api/sendUniversalLinkClick";
import type { Config } from "../links/types";
import { getRouteFromDeepLink } from "../links/utils/urlHelpers";

/**
 * Arguments passed by Expo Router to `redirectSystemPath`.
 */
export type PostedNativeIntentArgs = {
  /**
   * Incoming system path/URL that should be evaluated.
   */
  path: string;
  /**
   * Whether this is the initial URL used to launch the app.
   */
  initial: boolean;
};

/**
 * Function signature compatible with Expo Router native intent handlers.
 */
export type PostedNativeIntentHandler = (args: PostedNativeIntentArgs) => string | Promise<string>;

/**
 * Value passed to `mapToRoute` after URL resolution.
 */
export type PostedNativeIntentResolvedValue = {
  /**
   * Original incoming system path passed by Expo Router.
   */
  originalPath: string;
  /**
   * Whether this is the initial URL used to launch the app.
   */
  initial: boolean;
  /**
   * URL after optional short-link resolution.
   */
  resolvedUrl: URL;
};

/**
 * Resolve configuration for `createPostedNativeIntentHandler`.
 */
export type PostedNativeIntentResolveConfig = Pick<Config, "apiKey" | "appID"> & {
  /**
   * Timeout for short-link resolution call.
   * Defaults to `1200` ms.
   */
  timeoutMs?: number;
  /**
   * Optional callback invoked when short-link resolution fails or times out.
   */
  onResolveError?: (error: unknown, context: PostedNativeIntentArgs) => void;
};

/**
 * Configuration for `createPostedNativeIntentHandler`.
 */
export type PostedNativeIntentOptions = {
  /**
   * Path returned when Posted host match occurs and resolve mode is not enabled.
   * Also used as a safe fallback for resolve failures.
   * Defaults to an empty path (`''`), which is commonly used to avoid a
   * temporary not-found flash before app-level Posted handling runs.
   */
  fallbackPath?: string;
  /**
   * Host patterns to match against `url.hostname`.
   *
   * String examples:
   * - `go.example.com` (exact match)
   * - `*.example.com` (suffix wildcard)
   *
   * Defaults to `*.godetour.link` (TODO(B4): will be updated to the new short-link domain).
   */
  hosts?: Array<string | RegExp>;
  /**
   * When provided, the handler enables resolve mode:
   * - detects short links,
   * - calls resolve-short API when needed,
   * - maps the resulting URL to a final app route.
   *
   * Without this field, the handler works in intercept mode and simply returns
   * `fallbackPath` on host match.
   */
  config?: PostedNativeIntentResolveConfig;
  /**
   * Optional mapping callback used in resolve mode.
   * If omitted, SDK uses the default mapping strategy.
   */
  mapToRoute?: (value: PostedNativeIntentResolvedValue) => string;
};

// TODO(B4): update to new short-link domain once confirmed — https://github.com/posted-attribution/react-native-posted-sdk/issues
const DEFAULT_HOSTS: Array<string | RegExp> = [/\.godetour\.link$/i];
const DEFAULT_TIMEOUT_MS = 1200;

const isRegExpMatch = (pattern: RegExp, value: string) => {
  pattern.lastIndex = 0;
  return pattern.test(value);
};

const matchesHostPattern = (hostname: string, hostPattern: string | RegExp) => {
  const normalizedHost = hostname.toLowerCase();

  if (typeof hostPattern === "string") {
    const normalizedPattern = hostPattern.toLowerCase();

    if (normalizedPattern.startsWith("*.")) {
      return normalizedHost.endsWith(normalizedPattern.slice(1));
    }

    return normalizedHost === normalizedPattern;
  }

  return isRegExpMatch(hostPattern, normalizedHost);
};

const matchesAnyHost = (hostname: string, hosts: Array<string | RegExp>) => {
  return hosts.some((pattern) => matchesHostPattern(hostname, pattern));
};

const parseIntentUrl = (path: string): URL | null => {
  try {
    if (path.includes("://")) {
      return new URL(path);
    }

    if (path.startsWith("//")) {
      return new URL(`https:${path}`);
    }

    if (path.startsWith("/")) {
      return null;
    }

    return new URL(`https://${path}`);
  } catch {
    return null;
  }
};

const isWebProtocol = (url: URL) => {
  return url.protocol === "http:" || url.protocol === "https:";
};

const normalizeRoute = (value: string, fallbackPath: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return fallbackPath;
  }

  if (trimmedValue.startsWith("/")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("?")) {
    return `/${trimmedValue}`;
  }

  return `/${trimmedValue}`;
};

/**
 * Default mapping strategy used when `mapToRoute` is not provided.
 *
 * Web URL mapping:
 * - single segment path: keep original pathname (e.g. `/details`)
 * - multi segment path: drop the first segment (Posted app-hash segment)
 *   e.g. `/abcd1234/details` -> `/details`
 *
 * Custom scheme mapping:
 * - convert to Expo Router path (`myapp://app/details?id=1` -> `/app/details?id=1`)
 */
const defaultMapToRoute = ({ resolvedUrl }: PostedNativeIntentResolvedValue) => {
  if (!isWebProtocol(resolvedUrl)) {
    return getRouteFromDeepLink(resolvedUrl);
  }

  const pathSegments = resolvedUrl.pathname.split("/").filter(Boolean);

  if (pathSegments.length <= 1) {
    return `${resolvedUrl.pathname || "/"}${resolvedUrl.search ?? ""}`;
  }

  const routeWithoutAppHash = `/${pathSegments.slice(1).join("/")}`;
  return `${routeWithoutAppHash}${resolvedUrl.search ?? ""}`;
};

const isShortLinkCandidate = (url: URL) => {
  if (!isWebProtocol(url)) {
    return false;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const firstSegment = pathSegments[0];
  return pathSegments.length === 1 && Boolean(firstSegment?.length);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Posted short-link resolve timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

/**
 * Creates a Posted-aware `redirectSystemPath` handler for Expo Router.
 *
 * The returned handler:
 * - parses the incoming path into a URL when possible,
 * - checks whether the URL host matches configured Posted hosts,
 * - returns `fallbackPath` on match (intercept mode),
 * - or resolves short links + maps to route (resolve mode),
 * - otherwise returns the original path unchanged.
 *
 * By default, it matches any URL with a hostname ending in `.godetour.link`
 * (TODO(B4): will be updated to the new short-link domain once confirmed).
 *
 * @param options Configuration for host matching, fallback path, and optional resolve mode.
 * @returns A `redirectSystemPath` handler function compatible with Expo Router.
 * @example
 * ```tsx title="app/+native-intent.tsx"
 * import { createPostedNativeIntentHandler } from '@posted-sdk/react-native/expo-router';
 *
 * export const redirectSystemPath = createPostedNativeIntentHandler({
 *   fallbackPath: '',
 * });
 * ```
 *
 * @example
 * ```tsx title="app/+native-intent.tsx"
 * import { createPostedNativeIntentHandler } from '@posted-sdk/react-native/expo-router';
 *
 * export const redirectSystemPath = createPostedNativeIntentHandler({
 *   fallbackPath: '',
 *   hosts: ['custom.domain.com', /\.example\.org$/i],
 * });
 * ```
 *
 * @example
 * ```tsx title="app/+native-intent.tsx"
 * import { createPostedNativeIntentHandler } from '@posted-sdk/react-native/expo-router';
 *
 * export const redirectSystemPath = createPostedNativeIntentHandler({
 *   fallbackPath: '',
 *   config: {
 *     apiKey: process.env.EXPO_PUBLIC_POSTED_API_KEY!,
 *     appID: process.env.EXPO_PUBLIC_POSTED_APP_ID!,
 *     timeoutMs: 1200,
 *   },
 *
 *   // Optional custom mapping:
 *   mapToRoute: ({ resolvedUrl }) => `${resolvedUrl.pathname}${resolvedUrl.search}`,
 * });
 * ```
 */
export const createPostedNativeIntentHandler = (
  options: PostedNativeIntentOptions = {},
): PostedNativeIntentHandler => {
  const fallbackPath = options.fallbackPath ?? "";
  const hosts = options.hosts?.length ? options.hosts : DEFAULT_HOSTS;
  const mapToRoute = options.mapToRoute ?? defaultMapToRoute;

  return async ({ path, initial }: PostedNativeIntentArgs) => {
    const url = parseIntentUrl(path);
    if (!url?.hostname) {
      return path;
    }

    if (!matchesAnyHost(url.hostname, hosts)) {
      return path;
    }

    if (!options.config) {
      return fallbackPath;
    }

    const clickResult = await sendUniversalLinkClick({
      apiKey: options.config.apiKey,
      appID: options.config.appID,
      url: url.toString(),
    });

    if (!clickResult.allowed) {
      console.error("🔗[Posted:CLICK_LIMIT_ERROR] Native-intent routing blocked:", {
        path,
        error: clickResult.error,
        code: clickResult.code,
        clicksInPeriod: clickResult.clicksInPeriod,
        effectiveLimit: clickResult.effectiveLimit,
      });
      return fallbackPath;
    }

    let resolvedUrl = url;

    if (isShortLinkCandidate(url)) {
      try {
        const resolved = await withTimeout(
          resolveShortLink({
            apiKey: options.config.apiKey,
            appID: options.config.appID,
            url: url.toString(),
          }),
          options.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        );

        if (resolved?.link) {
          const parsedResolvedUrl = parseIntentUrl(resolved.link);
          if (parsedResolvedUrl) {
            resolvedUrl = parsedResolvedUrl;
          } else {
            return normalizeRoute(resolved.link, fallbackPath);
          }
        }
      } catch (error) {
        options.config.onResolveError?.(error, { path, initial });
        return fallbackPath;
      }
    }

    let route: string;
    try {
      route = mapToRoute({
        resolvedUrl,
        originalPath: path,
        initial,
      });
    } catch (error) {
      options.config.onResolveError?.(error, { path, initial });
      return fallbackPath;
    }

    return normalizeRoute(route, fallbackPath);
  };
};
