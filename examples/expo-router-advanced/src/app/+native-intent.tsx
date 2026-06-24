import { createPostedNativeIntentHandler } from "@posted-sdk/react-native/expo-router";

// Used only for runtime links. Cold-start links are handled by the SDK via
// Linking.getInitialURL() — the splash screen covers that async wait.
const postedHandler = createPostedNativeIntentHandler({
  // TODO(B4): update host pattern to new short-link domain once confirmed.
  hosts: [/\.godetour\.link$/i],
  fallbackPath: "/",
});

export async function redirectSystemPath(args: { path: string; initial: boolean }) {
  const postedResult = await postedHandler(args);
  if (postedResult !== args.path) {
    return postedResult;
  }

  // fallbackPath only applies to Posted host matches. Any other URL-like
  // path here (custom scheme such as myapp://details) would otherwise be passed through to Expo Router,
  // which would try to route to it and paint +not-found before
  // usePostedGate can react to link/auth state. Send it to "/" instead so
  // the SDK-resolved link in usePostedContext() drives navigation.
  if (args.path.includes("://") || args.path.startsWith("//")) {
    return "/";
  }

  return args.path;
}
