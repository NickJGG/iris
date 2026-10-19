import { FEED_FLAG, hasFeedMarker } from './feed-url';

if (hasFeedMarker()) document.documentElement.setAttribute(FEED_FLAG, '');
