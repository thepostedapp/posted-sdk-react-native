import { Linking } from "react-native";

import { getDeferredLink } from "../links/api/getDeferredLink";
import { resolveShortLink } from "../links/api/resolveShortLink";
import { sendUniversalLinkClick } from "../links/api/sendUniversalLinkClick";
import type { Config, PostedResult, RequiredConfig } from "../links/types";
import { resolveStorage } from "../links/utils/storage";
import { StorageKeys } from "../links/utils/storage";
import { isInfrastructureUrl, isWebUrl } from "../links/utils/urlHelpers";
import { getGlobalConfig } from "./configure";

// Sentinel stored for a null result so fire-once flag is still honoured.
const NULL_SENTINEL = "\x00";

// In-memory cache: survives within a single JS runtime; cleared by resetSession().
let memoryCache: { resolved: true; result: PostedResult } | null = null;

// Single-flight guard: concurrent callers share the same resolution promise
// rather than each firing an independent network call.
let inFlight: Promise<PostedResult> | null = null;

function resolveConfig(config?: Config): RequiredConfig {
  if (config) {
    return {
      apiKey: config.apiKey,
      appID: config.appID,
      shouldUseClipboard: config.shouldUseClipboard ?? true,
      storage: resolveStorage(config.storage),
      linkProcessingMode: config.linkProcessingMode ?? "all",
    };
  }
  const global = getGlobalConfig();
  if (!global) {
    throw new Error(
      "🔗[Posted] resolveAppLaunch: no config provided and configure() was not called.",
    );
  }
  return global;
}

async function readCache(
  storage: RequiredConfig["storage"],
): Promise<{ hit: true; result: PostedResult } | { hit: false }> {
  const flag = await storage.getItem(StorageKeys.ATTRIBUTION_RESOLVED_FLAG_KEY);
  if (flag !== "true") return { hit: false };
  const raw = await storage.getItem(StorageKeys.ATTRIBUTION_CACHED_RESULT_KEY);
  const result = raw === null || raw === NULL_SENTINEL ? null : raw;
  return { hit: true, result };
}

async function writeCache(storage: RequiredConfig["storage"], result: PostedResult): Promise<void> {
  await storage.setItem(
    StorageKeys.ATTRIBUTION_CACHED_RESULT_KEY,
    result !== null ? result : NULL_SENTINEL,
  );
  await storage.setItem(StorageKeys.ATTRIBUTION_RESOLVED_FLAG_KEY, "true");
}

async function resolveLinkPresent(cfg: RequiredConfig, url: string): Promise<PostedResult> {
  let resolvedUrl = url;

  const isWeb = isWebUrl(url);
  if (isWeb) {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split("/").filter(Boolean);
      // Single-segment path after the host → potential short link
      if (pathSegments.length === 1 && pathSegments[0] && pathSegments[0].length > 0) {
        const short = await resolveShortLink({ apiKey: cfg.apiKey, appID: cfg.appID, url });
        if (short?.link) {
          resolvedUrl = short.link;
        }
      }
    } catch {
      // Unparseable URL — skip short-link attempt, use the URL as-is.
    }

    // Register the universal link click for attribution (fire-and-forget; result not used here).
    // NOTE: The link-present path legitimately makes two HTTP calls (resolve-short + universal-link-click);
    // this is the legacy flow preserved as-is, not a violation of the "one attribution call per launch" invariant.
    await sendUniversalLinkClick({ apiKey: cfg.apiKey, appID: cfg.appID, url });
  }

  return resolvedUrl;
}

async function doResolve(config?: Config): Promise<PostedResult> {
  const cfg = resolveConfig(config);

  // Persistent cache (survives app restarts and updates on the same install)
  const cached = await readCache(cfg.storage);
  if (cached.hit) {
    memoryCache = { resolved: true, result: cached.result };
    return cached.result;
  }

  let result: PostedResult;
  try {
    // Link-present branch: app opened via a universal/custom-scheme link
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl && !isInfrastructureUrl(initialUrl)) {
      result = await resolveLinkPresent(cfg, initialUrl);
    } else {
      // Deferred branch: probabilistic or deterministic fingerprint match
      result = await getDeferredLink({
        apiKey: cfg.apiKey,
        appID: cfg.appID,
        shouldUseClipboard: cfg.shouldUseClipboard,
      });
    }
  } catch (error) {
    // Transient failure: do NOT arm fire-once — next launch will retry.
    console.error("🔗[Posted:ATTRIBUTION_ERROR]", error);
    return null;
  }

  // Persist fire-once flag + result
  try {
    await writeCache(cfg.storage, result);
  } catch {
    // Storage failure is non-fatal; result is still returned.
  }

  memoryCache = { resolved: true, result };
  return result;
}

/**
 * Resolves attribution for the current app launch. Returns the attributed
 * link URL, or null if no attribution was found.
 *
 * Fire-once per install: the first call performs one network request and
 * caches the result. Subsequent calls (same install, same process, or across
 * app updates) return the cached value with zero network calls.
 *
 * Re-arms on: OS-cleared storage (reinstall) or explicit resetSession().
 *
 * On React Native, launchContext is always omitted — the native Linking
 * module captures the launch URL.
 */
export const resolveAppLaunch = async (
  config?: Config,
  // launchContext is reserved for cross-platform API parity; RN always omits it.
  _launchContext?: undefined,
): Promise<PostedResult> => {
  // 1. In-memory cache (same JS runtime, e.g. multiple calls in one session)
  if (memoryCache) {
    return memoryCache.result;
  }

  // 2. Single-flight guard: join an in-progress resolution rather than firing a second network call.
  if (inFlight) {
    return inFlight;
  }

  inFlight = doResolve(config);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/**
 * Re-arms the fire-once attribution resolution. The next call to
 * resolveAppLaunch() will perform a fresh network resolution.
 *
 * Designed for: explicit logout/reinstall flows, QA, and testing.
 */
export const resetSession = async (config?: Config): Promise<void> => {
  const cfg = config ? resolveConfig(config) : getGlobalConfig();

  // Clear both caches unconditionally.
  memoryCache = null;
  inFlight = null;

  if (!cfg) return;

  try {
    await cfg.storage.removeItem?.(StorageKeys.ATTRIBUTION_RESOLVED_FLAG_KEY);
    await cfg.storage.removeItem?.(StorageKeys.ATTRIBUTION_CACHED_RESULT_KEY);
  } catch {
    // Storage errors are non-fatal.
  }
};
