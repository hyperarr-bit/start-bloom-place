/**
 * LINK ÚNICO DE DOWNLOAD — coreaplicativo.com.br/baixar (18/09, pedido do dono:
 * "um link tipo toki.com/api/download que abre na loja certa").
 *
 * Roda no servidor (função da Vercel), antes de qualquer HTML: lê o
 * User-Agent e responde um 302 pra loja do aparelho. Sem carregar o site,
 * sem JavaScript, sem tela branca — no webview do Instagram isso é a
 * diferença entre abrir a loja em 0,2 s e perder a pessoa.
 *
 *   iPhone/iPad  → App Store
 *   Android      → Google Play, com referrer (utm) pra atribuir a instalação
 *   computador   → o site, com os mesmos utm
 *
 * Parâmetros: ?origem=ig_bio (padrão) | ig_story | tiktok | ... — vira o
 * utm_campaign no Play e no site, e o `ct` no link da App Store. O clique é
 * registrado em analytics_events (baixar_click) com plataforma e origem —
 * fire-and-forget com 400 ms de teto, nunca segura o redirect.
 */
const APP_STORE = "https://apps.apple.com/br/app/id6806913181";
const PLAY = "https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app";
const SITE = "https://coreaplicativo.com.br/";
const SUPABASE_URL = "https://itoylenzvahbscgjgtqf.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";

const limpa = (s) => String(s || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "ig_bio";

export function destino(userAgent, origem) {
  const ua = String(userAgent || "");
  const o = limpa(origem);
  const utm = `utm_source=${o.split("_")[0] || "link"}&utm_medium=link&utm_campaign=${o}`;
  if (/iPhone|iPad|iPod/i.test(ua)) return { plataforma: "ios", url: `${APP_STORE}?ct=${o}` };
  if (/Android/i.test(ua)) return { plataforma: "android", url: `${PLAY}&referrer=${encodeURIComponent(utm)}` };
  return { plataforma: "web", url: `${SITE}?${utm}` };
}

export default async function handler(req, res) {
  const { plataforma, url } = destino(req.headers["user-agent"], req.query?.origem);
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
  // registro do clique (depois do redirect já ter saído; teto de 400 ms)
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 400);
    await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: "POST", signal: ctl.signal,
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ event_name: "baixar_click", session_id: null, event_data: { plataforma, origem: limpa(req.query?.origem), ua: String(req.headers["user-agent"] || "").slice(0, 120), ref: String(req.headers.referer || "").slice(0, 120) } }),
    });
    clearTimeout(t);
  } catch { /* nunca atrapalha o redirect */ }
}
