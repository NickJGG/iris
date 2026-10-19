// Builds once, then runs Iris in the "Iris" and "Iris 2" Firefox profiles side by side, for
// testing sends between two signed-in Users. Closing either Firefox stops both.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webExt = resolve(root, 'node_modules/web-ext/bin/web-ext.js');
const profiles = ['Iris', 'Iris 2'];

const built = spawnSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

const children = profiles.map((profile) =>
  spawn(process.execPath, [
    webExt, 'run',
    '--source-dir=dist',
    '--target=firefox-desktop',
    `--firefox-profile=${profile}`,
    '--keep-profile-changes',
    '--url=https://www.youtube.com/',
  ], { cwd: root, stdio: 'inherit' }),
);

for (const child of children) {
  child.on('exit', (code) => {
    for (const other of children) if (other !== child && other.exitCode === null) other.kill();
    process.exitCode = code ?? 0;
  });
}
