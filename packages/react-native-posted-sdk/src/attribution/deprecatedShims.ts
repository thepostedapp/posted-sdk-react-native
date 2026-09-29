/**
 * Deprecated public-API shims — 3.0.0 one-cycle bridge.
 *
 * Every method here forwards to resolveAppLaunch() and emits a runtime
 * deprecation warning. They will be removed in the next major version.
 * See design §6 (POS-113) for the migration map.
 *
 * Deprecation warnings are de-duplicated per method: each notice fires at most
 * once per app session (POS-177), so hot-path callers keep the migration signal
 * without spamming the RN log. Wording follows the canonical cross-platform
 * template locked in POS-496: "[Posted] <method>() is deprecated and will be
 * removed in 4.0.0. Use resolveAppLaunch() instead."
 */
import type { Config, PostedResult } from "../links/types";
import { resolveAppLaunch } from "./resolveAppLaunch";

// Tracks which deprecated methods have already emitted their warning this
// session. Survives within a single JS runtime; cleared by
// resetDeprecationWarnings() for QA/testing.
const warnedMethods = new Set<string>();

/**
 * Emits `message` via console.warn at most once per `method` per app session.
 * Repeat invocations of the same method are silent.
 */
function warnOnce(method: string, message: string): void {
  if (warnedMethods.has(method)) return;
  warnedMethods.add(method);
  console.warn(message);
}

/**
 * Re-arms the once-per-session deprecation warnings so every shim will warn
 * again on its next invocation.
 *
 * Designed for: QA and testing.
 */
export const resetDeprecationWarnings = (): void => {
  warnedMethods.clear();
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in 4.0.0.
 */
export const resolveInitialLink = async (config: Config): Promise<PostedResult> => {
  warnOnce(
    "resolveInitialLink",
    "[Posted] resolveInitialLink() is deprecated and will be removed in 4.0.0. Use resolveAppLaunch() instead.",
  );
  return resolveAppLaunch(config);
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in 4.0.0.
 * The url argument is accepted for backwards-compatibility but ignored — the facade
 * detects the launch URL internally via Linking.getInitialURL().
 */
export const processLink = async (config: Config, _url?: string): Promise<PostedResult> => {
  warnOnce(
    "processLink",
    "[Posted] processLink() is deprecated and will be removed in 4.0.0. Use resolveAppLaunch() instead.",
  );
  return resolveAppLaunch(config);
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in 4.0.0.
 * This previously triggered the deferred/fingerprint branch directly. resolveAppLaunch()
 * now selects the correct branch automatically and caches the result fire-once.
 */
export const getDeferredLink = async (config: Config): Promise<PostedResult> => {
  warnOnce(
    "getDeferredLink",
    "[Posted] getDeferredLink() is deprecated and will be removed in 4.0.0. Use resolveAppLaunch() instead.",
  );
  return resolveAppLaunch(config);
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in 4.0.0.
 * Short-link resolution is now handled internally within the link-present branch of
 * resolveAppLaunch(). The url argument is ignored.
 */
export const resolveShortLink = async (config: Config, _url?: string): Promise<PostedResult> => {
  warnOnce(
    "resolveShortLink",
    "[Posted] resolveShortLink() is deprecated and will be removed in 4.0.0. Use resolveAppLaunch() instead.",
  );
  return resolveAppLaunch(config);
};
