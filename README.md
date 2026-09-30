# posted-sdk React Native

posted-sdk React Native (`@posted-sdk/react-native`) is an SDK for handling deferred deep links in React Native. A deferred link works like a regular deep link, but survives the App Store or Play Store install — a user who clicks a link before having the app installed is redirected to the right screen on first launch. The SDK also handles Universal/App links and custom scheme links in a single unified API.

## Quick links

- **Getting-Started guide** (cross-platform golden path — create an app, install, verify): [GETTING-STARTED.md](https://github.com/thepostedapp/posted-sdk-admin/blob/main/GETTING-STARTED.md). This README is the full React Native reference.
- **API host**: `attr.postedapp.com` (the SDK targets this by default — you do not configure it). Deep links resolve via `l.postedapp.com`.
- **Troubleshooting**: [TROUBLESHOOTING.md](https://github.com/thepostedapp/posted-sdk-admin/blob/main/TROUBLESHOOTING.md)
- **Backend contract redoc**: not yet live <!-- TODO(POS-589): link once the contract redoc is hosted — Firebase Hosting activation is gated on the POS-312 D1/D2 DNS decision -->
- **Support**: see [Support](#support) below
- Documentation site: <!-- TODO(B6): update when new docs URL is live --> [https://postedapp.com/docs/](https://postedapp.com/docs/)

## Create account

You need a posted-sdk account to generate app credentials (`app_id` + API key) and configure your links. Follow [**Create an app & find your credentials**](https://github.com/thepostedapp/posted-sdk-admin/blob/main/README.md#create-an-app--find-your-credentials) in the dashboard README — it covers the full create-app flow and where each credential appears afterward.

## Install

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

## Quickstart

The fastest way to get attribution working: wrap your app in `PostedProvider` and read the resolved link via `usePostedContext` (see [Deep-link handling](#deep-link-handling) for navigation-library-specific wiring). If you don't need the provider/hook pattern, call `resolveAppLaunch()` directly instead.

### Minimal init (PostedProvider)

```tsx
import { type Config, PostedProvider } from "@posted-sdk/react-native";

const config: Config = {
  apiKey: "<YOUR_API_KEY>",
  appID: "<YOUR_APP_ID>",
};

export default function App() {
  return <PostedProvider config={config}>{/* your app content */}</PostedProvider>;
}
```

### Minimal `resolveAppLaunch()` call (no provider)

```ts
import { resolveAppLaunch } from "@posted-sdk/react-native";

const link = await resolveAppLaunch({
  apiKey: "<YOUR_API_KEY>",
  appID: "<YOUR_APP_ID>",
});

if (link) {
  // link is the attributed URL string — route to it however your app navigates.
}
```

See [resolveAppLaunch](#resolveapplaunch) below for fire-once semantics and `resetSession()`.

## Configure

Beyond `apiKey` and `appID`, `Config` accepts a few optional knobs:

- **`storage`** — override the default persistent storage (`@react-native-async-storage/async-storage`) with your own `PostedStorage` implementation.
- **`shouldUseClipboard`** — iOS-only clipboard check for deferred-link matching, defaults to `true`. Android always uses the install referrer instead; clipboard is never accessed there regardless of this setting.
- **`linkProcessingMode`** — controls which link sources the SDK listens to (`'all'` | `'web-only'` | `'deferred-only'`, default `'all'`). See [Deep-link handling](#controlling-which-links-the-sdk-processes) for the full behavior table.

See [Types → Config](#config) for the full type definition.

If threading a `config` object through every `resolveAppLaunch()` / `resetSession()` call is inconvenient, call `configure(config)` once at app startup instead:

```ts
import { configure, resolveAppLaunch } from "@posted-sdk/react-native";

configure({ apiKey: "<YOUR_API_KEY>", appID: "<YOUR_APP_ID>" });

// elsewhere, no config argument needed:
const link = await resolveAppLaunch();
```

## resolveAppLaunch

```ts
resolveAppLaunch(config?: Config): Promise<PostedResult> // PostedResult = string | null
```

The single unified cold-start attribution entry point. Detects the launch URL internally via `Linking.getInitialURL()` and dispatches to the link-present or deferred branch automatically — there is no explicit-URL override on React Native.

- **Fire-once per install**: the first call performs one network resolution and caches the result. It survives app restarts and app updates on the same install; subsequent calls make no network request.
- **Re-arms** on a reinstall (OS-cleared storage) or an explicit `resetSession()` call.
- Requires a `config` argument, or a prior `configure(config)` call (see [Configure](#configure)).

### resetSession

```ts
resetSession(config?: Config): Promise<void>
```

Re-arms the fire-once resolution so the next `resolveAppLaunch()` call performs a fresh network resolution. Designed for explicit logout/reinstall flows, QA, and testing.

`PostedProvider` / `usePostedContext` is a separate, parallel API surface for apps that want a parsed `PostedLink` object (route/pathname/params) driving navigation instead of the raw URL string — see [Deep-link handling](#deep-link-handling). Both surfaces resolve the same underlying attribution.

## Deep-link handling

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
  apiKey: "<YOUR_API_KEY>",
  appID: "<YOUR_APP_ID>",
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
  apiKey: "<YOUR_API_KEY>",
  appID: "<YOUR_APP_ID>",
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
  apiKey: "<YOUR_API_KEY>",
  appID: "<YOUR_APP_ID>",
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

## API Reference

Every public export, with a pointer to where it's documented in depth:

| Export                                                                                                                              | Kind                  | Docs                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `PostedProvider`                                                                                                                    | component             | [Deep-link handling](#deep-link-handling)                                                  |
| `usePostedContext`                                                                                                                  | hook                  | [Deep-link handling](#deep-link-handling), [Types → PostedContextType](#postedcontexttype) |
| `resolveAppLaunch(config?)`                                                                                                         | function              | [resolveAppLaunch](#resolveapplaunch)                                                      |
| `resetSession(config?)`                                                                                                             | function              | [resolveAppLaunch](#resolveapplaunch)                                                      |
| `configure(config)`                                                                                                                 | function              | [Configure](#configure)                                                                    |
| `PostedAnalytics.logEvent` / `PostedAnalytics.logRetention`                                                                         | function              | [Analytics](#analytics)                                                                    |
| `PostedEventNames`                                                                                                                  | enum                  | [Analytics](#analytics)                                                                    |
| `Posted.getInitialURL()` / `Posted.addEventListener("url", ...)`                                                                    | function              | [Types → React Navigation adapter types](#react-navigation-adapter-types)                  |
| `POSTED_LINKING_PREFIX`                                                                                                             | constant              | [Types → React Navigation adapter types](#react-navigation-adapter-types)                  |
| `Config`, `PostedContextType`, `PostedLink`, `PostedResult`, `PostedUrlEvent`, `PostedUrlSubscription`, `PostedStorage`, `LinkType` | types                 | [Types](#types)                                                                            |
| `resolveInitialLink` / `processLink` / `getDeferredLink` / `resolveShortLink`                                                       | function (deprecated) | [Migration](#migration)                                                                    |

## Errors/Troubleshooting

See the canonical [Troubleshooting & error-code reference](https://github.com/thepostedapp/posted-sdk-admin/blob/main/TROUBLESHOOTING.md) — 401s, no-match, deferred deep links not firing, iOS clipboard / Android install-referrer edge cases, and key rotation, each with cause → how to detect → fix.

## Migration

This package has never been published under a pre-rebrand name, so there is no external migration audience and no standalone `MIGRATION.md` — the table below is the complete migration guidance.

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

## Versioning/compatibility

- **SDK version**: `4.0.0` (aligned across iOS/Android/React Native/Flutter)
- **Backend contract**: v1.1.0, served from `attr.postedapp.com`
- **Min React Native**: `>=0.72` · **Min React**: `>=18` (see `peerDependencies` in [`package.json`](./packages/react-native-posted-sdk/package.json))
- **Cross-platform compatibility matrix**: [COMPATIBILITY.md](https://github.com/thepostedapp/posted-sdk-admin/blob/main/COMPATIBILITY.md)

## Example

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

## Support

- Found a bug or have a question specific to this SDK? [Open an issue](https://github.com/thepostedapp/posted-sdk-react-native/issues) on this repo.
- For contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Other posted-sdk SDKs

posted-sdk is also available for other app stacks:

- Android SDK: [https://github.com/thepostedapp/posted-sdk-android](https://github.com/thepostedapp/posted-sdk-android)
- iOS SDK: [https://github.com/thepostedapp/posted-sdk-ios](https://github.com/thepostedapp/posted-sdk-ios)
- Flutter SDK: [https://github.com/thepostedapp/posted-sdk-flutter](https://github.com/thepostedapp/posted-sdk-flutter)
