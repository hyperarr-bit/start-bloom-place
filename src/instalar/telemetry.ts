import { capturarAtribuicao } from '@/landing/atribuicao';
import { idDoAparelho } from '@/landing/marcador';
import { storeForDevice } from './platform';

/** This route measures visits and store departures, never installs or purchases. */
export const QA = new URLSearchParams(location.search).get('qa') === '1'
  || !/(^|\.)coreaplicativo\.com\.br$/.test(location.hostname);
export const newClickId = (): string => {
  try { return crypto.randomUUID(); }
  catch { return `i${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
};
const session = (key: string): string => {
  if (QA) return newClickId();
  try {
    const old = sessionStorage.getItem(key);
    if (old) return old;
    const value = newClickId(); sessionStorage.setItem(key, value); return value;
  } catch { return newClickId(); }
};
const coreSession = session('core_session_id');
const landingSession = session('landing-sessao-v1');
const device = QA ? newClickId() : idDoAparelho();
const storage = (() => { try { return QA ? null : localStorage; } catch { return null; } })();
const attribution = capturarAtribuicao(location.search, storage, Date.now(), QA);
const ua = navigator.userAgent || '';
const common = {
  ...attribution, path: '/instalar', pagina: 'instalar', funil: 'instalar', objetivo: 'download',
  landing_session_id: landingSession, landing_device_id: device,
  landing_medicao_v: 2, medicao_forcada: QA, braco_lp: 'atual', braco_pix: 'unknown',
  plataforma: storeForDevice(ua, navigator.maxTouchPoints) || 'web',
  in_app: /FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua),
};

// Existing public anon credential and existing analytics endpoint. No account client is initialized.
const EVENT_URL = 'https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events';
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg';
const allowedEvents = new Set([
  'landing_html', 'landing_bloco', 'landing_area', 'landing_demo_aberta', 'landing_demo_pronta',
  'landing_demo_modulo', 'landing_demo_mexeu', 'landing_demo_saida', 'landing_cta',
  'landing_loja', 'landing_erro', 'landing_duvida_aberta', 'landing_lojas_vistas',
]);
const allowedFields = new Set([
  'bloco', 'area', 'modulo', 'via', 'destino', 'onde', 'loja', 'link_click_id',
  'referrer_medido', 'apple_campaign', 'tela1_ms', 'ttfb_ms', 'ms_desde_html',
  'motivo', 'pergunta', 'cta', 'visivel', 'ms_desde_inicio',
]);
type MetaQueue = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; push?: MetaQueue;
  loaded?: boolean; version?: string;
};
type MeasurementWindow = Window & {
  fbq?: MetaQueue; _fbq?: MetaQueue;
  __eventosInstalar?: Array<Record<string, unknown>>;
};
const measurementWindow = window as MeasurementWindow;

export function event(name: string, data: Record<string, unknown> = {}): void {
  if (!allowedEvents.has(name)) return;
  if (name === 'landing_loja' && !data.link_click_id) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!allowedFields.has(key)) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, 200);
    else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) clean[key] = value;
  }
  const payload = { ...clean, ...common, t_ms: Math.round(performance.now()) };
  (measurementWindow.__eventosInstalar ??= []).push({ nome: name, ...payload });
  if (QA) return;
  try {
    void fetch(EVENT_URL, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: PUBLIC_ANON_KEY, Authorization: `Bearer ${PUBLIC_ANON_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: null, session_id: coreSession, event_name: name, event_data: payload }),
    }).catch(() => {});
  } catch { /* Measurement must never prevent navigation. */ }
}

let initialized = false;
export function initMeasurement(): void {
  if (initialized) return;
  initialized = true;
  event('landing_html', { tela1_ms: Math.round(performance.now()) });
  if (QA) return;
  if (!measurementWindow.fbq) {
    const queue: MetaQueue = function (...args: unknown[]) {
      if (queue.callMethod) queue.callMethod(...args); else queue.queue!.push(args);
    };
    queue.queue = []; queue.push = queue; queue.loaded = true; queue.version = '2.0';
    measurementWindow.fbq = queue; measurementWindow._fbq = queue;
    queue('init', '998037194527241'); queue('init', '1104688251942954');
    const script = document.createElement('script'); script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
  }
  try { measurementWindow.fbq('track', 'PageView'); } catch { /* Pixel can be blocked. */ }
}

export function trackStoreClick(data: {
  loja: 'ios' | 'android'; onde: string; link_click_id: string;
  referrer_medido: boolean; apple_campaign?: string;
}): void {
  event('landing_loja', data);
  if (QA) return;
  // A store departure is not an installation, trial, checkout, or purchase.
  try { measurementWindow.fbq?.('trackCustom', 'StoreClick', { loja: data.loja, onde: data.onde, pagina: 'instalar' }, { eventID: `instalar_store_${data.link_click_id}` }); }
  catch { /* Navigation remains available with blocked pixels. */ }
}
