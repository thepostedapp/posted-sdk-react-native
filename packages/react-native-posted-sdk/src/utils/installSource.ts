import { NativeModules } from "react-native";

import { expoConstants } from "./optionalModules";

export type InstallSource = "store" | "development";

/**
 * Whether this build came from the App Store / Google Play. Null when the
 * native module isn't linked, e.g. new JS shipped over the air to an older binary.
 */
export const getInstallSource = (): InstallSource | null => {
  if (__DEV__ || expoConstants?.executionEnvironment === "storeClient") return "development";
  const source: unknown = NativeModules?.PostedSdk?.installSource;
  return source === "store" || source === "development" ? source : null;
};
