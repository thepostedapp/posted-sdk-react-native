import type { PostedStorage } from "../types";

const STORAGE_KEY_PREFIX = "Posted_";
const FIRST_ENTRANCE_FLAG = `${STORAGE_KEY_PREFIX}firstEntranceFlag`;
const DEVICE_ID = `${STORAGE_KEY_PREFIX}deviceId`;
const ATTRIBUTION_RESOLVED_FLAG = `${STORAGE_KEY_PREFIX}attributionResolved`;
const ATTRIBUTION_CACHED_RESULT = `${STORAGE_KEY_PREFIX}attributionResult`;

export enum StorageKeys {
  FIRST_ENTRANCE_FLAG_KEY = FIRST_ENTRANCE_FLAG,
  DEVICE_ID_KEY = DEVICE_ID,
  ATTRIBUTION_RESOLVED_FLAG_KEY = ATTRIBUTION_RESOLVED_FLAG,
  ATTRIBUTION_CACHED_RESULT_KEY = ATTRIBUTION_CACHED_RESULT,
}

let DefaultAsyncStorage: PostedStorage | null = null;

try {
  const storageModule = require("@react-native-async-storage/async-storage");

  DefaultAsyncStorage = storageModule.default || storageModule;
} catch (e) {
  DefaultAsyncStorage = null;
}

export const resolveStorage = (userStorage?: PostedStorage): PostedStorage => {
  if (userStorage) {
    return userStorage;
  }

  if (DefaultAsyncStorage) {
    return DefaultAsyncStorage;
  }
  throw new Error(
    "🔗[Posted] No storage implementation provided.\n" +
      'Please install "@react-native-async-storage/async-storage" OR pass a custom "storage" in the config',
  );
};
