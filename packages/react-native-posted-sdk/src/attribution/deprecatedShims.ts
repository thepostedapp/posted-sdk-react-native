/**
 * Deprecated public-API shims — 3.0.0 one-cycle bridge.
 *
 * Every method here forwards to resolveAppLaunch() and emits a runtime
 * deprecation warning. They will be removed in the next major version.
 * See design §6 (POS-113) for the migration map.
 */

import type { Config, PostedResult } from "../links/types";
import { resolveAppLaunch } from "./resolveAppLaunch";

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in a future major version.
 */
export const resolveInitialLink = async (config: Config): Promise<PostedResult> => {
  console.warn(
    "🔗[Posted:DEPRECATED] resolveInitialLink() is deprecated and will be removed in a future major version. " +
      "Migrate to resolveAppLaunch().",
  );
  return resolveAppLaunch(config);
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in a future major version.
 * The url argument is accepted for backwards-compatibility but ignored — the facade
 * detects the launch URL internally via Linking.getInitialURL().
 */
export const processLink = async (config: Config, _url?: string): Promise<PostedResult> => {
  console.warn(
    "🔗[Posted:DEPRECATED] processLink() is deprecated and will be removed in a future major version. " +
      "Migrate to resolveAppLaunch().",
  );
  return resolveAppLaunch(config);
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in a future major version.
 * This previously triggered the deferred/fingerprint branch directly. resolveAppLaunch()
 * now selects the correct branch automatically and caches the result fire-once.
 */
export const getDeferredLink = async (config: Config): Promise<PostedResult> => {
  console.warn(
    "🔗[Posted:DEPRECATED] getDeferredLink() is deprecated and will be removed in a future major version. " +
      "Migrate to resolveAppLaunch().",
  );
  return resolveAppLaunch(config);
};

/**
 * @deprecated Use resolveAppLaunch() instead. Will be removed in a future major version.
 * Short-link resolution is now handled internally within the link-present branch of
 * resolveAppLaunch(). The url argument is ignored.
 */
export const resolveShortLink = async (config: Config, _url?: string): Promise<PostedResult> => {
  console.warn(
    "🔗[Posted:DEPRECATED] resolveShortLink() is deprecated and will be removed in a future major version. " +
      "Migrate to resolveAppLaunch().",
  );
  return resolveAppLaunch(config);
};
