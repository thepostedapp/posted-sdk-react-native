# Changelog

All notable changes to `@posted-sdk/react-native` are documented here.

## [1.0.2] — Initial public release

Initial public release of `@posted-sdk/react-native`.

### Public API

- **`reportInstall(config)`** — reports the install once per install, so the
  backend can match it to the ad click and report the conversion. Call it on
  every launch: it retries on later launches until the backend accepts it, never
  throws, and never reads the clipboard. Android installs include the Play
  install referrer `click_id`.
- **Backend API base**: `attr.postedapp.com`.
- Works in Expo and bare React Native projects: device data comes from
  `expo-device` or `react-native-device-info`, with locale and timezone from
  `expo-localization` or `Intl`.
