/**
 * O SCRIPT DO HTML LEVE DO /missao (protótipo 18/10). Vanilla, sem React — a tela 1 já veio pintada no HTML.
 *
 *  1. mede (missao_html: quando o HTML chegou e a tela 1 apareceu) e guarda a sessão do funil;
 *  2. PRÉ-CARREGA o app em segundo plano: o download de ./app-entry (React + App + CSS, sem montar) começa assim que
 *     este script roda (a tela 1 já está pintada pelo HTML). No toque numa área, pede o módulo dela EM PARALELO;
 *  3. tela 1 → tela 2 (a dor da área, honesta, sem número inventado) → botão → o App monta no MESMO documento,
 *     já no módulo da área com o tutorial da missão aberto. Se o app ainda não chegou, "Abrindo seu CORE…".
 *  4. o #mt (as telas leves) só sai quando o tutorial está na tela (html[data-missao-tutorial]) — nunca tela branca.
 * Voltar do navegador: tela 2 → tela 1 (pushState com a MESMA URL, pra não perder utm/fbclid da captura).
 */
type Area = "dinheiro" | "rotina" | "corpo" | "metas" | "tudo";
type AppEntry = typeof import("./app-entry");

const AREAS: Record<Area, { kicker: string; h1: string; p: string; passos: [string, string][]; cta: string }> = {
  dinheiro: {
    kicker: "Dinheiro",
    h1: "Saber quanto dá pra gastar hoje muda o mês.",
    p: "Não é cortar tudo. É ter um número pro dia e ver ele mudar quando você gasta.",
    passos: [["Monte suas Finanças", "renda e contas, em 30 segundos"], ["Veja quanto pode gastar hoje", "o CORE faz a conta"], ["Anote o primeiro gasto", "e veja o número se ajustar"]],
    cta: "Montar minhas Finanças",
  },
  rotina: {
    kicker: "Rotina",
    h1: "O dia não some por preguiça. Some porque nada está escrito.",
    p: "Uma rotina curta, marcada na hora, vale mais que a lista gigante que ninguém cumpre.",
    passos: [["Monte sua Rotina", "a hora que você acorda e o que quer fazer"], ["Marque o primeiro de hoje", "no quadradinho do dia"], ["Veja a semana tomar forma", "cada dia marcado vira sequência"]],
    cta: "Montar minha Rotina",
  },
  corpo: {
    kicker: "Corpo e saúde",
    h1: "Recomeçar toda segunda cansa.",
    p: "O que segura é abrir o celular e o treino de hoje já estar lá. Sem pensar, sem planilha.",
    passos: [["Responda 2 perguntas", "onde você treina e quantos dias"], ["Receba um treino pronto", "a semana inteira montada"], ["Comece hoje", "o 1º treino já aparece"]],
    cta: "Escolher meu treino",
  },
  metas: {
    kicker: "Metas",
    h1: "Meta que fica na cabeça vira vontade.",
    p: "Escrita, com o primeiro passo, vira plano. Começa com uma só.",
    passos: [["Escolha uma meta", "ou escreva a sua"], ["Veja ela no seu quadro", "com o progresso à vista"], ["Amanhã, o próximo passo", "o CORE te mostra onde parou"]],
    cta: "Escrever minha meta",
  },
  tudo: {
    kicker: "Tudo um pouco",
    h1: "Quando tudo pesa, comece pelo que mais aperta.",
    p: "Pra quase todo mundo é o dinheiro. Um passo por dia, uma área por vez.",
    passos: [["Hoje: Finanças", "quanto dá pra gastar por dia"], ["Amanhã: Rotina", "um dia que anda"], ["Depois: Saúde", "água, sono e consultas"]],
    cta: "Começar pelas Finanças",
  },
};

const $ = (id: string) => document.getElementById(id)!;
const agora = () => Math.round(performance.now());
const w = window as unknown as {
  __missao?: { pronto: boolean; prontoEm: number | null; tela1: number | null };
  __eventosMissao?: Record<string, unknown>[];
};
w.__missao = { pronto: false, prontoEm: null, tela1: null };
w.__eventosMissao = w.__eventosMissao || [];

