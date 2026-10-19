# Iris setup

One-time setup for the Supabase backend and Google sign-in. Start with the local stack (section 0); the hosted steps (1–4) are for when friends need to use it.

## 0. Local stack (development)

Runs Postgres, Auth, Realtime and Studio in Docker on your machine. `supabase/config.toml` already holds the extension's redirect URL and enables Google.

1. Install the CLI: `npm i -D supabase` (its postinstall downloads the binary, so approve it with `npm approve-scripts supabase`). Docker Desktop must be running.
2. Create a Google OAuth client as in section 2, but with the redirect URI `http://127.0.0.1:54321/auth/v1/callback`. The same client can list both the local and hosted callbacks.
3. Copy `.env.example` to `.env` and fill in `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`.
4. `npx supabase start`. The first run pulls images and takes a while. It applies `supabase/migrations/` and prints the API URL and the anon (or publishable) key. Put those in `.env` as `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
5. Run the RLS test. Either paste `supabase/tests/rls.sql` into local Studio's SQL editor (<http://127.0.0.1:54323>), or run:
   ```
   psql -f supabase/tests/rls.sql postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
   It should end with `all RLS assertions passed`. Don't use `supabase test db` for it: that expects pgTAP output.
6. `npm run build`. The build narrows the manifest's Supabase host permission to `SUPABASE_URL`, local or hosted. Then try sign-in as in section 5.

Other useful commands:
- `npx supabase db reset` re-applies the migrations from scratch and wipes local data.
- `npx supabase stop` stops the stack.
- To switch to hosted, point `.env` at the hosted project and rebuild.

## 1. Supabase project

1. Create a project at <https://supabase.com/dashboard> (the free tier is fine). Note its **project ref**, the `<ref>` in `https://<ref>.supabase.co`.
2. Open **SQL Editor**, paste each file in `supabase/migrations/` in order, and run it.
3. In a new query, paste all of `supabase/tests/rls.sql` and run it. The result must be the single row `all RLS assertions passed`. Any `FAIL: …` error names the broken rule. The script runs in one transaction and rolls back, so it leaves no test users behind.

## 2. Google OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one), then go to **APIs & Services → OAuth consent screen**:
   - User type **External**.
   - Scopes: only the defaults (`openid`, `email`, `profile`). Iris needs no YouTube scopes.
   - While the app is in **Testing**, only listed **test users** can sign in, so add every friend's Google address there. Alternatively, publish the app. Basic scopes need no Google verification.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
3. Copy the client ID and client secret.
4. In Supabase, go to **Authentication → Sign In / Providers → Google**. Enable it and paste the client ID and secret.

## 3. Allow the extension's redirect URL

Iris signs in through `browser.identity.launchWebAuthFlow`, which finishes on a URL Firefox derives from the add-on ID. The ID is fixed (`iris@nick.local`), so the URL never changes:

```
https://c29f559808e658ca63870085bbd8ae5918763778.extensions.allizom.org/
```

In Supabase, go to **Authentication → URL Configuration → Redirect URLs** and add that URL exactly. If it's missing, Supabase silently redirects to the Site URL instead and sign-in fails with "Sign-in returned no session".

To double-check the URL, load Iris, open `about:debugging#/runtime/this-firefox`, click **Inspect** next to Iris, and run `browser.identity.getRedirectURL()` in the console.

## 4. Point the build at your project

1. Copy `.env.example` to `.env` (it's gitignored).
2. Fill in both values from Supabase **Project Settings → API**:
   - `SUPABASE_URL` is `https://<ref>.supabase.co`.
   - `SUPABASE_ANON_KEY` is the **anon** key, or the **publishable** key on newer projects.
3. Run `npm run build`. The values are baked into `dist/background.js`. That's safe: the anon key is public by design and RLS is what protects the data.

## 5. Try sign-in (before the Feed UI exists)

1. `npm run build`, then `npm run run:firefox`.
2. In `about:debugging`, find Iris's **Internal UUID**, then open `moz-extension://<uuid>/feed.html`.
3. In that tab's console, run:
   ```js
   await browser.runtime.sendMessage({ type: 'signIn' })                          // Google popup → { ok: true, data: { signedIn: true, … } }
   await browser.runtime.sendMessage({ type: 'checkHandle', handle: 'yourname' })  // { available: true }
   await browser.runtime.sendMessage({ type: 'claimHandle', handle: 'yourname' })  // your profile, with the handle
   await browser.runtime.sendMessage({ type: 'getAuthState' })
   await browser.runtime.sendMessage({ type: 'signOut' })
   ```

## Idle pause

Free Supabase projects **pause after about 7 days without activity**. While paused, every Iris request fails. To fix it:

- Resume the project from the Supabase dashboard (one click). Data is kept.
- Or keep it awake with a scheduled ping, for example a daily GitHub Actions cron that `curl`s `https://<ref>.supabase.co/rest/v1/` with the `apikey` header set to the anon key.
- Or move to a paid plan, which doesn't pause.
