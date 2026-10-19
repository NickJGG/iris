/** Where the Feed lives on YouTube. Kept apart from route.ts so early.ts stays tiny. */
export const FEED_PATH = '/feed/you';
export const FEED_MARKER = 'iris';
export const FEED_HREF = `${FEED_PATH}?${FEED_MARKER}`;
/** Set on <html> by early.ts, because YouTube strips the marker from the URL before content.js runs. */
export const FEED_FLAG = 'iris-feed';

export const hasFeedMarker = () => new URLSearchParams(location.search).has(FEED_MARKER);
