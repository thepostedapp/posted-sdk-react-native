# Changelog

All notable changes to `@posted-sdk/react-native` are documented here.

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
