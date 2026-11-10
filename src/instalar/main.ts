import { ehArea, ehModuloLanding, MODULO_DA_AREA, NOME_DO_MODULO, type ModuloLanding } from '../landing/regras';
import { APP_STORE_URL, PLAY_STORE_URL, prepareStoreLink } from './links';
import { QA, event, initMeasurement } from './telemetry';
import { storeForDevice } from './platform';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const deviceStore = storeForDevice(navigator.userAgent, navigator.maxTouchPoints);
const scrollTo = (id: string) => byId(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

// Real links remain usable without JS. Desktop offers both stores; mobile opens
// the matching store on the same tap, without an asynchronous redirect.
document.querySelectorAll<HTMLAnchorElement>('a[data-download-auto]').forEach(a => {
  if (deviceStore) {
    a.dataset.loja = deviceStore;
    a.href = deviceStore === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    const label = a.querySelector('[data-download-label]');
    if (label) label.textContent = deviceStore === 'ios' ? 'Baixar na App Store' : 'Baixar na Play Store';
  }
});
function activateStore(e: MouseEvent) {
  if ((e.type === 'auxclick' && e.button !== 1) || (e.type === 'click' && e.button !== 0)) return;
  const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[data-loja]') : null;
  if (a) { try { prepareStoreLink(a, a.dataset.onde || 'download'); } catch { /* The original store link remains usable. */ } }
}
document.addEventListener('click', activateStore, true);
document.addEventListener('auxclick', activateStore, true);
document.querySelectorAll<HTMLAnchorElement>('a[data-download-auto]').forEach(a => a.addEventListener('click', e => {
  event('landing_cta', { onde: a.dataset.onde, destino: deviceStore || 'escolher_loja' });
  if (!deviceStore && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); scrollTo('download'); }
}));

