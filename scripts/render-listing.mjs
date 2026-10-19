// Renders listing/compose.html to one 1280x800 PNG per slide with headless Edge, for the AMO screenshots.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SLIDES = ['feed', 'send', 'shelf', 'sidebar'];

const listing = resolve(dirname(fileURLToPath(import.meta.url)), '../listing');
const page = pathToFileURL(resolve(listing, 'compose.html')).href;

SLIDES.forEach((slide, i) => {
  const out = resolve(listing, `${i + 1}-${slide}.png`);
  execFileSync(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,800',
    // Gives the web font and screenshot time to load before capture.
    '--virtual-time-budget=4000',
    `--screenshot=${out}`,
    `${page}#${slide}`,
  ], { stdio: 'ignore' });
  console.log(out);
});