/* ───────── sessão + eventos (o mesmo endpoint/chave anon do trackEventBeacon; SÓ no domínio de produção) ───────── */
const novoId = () => { try { return crypto.randomUUID(); } catch { return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; } };
let sessao = "";
try { sessao = sessionStorage.getItem("missao-sessao-v1") || ""; } catch { /* noop */ }
if (!sessao) { sessao = novoId(); try { sessionStorage.setItem("missao-sessao-v1", sessao); } catch { /* noop */ } }
let coreSid = "";
try { coreSid = sessionStorage.getItem("core_session_id") || ""; if (!coreSid) { coreSid = novoId(); sessionStorage.setItem("core_session_id", coreSid); } } catch { /* noop */ }
const PRODUCAO = /(^|\.)coreaplicativo\.com\.br$/.test(location.hostname);
const URL_EV = "https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const ua = navigator.userAgent || "";
const plataforma = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "web";
const inApp = /Instagram|FBAN|FBAV|FB_IAB/i.test(ua);
function evento(nome: string, dados: Record<string, unknown> = {}) {
  const corpo = { ...dados, missao_session_id: sessao, plataforma, in_app: inApp, t_ms: agora() };
  w.__eventosMissao!.push({ nome, ...corpo });
  if (!PRODUCAO) return;
  try {
    const q = new URLSearchParams(location.search);
    fetch(URL_EV, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "return=minimal" },
      // 19/10: sem coluna `page` na tabela (o insert inteiro voltava 400 e as telas 1–2 sumiam) → o caminho vai em event_data.path
      body: JSON.stringify({ user_id: null, session_id: coreSid, event_name: nome, event_data: { ...corpo, path: location.pathname, utm_source: q.get("utm_source"), utm_campaign: q.get("utm_campaign"), utm_content: q.get("utm_content"), fbclid: q.get("fbclid") } }),
    }).catch(() => {});
  } catch { /* nunca derruba a tela */ }
}

/* tela 1 visível: o HTML já pintou; o 1º frame depois deste script confirma */
requestAnimationFrame(() => {
  w.__missao!.tela1 = agora();
  let ttfb: number | null = null;
  try { const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined; if (n) ttfb = Math.round(n.responseStart); } catch { /* noop */ }
  evento("missao_html", { tela1_ms: w.__missao!.tela1, ttfb_ms: ttfb });
});

/* ───────── o app em segundo plano ───────── */
let app: Promise<AppEntry> | null = null;
let appPronto: AppEntry | null = null;
function carregarApp(): Promise<AppEntry> {
  if (!app) {
    app = import("./app-entry").then((m) => {
      appPronto = m;
      w.__missao!.pronto = true;
      w.__missao!.prontoEm = agora();
      evento("missao_app_carregado", {});
      return m;
    });
    app.catch(() => { app = null; });
  }
  return app;
}
// 18/10 (versão de verdade, "quem toca rápido"): o download do app começa JÁ — o import() só pede os arquivos (a rede
// trabalha enquanto ela lê a tela 1, que já está pintada pelo HTML); a avaliação do JS acontece quando chegam. Antes
// esperava 2 frames + o ocioso (até ~0,6 s de rede parada no 4G lento).
void carregarApp();

/* O MÓDULO da área: pedido assim que o app chega (app-entry.preaquecer — o mesmo pedaço do React.lazy do App.tsx).
   18/10: pedir o módulo direto daqui (em paralelo) fazia o Rollup picar o app em ~50 pedaços (+45 KB comprimidos e o
   app pronto ~1 s DEPOIS no 4G lento) — medido, desfeito. */
let areaPreaquecida: Area | null = null;
function preaquecerArea(area: Area): void {
  if (areaPreaquecida === area) return;
  areaPreaquecida = area;
  void carregarApp().then((m) => m.preaquecer(area)).catch(() => { areaPreaquecida = null; });
}

