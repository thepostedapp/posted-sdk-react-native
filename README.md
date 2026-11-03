# posted-sdk React Native

`@posted-sdk/react-native` reports app installs to Posted. The backend matches each install to the ad click that led to it and reports it back to the ad network as a conversion.

The SDK has one function, `reportInstall()`. Call it on every app launch. It sends the report once per install.

- [Requirements](#requirements)
- [Get your app ID and API key](#get-your-app-id-and-api-key)
- [1. Install](#1-install)
- [2. Report the install](#2-report-the-install)
- [3. Verify the integration](#3-verify-the-integration)
- [Configuration](#configuration)
- [Data collected](#data-collected)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

## Requirements

- React Native `>=0.72`
- Expo and bare React Native projects are both supported. Bare projects don't need Expo Modules.

## Get your app ID and API key

Both come from the Posted dashboard at [app.postedapp.com/dashboard/settings](https://app.postedapp.com/dashboard/settings), under **Posted SDK**.

1. Under **Apps**, click **Add app**, fill in the form and submit it. The dashboard generates the **app ID** (`app_…`) for the new app.
2. Under **API keys**, click **Create key**. Copy the key when it is shown; it is not displayed again.

Pass these as `appID` and `apiKey` to `reportInstall()`. One API key works for all apps in your account.

## 1. Install

```sh
npm install @posted-sdk/react-native
```

The SDK reads device data through packages your app may already have. These are optional peer dependencies, so install the ones that match your project.

### Expo

```sh
npx expo install @react-native-async-storage/async-storage expo-device expo-application expo-constants expo-localization
```

Then rebuild the native app (`npx expo run:ios` / `npx expo run:android`, or a new EAS build).

### Bare React Native

```sh
npm install @react-native-async-storage/async-storage react-native-device-info
cd ios && pod install
```

Then rebuild the native app.

### What each package is for

| Package                                              | Used for                                          | If missing                                        |
| ---------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `expo-device` **or** `react-native-device-info`      | Device model, manufacturer, OS version            | **Required.** The install isn't reported.         |
| `@react-native-async-storage/async-storage`          | Remembering that the install was reported         | Required unless you pass your own `storage`.      |
| `expo-application` **or** `react-native-device-info` | Android Play install referrer (exact click match) | Android installs are matched by fingerprint only. |
| `expo-constants` **or** `react-native-device-info`   | User agent                                        | User agent is sent as `unknown`.                  |
| `expo-localization`                                  | Locale and timezone                               | Read from `Intl` instead.                         |

## 2. Report the install

Call `reportInstall()` once per launch, as early as possible: in your entry file, or in your root component.

```ts
// index.js (or app/_layout.tsx with Expo Router)
import { reportInstall } from "@posted-sdk/react-native";

reportInstall({
  apiKey: "<YOUR_API_KEY>",
  appID: "<YOUR_APP_ID>",
});
```

You don't need to `await` it. It never throws, and it doesn't block app startup.

## 3. Verify the integration

1. Run the app with a **fresh install**. Uninstalling clears the SDK's storage, so a reinstall reports again.
2. Watch the logs. Nothing is logged on success. On failure, you'll see a line starting with `🔗[Posted:INSTALL_ERROR]` (see [Troubleshooting](#troubleshooting)).

## Configuration

```ts
reportInstall(config: Config): Promise<void>
```

| Field     | Type            | Required | Description                                                                            |
| --------- | --------------- | -------- | -------------------------------------------------------------------------------------- |
| `apiKey`  | `string`        | Yes      | API key from the dashboard, **Posted SDK → API keys**.                                 |
| `appID`   | `string`        | Yes      | App ID from the dashboard, **Posted SDK → Apps**.                                      |
| `storage` | `PostedStorage` | No       | Persistent key-value storage. Defaults to `@react-native-async-storage/async-storage`. |

### Custom storage

Pass any storage that persists across launches. Both methods may be sync or async.

```ts
interface PostedStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}
```

For example, with [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv):

```ts
import { MMKV } from "react-native-mmkv";

import { reportInstall } from "@posted-sdk/react-native";

const mmkv = new MMKV();

reportInstall({
  apiKey,
  appID,
  storage: {
    getItem: (key) => mmkv.getString(key) ?? null,
    setItem: (key, value) => mmkv.set(key, value),
  },
});
```

The SDK stores two keys, both prefixed with `Posted_`: the "install reported" flag and a device ID. If storage is cleared, the install is reported again.

## Data collected

The install report is one `POST` to `attr.postedapp.com/api/install`, sent once per install. The backend uses the fields below to match the install to an earlier ad click on the same device.

| Field                                    | Source                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `platform`                               | `ios` or `android`                                                              |
| `model`, `manufacturer`, `systemVersion` | `expo-device` or `react-native-device-info`                                     |
| `screenWidth`, `screenHeight`, `scale`   | `Dimensions` and `PixelRatio`                                                   |
| `locale`, `timezone`                     | `expo-localization`, or `Intl` when it isn't installed                          |
| `userAgent`                              | `expo-constants` or `react-native-device-info`, `unknown` when neither is there |
| `timestamp`                              | Current time in milliseconds                                                    |
| `device_id`                              | A random UUID generated once per install and kept in storage                    |
| `clickId`                                | Android only: `click_id` from the Play install referrer, when present           |

The SDK never reads the clipboard, never collects the IDFA or the Android advertising ID, and does not request App Tracking Transparency permission.

## Troubleshooting

All SDK log lines start with `🔗[Posted`.

| Log message                                                       | Cause                                                             | Fix                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Failed to report install: 401`                                   | Wrong API key, or the app ID doesn't match the key                | Check both values in the dashboard.                                    |
| `Failed to report install: <other status>`                        | Backend rejected or failed the request                            | Retried on the next launch. If it persists, [open an issue](#support). |
| `Error reporting install: ... No device info library found`       | Neither `expo-device` nor `react-native-device-info` is installed | Install one of them and rebuild.                                       |
| `Error reporting install: ... No storage implementation provided` | AsyncStorage isn't installed and no `storage` was passed          | Install `@react-native-async-storage/async-storage` or pass `storage`. |
| `Error reporting install: TypeError: Network request failed`      | Device is offline                                                 | Nothing to do. It's retried on the next launch.                        |

## Support

- Found a bug or have a question? [Open an issue](https://github.com/thepostedapp/posted-sdk-react-native/issues).
