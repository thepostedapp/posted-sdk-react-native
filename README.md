<img src="https://github.com/user-attachments/assets/c965b51b-7307-477a-8d22-9c9cd6da6231" alt="posted-sdk React Native" width="100%"/>

# posted-sdk React Native

posted-sdk React Native (`@posted-sdk/react-native`) is an SDK for handling deferred deep links in React Native. A deferred link works like a regular deep link, but survives the App Store or Play Store install — a user who clicks a link before having the app installed is redirected to the right screen on first launch. The SDK also handles Universal/App links and custom scheme links in a single unified API.

## Quick links

- Documentation: [https://postedapp.com/docs/](https://postedapp.com/docs/) <!-- TODO(B6): update when new docs URL is live -->
- Installation guide: [https://postedapp.com/docs/sdk/react-native/sdk-installation](https://postedapp.com/docs/sdk/react-native/sdk-installation) <!-- TODO(B6): update when new docs URL is live -->

## Create an account

You need a posted-sdk account to generate app credentials and configure your links.

<!-- TODO(B3): update sign-up URL once new backend domain is live -->

## Installation

### Package

Install the SDK:

```sh
npm install @posted-sdk/react-native
```

### Additional dependencies

Install required peer dependencies:

```sh
npm install expo-localization expo-clipboard expo-constants @react-native-async-storage/async-storage expo-application
# Pick ONE of the device-info providers:
npm install expo-device
# – or –
npm install react-native-device-info
```

> You can override the default persistent storage (`@react-native-async-storage/async-storage`) by providing an alternative storage implementation via the `storage` config option.
>
> For device info, install either `expo-device` or `react-native-device-info` — at least one is required. If your project already uses one of them, no extra installation is needed.

### Bare React Native CLI (without Expo)

The SDK's peer dependencies are Expo Modules (they ship native code). In a bare React Native CLI project, add Expo Modules once and point Metro at `expo/metro-config`:

```sh
npx install-expo-modules@latest
npx expo install --fix
```

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { mergeConfig } = require("@react-native/metro-config");

module.exports = mergeConfig(getDefaultConfig(__dirname), {});
```

Then rebuild — `PostedProvider` and the hooks work exactly as in the Expo examples.

## Usage

Mount `PostedProvider` at the root of your app and configure it with your credentials. How you consume the resolved link depends on your navigation library.

> The SDK is a no-op on Expo Web — `PostedProvider` mounts but link processing is skipped and `isLinkProcessed` resolves immediately to `true`.

### Expo Router

Wrap your root layout with `PostedProvider`, then use the `usePostedContext` hook to read the resolved link and drive navigation. If your app uses Expo Router's `+native-intent.tsx` to handle Universal/App links, import `createPostedNativeIntentHandler` from `@posted-sdk/react-native/expo-router` and set `linkProcessingMode: 'deferred-only'` — the SDK will only handle deferred links and let the native intent handler take care of the rest. See [`examples/expo-router-native-intent`](./examples/expo-router-native-intent) for a working setup.

<details>
<summary>Expo Router example</summary>

```tsx
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { type Config, PostedProvider, usePostedContext } from "@posted-sdk/react-native";

SplashScreen.preventAutoHideAsync();

const config: Config = {
  apiKey: "<REPLACE_WITH_YOUR_API_KEY>",
  appID: "<REPLACE_WITH_APP_ID_FROM_PLATFORM>",
};

export default function RootLayout() {
  return (
    <PostedProvider config={config}>
      <RootNavigator />
    </PostedProvider>
  );
}

function RootNavigator() {
  const { isLinkProcessed, link, clearLink } = usePostedContext();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLinkProcessed) {
      SplashScreen.hide();
    }
  }, [isLinkProcessed]);

  useEffect(() => {
    if (!isLinkProcessed || !link) return;
    if (pathname !== link.pathname) {
      router.replace({ pathname: link.pathname, params: link.params });
      return;
    }
    clearLink();
  }, [clearLink, isLinkProcessed, link, pathname, router]);

  if (!isLinkProcessed) {
    return null;
  }

  return <Stack />;
}
```

</details>

### React Navigation

#### v2.3.0 and later

Pass the SDK's linking adapter to `NavigationContainer`. React Navigation will handle routing automatically — `usePostedContext` is not needed for basic usage. The splash screen is hidden via `onReady`, which fires after `getInitialURL` resolves.

<details>
<summary>React Navigation example</summary>

```tsx
import * as SplashScreen from "expo-splash-screen";

