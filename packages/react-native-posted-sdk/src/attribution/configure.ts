import type { Config, RequiredConfig } from "../links/types";
import { resolveStorage } from "../links/utils/storage";

let globalConfig: RequiredConfig | null = null;

/**
 * Initializes the SDK with the given config. Must be called before
 * resolveAppLaunch() / resetSession() when those are used without
 * an explicit config argument.
 */
export const configure = (config: Config): void => {
  globalConfig = {
    apiKey: config.apiKey,
    appID: config.appID,
    shouldUseClipboard: config.shouldUseClipboard ?? true,
    storage: resolveStorage(config.storage),
    linkProcessingMode: config.linkProcessingMode ?? "all",
  };
};

export const getGlobalConfig = (): RequiredConfig | null => globalConfig;

export const clearGlobalConfig = (): void => {
  globalConfig = null;
};
