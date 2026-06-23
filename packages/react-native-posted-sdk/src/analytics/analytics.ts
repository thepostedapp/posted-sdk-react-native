import { PostedEventNames } from "./types";
import { analyticsEmitter } from "./utils/analyticsEmitter";

export const logEvent = (eventName: PostedEventNames | `${PostedEventNames}`, data?: any) => {
  analyticsEmitter.emit({ eventName, data });
};

export const logRetention = (retentionEventName: string) => {
  analyticsEmitter.emit({ eventName: retentionEventName, isRetention: true });
};

export const PostedAnalytics = {
  logEvent,
  logRetention,
};
