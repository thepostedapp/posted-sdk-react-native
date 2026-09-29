import type { PostedUrlEvent, PostedUrlSubscription } from "./links/types/index";
import {
  POSTED_LINKING_PREFIX,
  addReactNavigationEventListener,
  getReactNavigationInitialUrl,
} from "./links/utils/reactNavigation";

export type { PostedUrlEvent, PostedUrlSubscription };

type PostedReactNavigationApi = {
  getInitialURL: () => Promise<string | undefined>;
  addEventListener: (
    event: "url",
    listener: (event: PostedUrlEvent) => void,
  ) => PostedUrlSubscription;
};

export const Posted: PostedReactNavigationApi = {
  getInitialURL: getReactNavigationInitialUrl,
  addEventListener: addReactNavigationEventListener,
};

export { POSTED_LINKING_PREFIX };
