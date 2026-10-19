# Iris

Firefox MV3 extension for sending YouTube videos to friends, surfaced inside YouTube. Vocabulary is in `CONTEXT.md`; backend setup is in `SETUP.md`.

## After every set of changes

Don't launch Firefox yourself. Tell the user to run `npm run run:firefox:dev` (or to restart it if it's already open) and say what to check in the browser.

`run:firefox:dev` builds, then loads `dist/` as a temporary add-on in the user's dedicated Firefox profile `Iris`. `--keep-profile-changes` keeps the Google login there between runs, and the profile's `extensions.webextensions.keepStorageOnUninstall` pref keeps the Iris session too. While it runs, web-ext reloads the extension whenever `dist/` changes, so `npm run watch` in another terminal picks up edits without a restart.

For two-User checks (sending, friend requests), `npm run run:firefox:pair` does the same in both the `Iris` and `Iris 2` profiles at once.

Only `npm run sign` produces an installable build. It needs a version bump in `manifest.json` first, because AMO won't sign the same version twice, and a fresh `npm run build`, because `sign` uploads `dist/` as it is.
