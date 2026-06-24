import { useEffect, useMemo } from "react";

import { Text, View } from "react-native";

import * as SplashScreen from "expo-splash-screen";

import {
  type Config,
  POSTED_LINKING_PREFIX,
  Posted,
  PostedProvider,
} from "@posted-sdk/react-native";
import { type LinkingOptions, NavigationContainer } from "@react-navigation/native";

import { Navigation, type RootStackParamList, linkingConfig } from "./navigation";
import { styles } from "./styles";

const hasCredentials =
  !!process.env.EXPO_PUBLIC_POSTED_API_KEY && !!process.env.EXPO_PUBLIC_POSTED_APP_ID;

const SetupRequired = () => {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Setup Required</Text>
        <Text style={styles.subtitle}>
          Copy <Text style={styles.accent}>.env.example</Text> to{" "}
          <Text style={styles.accent}>.env</Text> and add your posted-sdk credentials from the panel
          before running this example.
        </Text>
        <View style={styles.divider} />
        <Text style={styles.code}>EXPO_PUBLIC_POSTED_API_KEY=...</Text>
        <Text style={styles.code}>EXPO_PUBLIC_POSTED_APP_ID=...</Text>
      </View>
    </View>
  );
};

const postedConfig: Config = {
  apiKey: process.env.EXPO_PUBLIC_POSTED_API_KEY!,
  appID: process.env.EXPO_PUBLIC_POSTED_APP_ID!,
  shouldUseClipboard: true,
};

SplashScreen.preventAutoHideAsync();

const AppNavigator = () => {
  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: [POSTED_LINKING_PREFIX],
      config: linkingConfig,
      async getInitialURL() {
        return await Posted.getInitialURL();
      },
      subscribe(listener) {
        const subscription = Posted.addEventListener("url", ({ url }) => {
          listener(url);
        });

        return () => subscription.remove();
      },
    }),
    [],
  );

  return (
    <NavigationContainer
      linking={linking}
      // Initial state waits for Posted.getInitialURL(), so onReady means deep-link state is resolved.
      onReady={() => SplashScreen.hideAsync()}
    >
      <Navigation />
    </NavigationContainer>
  );
};

export function App() {
  if (!hasCredentials) {
    return <SetupRequired />;
  }

  return (
    <PostedProvider config={postedConfig}>
      <AppNavigator />
    </PostedProvider>
  );
}
