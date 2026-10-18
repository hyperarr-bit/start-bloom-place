/**
 * O SCRIPT DO HTML LEVE DO /missao (protótipo 18/10). Vanilla, sem React — a tela 1 já veio pintada no HTML.
 *
 *  1. mede (missao_html: quando o HTML chegou e a tela 1 apareceu) e guarda a sessão do funil;
 *  2. PRÉ-CARREGA o app em segundo plano: no 1º frame ocioso depois da pintura (ou no 1º toque, o que vier antes)
 *     importa ./app-entry (React + App + CSS, sem montar). No toque numa área, pede também o módulo dela;
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
      body: JSON.stringify({ user_id: null, session_id: coreSid, event_name: nome, page: location.pathname, event_data: { ...corpo, utm_source: q.get("utm_source"), utm_campaign: q.get("utm_campaign"), utm_content: q.get("utm_content") } }),
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
const ocioso = (cb: () => void) => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(cb, { timeout: 600 }); else setTimeout(cb, 200);
};
// depois da 1ª pintura (2 frames), no ocioso — a tela 1 nunca espera o app
requestAnimationFrame(() => requestAnimationFrame(() => ocioso(() => { void carregarApp(); })));
addEventListener("pointerdown", () => { void carregarApp(); }, { once: true, passive: true });

/* pixels de anúncio: só em produção, depois da tela 1 (fila fbq igual à do index.html) */
if (PRODUCAO) {
  const f = window as unknown as { fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown } };
  if (!f.fbq) {
    const n = function (...a: unknown[]) { if (n.callMethod) n.callMethod(...a); else n.queue!.push(a); } as NonNullable<typeof f.fbq>;
    n.queue = []; n.loaded = true; n.version = "2.0"; n.push = n;
    f.fbq = n;
  }
  f.fbq!("init", "998037194527241");
  f.fbq!("track", "PageView");
  addEventListener("load", () => setTimeout(() => {
    const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.appendChild(s);
  }, 1200), { once: true });
}

/* ───────── as telas ───────── */
let areaEscolhida: Area | null = null;
function mostrar(id: "mt-t1" | "mt-t2" | "mt-t3") {
  for (const t of ["mt-t1", "mt-t2", "mt-t3"]) {
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
    void carregarApp().then((m) => m.preaquecer(area)).catch(() => {});
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
  // só mostra "Abrindo seu CORE…" se demorar (app ainda baixando): quem tem o app pronto vai direto
  const avisar = setTimeout(() => { mostrar("mt-t3"); evento("missao_abrindo_view", { area }); }, appPronto ? 900 : 120);
  carregarApp().then((m) => {
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
