// Entry for feed.html, the fallback Feed page outside YouTube.
import { mountFeed } from './feed';
import { injectStyles } from './styles';

injectStyles();
mountFeed(document.getElementById('iris-root')!);
