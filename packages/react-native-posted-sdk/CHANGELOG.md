# Changelog

All notable changes to `@posted-sdk/react-native` are documented here.

## [3.0.0] — Attribution-first API: `resolveAppLaunch`

3.0.0 replaces the four imperative link-resolution methods with a single
attribution-first entry point, `resolveAppLaunch(config)`. For the full upgrade path
see [MIGRATION.md](./MIGRATION.md) §7–§9.

### New public surface

- **`resolveAppLaunch(config?)`** — resolves attribution for the current app launch and
  returns `PostedResult` (`string | null`). Detects the launch URL internally via
  `Linking.getInitialURL()` and dispatches to the link-present or deferred branch
  automatically. **Fire-once per install**: caches the result across restarts/updates;
  subsequent calls make no network request.
- **`resetSession(config?)`** — re-arms fire-once resolution (logout/reinstall/QA).

### Deprecated (removed next major)

- `resolveInitialLink`, `processLink`, `getDeferredLink`, `resolveShortLink` are now
  `@deprecated` aliases that forward to `resolveAppLaunch(config)` and emit a runtime
  `console.warn`. Migrate to `resolveAppLaunch()` before upgrading past 3.0.x.

### Behavior changes

- **The `url?` argument on `processLink`/`resolveShortLink` is now ignored.** The facade
  detects the launch URL internally via `Linking.getInitialURL()`. On React Native there
  is **no public explicit-URL override** — `resolveAppLaunch` takes only `config` (its
  `launchContext` parameter is reserved for cross-platform parity and always omitted on
  RN). Callers that forwarded the app's own launch URL should simply drop the argument;
  runtime deep links (received while the app is running) continue to flow through
  `PostedProvider` / `usePostedContext` / the Expo Router native-intent handler. See
  [MIGRATION.md](./MIGRATION.md) §8.

## [2.0.0] — Breaking rename: `@swmansion/react-native-detour` → `@posted-sdk/react-native`

This release renames the package and all public symbols from the `Detour*` prefix to `Posted*`.
For a step-by-step upgrade path see [MIGRATION.md](./MIGRATION.md).

### Breaking changes

- **Package**: `@swmansion/react-native-detour` → `@posted-sdk/react-native`
- **Custom URL scheme**: `detour://` → `posted://` — update your `app.json` / `AndroidManifest.xml` / `Info.plist` intent filters and associated-domain entries
- **All public symbols renamed** (see symbol map below)

### Symbol map (old → new)

| Old (`@swmansion/react-native-detour`) | New (`@posted-sdk/react-native`) |
|---|---|
| `DetourProvider` | `PostedProvider` |
| `useDetourContext` | `usePostedContext` |
| `DETOUR_LINKING_PREFIX` | `POSTED_LINKING_PREFIX` |
| `Detour` | `Posted` |
| `DetourAnalytics` | `PostedAnalytics` |
| `DetourEventNames` | `PostedEventNames` |
| `DetourContextType` (type) | `PostedContextType` (type) |
| `DetourLink` (type) | `PostedLink` (type) |
| `DetourUrlEvent` (type) | `PostedUrlEvent` (type) |
| `DetourUrlSubscription` (type) | `PostedUrlSubscription` (type) |
| `DetourStorage` (type) | `PostedStorage` (type) |

Unchanged exports: `Config`, `LinkType`.

### Deprecated back-compat shims (one minor cycle)

All old `Detour*` names are re-exported as `@deprecated` aliases in 2.0.0 so you can migrate at your own pace. They will be **removed in the next minor release** (2.1.0). TypeScript users will see deprecation warnings on the old names.

### Short-link domain

The short-link domain used in example apps and associated-domain configuration is `godetour.link` until the new domain (pending [POS-44](https://github.com/thepostedapp/react-native-detour)) goes live. When the new domain is confirmed, update `DEFAULT_HOSTS` and your app's associated domains accordingly.
