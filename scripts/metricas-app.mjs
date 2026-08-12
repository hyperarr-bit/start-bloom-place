/**
 * Métricas do APP da Play: `npm run metricas [-- opções]`
 *
 * Responde a pergunta que sempre volta: "quantas pessoas entraram e onde cada
 * uma saiu?" — separando o app da web, atribuindo a origem do anúncio e
 * contando dinheiro pela fonte certa.
 *
 * Existe porque toda análise até aqui foi script descartável em /tmp: a
 * receita se perdia entre sessões e as MESMAS armadilhas eram redescobertas
 * (janela em UTC, paginação de 1000, referrer URL-encoded). Agora está no
 * repo, versionado.
 *
 * AS TRÊS REGRAS QUE ESTE ARQUIVO EXISTE PRA NÃO DEIXAR ESQUECER:
 *
 * 1. DINHEIRO SE CONTA NA TABELA `subscriptions`, NUNCA NA TELEMETRIA.
 *    Em 11/08, 3 das 4 vendas do dia não emitiram `app_sheet_success`: o
 *    Android mata o app enquanto a folha do Google está por cima e o evento
 *    morre junto. Quem contasse pela telemetria veria 1 venda de 4.
 *
 * 2. O DIA É EM BRT (UTC-3), NÃO EM UTC. O banco grava UTC, então o dia vai
 *    de <dia>T03:00Z a <dia+1>T03:00Z. Contar em UTC joga tudo que aconteceu
 *    das 21h em diante pro dia seguinte — já produziu uma análise inteira
 *    errada que o dono teve de mandar refazer.
 *
 * 3. CAMPANHA DE APP TEM CAUDA DE ~3 DIAS. O `t` dentro do install_referrer é
 *    o unix do CLIQUE no anúncio; a instalação vem depois, às vezes dias
 *    depois (comprovado: cliques de 08/08 viraram venda em 09 e em 11). Por
 *    isso o relatório separa "instalou hoje" de "clicou hoje" — julgar
 *    campanha pelo gasto do mesmo dia subestima ela sistematicamente.
 *
 * USO
 *   npm run metricas                          → hoje
 *   npm run metricas -- 2026-08-11            → um dia
 *   npm run metricas -- 2026-08-05 2026-08-11 → intervalo (inclusivo)
 *   npm run metricas -- 2026-08-11 --gasto=51 → calcula CPI e ROI
 *   npm run metricas -- --json                → saída pra pipe/arquivo
 *
 * CREDENCIAL
 *   As tabelas são protegidas por RLS: a chave anônima devolve vazio. Precisa
 *   da conta admin em `.env.local` (que o .gitignore já cobre em `.env*`):
 *     CORE_ADMIN_EMAIL=...
 *     CORE_ADMIN_PASSWORD=...
 *   SEM o prefixo VITE_ de propósito — com ele, a Vite injetaria a senha no
 *   bundle, e o app da loja EMBARCA o bundle. Ficaria dentro do APK.
 *
 *   Opcional, pra ligar a seção do RevenueCat (reembolso/sandbox, que a nossa
 *   tabela não guarda):
 *     REVENUECAT_SECRET_KEY=sk_...   (RevenueCat → Project Settings → API keys → Secret v2)
 */
import { readFileSync, existsSync } from "node:fs";
import { createDecipheriv } from "node:crypto";

const SUPABASE_URL = "https://itoylenzvahbscgjgtqf.supabase.co";
// Chave anônima: pública por natureza (vai no bundle do site). Sozinha não lê
// nada protegido — é só o passaporte pro PostgREST.
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const RC_API = "https://api.revenuecat.com/v2";
const RC_PROJETO = "proj1f095041";

/* ------------------------------------------------------------ argumentos */

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const gastoArg = args.find((a) => a.startsWith("--gasto="));
const gasto = gastoArg ? Number(gastoArg.split("=")[1].replace(",", ".")) : null;
const datas = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const jsonOut = flags.has("--json");

