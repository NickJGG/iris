import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

const envFile = resolve(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('build: SUPABASE_URL / SUPABASE_ANON_KEY not set; sign-in will fail until .env is filled (see SETUP.md)');
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
// Narrow the Supabase host permission to the configured project, which may be a local stack.
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
if (supabaseUrl) {
  manifest.host_permissions = manifest.host_permissions.map((p) =>
    p === 'https://*.supabase.co/*' ? `${new URL(supabaseUrl).origin}/*` : p,
  );
}
await writeFile(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
await cp(resolve(root, 'feed.html'), resolve(dist, 'feed.html'));
await cp(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true });

const options = {
  entryPoints: {
    background: resolve(root, 'src/background/index.ts'),
    content: resolve(root, 'src/content/index.ts'),
    feed: resolve(root, 'src/ui/feed-page.ts'),
  },
  bundle: true,
  outdir: dist,
  format: 'iife',
  target: 'firefox115',
  sourcemap: 'inline',
  logLevel: 'info',
  define: {
    __SUPABASE_URL__: JSON.stringify(supabaseUrl),
    __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('esbuild: watching for changes...');
} else {
  await build(options);
}