const frame = byId<HTMLIFrameElement>('lp-demo-frame');
const phone = byId('lp-celular');
const picture = byId<HTMLImageElement>('lp-demo-img');
const retry = byId<HTMLButtonElement>('demo-retry');
const status = byId('demo-status');
const images: Partial<Record<ModuloLanding, string>> = { financas: '/landing/demo-financas.webp', rotina: '/landing/demo-rotina.webp', treino: '/landing/demo-treino.webp' };
let current: ModuloLanding = 'financas';
let started = false;
let ready = false;
let startedAt = 0;
let timeout: number | undefined;
const edited = new Set<string>();
function markModule(m: ModuloLanding) {
  current = m;
  phone.dataset.modulo = m;
  byId('lp-demo-kicker').textContent = `Seu CORE · ${NOME_DO_MODULO[m]}`;
  frame.title = `Demonstração do CORE — ${NOME_DO_MODULO[m]}`;
  document.querySelectorAll<HTMLButtonElement>('.lp-pilula[data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
}
function startDemo(via: string, restart = false) {
  if (started && !restart) return;
  started = true; ready = false; startedAt = performance.now();
  phone.removeAttribute('data-pronta');
  phone.dataset.abrindo = '';
  retry.hidden = true;
  status.textContent = 'Abrindo o app…';
  status.hidden = false;
  if (images[current]) { picture.src = images[current]!; picture.alt = `O módulo ${NOME_DO_MODULO[current]} do CORE com dados de exemplo`; picture.hidden = false; }
  else picture.hidden = true;
  frame.src = `/instalar/demo?m=${current}${QA ? '&qa=1' : ''}`;
  window.clearTimeout(timeout);
  timeout = window.setTimeout(() => {
    if (ready) return;
    status.textContent = 'A demo está demorando. Você pode tentar novamente ou baixar o app.';
    retry.hidden = false;
    event('landing_erro', { onde: 'demo_timeout', modulo: current });
  }, 12000);
  event('landing_demo_aberta', { modulo: current, via });
}
function openModule(m: ModuloLanding, via: string) {
  const changed = current !== m;
  markModule(m);
  if (ready) { if (changed) frame.contentWindow?.postMessage({ tipo: 'landing:modulo', m }, location.origin); }
  else startDemo(via, started && changed);
  event('landing_demo_modulo', { modulo: m, via });
}
window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
  const d = e.data;
  if (d.tipo === 'landing:pronta' && ehModuloLanding(d.modulo)) {
    if (d.modulo !== current) { frame.contentWindow?.postMessage({ tipo: 'landing:modulo', m: current }, location.origin); return; }
    if (!ready) event('landing_demo_pronta', { modulo: current, ms_desde_inicio: Math.round(performance.now() - startedAt) });
    ready = true; window.clearTimeout(timeout); phone.dataset.pronta = ''; delete phone.dataset.abrindo;
    frame.removeAttribute('tabindex'); status.hidden = true; retry.hidden = true;
  } else if (d.tipo === 'landing:modulo-trocado' && ehModuloLanding(d.modulo)) {
    markModule(d.modulo); event('landing_demo_modulo', { modulo: current, via: 'dentro' });
  } else if (d.tipo === 'landing:mexeu' && ehModuloLanding(d.modulo) && !edited.has(d.modulo)) {
    edited.add(d.modulo); event('landing_demo_mexeu', { modulo: d.modulo });
  } else if (d.tipo === 'landing:oferta') {
    event('landing_demo_saida', { destino: 'download', modulo: current }); scrollTo('download');
  }
});
retry.addEventListener('click', () => startDemo('tentar_novamente', true));
document.querySelectorAll<HTMLButtonElement>('[data-a]').forEach(b => b.addEventListener('click', () => {
  if (!ehArea(b.dataset.a)) return;
  document.querySelectorAll('[data-a]').forEach(el => el.setAttribute('aria-pressed', String(el === b)));
  event('landing_area', { area: b.dataset.a, modulo: MODULO_DA_AREA[b.dataset.a] });
  openModule(MODULO_DA_AREA[b.dataset.a], 'area'); scrollTo('demo');
}));
document.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => b.addEventListener('click', () => {
  if (!ehModuloLanding(b.dataset.m)) return;
  openModule(b.dataset.m, b.classList.contains('lp-mod') ? 'grade' : 'pilula');
  if (b.classList.contains('lp-mod')) scrollTo('demo');
}));
document.querySelectorAll<HTMLElement>('[data-ir]').forEach(b => b.addEventListener('click', () => scrollTo(b.dataset.ir!)));
document.querySelectorAll<HTMLDetailsElement>('details').forEach(d => d.addEventListener('toggle', () => {
  if (d.open) event('landing_duvida_aberta', { pergunta: d.querySelector('summary')?.textContent?.trim() });
}));

// Same embedded demonstration as the current LP, loaded only near the viewport
// or after an explicit choice. No checkout controller is imported by this entry.
if ('IntersectionObserver' in window) {
  const demoObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { startDemo('perto'); demoObserver.disconnect(); }
  }, { threshold: 0.15 });
  demoObserver.observe(byId('demo'));
  const seen = new Set<string>();
  const blocks = new IntersectionObserver(entries => entries.forEach(e => {
    const name = (e.target as HTMLElement).dataset.bloco;
    if (e.isIntersecting && name && !seen.has(name)) { seen.add(name); event('landing_bloco', { bloco: name }); }
  }), { threshold: 0.25 });
  document.querySelectorAll('[data-bloco]').forEach(el => blocks.observe(el));
} else startDemo('compatibilidade');
const sticky = byId('lp-fixo');
const updateSticky = () => {
  const top = byId('topo').getBoundingClientRect();
  const download = byId('download').getBoundingClientRect();
  const ending = byId('fim').getBoundingClientRect();
  const show = top.bottom < 0 && !(download.top < innerHeight && download.bottom > 0) && ending.top >= innerHeight;
  sticky.toggleAttribute('data-on', show);
  sticky.setAttribute('aria-hidden', String(!show));
  sticky.querySelectorAll('a').forEach(a => { a.tabIndex = show ? 0 : -1; });
};
window.addEventListener('scroll', updateSticky, { passive: true });
window.addEventListener('resize', updateSticky);
updateSticky();
initMeasurement();
