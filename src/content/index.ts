import { onEvent } from '../shared/messages';
import { closeComposer } from '../ui/composer';
import { injectStyles } from '../ui/styles';
import { startGuide, updateActive } from './guide';
import { syncRoute, unmount } from './route';
import { openSend, startSendPill } from './send';

injectStyles();
startGuide();
startSendPill();
syncRoute();

document.addEventListener('yt-navigate-start', () => {
  unmount();
  closeComposer();
});
document.addEventListener('yt-navigate-finish', () => {
  syncRoute();
  updateActive();
});

onEvent((event) => {
  if (event.type === 'openComposer') void openSend(event.videoId);
});
