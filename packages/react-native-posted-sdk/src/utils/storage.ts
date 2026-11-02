import type { PostedStorage } from "../types";

// Key names are persisted on existing installs — never rename them.
const STORAGE_KEY_PREFIX = "Posted_";
const DEVICE_ID = `${STORAGE_KEY_PREFIX}deviceId`;
const INSTALL_REPORTED_FLAG = `${STORAGE_KEY_PREFIX}installReported`;

export enum StorageKeys {
  DEVICE_ID_KEY = DEVICE_ID,
  INSTALL_REPORTED_FLAG_KEY = INSTALL_REPORTED_FLAG,
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
