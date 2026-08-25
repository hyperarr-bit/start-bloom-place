#!/usr/bin/env node
/**
 * Gerenciador × banco: `node scripts/metricas-ads.mjs [de] [ate]` (BRT)
 *
 * Nasceu 20/08: a autópsia da campanha "bid cap" exigiu cruzar na mão o
 * gasto do gerenciador com as vendas reais da `subscriptions` — de novo em
 * script descartável. Este junta os dois lados numa tabela só, por campanha:
 *
 *   GERENCIADOR (Marketing API): gasto, impressões, CPM, installs, CPI
 *   BANCO (verdade do dinheiro): pagos (R$ real) e trials (R$ agendado),
 *   atribuídos pelo install_referrer DECIFRADO (AES-256-GCM, mesma chave
 *   do metricas-app) — atribuição do aparelho, não a auto-atribuição
 *   generosa da Meta (view-through etc).
 *
 * Credenciais no .env.local: META_ADS_TOKEN + META_AD_ACCOUNT (token do
 * usuário de sistema; TEM ESCRITA — trocar por read-only um dia),
 * META_INSTALL_REFERRER_KEY, CORE_ADMIN_EMAIL/PASSWORD.
 *
 * Limite conhecido: a atribuição banco-side olha o install_referrer das
 * SESSÕES do comprador — quem instalou antes da telemetria ou sem referrer
 * cai em "orgânico/sem referrer". O metricas-app segue sendo o funil fundo.
 */
import { readFileSync, existsSync } from "node:fs";
import { createDecipheriv } from "node:crypto";

const SUPABASE_URL = "https://itoylenzvahbscgjgtqf.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const GRAPH = "https://graph.facebook.com/v21.0";

const lerEnvLocal = () => {
  const out = {};
  for (const arq of [".env.local", ".env"]) {
    if (!existsSync(arq)) continue;
    for (const linha of readFileSync(arq, "utf8").split("\n")) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/.exec(linha);
      if (m && !(m[1] in out)) out[m[1]] = m[2];
    }
  }
  return out;
};
const env = { ...lerEnvLocal(), ...process.env };
for (const falta of ["META_ADS_TOKEN", "META_AD_ACCOUNT", "META_INSTALL_REFERRER_KEY", "CORE_ADMIN_EMAIL"]) {
  if (!env[falta]) { console.error(`✗ falta ${falta} no .env.local`); process.exit(1); }
}

const datas = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const hojeBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const de = datas[0] ?? hojeBRT();
const ate = datas[1] ?? de;
const maisUm = (d) => new Date(Date.parse(d + "T00:00:00Z") + 86400_000).toISOString().slice(0, 10);
const INICIO = `${de}T03:00:00Z`;
const FIM = `${maisUm(ate)}T03:00:00Z`;

/* mesma decifragem do metricas-app (AES-256-GCM, tag nos últimos 16 bytes) */
const abrirReferrer = (raw = "") => {
  try {
    const texto = decodeURIComponent(String(raw));
    const m = /utm_content=(\{.*\})/.exec(texto);
    if (!m) return null;
    const fonte = JSON.parse(m[1])?.source;
    if (!fonte?.data || !fonte?.nonce) return null;
    const bruto = Buffer.from(fonte.data, "hex");
    const corpo = bruto.subarray(0, -16);
    const tag = bruto.subarray(-16);
    const d = createDecipheriv("aes-256-gcm", Buffer.from(env.META_INSTALL_REFERRER_KEY.trim(), "hex"), Buffer.from(fonte.nonce, "hex"));
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(corpo), d.final()]).toString());
  } catch { return null; }
};

/* ------------------------------------------------------- lado do BANCO */
const entrar = async () => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.CORE_ADMIN_EMAIL, password: env.CORE_ADMIN_PASSWORD }),
  });
  const d = await r.json();
  if (!d.access_token) { console.error("✗ login recusado"); process.exit(1); }
  return d.access_token;
};
const buscar = async (tabela, params, token) => {
  const linhas = [];
  for (let off = 0; off < 60_000; off += 1000) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, Range: `${off}-${off + 999}` },
    });
    const pag = await r.json();
    if (!Array.isArray(pag)) { console.error(tabela, pag); process.exit(1); }
    linhas.push(...pag);
    if (pag.length < 1000) break;
  }
  return linhas;
};

const token = await entrar();
const vendas = await buscar("subscriptions", {
  select: "user_id,customer_email,amount_cents,current_period_start,current_period_end,created_at,payment_method",
  created_at: `gte.${INICIO}`, and: `(created_at.lt.${FIM})`,
  order: "created_at.asc",
}, token);
const doApp = vendas.filter((v) => v.payment_method === "play_store");

