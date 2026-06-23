import { useEffect, useMemo } from "react";

import { Text, View } from "react-native";

import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";

import { type LinkingOptions, NavigationContainer } from "@react-navigation/native";

import {
  type Config,
  POSTED_LINKING_PREFIX,
  Posted,
  PostedProvider,
} from "@posted-sdk/react-native";

import { AuthProvider } from "./auth";
import { Navigation, type RootStackParamList, linkingConfig } from "./navigation";
import { colors, styles } from "./styles";

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

export const postedConfig: Config = {
  apiKey: process.env.EXPO_PUBLIC_POSTED_API_KEY!,
  appID: process.env.EXPO_PUBLIC_POSTED_APP_ID!,
  shouldUseClipboard: true,
};

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(colors.background);

const AppRoot = () => {
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
      onReady={() => SplashScreen.hideAsync()}
      theme={{
        dark: true,
        colors: {
          primary: colors.accent,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "900" },
        },
      }}
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
    <AuthProvider>
      <PostedProvider config={postedConfig}>
        <AppRoot />
      </PostedProvider>
    </AuthProvider>
  );
}
