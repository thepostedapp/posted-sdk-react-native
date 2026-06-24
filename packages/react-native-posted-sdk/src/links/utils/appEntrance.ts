import type { PostedStorage } from "../types";
import { StorageKeys } from "./storage";

export const markFirstEntrance = async (storage: PostedStorage) => {
  await storage.setItem(StorageKeys.FIRST_ENTRANCE_FLAG_KEY, "true");
};

export const checkIsFirstEntrance = async (storage: PostedStorage) => {
  const hasAlreadyEnteredFlag = await storage.getItem(StorageKeys.FIRST_ENTRANCE_FLAG_KEY);

  return hasAlreadyEnteredFlag === null || hasAlreadyEnteredFlag === "false";
};
