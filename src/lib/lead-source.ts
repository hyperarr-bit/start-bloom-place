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
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function readStored(): LeadSource | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadSource) : null;
  } catch {
    return null;
  }
}

function writeStored(data: LeadSource) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
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

    const existing = readStored();

    // Skip if we already have data AND no new UTM present
    if (existing && !hasUtm) return;

    const data: LeadSource = {
      utm_source: utm.utm_source ?? existing?.utm_source ?? null,
      utm_medium: utm.utm_medium ?? existing?.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? existing?.utm_campaign ?? null,
      utm_content: utm.utm_content ?? existing?.utm_content ?? null,
      utm_term: utm.utm_term ?? existing?.utm_term ?? null,
      referrer: cleanReferrer ?? existing?.referrer ?? null,
      landing_path: window.location.pathname + window.location.search,
      source_captured_at: new Date().toISOString(),
    };

    writeStored(data);
  } catch { /* noop */ }
}

export function getLeadSource(): LeadSource | null {
  return readStored();
}

/** Persists the captured lead source to a user's profile (best-effort). */
export async function persistLeadSource(
  supabase: { from: (table: string) => { update: (v: object) => { eq: (col: string, val: string) => Promise<unknown> } } },
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
    }).eq("id", userId);
  } catch { /* noop */ }
}

export function clearLeadSource() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