const hojeBRT = () => {
  const agora = new Date(Date.now() - 3 * 3600_000); // desloca pro fuso local do BR
  return agora.toISOString().slice(0, 10);
};
const de = datas[0] ?? hojeBRT();
const ate = datas[1] ?? de;
const maisUmDia = (d) => new Date(Date.parse(d + "T00:00:00Z") + 86400_000).toISOString().slice(0, 10);
// Regra 2: janela BRT. O dia começa às 03:00Z e acaba às 03:00Z do dia seguinte.
const INICIO = `${de}T03:00:00Z`;
const FIM = `${maisUmDia(ate)}T03:00:00Z`;

/* ------------------------------------------------------------ credencial */

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

const entrar = async () => {
  const email = env.CORE_ADMIN_EMAIL;
  const senha = env.CORE_ADMIN_PASSWORD;
  if (!email || !senha) {
    console.error(`
✗ Faltam as credenciais de leitura.

  As tabelas têm RLS — a chave anônima devolve vazio, sem erro (o que engana).
  Põe no .env.local (o .gitignore já cobre .env*), SEM prefixo VITE_:

    CORE_ADMIN_EMAIL=...
    CORE_ADMIN_PASSWORD=...

  O prefixo VITE_ faria a Vite injetar isso no bundle — e o app da loja
  embarca o bundle, então a senha viajaria dentro do APK.
`);
    process.exit(1);
  }
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const d = await r.json();
  if (!d.access_token) {
    console.error("✗ Login recusado:", d.error_description || d.msg || JSON.stringify(d).slice(0, 200));
    process.exit(1);
  }
  return d.access_token;
};

/* --------------------------------------------------------------- consulta */

/** PostgREST corta em 1000 linhas e NÃO avisa. Sem paginar, um dia movimentado
 *  vira um relatório silenciosamente truncado. */
const buscar = async (tabela, params, token) => {
  const linhas = [];
  for (let off = 0; off < 60_000; off += 1000) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        Range: `${off}-${off + 999}`,
      },
    });
    const d = await r.json();
    if (!Array.isArray(d)) {
      console.error(`✗ ${tabela}:`, JSON.stringify(d).slice(0, 200));
      process.exit(1);
    }
    linhas.push(...d);
    if (d.length < 1000) break;
  }
  return linhas;
};

/* ------------------------------------------------------------- utilidades */

