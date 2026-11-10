import { linkPlayAtribuido } from '@/landing/atribuicao';
import { QA, newClickId, trackStoreClick } from './telemetry';

export type Store = 'ios' | 'android';
export const APP_STORE_URL = 'https://apps.apple.com/br/app/id6806913181?pt=129384060&ct=core_instalar&mt=8';
// Never prefix this campaign with web_: older Android builds interpret it as an existing buyer.
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_source%3Dweb%26utm_medium%3Dinstalar_lp%26utm_campaign%3Dcore_instalar';

export function attributedStoreUrl(store: Store, clickId: string, where: string, qa = QA): string {
  if (store === 'ios') {
    const url = new URL(APP_STORE_URL);
    url.searchParams.set('ct', qa ? 'core_instalar_qa' : 'core_instalar');
    return url.toString();
  }
  return linkPlayAtribuido(PLAY_STORE_URL, {
    clickId, lp: 'atual', pix: 'unknown', onde: `instalar_${where}`, path: '/instalar', forçado: qa,
  });
}

/** Call only on an actual click/keyboard activation (or middle-button auxclick), not when rendering a link. */
export function prepareStoreLink(anchor: HTMLAnchorElement, where: string): { store: Store; clickId: string; href: string } | null {
  const store = anchor.dataset.loja;
  if (store !== 'ios' && store !== 'android') return null;
  // Only rewrite this app's existing store link; never turn a different destination into a measured conversion.
  const original = new URL(anchor.href);
  const valid = store === 'ios'
    ? original.origin === 'https://apps.apple.com' && /\/id6806913181\/?$/.test(original.pathname)
    : original.origin === 'https://play.google.com' && original.pathname === '/store/apps/details' && original.searchParams.get('id') === 'br.com.coreaplicativo.app';
  if (!valid) return null;
  const clickId = newClickId();
  const href = attributedStoreUrl(store, clickId, where);
  anchor.href = href;
  trackStoreClick({
    loja: store, onde: `instalar_${where}`, link_click_id: clickId,
    referrer_medido: store === 'android',
    ...(store === 'ios' ? { apple_campaign: new URL(href).searchParams.get('ct')! } : {}),
  });
  return { store, clickId, href };
}