/* "O tutorial está na tela": a marca que tira as telas leves (sem tela branca) e que a camada da oferta espera pra
   carregar (ela não disputa a rede com o módulo). Os mesmos alvos da camada (src/missao/FunilMissaoCamada). */
const TUTORIAL_NA_TELA = "html[data-montar-financas], html[data-montar-rotina], html[data-missao-dose], [data-testid='missao-doses-festa'], [data-testid='missao-doses-passo']";
function vigiarTutorial(): void {
  const marcar = () => {
    if (document.documentElement.hasAttribute("data-missao-tutorial")) return true;
    if (!document.querySelector(TUTORIAL_NA_TELA)) return false;
    document.documentElement.setAttribute("data-missao-tutorial", "1");
    return true;
  };
  if (marcar()) return;
  const obs = new MutationObserver(() => { if (marcar()) obs.disconnect(); });
  obs.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
}

/* pixels de anúncio: só em produção, depois da tela 1 (fila fbq igual à do index.html) */
if (PRODUCAO) {
  const f = window as unknown as { fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown } };
  if (!f.fbq) {
    const n = function (...a: unknown[]) { if (n.callMethod) n.callMethod(...a); else n.queue!.push(a); } as NonNullable<typeof f.fbq>;
    n.queue = []; n.loaded = true; n.version = "2.0"; n.push = n;
    f.fbq = n;
  }
  f.fbq!("init", "998037194527241");
  f.fbq!("init", "1104688251942954"); // 19/10: pixel iris (conta nova) — mesmos eventos, mesmo eventID
  f.fbq!("track", "PageView");
  addEventListener("load", () => setTimeout(() => {
    const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.appendChild(s);
  }, 1200), { once: true });
}

/* ───────── as telas ───────── */
let areaEscolhida: Area | null = null;
type IdTela = "mt-t1" | "mt-t2" | "mt-t3" | "mt-t4" | "mt-t5";
function mostrar(id: IdTela) {
  for (const t of ["mt-t1", "mt-t2", "mt-t3", "mt-t4", "mt-t5"] as IdTela[]) {
    const el = $(t);
    if (t === id) { el.hidden = false; el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; } // reinicia a MESMA entrada
    else el.hidden = true;
  }
  try { $("mt").scrollTop = 0; } catch { /* noop */ }
}

function preencherTela2(area: Area) {
  const c = AREAS[area];
  $("mt-kicker").textContent = c.kicker;
  $("mt-h1").textContent = c.h1;
  $("mt-p").textContent = c.p;
  $("mt-cta-txt").textContent = c.cta;
  const ol = $("mt-passos");
  ol.textContent = "";
  c.passos.forEach(([t, s], i) => {
    const li = document.createElement("li");
    const em = document.createElement("em"); em.textContent = String(i + 1);
    const span = document.createElement("span"); span.textContent = t;
    const small = document.createElement("small"); small.textContent = s;
    span.appendChild(small);
    li.append(em, span);
    ol.appendChild(li);
  });
}

document.querySelectorAll<HTMLButtonElement>("button.mt-op").forEach((b) => {
  b.addEventListener("click", () => {
    const area = b.dataset.area as Area;
    areaEscolhida = area;
    document.querySelectorAll("button.mt-op.on").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    evento("missao_area", { area, app_pronto: !!appPronto });
    preaquecerArea(area);
    preencherTela2(area);
    setTimeout(() => {
      try { history.pushState({ missaoTela: 2 }, "", location.href); } catch { /* noop */ }
      mostrar("mt-t2");
      evento("missao_ponte_view", { area });
    }, 160); // o realce aparece antes de trocar (igual ao /hoje)
  });
});

$("mt-voltar").addEventListener("click", () => { try { history.back(); } catch { mostrar("mt-t1"); } });
addEventListener("popstate", () => { if (!abriu) mostrar("mt-t1"); });