const brt = (iso) => {
  const d = new Date(Date.parse(iso) - 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const reais = (n) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "—");

// Aparelhos do time: emulador, headless e o moto g7 do dono. Sem isso, todo
// teste nosso entra como usuário real e infla o topo do funil.
const EH_TESTE = (ua = "") =>
  /HeadlessChrome|Macintosh|sdk_gphone|Android SDK built|generic|QPWS30\.61-21-18-7/.test(ua);

/** Eventos que SÓ o shell nativo dispara — é assim que se separa app de web. */
const MARCAS_DE_APP = [
  "app_welcome_view", "app_welcome_start", "app_paywall_rc", "app_sheet_rc",
  "app_sheet_view", "app_compra_falhou", "app_compra_pendente", "app_paywall_close",
  "app_sheet_success", "install_referrer", "webview_info", "app_device_info",
  "app_prefolha_view", "app_downsell_view",
];

/** O funil do app na ordem real das telas (v48). */
const ETAPAS = [
  ["welcome", "Abriu o app"],
  ["porta", "Escolheu a área"],
  ["quiz", "Começou o quiz"],
  ["quiz_fim", "Terminou o quiz"],
  ["result", "Viu o diagnóstico"],
  ["central", "Viu os 16 módulos"],
  ["demo", "Entrou na demo"],
  ["paywall", "Viu o paywall"],
  ["cta", "Tocou em comprar"],
  ["prefolha", "Escolheu forma de pagamento"],
  ["folha", "Abriu a folha do Google"],
  ["pagou", "PAGOU"],
];

const etapasDaSessao = (evs) => {
  const m = new Set();
  for (const e of evs) {
    const n = e.event_name;
    const d = e.event_data || {};
    const s = String(d.step ?? "");
    const c = String(d.cta ?? "");
    if (n === "app_welcome_view") m.add("welcome");
    if (n === "funnel_view" && s === "start") m.add("porta");
    if (n === "funnel_view" && s.startsWith("quiz")) m.add("quiz");
    if (n === "funnel_view" && s === "progress") m.add("quiz_fim");
    if (n === "funnel_view" && s === "result") { m.add("result"); m.add("quiz_fim"); }
    if (n === "funnel_view" && s === "central") m.add("central");
    if (n === "funnel_view" && s === "demo") m.add("demo");
    if (n === "funnel_view" && s === "offer") m.add("paywall");
    if (n === "app_paywall_rc" || n === "paywall_view") m.add("paywall");
    if (n === "funnel_click" && c === "app_paywall_cta") m.add("cta");
    if (n === "app_prefolha_view") m.add("cta");           // a pré-folha só abre pelo CTA
    if (n === "app_prefolha_escolha") m.add("prefolha");
    if (n === "app_compra_falhou" || n === "app_compra_pendente" || n === "app_sheet_success") m.add("folha");
    if (n === "app_sheet_success") m.add("pagou");
  }
  return m;
};

/** Regra 3: o `t` do utm_content é o unix do CLIQUE. Vem URL-encoded
 *  (%22t%22%3A...), então procurar por `"t":` no texto cru FALHA — foi
 *  exatamente o bug que escondeu duas jornadas numa análise. Decodifica antes. */
const lerReferrer = (raw = "") => {
  const texto = decodeURIComponent(String(raw));
  const fonte = /apps\.instagram/.test(texto) ? "instagram"
    : /apps\.facebook/.test(texto) ? "facebook"
    : /google-play/.test(texto) ? "orgânico"
    : /not%20set|\(not set\)/.test(texto) ? "desconhecido"
    : "outro";
  const m = /"t":(\d+)/.exec(texto);
  return { fonte, clique: m ? Number(m[1]) * 1000 : null };
};

/* ------------------------------------------- de qual CRIATIVO veio (Meta) */

/*
 * O ANÚNCIO EXATO ESTÁ NO REFERRER — só vem trancado (12/08).
 *
 * Eu tinha dito que era impossível saber o criativo pelos nossos dados,
 * porque `utm_content.source.data` vem criptografado. Estava errado pela
 * metade: a Meta entrega a CHAVE de descriptografia no painel de
 * desenvolvedor (Settings → Basic → Android, 64 caracteres hex, uma por app).
 * Com ela, o blob abre e sai campanha, conjunto e anúncio.
 *
 * Isso importa muito: significa atribuição por criativo DENTRO da nossa base,
 * sem SDK da Meta no binário — ou seja, sem mexer na declaração de Segurança
 * de Dados da Play, que é justamente o que impede a gente de embarcar
 * rastreador (app de saúde e finanças). E funciona pra trás, em todo referrer
 * já guardado.
 *
 * Formato: AES-256-GCM. `data` e `nonce` são hex; os ÚLTIMOS 16 BYTES de
 * `data` são a tag de autenticação (o libsodium anexa na hora de cifrar), não
 * conteúdo — sem separar isso, a decifragem falha.
 */
const abrirReferrer = (raw = "") => {
  const chave = env.META_INSTALL_REFERRER_KEY;
  if (!chave) return null;
  try {
    const texto = decodeURIComponent(String(raw));
    const m = /utm_content=(\{.*\})/.exec(texto);
    if (!m) return null;
    const fonte = JSON.parse(m[1])?.source;
    if (!fonte?.data || !fonte?.nonce) return null;
    const bruto = Buffer.from(fonte.data, "hex");
    const corpo = bruto.subarray(0, -16);
    const tag = bruto.subarray(-16);
    const d = createDecipheriv("aes-256-gcm", Buffer.from(chave.trim(), "hex"), Buffer.from(fonte.nonce, "hex"));
    d.setAuthTag(tag);
    const aberto = Buffer.concat([d.update(corpo), d.final()]);
    return JSON.parse(aberto.toString());
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ main */

const token = await entrar();

const eventos = await buscar("analytics_events", {
  select: "session_id,user_id,event_name,event_data,created_at",
  "created_at": `gte.${INICIO}`,
  order: "created_at.asc",
}, token);
const noPeriodo = eventos.filter((e) => e.created_at < FIM);

// agrupa por sessão e joga fora as do time
const porSessao = new Map();
for (const e of noPeriodo) {
  if (!porSessao.has(e.session_id)) porSessao.set(e.session_id, []);
  porSessao.get(e.session_id).push(e);
}
const uaDa = (evs) => evs.find((e) => e.event_data?.ua)?.event_data?.ua ?? "";
const sessoesApp = new Map();
for (const [sid, evs] of porSessao) {
  if (!evs.some((e) => MARCAS_DE_APP.includes(e.event_name))) continue; // é web
  if (EH_TESTE(uaDa(evs))) continue;
  sessoesApp.set(sid, evs);
}

/* O funil vale pra COORTE DE INSTALAÇÃO, não pro conjunto de sessões.
 *
 * Misturar os dois mente feio: quem já tem o app instalado abre direto no
 * gate e cai no paywall SEM passar por welcome/quiz/demo. No mesmo balde,
 * "viu o paywall" fica maior que "entrou na demo" e o funil deixa de ser
 * funil. Aqui a coorte é quem instalou no período (tem install_referrer);
 * o resto é reportado à parte como retorno. */
const instalacoes = [];
const retorno = [];
for (const [sid, evs] of sessoesApp) {
  const ref = evs.find((e) => e.event_name === "install_referrer");
  const m = etapasDaSessao(evs);
  let ultima = "nada";
  for (const [k] of ETAPAS) if (m.has(k)) ultima = k;
  const registro = { sid, marcos: m, parouEm: ultima, pagou: m.has("pagou") };
  if (!ref) { retorno.push(registro); continue; }
  const { fonte, clique } = lerReferrer(ref.event_data?.referrer ?? "");
  const anuncio = abrirReferrer(ref.event_data?.referrer ?? "");
  instalacoes.push({ ...registro, fonte, clique, anuncio, instalou: Date.parse(ref.created_at) });
}

// ---- funil da coorte de instalação
const alcancou = Object.fromEntries(ETAPAS.map(([k]) => [k, 0]));
const morreuEm = Object.fromEntries([...ETAPAS.map(([k]) => [k, 0]), ["nada", 0]]);
for (const i of instalacoes) {
  for (const [k] of ETAPAS) if (i.marcos.has(k)) alcancou[k]++;
  morreuEm[i.parouEm]++;
}
const dentroDaJanela = (ms) => ms != null && ms >= Date.parse(INICIO) && ms < Date.parse(FIM);
const cliquesNoPeriodo = instalacoes.filter((i) => dentroDaJanela(i.clique));
const cauda = instalacoes.filter((i) => i.clique && !dentroDaJanela(i.clique));

// ---- caixa
const contar = (nome) => noPeriodo.filter((e) => e.event_name === nome).length;
const escolhas = {};
for (const e of noPeriodo.filter((x) => x.event_name === "app_prefolha_escolha")) {
  const met = String(e.event_data?.metodo ?? "?");
  escolhas[met] = (escolhas[met] ?? 0) + 1;
}
const cancelou = noPeriodo.filter(
  (e) => e.event_name === "app_compra_falhou" && e.event_data?.motivo === "cancelou"
).length;

// ---- dinheiro (fonte da verdade)
const vendas = await buscar("subscriptions", {
  select: "created_at,customer_email,amount_cents,revenuecat_subscription_id,user_id",
  "created_at": `gte.${INICIO}`,
  order: "created_at.asc",
}, token);
const noPer = vendas.filter((v) => v.created_at < FIM);
const vendasApp = noPer.filter((v) => v.revenuecat_subscription_id);
const vendasWeb = noPer.filter((v) => !v.revenuecat_subscription_id);
const bruto = vendasApp.reduce((t, v) => t + (v.amount_cents ?? 0), 0) / 100;
const liquido = bruto * 0.85; // o Play fica com 15% (programa de pequenos negócios)

/* ---------------------------------------------------------------- saída */

if (jsonOut) {
  console.log(JSON.stringify({
    periodo: { de, ate },
    sessoes_app: sessoesApp.size,
    funil: alcancou, saiu_em: morreuEm,
    instalacoes: { total: instalacoes.length, clique_no_periodo: cliquesNoPeriodo.length, cauda: cauda.length },
    caixa: { prefolha_view: contar("app_prefolha_view"), escolhas, fechou: contar("app_prefolha_fechou"), cancelou, downsell: contar("app_downsell_view") },
    vendas: { app: vendasApp.length, web: vendasWeb.length, bruto, liquido },
  }, null, 2));
  process.exit(0);
}

const L = (s = "") => console.log(s);
L();
L(`━━━ APP DA PLAY · ${de === ate ? de : `${de} → ${ate}`} (BRT) ━━━`);
L();
L(`  ${sessoesApp.size} sessões do app · ${instalacoes.length} instalações novas · ${retorno.length} de quem já tinha o app`);
L();

L(`▸ FUNIL DE AQUISIÇÃO — as ${instalacoes.length} pessoas que INSTALARAM no período`);
const base = instalacoes.length || 1;
let anterior = base;
for (const [k, rotulo] of ETAPAS) {
  const v = alcancou[k];
  const queda = anterior > v ? `  ↓ perde ${pct(anterior - v, anterior)}` : "";
  L(`   ${rotulo.padEnd(28)} ${String(v).padStart(4)}  ${pct(v, base).padStart(6)}${queda}`);
  if (v) anterior = v;
}
L();

L("▸ ONDE SAÍRAM — última tela de cada uma dessas pessoas");
const maiorSaida = Math.max(...Object.values(morreuEm), 1);
const ordenado = [...ETAPAS.map(([k, r]) => [k, r]), ["nada", "Instalou e não abriu"]]
  .filter(([k]) => morreuEm[k])
  .sort((a, b) => morreuEm[b[0]] - morreuEm[a[0]]);
for (const [k, rotulo] of ordenado) {
  const v = morreuEm[k];
  L(`   ${rotulo.padEnd(28)} ${String(v).padStart(4)}  ${pct(v, base).padStart(6)}  ${"█".repeat(Math.round((30 * v) / maiorSaida))}`);
}
L();

// Retorno é onde mora boa parte do dinheiro (a pessoa instala hoje e compra
// dias depois), então nunca some do relatório.
const retornoPagou = retorno.filter((r) => r.pagou).length;
const retornoPaywall = retorno.filter((r) => r.marcos.has("paywall")).length;
L("▸ QUEM JÁ TINHA O APP (voltou no período)");
L(`   ${retorno.length} sessões · ${retornoPaywall} viram o paywall · ${retornoPagou} pagaram`);
L();

L("▸ CAIXA (v48)");
L(`   viram a pré-folha           ${contar("app_prefolha_view")}`);
L(`   escolheram forma            ${Object.entries(escolhas).map(([k, v]) => `${k}: ${v}`).join(" · ") || "ninguém"}`);
L(`   fecharam a pré-folha        ${contar("app_prefolha_fechou")}`);
L(`   cancelaram a folha Google   ${cancelou}`);
L(`   downsell R$19,90 exibido    ${contar("app_downsell_view")}`);
L(`   Pix pendente                ${contar("app_compra_pendente")}`);
L();

L("▸ DINHEIRO (tabela subscriptions — a verdade)");
L(`   APP: ${vendasApp.length} vendas · ${reais(bruto)} bruto · ${reais(liquido)} líquido (Play fica com 15%)`);
for (const v of vendasApp) L(`      ${brt(v.created_at)}  ${(v.customer_email ?? "").padEnd(34)} ${reais((v.amount_cents ?? 0) / 100)}`);
L(`   WEB: ${vendasWeb.length} vendas · ${reais(vendasWeb.reduce((t, v) => t + (v.amount_cents ?? 0), 0) / 100)}`);
const semEvento = vendasApp.length - alcancou.pagou;
if (semEvento > 0) {
  L(`   ⚠ ${semEvento} venda(s) do app não emitiram evento de sucesso na telemetria`);
  L(`     (o app morre com a folha do Google por cima). Normal — o webhook pegou.`);
}
L();

L("▸ ATRIBUIÇÃO DAS INSTALAÇÕES");
const porFonte = {};
for (const i of instalacoes) porFonte[i.fonte] = (porFonte[i.fonte] ?? 0) + 1;
for (const [f, n] of Object.entries(porFonte).sort((a, b) => b[1] - a[1])) L(`   ${f.padEnd(14)} ${n}`);
L();
L(`   clicaram no anúncio DENTRO do período : ${cliquesNoPeriodo.length}  (${cliquesNoPeriodo.filter((i) => i.pagou).length} compraram)`);
L(`   clicaram ANTES (cauda)               : ${cauda.length}  (${cauda.filter((i) => i.pagou).length} compraram)`);
if (cauda.length) {
  L(`   → cauda comprovada: campanha de app rende dias depois do gasto.`);
  for (const i of cauda.filter((x) => x.pagou)) {
    L(`     • clicou ${brt(new Date(i.clique).toISOString())}, instalou ${brt(new Date(i.instalou).toISOString())}, COMPROU`);
  }
}
L();

/* Atribuição por CRIATIVO saída da NOSSA base (não da Meta): cada instalação
 * carrega, dentro do referrer, a campanha/conjunto/anúncio que a trouxe. É o
 * único caminho que liga anúncio → venda sem SDK no app. */
L("▸ POR CRIATIVO (do install referrer, base própria)");
if (!env.META_INSTALL_REFERRER_KEY) {
  L("   (desligado) Falta a CHAVE DE DESCRIPTOGRAFIA do install referrer.");
  L("   Pegue em: developers.facebook.com → seu app → Configurações → Básico →");
  L("   seção Android → \"Chave de descriptografia do install referrer\" (64 caracteres).");
  L("   Ponha no .env.local como META_INSTALL_REFERRER_KEY=<64 hex>.");
  L("   Com ela sai campanha, conjunto e ANÚNCIO de cada instalação — sem SDK");
  L("   no binário, e vale pra trás em todo referrer já guardado.");
} else {
  const comAnuncio = instalacoes.filter((i) => i.anuncio);
  const semAnuncio = instalacoes.filter((i) => !i.anuncio && i.fonte !== "orgânico" && i.fonte !== "desconhecido");
  if (!comAnuncio.length) {
    L(`   ✗ nenhum referrer abriu (${instalacoes.length} instalação(ões) no período).`);
    L("     Chave errada, ou os installs do período não vieram de anúncio Meta.");
  } else {
    const porAd = new Map();
    for (const i of comAnuncio) {
      const k = `${i.anuncio.campaign_name ?? "?"}|${i.anuncio.adgroup_name ?? "?"}|${i.anuncio.ad_id ?? "?"}`;
      if (!porAd.has(k)) porAd.set(k, { campanha: i.anuncio.campaign_name, conjunto: i.anuncio.adgroup_name, ad: i.anuncio.ad_id, instalou: 0, pagou: 0 });
      const r = porAd.get(k);
      r.instalou++;
      if (i.pagou) r.pagou++;
    }
    L(`   ${"campanha".padEnd(24)} ${"conjunto".padEnd(22)} ${"anúncio".padEnd(18)} ${"inst".padStart(5)} ${"vendas".padStart(7)}`);
    for (const r of [...porAd.values()].sort((a, b) => b.instalou - a.instalou)) {
      L(`   ${String(r.campanha ?? "?").slice(0, 24).padEnd(24)} ${String(r.conjunto ?? "?").slice(0, 22).padEnd(22)} ${String(r.ad ?? "?").slice(0, 18).padEnd(18)} ${String(r.instalou).padStart(5)} ${String(r.pagou).padStart(7)}`);
    }
    if (semAnuncio.length) L(`   (${semAnuncio.length} referrer de anúncio não abriu — chave ou formato)`);
    L(`   ⚠ "vendas" aqui é quem instalou E comprou na MESMA sessão. A cauda de`);
    L(`     dias (comprovada) não aparece nesta coluna — pra ela, cruze o ad_id`);
    L(`     da instalação com a venda depois.`);
  }
}
L();

if (gasto != null) {
  L("▸ CAMPANHA");
  const n = cliquesNoPeriodo.length;
  const vendasDoPeriodo = cliquesNoPeriodo.filter((i) => i.pagou).length;
  L(`   gasto                         ${reais(gasto)}`);
  L(`   instalações de cliques do período ${n}${n ? `  →  CPI ${reais(gasto / n)}` : ""}`);
  L(`   vendas atribuídas (mesma janela)  ${vendasDoPeriodo}`);
  const liqAtrib = vendasDoPeriodo * 27.9 * 0.85;
  L(`   ROI estrito (só clique do período): ${reais(liqAtrib - gasto)} ${liqAtrib >= gasto ? "✓" : "✗"}`);
  L(`   ROI de caixa (todas as vendas app): ${reais(liquido - gasto)} ${liquido >= gasto ? "✓" : "✗"}`);
  L(`   ⚠ o estrito subestima: parte do gasto de hoje vira venda em 1-3 dias.`);
  L();
}

/* --------------------------------------------------- por criativo (Meta) */

/* "De qual criativo veio a venda?" só a Meta responde: o anúncio viaja
 * criptografado dentro do install_referrer (`source.data`) e nenhuma chave
 * nossa abre aquilo. Então o número vem da Graph API, nível `ad`.
 *
 * ⚠ Isto só é verdade se as compras estiverem CHEGANDO no dataset. Em 11/08
 * apenas 2 de 6 chegaram, porque a v48 compra anônimo e o webhook desiste de
 * id anônimo — o `revenuecat-sync` passou a avisar a Meta também. Se as
 * compras aqui vierem bem abaixo das vendas do relatório acima, é este cano
 * que está entupido, não o criativo que é ruim. */
if (flags.has("--criativos")) {
  L("▸ POR CRIATIVO (dados da Meta)");
  const chamaMeta = async (nivel) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/meta-insights`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ since: de, until: ate, nivel }),
    });
    return await r.json().catch(() => ({}));
  };
  const d = await chamaMeta("ad");
  // O OBJETIVO separa campanha de app de campanha de web — e não dá pra
  // deduzir pelo nome (aqui as duas se chamam "tempo perdido"). Sem isso a
  // venda da web parece do app e a leitura inteira vira ficção.
  const objs = {};
  for (const c of (await chamaMeta("campanhas")).campanhas ?? []) {
    objs[c.name] = String(c.objective ?? "").replace("OUTCOME_", "");
  }
  if (d.error) {
    L(`   ✗ ${d.error}${d.detail ? `: ${d.detail}` : ""}`);
  } else if (!d.anuncios?.length) {
    L("   (a Meta não devolveu anúncio com entrega neste período)");
  } else {
    // A CAMPANHA vai junto de propósito: a conta tem anúncio de web e de app
    // ao mesmo tempo, e sem essa coluna a compra da web parece do app.
    const ordenados = d.anuncios.filter((a) => a.gasto > 0 || a.compras > 0).sort((a, b) => b.gasto - a.gasto);
    L(`   ${"campanha".padEnd(24)} ${"tipo".padEnd(14)} ${"criativo".padEnd(22)} ${"gasto".padStart(9)} ${"compras".padStart(8)} ${"CPA".padStart(9)}`);
    let gastoApp = 0, gastoWeb = 0, comprasApp = 0;
    for (const a of ordenados) {
      const tipo = objs[a.campanha] ?? "?";
      const ehApp = tipo === "APP_PROMOTION";
      if (ehApp) { gastoApp += a.gasto; comprasApp += a.compras; } else gastoWeb += a.gasto;
      const cpa = a.compras ? reais(a.gasto / a.compras) : "—";
      L(`   ${String(a.campanha ?? "?").slice(0, 24).padEnd(24)} ${tipo.slice(0, 14).padEnd(14)} ${String(a.criativo ?? "?").slice(0, 22).padEnd(22)} ${reais(a.gasto).padStart(9)} ${String(a.compras).padStart(8)} ${cpa.padStart(9)}`);
    }
    L();
    L(`   gasto em APP_PROMOTION: ${reais(gastoApp)}  ·  em Vendas/web: ${reais(gastoWeb)}`);
    if (gastoApp > 0 && comprasApp < vendasApp.length) {
      L(`   ⚠ a Meta atribuiu ${comprasApp} compra(s) às campanhas de app, mas o banco`);
      L(`     tem ${vendasApp.length} venda(s) no app. Ou o evento não chegou no dataset, ou`);
      L(`     a Meta não conseguiu casar a pessoa (sem SDK, o pareamento é por`);
      L(`     e-mail/external_id — mais fraco). Relatório da Meta também atrasa horas.`);
    }
    const nomes = new Set(ordenados.map((a) => a.criativo));
    if (ordenados.length > 1 && nomes.size < ordenados.length) {
      L(`   ⚠ há criativos com o MESMO nome — teste A/B fica ilegível. Renomeie no`);
      L(`     Gerenciador (o nome do anúncio é a única etiqueta que chega aqui).`);
    }
    // Instalação some de propósito: a Meta só conta install com SDK dela (ou
    // MMP) dentro do app, e este binário não embarca rastreador nenhum por
    // decisão de Data Safety. O número REAL de instalações é o do relatório
    // acima, que sai do install_referrer da própria Play.
    L(`   (a Meta não conta instalação: o app não embarca SDK dela — use o número`);
    L(`    de instalações do relatório acima, que vem do install_referrer da Play.)`);
    const totalCompras = ordenados.reduce((t, a) => t + a.compras, 0);
    if (totalCompras < vendasApp.length) {
      L(`   ⚠ a Meta contou ${totalCompras} compra(s), nosso banco tem ${vendasApp.length}.`);
      L(`     Diferença = evento que não chegou no dataset (ver mandarCompraProMeta).`);
    }
  }
  L();
}

// RevenueCat é opcional — a tabela `subscriptions` já espelha o essencial.
// Ele serve pro que a nossa tabela NÃO guarda: reembolso, sandbox, entitlement.
if (env.REVENUECAT_SECRET_KEY) {
  L("▸ REVENUECAT");
  try {
    const r = await fetch(`${RC_API}/projects/${RC_PROJETO}/products`, {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}` },
    });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 160));
    L(`   ${(d.items ?? []).length} produtos no projeto:`);
    for (const p of d.items ?? []) L(`      ${p.store_identifier ?? p.id}  (${p.type ?? "?"})`);
    L(`   Para reembolso/sandbox de UMA pessoa:`);
    L(`      GET ${RC_API}/projects/${RC_PROJETO}/customers/<user_id>/purchases`);
  } catch (e) {
    L(`   ✗ ${String(e.message).slice(0, 160)}`);
  }
} else {
  L("▸ REVENUECAT (desligado)");
  L("   A tabela `subscriptions` já espelha as compras — o RevenueCat só");
  L("   acrescenta reembolso, sandbox e entitlement. Pra ligar, pegue a chave");
  L("   em RevenueCat → Project Settings → API keys → Secret (v2) e ponha no");
  L("   .env.local como REVENUECAT_SECRET_KEY=sk_...");
}
L();
