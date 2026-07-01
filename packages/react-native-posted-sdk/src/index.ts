export { PostedProvider, usePostedContext } from "./PostedContext";
export { POSTED_LINKING_PREFIX, Posted } from "./reactNavigation";

export { configure } from "./attribution/configure";
export { resolveAppLaunch, resetSession } from "./attribution/resolveAppLaunch";

// @deprecated Use resolveAppLaunch() instead. Will be removed in a future major version.
export {
  resolveInitialLink,
  processLink,
  getDeferredLink,
  resolveShortLink,
} from "./attribution/deprecatedShims";

export type {
  Config,
  PostedContextType,
  PostedLink,
  PostedResult,
  PostedUrlEvent,
  PostedUrlSubscription,
  PostedStorage,
  LinkType,
} from "./links/types/index";

export { PostedAnalytics } from "./analytics/analytics";
export { PostedEventNames } from "./analytics/types/index";

// @deprecated Use PostedProvider instead. Will be removed in a future major version.
export { PostedProvider as DetourProvider } from "./PostedContext";
// @deprecated Use usePostedContext instead. Will be removed in a future major version.
export { usePostedContext as useDetourContext } from "./PostedContext";
// @deprecated Use POSTED_LINKING_PREFIX instead. Will be removed in a future major version.
export { POSTED_LINKING_PREFIX as DETOUR_LINKING_PREFIX } from "./reactNavigation";
// @deprecated Use Posted instead. Will be removed in a future major version.
export { Posted as Detour } from "./reactNavigation";
// @deprecated Use PostedAnalytics instead. Will be removed in a future major version.
export { PostedAnalytics as DetourAnalytics } from "./analytics/analytics";
// @deprecated Use PostedEventNames instead. Will be removed in a future major version.
export { PostedEventNames as DetourEventNames } from "./analytics/types/index";

export type {
  // @deprecated Use PostedContextType instead. Will be removed in a future major version.
  PostedContextType as DetourContextType,
  // @deprecated Use PostedLink instead. Will be removed in a future major version.
  PostedLink as DetourLink,
  // @deprecated Use PostedUrlEvent instead. Will be removed in a future major version.
  PostedUrlEvent as DetourUrlEvent,
  // @deprecated Use PostedUrlSubscription instead. Will be removed in a future major version.
  PostedUrlSubscription as DetourUrlSubscription,
  // @deprecated Use PostedStorage instead. Will be removed in a future major version.
  PostedStorage as DetourStorage,
} from "./links/types/index";