let abriu = false;
$("mt-cta").addEventListener("click", () => {
  if (!areaEscolhida || abriu) return;
  abriu = true;
  const area = areaEscolhida;
  const t0 = performance.now();
  evento("missao_cta", { area, app_pronto: !!appPronto });
  const ctaTxt = $("mt-cta-txt");
  ctaTxt.textContent = "Abrindo…";
  preaquecerArea(area);
  // o app ainda não chegou e a área é Finanças: o PASSO 1 do tutorial já aparece aqui, em HTML (ela responde enquanto
  // o app termina de chegar); o app monta por trás e a resposta vai pra tela de verdade (passo1.ts)
  if (passo1Cabe(area)) {
    mostrar(area === "rotina" ? "mt-t5" : "mt-t4");
    evento("missao_tutorial_na_tela", { area, ms_desde_toque: Math.round(performance.now() - t0), via: "passo1_html" });
    if (area === "rotina") abrirPasso1Rotina(area, t0); else abrirPasso1(area, t0);
    carregarApp().then((m) => { vigiarTutorial(); m.montar(area, sessao, t0); }).catch(() => { location.href = `/missao/app?area=${area}`; });
    return;
  }
  // só mostra "Abrindo seu CORE…" se demorar (app ainda baixando): quem tem o app pronto vai direto
  const avisar = setTimeout(() => { mostrar("mt-t3"); evento("missao_abrindo_view", { area }); }, appPronto ? 900 : 120);
  carregarApp().then((m) => {
    vigiarTutorial();
    m.montar(area, sessao, t0);
    revelarQuandoPronto(avisar, t0, area);
  }).catch(() => {
    // o app não veio (rede caiu): o caminho de sempre, recarregando direto no app
    location.href = `/missao/app?area=${area}`;
  });
});

/** Tira as telas leves quando o tutorial aparece (ou em 6 s, rede de segurança) — com a MESMA entrada no app. */
function revelarQuandoPronto(avisar: ReturnType<typeof setTimeout>, t0: number, area: Area) {
  let feito = false;
  const revelar = (via: string) => {
    if (feito) return;
    feito = true;
    clearTimeout(avisar);
    obs.disconnect();
    const raiz = $("root");
    raiz.classList.remove("mt-entrando"); void raiz.offsetWidth; raiz.classList.add("mt-entrando");
    $("mt").remove();
    evento("missao_tutorial_na_tela", { area, ms_desde_toque: Math.round(performance.now() - t0), via });
  };
  const obs = new MutationObserver(() => { if (document.documentElement.hasAttribute("data-missao-tutorial")) revelar("tutorial"); });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-missao-tutorial"] });
  if (document.documentElement.hasAttribute("data-missao-tutorial")) revelar("tutorial");
  setTimeout(() => revelar("tempo"), 6000);
}

/* ───────── o PASSO 1 DE FINANÇAS em HTML (quem toca antes de o app chegar) ─────────
   A MESMA tela 1 do "Vamos montar suas Finanças" (src/components/finance/montar/MontarFinancas, passo "renda"). Ela
   responde aqui; o app monta por trás (o #mt fica por cima); no "Continuar", a resposta vai pra tela de verdade pelos
   MESMOS toques (o chip da faixa, ou o valor digitado no campo) e o "Continuar" de lá é tocado — o passo 2 entra com a
   animação de sempre e o #mt sai. "Pular" toca o "Pular" de verdade. Nada de dado gravado por fora do app. */
const FAIXAS_DE_RENDA: { id: string; rotulo: string; valor: number }[] = [ // = lib/montar-financas FAIXAS_DE_RENDA (o teste confere)
  { id: "ate2", rotulo: "Até R$ 2 mil", valor: 1500 },
  { id: "2a4", rotulo: "R$ 2 a 4 mil", valor: 3000 },
  { id: "4a7", rotulo: "R$ 4 a 7 mil", valor: 5500 },
  { id: "7mais", rotulo: "Mais de R$ 7 mil", valor: 8000 },
];
// 1.0.17 (dono: "minimalista"): o app tirou a dica embaixo do campo — a tela em HTML espelha (vazia = escondida)
const DICA_SEM_FAIXA = "";
const DICA_COM_FAIXA = "";
const reaisDigitados = (t: string): number => { const so = String(t ?? "").split(",")[0].replace(/\D/g, "").slice(0, 7); return so ? parseInt(so, 10) : 0; };
const reaisTexto = (v: number): string => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/** Cabe o passo 1 em HTML? Finanças (dinheiro/tudo) e Rotina, só com o app ainda chegando, e só se ela ainda não
 *  passou do passo 1 (missão sem dose feita; o "Vamos montar" sem decisão nem rascunho além da 1ª pergunta). */
