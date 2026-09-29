import { type PropsWithChildren, createContext, useContext, useEffect } from "react";

import { Platform } from "react-native";

import { sendEvent } from "./analytics/api/events";
import { sendRetentionEvent } from "./analytics/api/retention";
import { useAppOpenRetention } from "./analytics/hooks/useAppOpenRetention";
import type { PostedEvent, PostedEventNames } from "./analytics/types";
import { analyticsEmitter } from "./analytics/utils/analyticsEmitter";
import { prepareDeviceIdForApi } from "./analytics/utils/devicePersistence";
import { usePosted } from "./links/hooks/usePosted";
import type { Config, PostedContextType } from "./links/types";
import { resolveStorage } from "./links/utils/storage";

type Props = PropsWithChildren & { config: Config };

const PostedContext = createContext<PostedContextType | undefined>(undefined);

let activeProviderCount = 0;
let hasWarnedUnsupportedWeb = false;

const NOOP_POSTED_CONTEXT: PostedContextType = {
  isLinkProcessed: true,
  link: null,
  clearLink: () => {},
};

const PostedProviderNative = ({ config, children }: Props) => {
  const {
    apiKey,
    appID,
    shouldUseClipboard = true,
    storage: userStorage,
    linkProcessingMode = "all",
  } = config;

  const storage = resolveStorage(userStorage);

  useEffect(() => {
    activeProviderCount++;

    const unsubscribe = analyticsEmitter.subscribe(async ({ eventName, data, isRetention }) => {
      if (activeProviderCount > 1) {
        if (__DEV__) {
          console.error(
            `🔗[Posted:ANALYTICS_ERROR] Event "${eventName}" dropped. ` +
              `Multiple PostedProviders (${activeProviderCount}) detected. ` +
              "Analytics logging is disabled until only one provider remains.",
          );
        }
        return;
      }

      try {
        const deviceId = await prepareDeviceIdForApi(storage);

        if (isRetention) {
          sendRetentionEvent({ apiKey, appID, eventName, deviceId });
        } else {
          const event: PostedEvent = {
            eventName: eventName as PostedEventNames,
            data,
          };
          sendEvent({
            apiKey,
            appID,
            event,
            deviceId,
          });
        }
      } catch (error) {
        console.error(
          "[Posted:ANALYTICS_ERROR] Analytics disabled due to storage/runtime failure:",
          error,
        );
      }
    });

    return () => {
      activeProviderCount--;
      unsubscribe();
    };
  }, [apiKey, appID, storage]);

  const value = usePosted({
    apiKey,
    appID,
    shouldUseClipboard,
    storage,
    linkProcessingMode,
  });
  useAppOpenRetention();

  return <PostedContext.Provider value={value}>{children}</PostedContext.Provider>;
};

export const PostedProvider = ({ config, children }: Props) => {
  if (Platform.OS === "web") {
    if (__DEV__ && !hasWarnedUnsupportedWeb) {
      console.warn(
        "🔗[Posted:WEB_UNSUPPORTED] PostedProvider is disabled on Expo Web. " +
          "SDK initialization is skipped on web and no links will be processed.",
      );
      hasWarnedUnsupportedWeb = true;
    }

    return <PostedContext.Provider value={NOOP_POSTED_CONTEXT}>{children}</PostedContext.Provider>;
  }

  return <PostedProviderNative config={config}>{children}</PostedProviderNative>;
};

export const usePostedContext = () => {
  const context = useContext(PostedContext);

  if (!context) {
    throw new Error(
      "🔗[Posted:RUNTIME_ERROR] usePostedContext must be used within a PostedProvider",
    );
  }

  return context;
};
