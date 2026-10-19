<picture>
  <source media="(prefers-color-scheme: dark)" srcset="icons/iris-light-128.png">
  <img src="icons/iris-128.png" alt="Iris logo" width="64">
</picture>

# Iris for YouTube

A Firefox add-on for sending YouTube videos to friends, and seeing what they sent you, right inside YouTube.

**[Get it on Firefox Add-ons](https://addons.mozilla.org/firefox/addon/iris-for-youtube/)** · **[Homepage](https://nickjgg.github.io/iris/)** · **[Privacy policy](https://nickjgg.github.io/iris/privacy.html)**

## Features

- **Send** any video to one or more friends from the Send button under it, or by right-clicking a video link. Add an optional note and a start time.
- **Receive** in the Iris Feed, a page inside YouTube with Inbox, Sent and Friends tabs. New Shares also appear in a "From friends" row on YouTube's home page, and a dot on the Iris sidebar entry tells you something's new.
- **Watched** happens on its own: opening a video anywhere on YouTube marks its Shares as watched.
- **Private by design:** no read receipts, and Iris only hears about a video you open if a friend sent it to you and you haven't watched it yet.

## How it works

Iris is a Manifest V3 add-on written in TypeScript and bundled with esbuild. Its backend is [Supabase](https://supabase.com): Google sign-in through Supabase Auth, and a Postgres database whose RLS policies decide who can read and write what. Video titles, channel details, and stats come straight from YouTube.

```
src/background/   auth, friends, shares, counts, and video stats (talks to Supabase)
src/content/      the YouTube integration: sidebar entry, send button, home shelf, routing
src/ui/           the feed, the send modal, and shared components
src/shared/       message types between content and background
supabase/         migrations and the RLS test
```

## Development

Requires Node.js 20.12 or newer, Docker (for the local Supabase stack) and Firefox.

1. `npm install`
2. Set up the backend and Google sign-in by following [SETUP.md](SETUP.md). It covers the local stack, the hosted project and the `.env` files.
3. `npm run run:firefox:dev` builds the add-on and opens it in a dedicated Firefox profile.

| Script | What it does |
| --- | --- |
| `npm run build` / `build:prod` | Build `dist/` against `.env` (local) or `.env.production` (hosted) |
| `npm run watch` | Rebuild on change |
| `npm run typecheck` | Type-check without emitting |
| `npm run run:firefox:dev` | Build and run in the `Iris` Firefox profile |
| `npm run run:firefox:pair` | Run two profiles side by side, for testing between two Users |
| `npm run package` | Production build zipped for AMO |
| `npm run icons` | Regenerate the icons |

The RLS test (`supabase/tests/rls.sql`) should end with `all RLS assertions passed`; SETUP.md shows how to run it.

## License

[MIT](LICENSE)
