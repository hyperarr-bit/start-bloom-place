// Captures lead acquisition source (UTM + referrer) once per browser
// and exposes helpers to persist it to the user's profile on signup.

const STORAGE_KEY = "lead-source-v1";

export interface LeadSource {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
  source_captured_at: string;
  /** Código de indicação (?ref=CODE) — vira profiles.referred_by_code no cadastro. */
  ref: string | null;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/* Memória da página (25/09) — a mesma rede do analytics.ts (sessaoMemoria):
 * o navegador do Instagram às vezes zera o storage com a página viva, logo
 * depois da chegada do anúncio. Sem esta cópia, a conta nascia com a origem
 * da DEMO (landing_path=/preview/…&from=dia14) e sem campanha. */
let memoria: LeadSource | null = null;

function readStored(): LeadSource | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LeadSource;
  } catch { /* noop */ }
  if (memoria) { writeStored(memoria); return memoria; }
  return null;
}

function writeStored(data: LeadSource) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
  memoria = data;
}

/** Página NOVA depois da zerada (a demo abre com navegação cheia): a origem
 *  some daqui, mas o analytics re-semeou o `core_utm` antes de sair do
 *  /inicio — é dele que a origem volta. */
function daAtribuicaoDoAnalytics(): LeadSource | null {
  try {
    const m = JSON.parse(localStorage.getItem("core_utm") || "{}") as Record<string, string>;
    if (!m.utm_source && !m.utm_campaign) return null;
    return {
      utm_source: m.utm_source || null,
      utm_medium: m.utm_medium || null,
      utm_campaign: m.utm_campaign || null,
      utm_content: m.utm_content || null,
      utm_term: null,
      referrer: m.referrer || null,
      landing_path: m.path || null,
      source_captured_at: new Date().toISOString(),
      ref: null,
    };
  } catch {
    return null;
  }
}

/**
 * Reads UTM params from current URL and document.referrer.
 * Saves on first visit; if a stronger signal (UTM) arrives later, it overwrites.
 */
export function captureLeadSource() {
  if (typeof window === "undefined") return;

  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string | null> = {};
    let hasUtm = false;
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      utm[k] = v;
      if (v) hasUtm = true;
    });

    const referrer = document.referrer || null;
    // Ignore internal referrers (same origin)
    const cleanReferrer = referrer && !referrer.startsWith(window.location.origin) ? referrer : null;

    const ref = params.get("ref");
    let existing = readStored();
    if (!existing && !hasUtm && !ref) {
      const doAnalytics = daAtribuicaoDoAnalytics();
      if (doAnalytics) { writeStored(doAnalytics); existing = doAnalytics; }
    }

    // Skip if we already have data AND no new signal (UTM or ref) present
    if (existing && !hasUtm && !ref) return;

    const data: LeadSource = {
      utm_source: utm.utm_source ?? existing?.utm_source ?? null,
      utm_medium: utm.utm_medium ?? existing?.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? existing?.utm_campaign ?? null,
      utm_content: utm.utm_content ?? existing?.utm_content ?? null,
      utm_term: utm.utm_term ?? existing?.utm_term ?? null,
      referrer: cleanReferrer ?? existing?.referrer ?? null,
      landing_path: window.location.pathname + window.location.search,
      source_captured_at: new Date().toISOString(),
      ref: ref ?? existing?.ref ?? null,
    };

    writeStored(data);
  } catch { /* noop */ }
}

export function getLeadSource(): LeadSource | null {
  return readStored();
}

/** Persists the captured lead source to a user's profile (best-effort). */
// Tipo do cliente REAL, só como tipo (nada de import em runtime: este
// arquivo roda na landing antes do Supabase carregar). O parâmetro
// estrutural que existia aqui (`{ from: (table: string) => … }`) obrigava o
// TypeScript a conferir o cliente inteiro contra "qualquer tabela" — estourava
// a profundidade de instanciação (TS2589) e, dependendo da ORDEM dos arquivos,
// contaminava a checagem dos RPCs do /admin com 6 erros fantasmas (11/09).
export async function persistLeadSource(
  supabase: typeof import("@/integrations/supabase/client").supabase,
  userId: string
) {
  const src = getLeadSource();
  if (!src) return;
  try {
    await supabase.from("profiles").update({
      utm_source: src.utm_source,
      utm_medium: src.utm_medium,
      utm_campaign: src.utm_campaign,
      utm_content: src.utm_content,
      utm_term: src.utm_term,
      referrer: src.referrer,
      landing_path: src.landing_path,
      source_captured_at: src.source_captured_at,
      referred_by_code: src.ref,
    }).eq("id", userId);
  } catch { /* noop */ }
}

export function clearLeadSource() {
  memoria = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
