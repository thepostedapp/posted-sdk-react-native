export type Config = {
  appID: string;
  apiKey: string;
  /** Defaults to `@react-native-async-storage/async-storage` when installed. */
  storage?: PostedStorage;
};

export interface PostedStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}
