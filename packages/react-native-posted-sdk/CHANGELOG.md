# Changelog

All notable changes to `@posted-sdk/react-native` are documented here.

## [1.0.0] — Initial public release

Initial public release of `@posted-sdk/react-native`.

### Public API

- **`resolveAppLaunch(config?)`** — single unified cold-start attribution entry point.
  Resolves attribution for the current app launch and returns `PostedResult`
  (`string | null`). Detects the launch URL internally via `Linking.getInitialURL()`
  and dispatches to the link-present or deferred branch automatically. Its second
  positional parameter (`launchContext`) is reserved for cross-platform API parity and
  is **always omitted on React Native** — there is no RN-specific launch-context
  wrapper type, since the native `Linking` module is the single source of truth for the
  launch URL. **Fire-once per install**: the first call performs one network
  resolution and caches the result; it survives app restarts and app updates on the
  same install, and subsequent calls make no network request. Re-arms on a reinstall
  (OS-cleared storage) or an explicit `resetSession()` call.
- **`resetSession(config?)`** — re-arms fire-once resolution (logout/reinstall/QA).
- **`PostedProvider` / `usePostedContext`** — continuous deep-link stream for
  in-session navigation, separate from attribution (see README).
- **`PostedAnalytics.logEvent` / `logRetention`** — analytics reporting.
- **Backend API base**: `attr.postedapp.com` (analytics + link endpoints).
- **Default short-link domain**: `l.postedapp.com`.
- **Custom URL scheme**: `posted://`.

### Deprecated

- `resolveInitialLink`, `processLink`, `getDeferredLink`, `resolveShortLink` (all
  overloads) → use `resolveAppLaunch`. They are `@deprecated` aliases that forward
  to `resolveAppLaunch(config)` and emit a runtime `console.warn`. The `url?` argument
  on `processLink` / `resolveShortLink` is ignored — the facade detects the launch URL
  internally via `Linking.getInitialURL()`; there is no explicit-URL override on React
  Native.
