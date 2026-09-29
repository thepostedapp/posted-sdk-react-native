# Dead link sweep (POS-524)

Every link in this repo's docs (READMEs, CHANGELOG, MIGRATION, examples, code-comment URLs), external and
internal/relative, was HTTP-checked. Internal/relative links all resolved (200/exists) and needed no
changes. Findings for external links below.

## Removed

Links with no existing tracking that were confirmed dead and removed from the referencing doc.

| repo-relative-path                             | dead URL                                                                      | referencing doc                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `examples/react-navigation-advanced/README.md` | prior SDK vendor's blog post on deferred deep linking (URL redacted, POS-541) | `examples/react-navigation-advanced/README.md` (POS-524 Part 1a) |

Note: a row previously tracked a dead `.../issues` link in `packages/react-native-posted-sdk/MIGRATION.md`;
that file was deleted in POS-541 (never-published package, no migration audience), so the row is moot and
has been dropped rather than updated to the post-rename org.

## Resolved — GitHub org rename (POS-548, 2026-09-29)

These rows previously carried an inline marker tracking a pending GitHub org rename (placeholder
org for the cross-platform SDK links). The board completed the rename to `thepostedapp` on
2026-09-29; links updated in place and the markers removed.

| repo-relative-path | new URL                                              | referencing doc |
| ------------------ | ---------------------------------------------------- | --------------- |
| `README.md`        | `https://github.com/thepostedapp/posted-sdk-android` | `README.md:534` |
| `README.md`        | `https://github.com/thepostedapp/posted-sdk-ios`     | `README.md:535` |
| `README.md`        | `https://github.com/thepostedapp/posted-sdk-flutter` | `README.md:536` |

## Flagged — not removed, pending board decision

These URLs also 404, but every occurrence already carries an inline `<!-- TODO(Bn): ... -->` marker added
in the original SDK rebrand commit (`e83777c`), tracking a **known**
pending domain/org change (new docs site, new backend domain, GitHub org rename — not yet live). They are
not left over from neglect; each is deliberately tracked in-line already. Removing them now would strip
the primary instructional content (dashboard/setup/testing/architecture links) from every README in this
repo ahead of that migration landing. Left intact pending a board call on whether to (a) keep as-is
(current, TODO-tracked), (b) remove now and re-add once the destinations are live, or (c) something else.
See PR/issue comment for the ask.

| repo-relative-path                             | dead URL                                                                                                                                                  | referencing doc                                                 | existing marker       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------- |
| `README.md`                                    | `https://postedapp.com/docs/`                                                                                                                             | `README.md:9`                                                   | `TODO(B6)`            |
| `README.md`                                    | `https://postedapp.com/docs/sdk/react-native/sdk-installation`                                                                                            | `README.md:10`                                                  | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/sdk/react-native/sdk-installation`                                                                                            | `examples/expo-bare/README.md:3`                                | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com` (×3)                                                                                                                              | `examples/expo-bare/README.md:31,158`                           | `TODO(B3)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Fundamentals/dashboard`                                                                                                       | `examples/expo-bare/README.md:31`                               | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Fundamentals/getting-started#4-complete-app-configuration`                                                                    | `examples/expo-bare/README.md:37`                               | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Fundamentals/dashboard#apps`                                                                                                  | `examples/expo-bare/README.md:39`                               | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/sdk/react-native/testing#testing-android-app-links`                                                                           | `examples/expo-bare/README.md:57`                               | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Fundamentals/getting-started#app-configuration`                                                                               | `examples/expo-bare/README.md:61`                               | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Fundamentals/dashboard#app-configuration` (×2)                                                                                | `examples/expo-bare/README.md:63,83`                            | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Fundamentals/dashboard#api-configuration-and-key-security` (×2)                                                               | `examples/expo-bare/README.md:74,159`                           | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/Architecture/architecture-limitations`                                                                                        | `examples/expo-bare/README.md:117`                              | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/sdk/react-native/testing`                                                                                                     | `examples/expo-bare/README.md:153`                              | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/sdk/react-native/sdk-usage`                                                                                                   | `examples/expo-bare/README.md:166`                              | `TODO(B6)`            |
| `examples/expo-bare/README.md`                 | `https://postedapp.com/docs/sdk/react-native/api-reference`                                                                                               | `examples/expo-bare/README.md:167`                              | `TODO(B6)`            |
| `examples/expo-router/README.md`               | same `postedapp.com`/`postedapp.com/docs/*` pattern as above                                                                                              | `examples/expo-router/README.md` (13 occurrences)               | `TODO(B3)`/`TODO(B6)` |
| `examples/expo-router-advanced/README.md`      | same `postedapp.com`/`postedapp.com/docs/*` pattern as above, plus `.../docs/Architecture/matching`                                                       | `examples/expo-router-advanced/README.md` (13 occurrences)      | `TODO(B3)`/`TODO(B6)` |
| `examples/expo-router-native-intent/README.md` | same `postedapp.com`/`postedapp.com/docs/*` pattern as above, plus `.../api-reference#expo-router-helper` and `.../dashboard#links-behavior-runtime-flow` | `examples/expo-router-native-intent/README.md` (14 occurrences) | `TODO(B3)`/`TODO(B6)` |
| `examples/react-navigation/README.md`          | same `postedapp.com`/`postedapp.com/docs/*` pattern as above                                                                                              | `examples/react-navigation/README.md` (13 occurrences)          | `TODO(B3)`/`TODO(B6)` |
| `examples/react-navigation-advanced/README.md` | same `postedapp.com`/`postedapp.com/docs/*` pattern as above, plus `.../docs/Architecture/matching`                                                       | `examples/react-navigation-advanced/README.md` (14 occurrences) | `TODO(B3)`/`TODO(B6)` |

## Checked, alive (no action)

All other external links (github.com/release-it, eslint.org, prettier.io, jestjs.io, typescriptlang.org,
nodejs.org, pnpm.io, reactnavigation.org, reactnative.dev, docs.expo.dev, developer.apple.com,
contributor-covenant.org, conventionalcommits.org, app.egghead.io, github.com/mozilla/diversity, bare
`https://postedapp.com` root) returned 200. All internal/relative markdown links (`./MIGRATION.md`,
`../react-navigation`, `./LICENSE`, etc.) resolve to existing files.
