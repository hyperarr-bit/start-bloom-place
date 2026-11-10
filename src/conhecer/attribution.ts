/** The payment endpoint stores at most 300 characters. Never slice a click id. */
export function compactCheckoutSource(href: string): { url: string; omitted: string[] } {
  const input = new URL(href);
  const source = new URL(input.origin + input.pathname);
  const omitted: string[] = [];
  // Campaign identity survives even when an ad platform prepends a very long click id.
  for (const key of ['utm_campaign', 'c_id', 'as_id', 'ad_id', 'utm_source', 'utm_medium', 'utm_content', 'utm_term', 'fbclid', 'ttclid', 'gclid', 'gbraid', 'wbraid']) {
    const value = input.searchParams.get(key);
    if (!value) continue;
    const candidate = new URL(source.href);
    candidate.searchParams.set(key, value);
    if (candidate.href.length <= 300) source.searchParams.set(key, value);
    else omitted.push(key);
  }
  return { url: source.href, omitted };
}
// Capture once, before internal stage navigation. No stale cross-visit attribution fallback.
export const CHECKOUT_SOURCE = compactCheckoutSource(location.href);