import { NavigationContainer } from "@react-navigation/native";

import {
  type Config,
  POSTED_LINKING_PREFIX,
  Posted,
  PostedProvider,
} from "@posted-sdk/react-native";

SplashScreen.preventAutoHideAsync();

const config: Config = {
  apiKey: "<REPLACE_WITH_YOUR_API_KEY>",
  appID: "<REPLACE_WITH_APP_ID_FROM_PLATFORM>",
};

const linking = {
  prefixes: [POSTED_LINKING_PREFIX],
  async getInitialURL() {
    return await Posted.getInitialURL();
  },
  subscribe(listener) {
    const subscription = Posted.addEventListener("url", ({ url }) => {
      listener(url);
    });
    return () => subscription.remove();
  },
};

export function App() {
  return (
    <PostedProvider config={config}>
      <NavigationContainer linking={linking} onReady={() => SplashScreen.hideAsync()}>
        <Navigation />
      </NavigationContainer>
    </PostedProvider>
  );
}
```

</details>

#### Before v2.3.0

Use `usePostedContext` and call your navigator imperatively, the same way as the [Expo Router approach](#expo-router) above.

#### Auth-gated apps

The adapter appends `fromDeepLink=true` and `linkType` query params to every URL it emits — you will see these in your route params.

For auth-gated apps, let React Navigation hold the deep link until the right screen is reachable.
Render screens conditionally on auth/onboarding state and opt in to React Navigation's pending-link
behavior on the navigator:

<details>
<summary>Auth-gated navigator example</summary>

```tsx
<Stack.Navigator UNSTABLE_routeNamesChangeBehavior="lastUnhandled">
  {isSignedIn ? (
    isOnboardingCompleted ? (
      <>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Details" component={Details} />
      </>
    ) : (
      <Stack.Screen name="Onboarding" component={Onboarding} />
    )
  ) : (
    <Stack.Screen name="SignIn" component={SignIn} />
  )}
</Stack.Navigator>
```

</details>

A deep link that arrives while the user is signed-out is parsed, found unreachable, and remembered. When the rendered screen set changes after sign-in or onboarding, React Navigation retries and lands the user on the target. See [`examples/react-navigation-advanced`](./examples/react-navigation-advanced) for a working setup.

See the [React Navigation deep linking docs](https://reactnavigation.org/docs/deep-linking?config=static#integrating-with-other-tools).

### Controlling which links the SDK processes

Use `linkProcessingMode` to control which link sources the SDK listens to:

| Value             | Universal/App links | Deferred links | Custom scheme links |
| ----------------- | ------------------- | -------------- | ------------------- |
| `'all'` (default) | ✅                  | ✅             | ✅                  |
| `'web-only'`      | ✅                  | ✅             | ❌                  |
| `'deferred-only'` | ❌                  | ✅             | ❌                  |

<details>
<summary>linkProcessingMode config example</summary>

```ts
const config: Config = {
  apiKey: "<REPLACE_WITH_YOUR_API_KEY>",
  appID: "<REPLACE_WITH_APP_ID_FROM_PLATFORM>",
  // Process Universal/App links and deferred links, but let your own
  // navigation layer handle custom scheme links (e.g. myapp://...).
  linkProcessingMode: "web-only",
};
```

</details>

Use `'deferred-only'` when Expo Router's `+native-intent.tsx` handler is already resolving runtime Universal/App links — this prevents double-processing.

### Clearing handled links

If your app redirects based on `link` (especially in entry screens), call `clearLink()` after handling the route. This prevents repeated redirects when the user returns to the same screen.

## Analytics

The SDK includes a built-in analytics module. `PostedProvider` automatically tracks app opens for retention. You can also log custom events using the predefined `PostedEventNames` enum:

<details>
<summary>Analytics example</summary>

```ts
import { PostedAnalytics, PostedEventNames } from "@posted-sdk/react-native";

