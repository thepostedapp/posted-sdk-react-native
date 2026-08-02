export { PostedProvider, usePostedContext } from "./PostedContext";
export { POSTED_LINKING_PREFIX, Posted } from "./reactNavigation";

export { configure } from "./attribution/configure";
export { resolveAppLaunch, resetSession } from "./attribution/resolveAppLaunch";

// @deprecated Use resolveAppLaunch() instead. Will be removed in 4.0.0.
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
