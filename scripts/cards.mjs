#!/usr/bin/env node
/**
 * USO POR CARD — `npm run cards [de] [ate]` (datas YYYY-MM-DD, padrão: últimos 7 dias).
 *
 * Lê os eventos card_view / card_interact (src/lib/medicao-cards.ts) e mostra,
 * por módulo e aba, quantas PESSOAS viram cada card e quantas usaram. É a
 * resposta a "o pessoal usa isso?" antes de redesenhar ou tirar um card.
 *
 * Regras iguais às do metricas-app.mjs: janela BRT (03:00Z), sessões do time
 * fora (emulador, headless, Mac), pessoa = user_id ou, sem conta, a sessão.
 * Só agregados: nunca imprime e-mail nem id.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SUPABASE_URL = "https://itoylenzvahbscgjgtqf.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";

const lerEnv = () => {
  for (const arq of [path.resolve(".env.local"), path.join(os.homedir(), "core/start-bloom-place/.env.local")]) {
    try {
      const linhas = fs.readFileSync(arq, "utf8").split("\n");
      const env = {};
      for (const l of linhas) {
        const i = l.indexOf("=");
        if (i > 0 && !l.startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
      if (env.CORE_ADMIN_EMAIL && env.CORE_ADMIN_PASSWORD) return env;
    } catch { /* tenta o próximo */ }
  }
  console.error("Faltam CORE_ADMIN_EMAIL / CORE_ADMIN_PASSWORD no .env.local");
  process.exit(1);
};

const args = process.argv.slice(2);
const datas = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const hojeBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const diasAtras = (n) => new Date(Date.now() - 3 * 3600_000 - n * 86400_000).toISOString().slice(0, 10);
const de = datas[0] ?? diasAtras(6);
const ate = datas[1] ?? hojeBRT();
const maisUmDia = (d) => new Date(Date.parse(d + "T00:00:00Z") + 86400_000).toISOString().slice(0, 10);
const INICIO = `${de}T03:00:00Z`;
const FIM = `${maisUmDia(ate)}T03:00:00Z`;

const env = lerEnv();
const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.CORE_ADMIN_EMAIL, password: env.CORE_ADMIN_PASSWORD }),
});
const token = (await r.json()).access_token;
if (!token) { console.error("✗ login falhou"); process.exit(1); }

const buscar = async (params) => {
  const linhas = [];
  for (let off = 0; off < 200_000; off += 1000) {
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/analytics_events?${qs}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, Range: `${off}-${off + 999}` },
    });
    const d = await resp.json();
    if (!Array.isArray(d)) { console.error("✗", JSON.stringify(d).slice(0, 200)); process.exit(1); }
    linhas.push(...d);
    if (d.length < 1000) break;
  }
  return linhas;
};

const EH_TESTE = (ua = "") => /HeadlessChrome|Macintosh|sdk_gphone|Android SDK built|generic|QPWS30\.61-21-18-7/.test(ua);

// Eventos de card + a ficha do aparelho (pra tirar o time)
const eventos = await buscar({
  select: "session_id,user_id,event_name,event_data,created_at",
  event_name: "in.(card_view,card_interact,app_device_info)",
  created_at: `gte.${INICIO}`,
  order: "created_at.asc",
});
const noPeriodo = eventos.filter((e) => e.created_at < FIM);
const sessoesTeste = new Set(
  noPeriodo.filter((e) => e.event_name === "app_device_info" && EH_TESTE(e.event_data?.ua ?? "")).map((e) => e.session_id),
);
const cards = noPeriodo.filter((e) => /^card_/.test(e.event_name) && !sessoesTeste.has(e.session_id));

if (!cards.length) {
  console.log(`\nSem eventos de card entre ${de} e ${ate}. A medição entrou em 12/09 — espera a base atualizar (web na hora; app das lojas quando a versão com ela subir).`);
  process.exit(0);
}

const pessoa = (e) => e.user_id || `s:${e.session_id}`;
const mapa = new Map(); // modulo/aba/card → { viram:Set, usaram:Set }
for (const e of cards) {
  const d = e.event_data || {};
  const k = `${d.modulo || "?"} ${d.aba || ""} ${d.card || "?"}`;
  if (!mapa.has(k)) mapa.set(k, { modulo: d.modulo || "?", aba: d.aba || "", card: d.card || "?", viram: new Set(), usaram: new Set() });
  const m = mapa.get(k);
  (e.event_name === "card_view" ? m.viram : m.usaram).add(pessoa(e));
}
const pessoasTotal = new Set(cards.map(pessoa)).size;
console.log(`\n━━━ USO POR CARD · ${de} → ${ate} (BRT) · ${pessoasTotal} pessoas ━━━`);
const porModulo = new Map();
for (const m of mapa.values()) {
  if (!porModulo.has(m.modulo)) porModulo.set(m.modulo, []);
  porModulo.get(m.modulo).push(m);
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const vistasDe = (lista) => lista.reduce((s, m) => s + m.viram.size, 0);
for (const [modulo, lista] of [...porModulo.entries()].sort((a, b) => vistasDe(b[1]) - vistasDe(a[1]))) {
  const pessoasDoModulo = new Set(lista.flatMap((m) => [...m.viram, ...m.usaram])).size;
  console.log(`\n▸ ${modulo.toUpperCase()} — ${pessoasDoModulo} pessoas`);
  console.log(`   ${"aba".padEnd(16)} ${"card".padEnd(34)} ${"viram".padStart(6)} ${"usaram".padStart(7)} ${"uso".padStart(5)}`);
  for (const m of lista.sort((a, b) => b.viram.size - a.viram.size || b.usaram.size - a.usaram.size)) {
    console.log(`   ${m.aba.slice(0, 16).padEnd(16)} ${m.card.slice(0, 34).padEnd(34)} ${String(m.viram.size).padStart(6)} ${String(m.usaram.size).padStart(7)} ${pct(m.usaram.size, m.viram.size).padStart(5)}`);
  }
}
console.log(`\n"uso" = quem usou ÷ quem viu. Card com muita vista e pouco uso ocupa espaço; card com pouca vista está longe demais na tela.`);