PostedAnalytics.logEvent(PostedEventNames.Purchase);
PostedAnalytics.logRetention("week_1");
```

</details>

## Examples

All example apps with the SDK integrated live in `examples/`:

| Example                              | Description                                                    |
| ------------------------------------ | -------------------------------------------------------------- |
| `examples/expo-router`               | Minimal Expo Router example (recommended starting point)       |
| `examples/expo-router-native-intent` | Expo Router with `+native-intent` handler                      |
| `examples/expo-router-advanced`      | Expo Router with auth flow and custom native-intent            |
| `examples/expo-bare`                 | Expo without file-based routing (plain `index.js` entry point) |
| `examples/react-navigation`          | Minimal React Navigation example                               |
| `examples/react-navigation-advanced` | React Navigation with auth + onboarding gated deep linking     |

The monorepo uses **pnpm workspaces**. Start by installing all dependencies from the repo root:

```sh
pnpm install
```

Then run an example using the root-level shorthand scripts:

```sh
pnpm examples:expo-router ios
pnpm examples:expo-router android
pnpm examples:expo-router-native-intent ios
pnpm examples:expo-router-advanced ios
pnpm examples:expo-bare ios
pnpm examples:react-navigation ios
pnpm examples:react-navigation-advanced ios
```

These are aliases for `pnpm --filter <package-name> <script>`. You can also target examples directly using the workspace filter flag:

```sh
pnpm --filter @posted-sdk/react-native-expo-router ios
```

Or navigate into an example and run scripts there:

```sh
cd examples/expo-router
pnpm ios
pnpm android
```

> Running `pnpm ios` / `pnpm android` produces a development build. This is recommended over Expo Go for testing deep linking flows on a real device.

## Types

The package exposes several types to help you with type-checking in your own codebase.

### Config

This type is used to define the configuration object you pass to `PostedProvider`.

<details>
<summary>Config type</summary>

```ts
export type Config = {
  /**
   * Your application ID from the posted-sdk dashboard.
   */
  appID: string;

  /**
   * Your API key from the posted-sdk dashboard.
   */
  apiKey: string;

  /**
   * Optional: A flag to determine if the provider should check the clipboard for a deferred link.
   * Note: This feature is iOS-only. On Android, the SDK uses the install referrer for deterministic
   * link matching instead; clipboard is never accessed regardless of this setting.
   * When enabled on iOS, it may display a permission alert to the user.
   * Defaults to true if not provided.
   */
  shouldUseClipboard?: boolean;

  /**
   * Optional: Controls which link sources are handled by the SDK.
   * - 'all': deferred links + Universal/App links + custom scheme links (default)
   * - 'web-only': deferred links + Universal/App links, but NOT custom scheme links
   * - 'deferred-only': only deferred links (use when native-intent already handles runtime links)
   * Defaults to 'all'.
   */
  linkProcessingMode?: "all" | "web-only" | "deferred-only";

  /**
   * Optional: A custom storage adapter. Defaults to AsyncStorage if not provided.
   */
  storage?: PostedStorage;
};
```

</details>

### PostedContextType

This type represents the object returned by the `usePostedContext` hook, containing the resolved link and its processing status.

<details>
<summary>PostedContextType type</summary>

```ts
export type PostedContextType = {
  /**
   * Boolean indicating if the initial link (deferred, Universal/App Link, or scheme) has been processed.
   * Use this to gate navigation or hide the splash screen.
   */
  isLinkProcessed: boolean;

  /**
   * The resolved link object, or null if no link was found.
   */
  link: PostedLink;

  /**
   * Resets the link to null. Call this after you handle a link.
   */
  clearLink: () => void;
};
```

</details>

### PostedLink

The resolved link object, or null if no link was found.

<details>
<summary>PostedLink type</summary>

```ts
export type PostedLink = {
  /** The original link URL as received by the SDK. */
  url: string | URL;

  /** Full route path including query string (e.g. '/details/42?campaign=summer'). */
  route: string;

  /** Route path without query string (e.g. '/details/42'). */
  pathname: string;

  /** Parsed query parameters (e.g. { campaign: 'summer' }). */
  params: Record<string, string>;

  /**
   * The type of the detected link:
   * - 'deferred': resolved from the posted-sdk API on first app install
   * - 'verified': Universal Link (iOS) or App Link (Android)
   * - 'scheme': custom scheme deep link (only when linkProcessingMode is 'all')
   */
  type: LinkType;
} | null;
```

</details>

### React Navigation adapter types

`PostedUrlEvent` carries both the React Navigation Linking mirror `url` (unchanged —
existing `({ url }) => ...` consumers keep working as-is) and the parsed attribution
`link`, matching the canonical continuous-event payload contract shared across posted-sdk
platforms. `link` is `null` when the incoming URL isn't an attributable posted link.

<details>
<summary>React Navigation adapter types</summary>

```ts
export const POSTED_LINKING_PREFIX: string; // "posted://"