function passo1Cabe(area: Area): boolean {
  if (area !== "dinheiro" && area !== "tudo" && area !== "rotina") return false;
  if (appPronto) return false; // o app chegou: o tutorial de verdade abre em ~0,2 s
  try {
    const w = JSON.parse(localStorage.getItem("core-missao-web") || "null") as { dose1?: number; festa?: unknown; pago?: unknown } | null;
    if (w && (w.dose1 || w.festa || w.pago)) return false;
    const chave = area === "rotina" ? "core-montar-rotina" : "core-montar-financas";
    const primeira = area === "rotina" ? "acordar" : "renda";
    const m = JSON.parse(localStorage.getItem(chave) || "null") as { r?: string; rascunho?: { etapa?: string } } | null;
    if (m && (m.r || (m.rascunho && m.rascunho.etapa && m.rascunho.etapa !== primeira))) return false;
  } catch { return false; }
  return true;
}

/** "Out 2026" (celular) / "Outubro de 2026" (≥ 460 px) — o MesDoCabecalho do app. */
function mesDoCabecalho(): string {
  try {
    const d = new Date();
    const abrev = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return innerWidth >= 460
      ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase())
      : `${abrev.charAt(0).toUpperCase()}${abrev.slice(1)} ${d.getFullYear()}`;
  } catch { return ""; }
}

/** Tira as telas leves (o passo 2 de verdade já está na tela) — com a MESMA entrada do app. */
function sairDoPasso1(area: Area, acao: string, t0: number, t1: number, achou: boolean) {
  const raiz = $("root");
  raiz.classList.remove("mt-entrando"); void raiz.offsetWidth; raiz.classList.add("mt-entrando");
  document.getElementById("mt")?.remove();
  evento("missao_passo1_entregue", { area, acao, ms_espera: Math.round(performance.now() - t1), ms_desde_toque: Math.round(performance.now() - t0), achou });
}

/* O passo 1 da ROTINA (MontarRotina "Que horas você acorda?"): 6h/7h/8h = 1 toque é a resposta (segue sozinho, como no
   app); "Outro horário" e "Pular" passam o toque pra tela de verdade (o relógio do sistema abre lá). */
function abrirPasso1Rotina(area: Area, t0: number) {
  $("mtr-mes").textContent = mesDoCabecalho();
  let entregando = false;
  evento("missao_passo1_html", { area, acao: "view" });
  const entregar = async (opcao: string | null) => {
    if (entregando) return;
    entregando = true;
    const t1 = performance.now();
    document.querySelectorAll<HTMLButtonElement>("#mtr-chips button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.opcao === opcao)));
    evento("missao_passo1_html", { area, acao: opcao ? "hora" : "pular", opcao, app_pronto: !!appPronto });
    const mrt = await esperar(() => document.querySelector<HTMLElement>('.mrt[data-etapa="acordar"]'), 20000);
    if (mrt) {
      if (!opcao) mrt.querySelector<HTMLButtonElement>("button.mrt-pular")?.click();
      else {
        const chips = [...mrt.querySelectorAll<HTMLButtonElement>("button.mrt-chip[data-hora]")];
        const chip = opcao === "outro" ? chips.find((b) => b.hasAttribute("data-outro")) : chips.find((b) => (b.textContent || "").trim() === opcao);
        chip?.click();
        if (opcao !== "outro") await esperar(() => document.querySelector('.mrt[data-etapa="itens"]'), 3000);
        else await doisFrames();
      }
    }
    sairDoPasso1(area, opcao ? "hora" : "pular", t0, t1, !!mrt);
  };
  document.querySelectorAll<HTMLButtonElement>("#mtr-chips button").forEach((b) => b.addEventListener("click", () => { void entregar(b.dataset.opcao || null); }));
  $("mtr-pular").addEventListener("click", () => { void entregar(null); });
}

function esperar<T>(achar: () => T | null, ms: number): Promise<T | null> {
  return new Promise((ok) => {
    const ja = achar(); if (ja) { ok(ja); return; }
    const fim = setTimeout(() => { obs.disconnect(); ok(achar()); }, ms);
    const obs = new MutationObserver(() => { const a = achar(); if (a) { clearTimeout(fim); obs.disconnect(); ok(a); } });
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
}
const doisFrames = () => new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok())));

