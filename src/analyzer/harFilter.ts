import { harSchema, type Har } from '../core.js';
const noise = /\.(png|jpe?g|gif|svg|ico|css|woff2?|ttf|mp4|webp|map)(?:$)/i;
const trackers = ['google-analytics.com', 'googletagmanager.com', 'doubleclick.net', 'hotjar.com', 'facebook.net'];
export function filterHar(input: unknown, origin: string): Har {
  const har = harSchema.parse(input);
  return { log: { ...har.log, entries: har.log.entries.filter(entry => {
    const url = new URL(entry.request.url);
    if (url.origin !== origin || noise.test(url.pathname) || trackers.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) return false;
    return /json/i.test(entry.response.content.mimeType) || /^(POST|PUT|PATCH|DELETE)$/i.test(entry.request.method) || /\/(api|v\d+|graphql)(\/|$)/i.test(url.pathname);
  }) } };
}
