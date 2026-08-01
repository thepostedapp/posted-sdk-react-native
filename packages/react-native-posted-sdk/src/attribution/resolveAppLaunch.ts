import { Linking } from "react-native";

import { getDeferredLink } from "../links/api/getDeferredLink";
import { resolveShortLink } from "../links/api/resolveShortLink";
import { sendUniversalLinkClick } from "../links/api/sendUniversalLinkClick";
import type { Config, PostedResult, RequiredConfig } from "../links/types";
import { resolveStorage } from "../links/utils/storage";
import { StorageKeys } from "../links/utils/storage";
import { isInfrastructureUrl, isWebUrl } from "../links/utils/urlHelpers";
import { getGlobalConfig } from "./configure";

// Legacy sentinel that older installs stored for a null result. No longer
// written (superseded by the JSON envelope below) but still READ so an existing
// install's fire-once flag survives an app update. See POS-152.
const NULL_SENTINEL = "\x00";

// Schema version stamped on every cached-result blob we write. Bump this when
// the envelope shape changes incompatibly; decode drops any blob whose version
// it does not recognise (see decodeCachedResult) so a future shape change
// re-resolves cleanly instead of returning data we can't trust. See POS-162.
const CACHE_SCHEMA_VERSION = 1;

// Persisted result is a self-describing, versioned JSON envelope:
//   {"version": <number>, "result": <string|null>}.
// The envelope avoids any theoretical collision with a real attributed value
// and the version field lets future readers detect and drop incompatible blobs.
type CacheEnvelope = { version: number; result: PostedResult };

// Outcome of decoding a persisted cached-result value. `ok: false` means the
// blob is missing, corrupt, or stamped with an unrecognised schema version —
// the caller must treat it as a cache miss and re-resolve rather than trust it.
type DecodeOutcome = { ok: true; result: PostedResult } | { ok: false };

// Decode a persisted cached-result value across formats:
//   - versioned JSON envelope ({"version": N, "result": ...}) — current format
//   - unversioned JSON envelope ({"result": ...}) — POS-152 transitional format
//   - NULL_SENTINEL — legacy null marker
//   - bare string — legacy result written before the envelope existed
//   - null (absent blob) — flag set without a persisted result → drop
// Returns { ok: false } for anything we cannot safely trust (absent blob or a
// version we don't recognise) so the caller re-resolves instead of short-
// circuiting on stale/undecodable data.
function decodeCachedResult(raw: string | null): DecodeOutcome {
  // Flag set but no blob persisted (the iOS flag-without-blob failure mode from
  // POS-140). Treat as a miss so we re-resolve rather than return a phantom null.
  if (raw === null) return { ok: false };
  // Legacy null marker (pre-envelope installs).
  if (raw === NULL_SENTINEL) return { ok: true, result: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === "object" && "result" in parsed) {
      const envelope = parsed as Partial<CacheEnvelope>;
      // Versioned envelope with an unrecognised version → drop + re-resolve.
      if ("version" in envelope && envelope.version !== CACHE_SCHEMA_VERSION) {
        return { ok: false };
      }
      const value = envelope.result;
      return { ok: true, result: typeof value === "string" ? value : null };
    }
  } catch {
    // Not a JSON envelope — could be a legacy bare-string result (pre-envelope
    // installs persisted the raw URL directly) or a corrupt/truncated blob
    // (e.g. a storage half-write). The two are indistinguishable without a
    // marker, so only trust it as the legacy format when it looks like a URL
    // (http(s) or a custom app scheme, same check as isWebUrl/usePosted use
    // for deep links elsewhere in the SDK) — a genuine attribution result is
    // always a link. Anything else is corrupt: drop + re-resolve. See POS-262.
  }
  return raw.includes("://") || raw.startsWith("//") ? { ok: true, result: raw } : { ok: false };
}

// In-memory cache: survives within a single JS runtime; cleared by resetSession().
let memoryCache: { resolved: true; result: PostedResult } | null = null;

// Single-flight guard: concurrent callers share the same resolution promise
// rather than each firing an independent network call.
let inFlight: Promise<PostedResult> | null = null;

// Generation/epoch token. resetSession() bumps this synchronously so that a
// resolution which started BEFORE the reset cannot persist its result or
// re-populate the caches afterwards — otherwise a doResolve() already in flight
// would re-arm fire-once immediately after an intended reset. See POS-154.
let generation = 0;

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
  const decoded = decodeCachedResult(raw);
  // Missing / corrupt / version-mismatched blob → treat as a miss so we
  // re-resolve rather than short-circuit on data we cannot trust.
  if (!decoded.ok) return { hit: false };
  return { hit: true, result: decoded.result };
}

async function writeCache(storage: RequiredConfig["storage"], result: PostedResult): Promise<void> {
  const envelope: CacheEnvelope = { version: CACHE_SCHEMA_VERSION, result };
  // Blob first, flag last: if the blob write throws, the flag is never set, so
  // the fire-once short-circuit is never armed without a decodable result.
  await storage.setItem(StorageKeys.ATTRIBUTION_CACHED_RESULT_KEY, JSON.stringify(envelope));
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
  // Snapshot the generation at the start; if resetSession() runs while this
  // resolution is in flight, the token changes and we must not touch the caches.
  const startGeneration = generation;

  // Persistent cache (survives app restarts and updates on the same install)
  const cached = await readCache(cfg.storage);
  if (cached.hit) {
    // Only re-populate the in-memory cache if no reset landed during the read.
    if (generation === startGeneration) {
      memoryCache = { resolved: true, result: cached.result };
    }
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

  // If resetSession() ran while this resolution was in flight, the reset must
  // win: do NOT persist the fire-once flag or populate the in-memory cache, as
  // that would silently re-arm fire-once right after the intended reset. The
  // resolved value is still returned to the original caller.
  if (generation !== startGeneration) {
    return result;
  }

  // Persist fire-once flag + result
  try {
    await writeCache(cfg.storage, result);
  } catch (error) {
    // Storage write failed: the fire-once flag was NOT armed. The current result is
    // still returned (non-fatal), but the next launch will re-resolve and re-fire the
    // network call — silent cost/attribution drift. Log at debug level so the condition
    // is diagnosable without adding noise to normal operation.
    console.debug(
      "🔗[Posted:STORAGE_WRITE_FAILED] Failed to persist fire-once flag; next launch will re-resolve.",
      error,
    );
  }

  // Re-check: a reset may have landed during the storage write above.
  if (generation !== startGeneration) {
    return result;
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

  const pending = doResolve(config);
  inFlight = pending;
  try {
    return await pending;
  } finally {
    // Only clear if still ours: resetSession() (or a newer call) may have
    // already replaced inFlight, and we must not clobber that newer state.
    if (inFlight === pending) {
      inFlight = null;
    }
  }
};

/**
 * Re-arms the fire-once attribution resolution. The next call to
 * resolveAppLaunch() will perform a fresh network resolution.
 *
 * Designed for: explicit logout/reinstall flows, QA, and testing.
 */
export const resetSession = async (config?: Config): Promise<void> => {
  // Bump the generation token FIRST, synchronously and before any await, so any
  // resolution already in flight is invalidated the instant the reset begins.
  generation += 1;

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