function abrirPasso1(area: Area, t0: number) {
  let faixa: string | null = null;
  let renda = 0;
  let entregando = false;
  $("mtf-mes").textContent = mesDoCabecalho();
  const chips = $("mtf-chips");
  const input = $("mtf-renda") as HTMLInputElement;
  const cta = $("mtf-cta") as HTMLButtonElement;
  const dica = $("mtf-dica");
  const pintar = () => {
    chips.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.faixa === faixa)));
    input.value = renda ? reaisTexto(renda) : "";
    dica.textContent = faixa ? DICA_COM_FAIXA : DICA_SEM_FAIXA;
    dica.hidden = !dica.textContent;
    cta.disabled = renda <= 0 || entregando;
  };
  chips.textContent = "";
  for (const f of FAIXAS_DE_RENDA) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "mtf-chip"; b.dataset.faixa = f.id; b.textContent = f.rotulo;
    b.addEventListener("click", () => { if (entregando) return; faixa = f.id; renda = f.valor; pintar(); });
    chips.appendChild(b);
  }
  input.addEventListener("input", () => { if (entregando) return; renda = reaisDigitados(input.value); faixa = null; pintar(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  pintar();
  evento("missao_passo1_html", { area, acao: "view" });

  const entregar = async (acao: "continuar" | "pular") => {
    if (entregando) return;
    entregando = true;
    const t1 = performance.now();
    cta.disabled = true;
    if (acao === "continuar") { cta.innerHTML = '<i class="mtf-gira" aria-hidden="true"></i><span>Continuar</span>'; }
    evento("missao_passo1_html", { area, acao, faixa: faixa ?? (renda ? "digitou" : null), app_pronto: !!appPronto });
    // a tela de verdade, no passo da renda (o app pode ainda estar chegando: espera até 20 s)
    const mf = await esperar(() => document.querySelector<HTMLElement>('.mf[data-etapa="renda"]'), 20000);
    if (mf) {
      if (acao === "pular") {
        mf.querySelector<HTMLButtonElement>("button.mf-pular")?.click();
      } else {
        const rotulo = FAIXAS_DE_RENDA.find((f) => f.id === faixa)?.rotulo;
        const chip = rotulo ? [...mf.querySelectorAll<HTMLButtonElement>("button.mf-chip")].find((b) => (b.textContent || "").trim() === rotulo) : null;
        if (chip) chip.click();
        else {
          const campo = mf.querySelector<HTMLInputElement>(".mf-renda input");
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          if (campo && setter) { setter.call(campo, String(renda)); campo.dispatchEvent(new Event("input", { bubbles: true })); }
        }
        // o "Continuar" de verdade liga quando o React pintar a renda
        const botao = await esperar(() => { const b = mf.querySelector<HTMLButtonElement>("button.mf-cta"); return b && !b.disabled ? b : null; }, 3000);
        await doisFrames();
        botao?.click();
        await esperar(() => document.querySelector('.mf[data-etapa="contas"]'), 3000);
      }
    }
    sairDoPasso1(area, acao, t0, t1, !!mf);
  };
  cta.addEventListener("click", () => { void entregar("continuar"); });
  $("mtf-pular").addEventListener("click", () => { void entregar("pular"); });
}