/* campanha de cada venda: install_referrer nas sessões do comprador */
const campanhaDaVenda = async (v) => {
  if (!v.user_id) return "sem referrer";
  const sess = await buscar("analytics_events", {
    select: "session_id", user_id: `eq.${v.user_id}`, limit: "50",
  }, token);
  const ids = [...new Set(sess.map((x) => x.session_id).filter(Boolean))];
  if (!ids.length) return "sem referrer";
  const refs = await buscar("analytics_events", {
    select: "event_data", event_name: "eq.install_referrer",
    session_id: `in.(${ids.join(",")})`, limit: "3",
  }, token);
  for (const r of refs) {
    const aberto = abrirReferrer(r.event_data?.referrer ?? "");
    if (aberto?.campaign_name) return aberto.campaign_name;
  }
  return refs.length ? "referrer sem campanha" : "orgânico/sem referrer";
};

const porCampanha = new Map(); // nome → {pagoR, pagoN, trialR, trialN, emails[]}
for (const v of doApp) {
  const nome = await campanhaDaVenda(v);
  const dias = (Date.parse(v.current_period_end) - Date.parse(v.current_period_start)) / 86400e3;
  // <10 dias = TRIAL (23/08). Era <5 e passou a MENTIR no dia em que o trial
  // do anual virou 7 dias (oferta coretrial7): um teste grátis de 7d entrava
  // como "pago R$ 159,90" e o relatório mostrava receita que não existe.
  // Mesmo detector do meta-backfill-app; nada legítimo dura <10d (prepaid 30,
  // mensal 30, anual 365, vitalício 2126).
  const trial = dias > 0 && dias < 10;
  if (!porCampanha.has(nome)) porCampanha.set(nome, { pagoR: 0, pagoN: 0, trialR: 0, trialN: 0, emails: [] });
  const c = porCampanha.get(nome);
  if (trial) { c.trialN++; c.trialR += v.amount_cents / 100; } else { c.pagoN++; c.pagoR += v.amount_cents / 100; }
  c.emails.push(`${v.customer_email?.split("@")[0]}${trial ? " (trial)" : ""}`);
}

/* --------------------------------------------------- lado do GERENCIADOR */
const insights = await (await fetch(
  `${GRAPH}/${env.META_AD_ACCOUNT}/insights?level=campaign&time_range={"since":"${de}","until":"${ate}"}&fields=campaign_name,spend,impressions,cpm,actions&access_token=${env.META_ADS_TOKEN}`,
)).json();
if (insights.error) { console.error("✗ Marketing API:", insights.error.message); process.exit(1); }

console.log(`\n━━━ GERENCIADOR × BANCO · ${de}${ate !== de ? " a " + ate : ""} (BRT) ━━━\n`);
const nomesBanco = new Set(porCampanha.keys());
for (const c of (insights.data ?? []).sort((a, b) => b.spend - a.spend)) {
  if (Number(c.spend) === 0) continue;
  const inst = Number(c.actions?.find((a) => a.action_type === "mobile_app_install")?.value ?? 0);
  const banco = porCampanha.get(c.campaign_name);
  nomesBanco.delete(c.campaign_name);
  console.log(`▸ ${c.campaign_name}`);
  console.log(`  gasto R$ ${Number(c.spend).toFixed(2)} · ${c.impressions} impr · CPM R$ ${Number(c.cpm).toFixed(2)} · ${inst} installs${inst ? ` (CPI R$ ${(c.spend / inst).toFixed(2)})` : ""}`);
  if (banco) {
    const linhas = [];
    if (banco.pagoN) linhas.push(`${banco.pagoN} pago(s) = R$ ${banco.pagoR.toFixed(2)} REAL`);
    if (banco.trialN) linhas.push(`${banco.trialN} trial(s) = R$ ${banco.trialR.toFixed(2)} agendado (custo/trial R$ ${(c.spend / banco.trialN).toFixed(2)})`);
    console.log(`  BANCO: ${linhas.join(" · ")}`);
    console.log(`         ${banco.emails.join(", ")}`);
  } else {
    console.log("  BANCO: nenhuma venda atribuída no período");
  }
  console.log();
}
for (const nome of nomesBanco) {
  const b = porCampanha.get(nome);
  console.log(`▸ ${nome} (sem gasto no gerenciador nesta janela)`);
  console.log(`  BANCO: ${b.pagoN} pago(s) R$ ${b.pagoR.toFixed(2)} · ${b.trialN} trial(s) R$ ${b.trialR.toFixed(2)} — ${b.emails.join(", ")}\n`);
}
