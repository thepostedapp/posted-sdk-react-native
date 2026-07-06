# Migration Guide: `@swmansion/react-native-detour` → `@posted-sdk/react-native`

This guide covers upgrading from any `@swmansion/react-native-detour` version to `@posted-sdk/react-native` 2.0.0.

For the canonical cross-platform naming scheme see the [POS-8 plan](https://github.com/posted-attribution/posted-sdk-react-native/issues) (internal board link: `/POS/issues/POS-8#document-plan`).

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

The short-link domain is `posted.link` as of 3.0.0 (it was `godetour.link` in 2.0.0). Update your `app.json` associated domains:

```json
"associatedDomains": ["applinks:<your-org>.posted.link"]
```

> **Universal Links are optional for v1.** Attribution (probabilistic + deterministic:
> install-referrer, iOS clipboard, and the `posted://` scheme) works without associated
> domains / AASA / assetlinks. The associated-domain config above is only needed if you
> also want tap-to-open Universal Links.

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

---

# 3.0.0 — Attribution API: old link methods → `resolveAppLaunch`

3.0.0 consolidates the four imperative link-resolution methods into a single
attribution-first entry point, `resolveAppLaunch(config)`. The old methods are
still exported as `@deprecated` aliases for one minor cycle so existing code keeps
compiling, but each now forwards to `resolveAppLaunch()` and logs a runtime
deprecation warning.

## 7. Method mapping

Replace every call to an old link method with a single `resolveAppLaunch(config)`
call at app launch:

| Old method (3.0.0 `@deprecated`) | New | Notes |
|---|---|---|
| `resolveInitialLink(config)` | `resolveAppLaunch(config)` | Direct 1:1 replacement. |
| `processLink(config, url?)` | `resolveAppLaunch(config)` | `url` argument is **ignored** — see §8. |
| `getDeferredLink(config)` | `resolveAppLaunch(config)` | The deferred branch is now selected automatically; no need to call it directly. |
| `resolveShortLink(config, url?)` | `resolveAppLaunch(config)` | `url` argument is **ignored** — see §8. Short-link resolution now happens internally inside the link-present branch. |

```diff
-import { processLink, getDeferredLink } from '@posted-sdk/react-native';
+import { resolveAppLaunch } from '@posted-sdk/react-native';

-const result = await processLink(config, launchUrl);
+const result = await resolveAppLaunch(config);
```

`resolveAppLaunch()` returns a `PostedResult` (`string | null`) — the resolved link
URL, or `null` when no attribution was found for this launch.

### One call per launch (fire-once)

Unlike the old methods, `resolveAppLaunch()` is **fire-once per install**: the first
call performs one network resolution and caches the result; subsequent calls (same
process, or across app restarts and updates on the same install) return the cached
value with zero network calls. You no longer need to guard against calling it twice.
Call it once during startup.

To deliberately re-arm resolution (e.g. logout/reinstall flows, QA), call
`resetSession(config)`; the next `resolveAppLaunch()` performs a fresh resolution.

## 8. Behavior change: the `url?` argument is now ignored

`processLink(config, url?)` and `resolveShortLink(config, url?)` previously accepted
an explicit launch URL. **In 3.0.0 that argument is ignored.** The `resolveAppLaunch()`
facade detects the launch URL internally via React Native's
[`Linking.getInitialURL()`](https://reactnative.dev/docs/linking#getinitialurl) and
then dispatches to the correct branch automatically:

- **Link-present branch** — if `Linking.getInitialURL()` returns a (non-infrastructure)
  URL, the facade resolves it, transparently expanding a short link and registering the
  universal-link click.
- **Deferred branch** — otherwise the facade runs deferred/fingerprint matching (the old
  `getDeferredLink` path).

### Was there a supported explicit-URL override?

**No — on React Native there is no public explicit-URL parameter.** `resolveAppLaunch`
takes only `config`; its second positional parameter (`launchContext`) is reserved for
cross-platform API parity and is **always omitted on React Native** — the native
`Linking` module is the single source of truth for the launch URL. This is intentional:
it guarantees the "one attribution resolution per launch" invariant and prevents callers
from attributing an arbitrary URL.

**If your code passed an explicit `url`:**

- **You were forwarding the app's own launch URL** (the common case — e.g. a value you
  had already read from `Linking.getInitialURL()`): just drop the argument. The facade
  reads the same value itself. `resolveAppLaunch(config)` is a complete replacement.
- **You were passing a URL received while the app was already running** (a runtime deep
  link, not the cold-launch URL): that was never `resolveAppLaunch`'s job and is not an
  attribution call. Continue handling runtime links through `PostedProvider` /
  `usePostedContext` (or the Expo Router native-intent handler) as documented in the
  README — those paths are unchanged in 3.0.0.

## 9. Removal timeline (3.0.0)

The `resolveInitialLink` / `processLink` / `getDeferredLink` / `resolveShortLink`
aliases are deprecated in 3.0.0 and will be **removed in the next major version**.
Migrate to `resolveAppLaunch()` before upgrading past 3.0.x. After removal, imports of
the old names will fail to compile — use the mapping in §7 to update them.

### Quick-find patterns (project-wide search and replace)

```
resolveInitialLink(config)        →  resolveAppLaunch(config)
getDeferredLink(config)           →  resolveAppLaunch(config)
processLink(config, url)          →  resolveAppLaunch(config)   // drop url
resolveShortLink(config, url)     →  resolveAppLaunch(config)   // drop url
```
