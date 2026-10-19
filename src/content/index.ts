import { onEvent, request } from '../shared/messages';
import { closeComposer } from '../ui/composer';
import { injectStyles } from '../ui/styles';
import { setGuideBadge, startGuide, updateActive } from './guide';
import { leaveRoute, syncRoute, watchVideoId } from './route';
import { openSend, startSendPill } from './send';
import { refreshShelf, startShelf } from './shelf';

injectStyles();
startGuide();
startSendPill();
startShelf();
syncRoute();

let lastWatched: string | null = null;

/** Opening a video anywhere on YouTube makes its Shares Watched. */
function markWatched(): void {
  const videoId = watchVideoId();
  if (videoId === lastWatched) return;
  lastWatched = videoId;
  if (videoId) request('markWatched', { videoId }).catch(() => {});
}

function updateCounts(): void {
  request('getCounts').then((counts) => setGuideBadge(counts.unwatched), () => setGuideBadge(0));
}

markWatched();
updateCounts();

document.addEventListener('yt-navigate-start', () => {
  leaveRoute();
  closeComposer();
});
document.addEventListener('yt-navigate-finish', () => {
  syncRoute();
  updateActive();
  markWatched();
  void refreshShelf();
});

onEvent((event) => {
  if (event.type === 'openComposer') void openSend(event.videoId);
  else if (event.type === 'authChanged') {
    updateCounts();
    void refreshShelf();
  } else if (event.type === 'counts') {
    setGuideBadge(event.counts.unwatched);
    void refreshShelf();
  }
});
