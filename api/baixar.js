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

const limpa = (s, padrao) => String(s || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || padrao;

/* `?c=` e `?m=` são os nomes que a página antiga (07/09) aceitava — links já
 * publicados continuam valendo. `?origem=` é o nome novo. */
export function destino(userAgent, origem, meio) {
  const ua = String(userAgent || "");
  const o = limpa(origem, "ig_bio");
  const utm = `utm_source=${o.split("_")[0] || "link"}&utm_medium=${limpa(meio, "link")}&utm_campaign=${o}`;
  if (/iPhone|iPad|iPod/i.test(ua)) return { plataforma: "ios", url: `${APP_STORE}?ct=${o}` };
  if (/Android/i.test(ua)) return { plataforma: "android", url: `${PLAY}&referrer=${encodeURIComponent(utm)}` };
  return { plataforma: "web", url: `${SITE}?${utm}` };
}

export default async function handler(req, res) {
  const origem = req.query?.origem ?? req.query?.c;
  const { plataforma, url } = destino(req.headers["user-agent"], origem, req.query?.m);
  // Registro do clique ANTES do redirect, com teto de 300 ms: a Vercel congela
  // a função assim que a resposta sai, então "depois" não roda.
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 300);
    await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: "POST", signal: ctl.signal,
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ event_name: "baixar_click", session_id: null, event_data: { plataforma, origem: limpa(origem, "ig_bio"), ua: String(req.headers["user-agent"] || "").slice(0, 120), ref: String(req.headers.referer || "").slice(0, 120) } }),
    });
    clearTimeout(t);
  } catch { /* nunca atrapalha o redirect */ }
  res.setHeader("Cache-Control", "no-store");
  /* NAVEGADOR DE DENTRO DO INSTAGRAM/FACEBOOK (18/09, print do dono): o
   * webview deles não segue um 302 pra loja — mostra "Ocorreu um erro
   * desconhecido". Pra ele a resposta é uma página mínima que pula pra loja
   * por JavaScript (e por meta refresh), com um botão de reserva caso o
   * webview bloqueie o pulo. Navegador normal continua no 302, que é o
   * mais rápido. */
  if (/Instagram|FBAN|FBAV|FB_IAB|Threads|Barcelona/i.test(String(req.headers["user-agent"] || ""))) {
    const loja = plataforma === "ios" ? "App Store" : plataforma === "android" ? "Google Play" : "site";
    const seguro = url.replace(/"/g, "&quot;").replace(/</g, "&lt;");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="1;url=${seguro}"><title>Baixar o CORE</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#16121c;font-family:Inter,-apple-system,system-ui,sans-serif;text-align:center;padding:24px}.m{font-weight:900;font-size:28px;letter-spacing:-.02em;margin-bottom:6px}p{color:#6b6661;font-size:15px;margin:0 0 22px}a{display:block;margin:0 auto;max-width:320px;padding:15px 20px;border-radius:999px;background:#16121c;color:#fff;font-weight:700;text-decoration:none;font-size:16px}</style></head><body><div><div class="m">CORE</div><p>Abrindo a ${loja}…</p><a href="${seguro}">Abrir na ${loja}</a></div><script>location.replace(${JSON.stringify(url)});</script></body></html>`);
    return;
  }
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}
