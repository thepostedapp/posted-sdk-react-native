import { type Config, PostedProvider } from "@posted-sdk/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Screen } from "./Screen";

const config: Config = {
  apiKey: process.env.EXPO_PUBLIC_POSTED_API_KEY!,
  appID: process.env.EXPO_PUBLIC_POSTED_APP_ID!,
  shouldUseClipboard: true,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PostedProvider config={config}>
        <Screen />
      </PostedProvider>
    </SafeAreaProvider>
  );
}
