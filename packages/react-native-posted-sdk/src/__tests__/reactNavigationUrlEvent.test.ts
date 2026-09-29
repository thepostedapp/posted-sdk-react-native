/**
 * PostedUrlEvent.link parity — POS-504
 *
 * Verifies the "url" event emitted via Posted.addEventListener carries the parsed
 * PostedLink alongside the existing React Navigation Linking mirror `url`, matching
 * the canonical continuous-event payload contract (POS-503):
 *   - matched posted link → event.link carries route/pathname/params/type
 *   - non-attributable URL → event.link === null while event.url is still delivered
 *   - existing event.url consumers see no change (regression)
 */
import type { PostedLink, PostedUrlEvent } from "../links/types";
import {
  POSTED_LINKING_PREFIX,
  addReactNavigationEventListener,
  markReactNavigationInitialUrlProcessed,
  notifyReactNavigationUnmatchedUrl,
  notifyReactNavigationUrl,
} from "../links/utils/reactNavigation";

describe("PostedUrlEvent — link parity", () => {
  // The cold-start getInitialURL() buffer only holds the very first notification;
  // flushing it once up front puts the module in its steady-state "live listener" mode
  // for every test below, matching how a mounted app behaves after initial processing.
  beforeAll(() => {
    markReactNavigationInitialUrlProcessed();
  });

  function captureEvents() {
    const events: PostedUrlEvent[] = [];
    const subscription = addReactNavigationEventListener("url", (event) => {
      events.push(event);
    });
    return { events, subscription };
  }

  it("matched posted link: event.link carries route/pathname/params/type; event.url is the Linking mirror URL (regression)", () => {
    const { events, subscription } = captureEvents();

    const link: Exclude<PostedLink, null> = {
      url: "https://l.postedapp.com/details/42?campaign=summer",
      route: "/details/42?campaign=summer",
      pathname: "/details/42",
      params: { campaign: "summer" },
      type: "verified",
    };

    notifyReactNavigationUrl(link);

    expect(events).toHaveLength(1);
    expect(events[0]!.url).toBe(
      `${POSTED_LINKING_PREFIX}details/42?campaign=summer&fromDeepLink=true&linkType=verified`,
    );
    expect(events[0]!.link).toEqual(link);

    subscription.remove();
  });

  it("non-attributable URL: event.link is null while event.url still delivers the raw incoming URL", () => {
    const { events, subscription } = captureEvents();

    notifyReactNavigationUnmatchedUrl("https://example.com/not-a-posted-link");

    expect(events).toHaveLength(1);
    expect(events[0]!.url).toBe("https://example.com/not-a-posted-link");
    expect(events[0]!.link).toBeNull();

    subscription.remove();
  });
});
