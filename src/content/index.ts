import { injectStyles } from '../ui/styles';
import { startGuide, updateActive } from './guide';
import { syncRoute, unmount } from './route';

injectStyles();
startGuide();
syncRoute();

document.addEventListener('yt-navigate-start', unmount);
document.addEventListener('yt-navigate-finish', () => {
  syncRoute();
  updateActive();
});
