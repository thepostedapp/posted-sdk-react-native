# Migration Guide: `@swmansion/react-native-detour` → `@posted-sdk/react-native`

This guide covers upgrading from any `@swmansion/react-native-detour` version to `@posted-sdk/react-native` 2.0.0.

For the canonical cross-platform naming scheme see the [POS-8 plan](https://github.com/thepostedapp/react-native-detour/issues) (internal board link: `/POS/issues/POS-8#document-plan`).

---

## 1. Install the new package

```sh
# Remove old package
npm uninstall @swmansion/react-native-detour
# or: yarn remove @swmansion/react-native-detour

# Install new package
npm install @posted-sdk/react-native
# or: yarn add @posted-sdk/react-native
```

Peer dependencies are unchanged — no reinstallation needed.

---

## 2. Update imports

Replace every import from the old package name:

```diff
-import { DetourProvider, useDetourContext } from '@swmansion/react-native-detour';
+import { PostedProvider, usePostedContext } from '@posted-sdk/react-native';
```

### Full symbol map

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

---

## 3. Update the custom URL scheme

The custom URL scheme changes from `detour://` to `posted://`.

### app.json (Expo)

```diff
 "scheme": [
-  "detour",
+  "posted",
   "your-app-scheme"
 ]
```

### AndroidManifest.xml (bare React Native)

```diff
 <data android:scheme="detour" />
```
→
```xml
 <data android:scheme="posted" />
```

### Info.plist (bare React Native)

```diff
 <string>detour</string>
```
→
```xml
 <string>posted</string>
```

### POSTED_LINKING_PREFIX

The linking prefix constant now reflects the new scheme:

```diff
-DETOUR_LINKING_PREFIX  // "detour://"
+POSTED_LINKING_PREFIX  // "posted://"
```

---

## 4. Update associated domains / short-link domain

The short-link domain is `godetour.link` in the current release. Update your `app.json` associated domains:

```json
"associatedDomains": ["applinks:<your-org>.godetour.link"]
```

The production domain will be updated in a future release once the new domain is confirmed (see [POS-44](https://github.com/thepostedapp/react-native-detour/issues) — internal release gate). Check the CHANGELOG for updates.

---

## 5. Deprecation shims and removal timeline

`@posted-sdk/react-native` 2.0.0 ships `@deprecated` re-exports for all old `Detour*` names, so your existing code compiles without changes. TypeScript users will see deprecation warnings pointing to the new names.

**Removal timeline:** The `Detour*` shims will be removed in **2.1.0**. Migrate before upgrading past 2.0.x.

When the shims are removed, any imports still using the old names will produce a compile error. Use the symbol map in §2 to update them.

---

## 6. Quick-find patterns (for project-wide search and replace)

```
@swmansion/react-native-detour  →  @posted-sdk/react-native
DetourProvider                  →  PostedProvider
useDetourContext                 →  usePostedContext
DETOUR_LINKING_PREFIX            →  POSTED_LINKING_PREFIX
DetourAnalytics                 →  PostedAnalytics
DetourEventNames                →  PostedEventNames
DetourContextType               →  PostedContextType
DetourLink                      →  PostedLink
DetourUrlEvent                  →  PostedUrlEvent
DetourUrlSubscription           →  PostedUrlSubscription
DetourStorage                   →  PostedStorage
detour://                       →  posted://
```