export type PostedUrlEvent = {
  /** The React Navigation Linking mirror URL — unchanged for existing consumers. */
  url: string;
  /** The parsed attribution link (route/pathname/params/type), or null if not attributable. */
  link: PostedLink;
};

export type PostedUrlSubscription = {
  remove: () => void;
};
```

```ts
Posted.getInitialURL(): Promise<string | undefined>
Posted.addEventListener("url", (event: PostedUrlEvent) => void): PostedUrlSubscription
```

</details>

<details>
<summary>Reading the parsed link from the "url" event</summary>

```ts
const subscription = Posted.addEventListener("url", ({ url, link }) => {
  // `url` still drives the React Navigation Linking mirror as before.
  listener(url);

  // `link` gives you the parsed attribution data directly, without re-parsing `url`.
  if (link) {
    console.log(link.route, link.pathname, link.params, link.type);
  }
});
```

</details>

### Continuous deep-link stream (cross-platform surface)

The **continuous deep-link stream** delivers every link the app receives while it is running (warm links). It is a **separate feature from fire-once install attribution**: `resolveAppLaunch` resolves the single deferred/deep link responsible for the install exactly once (cached thereafter), whereas the continuous stream is unrelated to attribution and emits on every warm link for the life of the process. Use `resolveAppLaunch` for attribution; use the stream (or the native warm-link path below) for ongoing in-session navigation.

The stream is an idiomatic convenience exposed **only on the JS/Dart wrappers**, which already sit on top of a framework-level URL event bus (React Native `Linking`, Flutter `EventChannel`). Native iOS/Android apps deliver warm links through platform lifecycle hooks instead — this divergence is **intentional, not a gap**.

| Platform                | Continuous stream API                                       | Status                                                 | Warm-link path                                                                                               |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Flutter (`PostedSdk`)   | `Stream<PostedResult> get linkStream`                       | ✅ present, non-deprecated (EventChannel-backed)       | via `linkStream`                                                                                             |
| React Native (`Posted`) | `addEventListener("url", listener) → PostedUrlSubscription` | ✅ present, non-deprecated (mirrors RN core `Linking`) | via `addEventListener`                                                                                       |
| Android (`Posted`)      | — none (intentional) —                                      | ➖ not offered                                         | `PostedDelegate.onNewIntent(intent)` → `resolveAppLaunch()`                                                  |
| iOS (`Posted`)          | — none (intentional) —                                      | ➖ not offered                                         | Scene/App URL handling (`scene(_:willConnectTo:)`, `openURL`, `continueUserActivity`) → `resolveAppLaunch()` |

**Fire-once vs continuous** — `resolveAppLaunch` fires once per install and returns the attribution result; the continuous stream never participates in attribution and fires on every warm link.

## Deprecated link methods → `resolveAppLaunch`

The imperative link-resolution methods are consolidated into a single attribution-first
call. `resolveInitialLink` / `processLink` / `getDeferredLink` / `resolveShortLink` are
`@deprecated` aliases that forward to `resolveAppLaunch(config)`. The `url?` argument
on `processLink` / `resolveShortLink` is **ignored** — the facade detects the launch URL
internally via `Linking.getInitialURL()` and there is no explicit-URL override on React
Native.

| Deprecated method                | Use instead                |
| -------------------------------- | -------------------------- |
| `resolveInitialLink(config)`     | `resolveAppLaunch(config)` |
| `processLink(config, url?)`      | `resolveAppLaunch(config)` |
| `getDeferredLink(config)`        | `resolveAppLaunch(config)` |
| `resolveShortLink(config, url?)` | `resolveAppLaunch(config)` |

## Other posted-sdk SDKs

posted-sdk is also available for other app stacks:

- Android SDK: [https://github.com/thepostedapp/posted-sdk-android](https://github.com/thepostedapp/posted-sdk-android)
- iOS SDK: [https://github.com/thepostedapp/posted-sdk-ios](https://github.com/thepostedapp/posted-sdk-ios)
- Flutter SDK: [https://github.com/thepostedapp/posted-sdk-flutter](https://github.com/thepostedapp/posted-sdk-flutter)

---

## License

This library is licensed under [The MIT License](./LICENSE).
