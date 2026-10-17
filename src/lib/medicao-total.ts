/**
 * MEDIÇÃO TOTAL (1.0.16) — dono: "tem que ter medição de tudo, literalmente tudo, porque vamos
 * simplificar tudo". A 1.0.17 corta/esconde/junta o que ninguém usa; esta versão tem que responder
 * "alguém usa isso?" pra cada tela, aba, card, botão, chave, folha, menu, widget e ação rápida.
 *
 * VOLUME (o /admin já sofreu com ~30 mil eventos/dia): nada de um evento por toque. Os toques são
 * CONTADOS EM MEMÓRIA por uma chave estável e saem num evento só, `uso_resumo`, quando o app vai
 * pro segundo plano / a página fecha (keepalive, trackEventBeacon) e, numa sessão longa, a cada
 * 10 min. Formato (todas as chaves com `|` separando posições fixas):
 *   n  toques       "tela|aba|folha|bloco|controle" → vezes
 *   t  entradas     "tela|aba" → vezes (tela_view; a aba vem do TrackedModule)
 *   s  tempo        "tela|aba" → segundos em primeiro plano (teto de 30 min por trecho)
 *   f  folhas       "tela|aba|folha" → vezes que abriu (folha_view)
 *   b  blocos       "tela|aba|bloco" → 1 (card/bloco que apareceu na tela, 1× por sessão)
 *   ms, seq (envio 1, 2… da sessão), motivo, fora (o que passou do teto de chaves por mapa)
 * Mais a ficha de sempre (device_id, app_versao, app_build, plataforma, turma) que o analytics
 * junta em todo evento. Só conta nas telas do APP (TELAS_DO_APP); funil, site, login e admin ficam
 * de fora. Leitura: ~/core/ferramentas-sessao/metricas/uso-total.mjs.
 *
 * PRIVACIDADE — chave nunca leva texto que a pessoa digitou. Uma chave só é montada de:
 *  - nome de tela (lista fixa abaixo) e id de aba (do código, via TrackedModule);
 *  - atributos escritos no código: data-track, data-track-bloco, data-folha, data-camada-guia,
 *    data-card, data-tour, data-spotlight (nunca data-testid: há testid com nome de categoria);
 *  - papel do elemento (botao, aba, chave, campo…), nome do ícone lucide, posição (#2) ou "@lista";
 *  - TEXTO DE TELA (rótulo, título do card, título da folha) só pela peneira `textoSeguro`:
 *    cada pedaço com 3+ letras tem que ser IGUAL a um texto escrito no código de uma tela
 *    (dicionário do build, vite-plugin-medicao-textos.ts) E não pode ser igual a nenhum texto dos
 *    dados da pessoa (store em memória do use-user-data — pega a sugestão que virou hábito, a
 *    categoria, o nome). Pedaço com menos de 3 letras (número, R$, iniciais) é descartado.
 *    Um pedaço que falha derruba o texto inteiro, e o card/controle fica com o nome estrutural.
 * Valor de campo (input/select) nunca é lido.
 *
 * DESEMPENHO: um ouvinte de clique (fase de captura) e, só nas telas do app, um MutationObserver
 * com varredura atrasada (400 ms) pras folhas e um IntersectionObserver pros blocos explícitos.
 * A chave é montada com closest/atributos/textContent (sem innerText, sem medir layout).
 *
 * CHAVE REMOTA `medicao_total: "on"|"off"` na metadata da offering do RevenueCat (registrada em
 * registrarChavesDasOfferings). Desligada: nada é contado nem enviado — card_view/card_interact e
 * home_* seguem como sempre (são independentes disto).
 */
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { letrasDe, MIN_LETRAS_ROTULO, normalizarChave } from "@/lib/medicao-normalizar";

/* ─────────────────────────── chave remota ─────────────────────────── */

export type ModoMedicaoTotal = "on" | "off";
/** Site (Vercel). Desligar na web = trocar aqui (não há RevenueCat na web). */
export const MEDICAO_TOTAL_WEB: ModoMedicaoTotal = "on";
/** App das lojas. Rollback sem build = `medicao_total: "off"` na offering do RC; com build = trocar aqui. */
export const MEDICAO_TOTAL_APP: ModoMedicaoTotal = "on";
export const CHAVE_REMOTA_MEDICAO_TOTAL = "medicao_total";
export const PARAM_QA_MEDICAO_TOTAL = "medicao-total";
/** Força de QA no navegador (`?medicao-total=on|off|auto`). Nome fora dos prefixos que a vassoura apaga. */
const CHAVE_FORCA_MEDICAO_TOTAL = "medicao-total-force";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoMedicaoTotal | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "on" || s === "off" ? s : null;
};

let remota: ModoMedicaoTotal | null = null;

type Offering = { metadata?: Record<string, unknown> | null } | null | undefined;
/** A da offering ATUAL vence; sem ela, qualquer outra que tenha a chave. */
export function lerChaveRemotaMedicaoTotal(offerings: unknown): ModoMedicaoTotal | null {
  const o = offerings as { current?: Offering; all?: Record<string, Offering> } | null | undefined;
  let lida: ModoMedicaoTotal | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lida = modoDe(off?.metadata?.[CHAVE_REMOTA_MEDICAO_TOTAL]) ?? lida;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_MEDICAO_TOTAL]) ?? lida;
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings(). */
export function registrarMedicaoTotalRemota(offerings: unknown): void {
  try {
    remota = lerChaveRemotaMedicaoTotal(offerings);
    if (remota === "off") zerarResumo(); // desligou no meio da sessão: o que estava contado não sai
  } catch { /* metadata estranha: fica como estava */ }
}

/** `?medicao-total=on|off` liga/desliga neste navegador; `auto` apaga a força. Nunca no app das lojas. */
export function guardarForcaMedicaoTotal(busca?: string | URLSearchParams): void {
  if (isNativeShell()) return;
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_QA_MEDICAO_TOTAL);
  } catch { return; }
  if (v === "auto") ls.del(CHAVE_FORCA_MEDICAO_TOTAL);
  else if (modoDe(v)) ls.set(CHAVE_FORCA_MEDICAO_TOTAL, modoDe(v)!);
}

/** Ligada AQUI, agora? força de QA (web) > metadata do RevenueCat > constante (app × web). */
export function medicaoTotalLigada(): boolean {
  if (!isNativeShell()) {
    const f = modoDe(ls.get(CHAVE_FORCA_MEDICAO_TOTAL));
    if (f) return f === "on";
  }
  if (remota) return remota === "on";
  return (isNativeShell() ? MEDICAO_TOTAL_APP : MEDICAO_TOTAL_WEB) === "on";
}

/* ─────────────────────────── telas ─────────────────────────── */

/** As telas do APP (rotas do logado). Fora delas nada é contado. */
export const TELAS_DO_APP: readonly string[] = [
  "home", "financas", "rotina", "desenvolvimento", "saude", "casa", "estudos", "biblioteca", "beleza",
  "viagens", "carreira", "treino", "dieta", "hiperfoco", "relacionamentos", "pet", "detox",
  "conquistas", "retrospectiva", "notificacoes", "ajuda", "planos",
];
const TELAS = new Set(TELAS_DO_APP);

export const telaDaRota = (pathname: string | null | undefined): string | null => {
  const seg = String(pathname ?? "").split(/[?#]/)[0].split("/")[1]?.toLowerCase() ?? "";
  return TELAS.has(seg) ? seg : null;
};

/* ─────────────────────────── dicionário (textos do código) ─────────────────────────── */

let dicionario: ReadonlySet<string> | null = null;
let carregandoDicionario: Promise<void> | null = null;

/** Carrega o dicionário do build (pedaço próprio, sob demanda). Sem ele, só nomes estruturais. */
export function carregarDicionario(): Promise<void> {
  if (!carregandoDicionario) {
    carregandoDicionario = import("virtual:medicao-textos")
      .then((m) => { dicionario = new Set(String(m.default ?? "").split("\n").filter(Boolean)); })
      .catch(() => { dicionario = new Set(); })
      .then(() => { processarPendentes(); aquecerPeneira(); });
  }
  return carregandoDicionario;
}

/** Só testes: troca o dicionário (null = volta a carregar o do build). */
export function _definirDicionario(textos: Iterable<string> | null): void {
  dicionario = textos ? new Set(textos) : null;
  carregandoDicionario = textos ? Promise.resolve() : null;
}

/* ─────────────────────────── peneira (dados da pessoa) ─────────────────────────── */

type LeitorDosDados = () => Record<string, unknown> | null | undefined;
let leitorDosDados: LeitorDosDados | null = null;
let storeVisto: Record<string, unknown> | null = null;
/** Por chave do store: o valor visto e os textos dele (normalizados). Só recalcula a chave que mudou. */
const textosPorChave = new Map<string, { valor: unknown; textos: Set<string> }>();
const MAX_TEXTOS_POR_CHAVE = 20_000;

/** use-user-data registra aqui a leitura do store EM MEMÓRIA (só leitura, nunca sai do aparelho). */
export function registrarLeitorDosDados(fn: LeitorDosDados | null): void {
  leitorDosDados = fn;
  storeVisto = null;
  textosPorChave.clear();
}

const coletarTextos = (v: unknown, out: Set<string>, prof = 0): void => {
  if (out.size >= MAX_TEXTOS_POR_CHAVE || prof > 10 || v == null) return;
  const somar = (s: string) => {
    if (s.length > 300) return; // texto longo (nota) nunca é rótulo de tela
    const n = normalizarChave(s);
    if (letrasDe(n) >= MIN_LETRAS_ROTULO) out.add(n);
  };
  if (typeof v === "string") { somar(v); return; }
  if (Array.isArray(v)) { for (const x of v) coletarTextos(x, out, prof + 1); return; }
  if (typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      somar(k); // chave de objeto também pode ser dado (limite por categoria, refeição com nome próprio)
      coletarTextos(x, out, prof + 1);
    }
  }
};

const atualizarPeneira = (): void => {
  let store: Record<string, unknown> | null | undefined = null;
  try { store = leitorDosDados?.(); } catch { store = null; }
  if (!store || typeof store !== "object" || store === storeVisto) return;
  storeVisto = store;
  for (const k of [...textosPorChave.keys()]) if (!(k in store)) textosPorChave.delete(k);
  for (const k of Object.keys(store)) {
    const v = store[k];
    const atual = textosPorChave.get(k);
    if (atual && atual.valor === v) continue;
    const textos = new Set<string>();
    textos.add(normalizarChave(k));
    coletarTextos(v, textos);
    textosPorChave.set(k, { valor: v, textos });
  }
};

/** Monta a peneira no tempo ocioso (a 1ª montagem percorre o store inteiro; depois só o que muda). */
const aquecerPeneira = (): void => {
  try {
    const ocioso = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ocioso) ocioso(() => atualizarPeneira(), { timeout: 5000 });
    else setTimeout(atualizarPeneira, 1500);
  } catch { /* noop */ }
};

/** O texto (já normalizado) aparece nos dados da pessoa? */
export function ehDadoDaPessoa(normalizado: string): boolean {
  atualizarPeneira();
  for (const { textos } of textosPorChave.values()) if (textos.has(normalizado)) return true;
  return false;
}

/** Um texto pode virar pedaço de chave? Só se for texto do código e não for dado da pessoa. */
export function textoSeguro(texto: string | null | undefined): string | null {
  if (!texto || !dicionario) return null;
  const n = normalizarChave(texto);
  if (letrasDe(n) < MIN_LETRAS_ROTULO || !dicionario.has(n) || ehDadoDaPessoa(n)) return null;
  return n;
}

/** Texto que nunca é lido: ícone, estilo e o que a pessoa digitou (o React põe o valor inicial do
 *  <textarea> como nó de texto; <select> mostra a opção escolhida). */
const PULAR_TEXTO = 'svg,style,script,noscript,textarea,select,[aria-hidden="true"]';
const MAX_PEDACOS = 24;
const MAX_CHARS = 240;

/** Os pedaços de texto (nós de texto) dentro do elemento. null = texto demais pra ser rótulo. */
const pedacosDeTexto = (el: Element): string[] | null => {
  const out: string[] = [];
  let total = 0;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const pai = (n as Text).parentElement;
    const pulo = pai?.closest(PULAR_TEXTO);
    if (pulo && (pulo === el || el.contains(pulo))) continue;
    const t = ((n as Text).data || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    total += t.length;
    out.push(t);
    if (out.length > MAX_PEDACOS || total > MAX_CHARS) return null;
  }
  return out;
};

/** O texto visível do elemento, se TODO pedaço com 3+ letras passar na peneira. Devolve o 1º pedaço:
 *  "Pendências de hoje · 3 pendentes" e "Pendências de hoje" são a mesma chave. */
export function textoSeguroDosNos(el: Element | null | undefined): string | null {
  if (!el || !dicionario) return null;
  const pedacos = pedacosDeTexto(el);
  if (!pedacos) return null;
  const bons: string[] = [];
  for (const p of pedacos) {
    const n = normalizarChave(p);
    if (letrasDe(n) < MIN_LETRAS_ROTULO) continue; // número, R$, iniciais: some
    if (!dicionario.has(n) || ehDadoDaPessoa(n)) return null; // um pedaço que não é do código derruba tudo
    bons.push(n);
  }
  return bons[0] ?? null;
}

/* ─────────────────────────── montagem da chave ─────────────────────────── */

const SEL_CONTROLE = [
  "button", "a[href]", 'input:not([type="hidden"])', "select", "textarea", "summary", "label",
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="switch"]', '[role="checkbox"]', '[role="radio"]',
  '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="option"]',
  '[role="slider"]', '[role="combobox"]', "[data-track]",
].join(",");
/** Folha = diálogo, gaveta, menu, lista de opções, overlay marcado com data-folha, ou camada de guia
 *  (`data-camada-guia`: missão, intro do módulo, Conhecer mais, tour da Home, tutorial, cartões). */
const SEL_FOLHA = '[data-folha],[data-camada-guia],[role="dialog"],[role="alertdialog"],[aria-modal="true"],[role="menu"],[role="listbox"]';
/** As que contam como "abriu" (menu e lista de opções contam pelo toque que abriu). */
const SEL_FOLHA_VISTA = '[data-folha],[data-camada-guia],[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
const SEL_TITULO = 'h1,h2,h3,h4,[class*="font-black"],[class*="font-bold"],[class*="font-semibold"]';
const SEL_BLOCO_VISTO = "[data-track-bloco],[data-tour]";

const MAX = { tela: 16, aba: 24, folha: 32, bloco: 40, controle: 48 } as const;

/** Valor de atributo do código → pedaço de chave (sem `|`, sem quebra, curto). */
const limparAtributo = (v: string | null | undefined, max = 40): string | null => {
  const s = String(v ?? "").replace(/[|\r\n\t]+/g, " ").replace(/[^\p{L}\p{N} :._/#@-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return s || null;
};

/** Id de aba (do código) → minúsculas, sem acento, só [a-z0-9_-]. */
export const limparId = (v: string | null | undefined): string | null => {
  const s = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX.aba);
  return s || null;
};

const montarChave = (partes: [string, string, string, string, string]): string => {
  const lim = [MAX.tela, MAX.aba, MAX.folha, MAX.bloco, MAX.controle];
  return partes.map((p, i) => String(p ?? "").replace(/[|\r\n]+/g, " ").slice(0, lim[i]).trim()).join("|");
};

let chaveDasPropsDoReact: string | null = null;
/** O React guarda as props no nó do DOM (`__reactProps$…`): é como sabemos que uma <div> tem onClick. */
const temOnClick = (el: Element): boolean => {
  try {
    if (!chaveDasPropsDoReact) {
      chaveDasPropsDoReact = Object.keys(el).find((k) => k.startsWith("__reactProps$")) ?? null;
      if (!chaveDasPropsDoReact) return false;
    }
    const props = (el as unknown as Record<string, { onClick?: unknown } | undefined>)[chaveDasPropsDoReact];
    return typeof props?.onClick === "function";
  } catch {
    return false;
  }
};

const ehControleNativo = (el: Element): boolean => { try { return el.matches(SEL_CONTROLE); } catch { return false; } };

/** O controle tocado: o 1º ancestral interativo. <div onClick> que embrulha 3+ controles e não tem
 *  cara de card é contêiner (ex.: o fundo da Home, que sai do modo de editar), não botão. */
export function controleDoAlvo(alvo: Element): Element | null {
  let el: Element | null = alvo;
  for (let i = 0; el && el !== document.body && el !== document.documentElement && i < 30; i++, el = el.parentElement) {
    // tocar no <label> é tocar no controle dele (a chave/caixa/campo): o clique que o navegador repete no controle cai no dedupe
    if (el.tagName === "LABEL") return (el as HTMLLabelElement).control ?? el.querySelector('input:not([type="hidden"]),button,select,textarea,[role="switch"],[role="checkbox"]') ?? el;
    if (ehControleNativo(el)) return el;
    if (temOnClick(el)) {
      if (!pareceCard(el) && el.querySelectorAll(SEL_CONTROLE).length > 2) return null; // toque em área morta
      return el;
    }
  }
  return null;
}

const PAPEL_POR_ROLE: Record<string, string> = {
  button: "botao", link: "link", tab: "aba", switch: "chave", checkbox: "caixa", radio: "opcao", option: "opcao",
  menuitem: "menu", menuitemcheckbox: "menu", menuitemradio: "menu", slider: "deslizar", combobox: "seletor",
};
export function papelDo(el: Element): string {
  const r = (el.getAttribute("role") || "").toLowerCase();
  if (PAPEL_POR_ROLE[r]) return PAPEL_POR_ROLE[r];
  switch (el.tagName) {
    case "BUTTON": return "botao";
    case "A": return "link";
    case "SELECT": return "seletor";
    case "TEXTAREA": return "texto";
    case "LABEL": return "rotulo";
    case "SUMMARY": return "abrir";
    case "INPUT": {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (t === "checkbox") return "caixa";
      if (t === "radio") return "opcao";
      if (t === "range") return "deslizar";
      if (t === "file") return "arquivo";
      if (t === "submit" || t === "button") return "botao";
      if (/^(date|time|datetime-local|month|week)$/.test(t)) return "data";
      return "campo";
    }
    default: return "item";
  }
}

const primeiraClasse = (el: Element) => (el.getAttribute("class") || "").trim().split(/\s+/)[0] || "";

/** O controle faz parte de uma lista (irmãos iguais: hábitos, gastos, pessoas)? Até 5 níveis acima. */
export function estaEmLista(el: Element, limite: Element | null): boolean {
  let atual: Element | null = el;
  for (let i = 0; atual && atual !== limite && i < 5; i++, atual = atual.parentElement) {
    const pai = atual.parentElement;
    if (!pai || pai.children.length < 2) continue;
    const tag = atual.tagName, cls = primeiraClasse(atual);
    const irmaos = pai.children;
    for (let j = 0; j < irmaos.length && j < 60; j++) {
      const s = irmaos[j];
      if (s !== atual && s.tagName === tag && primeiraClasse(s) === cls) return true;
    }
  }
  return false;
}

/** Nome do ícone lucide dentro do controle ("lucide lucide-pencil" → "pencil"): nome de componente, nunca dado. */
const iconeDo = (el: Element): string | null => {
  const svg = el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg");
  const cls = svg?.getAttribute("class") || "";
  const m = /\blucide-([a-z0-9-]+)/.exec(cls);
  return m ? `icone:${m[1].slice(0, 30)}` : null;
};

const ehChaveOuCaixa = (el: Element) => /^(chave|caixa|opcao)$/.test(papelDo(el));

/** O nome do controle, só de fonte segura. null = sem nome (usa papel + posição). */
export function nomeDoControle(c: Element): string | null {
  const attr = limparAtributo(c.getAttribute("data-track"), MAX.controle)
    ?? limparAtributo(c.getAttribute("data-tour"), MAX.controle)
    ?? limparAtributo(c.getAttribute("data-spotlight"), MAX.controle);
  if (attr) return attr;
  const aria = textoSeguro(c.getAttribute("aria-label")) ?? textoSeguro(c.getAttribute("title"));
  if (aria) return aria;
  const tag = c.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    // valor digitado NUNCA: só placeholder e rótulo associado (texto do código)
    const ph = textoSeguro(c.getAttribute("placeholder"));
    if (ph) return ph;
    const rotulos = (c as HTMLInputElement).labels;
    if (rotulos?.length) { const t = textoSeguroDosNos(rotulos[0]); if (t) return t; }
  } else {
    const t = textoSeguroDosNos(c);
    if (t) return t;
  }
  const lb = c.getAttribute("aria-labelledby");
  if (lb) {
    for (const id of lb.split(/\s+/)) {
      const t = textoSeguroDosNos(document.getElementById(id));
      if (t) return t;
    }
  }
  // chave/caixa sem texto: o texto da linha em volta (só se a linha não tiver outro controle)
  if (ehChaveOuCaixa(c)) {
    let linha: Element | null = c.parentElement;
    for (let i = 0; linha && i < 3; i++, linha = linha.parentElement) {
      const outros = [...linha.querySelectorAll(SEL_CONTROLE)].filter((x) => x !== c && !c.contains(x) && !x.contains(c));
      if (outros.length) break;
      const t = textoSeguroDosNos(linha);
      if (t) return t;
    }
  }
  return iconeDo(c);
}

const ehCaixaAlta = (t: string) => {
  const letras = t.replace(/[^\p{L}]/gu, "");
  if (letras.length < 3) return false;
  return letras.replace(/[^\p{Lu}]/gu, "").length / letras.length >= 0.6;
};

const pareceCard = (el: Element): boolean => {
  const cls = String(el.getAttribute("class") || "");
  return /\brounded/.test(cls) && /\bborder\b/.test(cls);
};

/** Título do card pela peneira: data-card, ou o 1º título (heading/caixa alta) se for texto do código. */
export function tituloSeguroDoCard(el: Element): string | null {
  const exp = limparAtributo(el.getAttribute("data-card"), MAX.bloco);
  if (exp) return exp;
  for (const c of el.querySelectorAll(SEL_TITULO)) {
    const bruto = (c.textContent || "").replace(/\s+/g, " ").trim();
    if (!bruto || bruto.length > 80) continue;
    const ehTitulo = /^H[1-4]$/.test(c.tagName) || ehCaixaAlta(bruto) || /\buppercase\b/.test(String(c.getAttribute("class") || ""));
    if (!ehTitulo) continue;
    if (normalizarChave(bruto).length < 4) continue; // "SEG", "TER": dia da semana, não título
    // o 1º título manda: se ele não é texto do código, o card fica sem nome (nunca cai pro 2º)
    const t = textoSeguroDosNos(c);
    return t && t.length >= 4 ? t : null;
  }
  return null;
}

const blocoExplicito = (el: Element): string | null =>
  limparAtributo(el.getAttribute("data-track-bloco"), MAX.bloco)
  ?? limparAtributo(el.getAttribute("data-card"), MAX.bloco)
  ?? (ehControleNativo(el) ? null : limparAtributo(el.getAttribute("data-tour"), MAX.bloco));

const LANDMARK: Record<string, string> = { HEADER: "cabecalho", NAV: "nav", FOOTER: "rodape" };

/** O bloco do controle: marcador explícito (o mais próximo) > card de fora com título do código > cabeçalho/nav/rodapé. */
export function blocoDoControle(c: Element, limite: Element | null): { nome: string; el: Element } | null {
  let card: { nome: string; el: Element } | null = null;
  let landmark: { nome: string; el: Element } | null = null;
  let el: Element | null = c.parentElement;
  for (let i = 0; el && el !== limite && el !== document.body && i < 40; i++, el = el.parentElement) {
    const exp = blocoExplicito(el);
    if (exp) return { nome: exp, el };
    if (!landmark && LANDMARK[el.tagName]) landmark = { nome: LANDMARK[el.tagName], el };
    if (pareceCard(el)) {
      const t = tituloSeguroDoCard(el);
      if (t) card = { nome: t, el }; // sobrescreve: fica o de FORA (como o card_view)
    }
  }
  return card ?? landmark;
}

/** O nome da folha: data-folha > data-camada-guia > título (aria-labelledby) > aria-label > 1º heading — tudo pela peneira. */
export function nomeDaFolha(raiz: Element): string {
  const exp = limparAtributo(raiz.getAttribute("data-folha") ?? raiz.closest("[data-folha]")?.getAttribute("data-folha"), MAX.folha)
    ?? limparAtributo(raiz.getAttribute("data-camada-guia"), MAX.folha);
  if (exp) return exp;
  const lb = raiz.getAttribute("aria-labelledby");
  if (lb) {
    for (const id of lb.split(/\s+/)) {
      const t = textoSeguroDosNos(document.getElementById(id));
      if (t) return t;
    }
  }
  const al = textoSeguro(raiz.getAttribute("aria-label"));
  if (al) return al;
  const h = textoSeguroDosNos(raiz.querySelector("h1,h2,h3"));
  if (h) return h;
  const role = raiz.getAttribute("role");
  return role === "menu" ? "menu" : role === "listbox" ? "opcoes" : "folha";
}

/** Posição do controle entre os do mesmo papel no bloco/folha/tela (fora de listas). */
const posicaoDo = (c: Element, papel: string, raiz: Element): string => {
  let k = 0;
  const todos = raiz.querySelectorAll(SEL_CONTROLE);
  for (let i = 0; i < todos.length && i < 250; i++) {
    const x = todos[i];
    if (x !== c && (papelDo(x) !== papel || estaEmLista(x, raiz))) continue;
    k++;
    if (x === c) return k <= 12 ? `#${k}` : "#n";
  }
  return "";
};

/** A chave do toque. null = fora das telas do app, ou toque fora de qualquer controle. */
export function chaveDoToque(alvo: Element, tela: string | null, aba: string | null): string | null {
  if (!tela) return null;
  const c = controleDoAlvo(alvo);
  if (!c) return null;
  const folhaEl = c.closest(SEL_FOLHA);
  const folha = folhaEl ? nomeDaFolha(folhaEl) : "";
  const bloco = blocoDoControle(c, folhaEl);
  let nome = nomeDoControle(c);
  if (!nome) {
    const papel = papelDo(c);
    const raiz = bloco?.el ?? folhaEl ?? document.querySelector("main") ?? document.body;
    nome = estaEmLista(c, raiz) ? `${papel}@lista` : `${papel}${papel === "item" ? "" : posicaoDo(c, papel, raiz)}`;
  }
  return montarChave([tela, aba ?? "", folha, bloco?.nome ?? "", nome]);
}

/* ─────────────────────────── o resumo da sessão ─────────────────────────── */

type Mapa = "n" | "t" | "s" | "f" | "b";
const TETOS: Record<Mapa, number> = { n: 300, t: 80, s: 80, f: 80, b: 200 };
const TETO_TRECHO_MS = 30 * 60_000;
const IDADE_MAX_MS = 10 * 60_000;

const novoResumo = () => ({
  n: new Map<string, number>(), t: new Map<string, number>(), s: new Map<string, number>(),
  f: new Map<string, number>(), b: new Map<string, number>(), fora: {} as Partial<Record<Mapa, number>>,
});
let r = novoResumo();

export interface OpcoesMedicaoTotal {
  /** Aceita clique sintético (testes). Em produção só o toque de verdade (isTrusted). */
  aceitarSinteticos?: boolean;
  /** Dois cliques em menos que isto são um só (rótulo → input dispara 2). Padrão 40 ms. */
  dedupeMs?: number;
  /** De quanto em quanto tempo confere a idade do resumo (padrão 60 s). */
  tiqueMs?: number;
  /** Resumo mais velho que isto sai sozinho com o app aberto (padrão 10 min). */
  idadeMaxMs?: number;
}

const estado = {
  instalado: false,
  opcoes: {} as OpcoesMedicaoTotal,
  tela: null as string | null,
  aba: null as string | null,
  trechoDesde: 0,
  trechoChave: "",
  msAtivo: 0,
  seq: 0,
  acumulandoDesde: 0,
  ultimoCheio: 0,
  ultimoToque: -Infinity,
  noFundo: false,
  vistos: new Set<string>(),
  /** folha aberta → o nome com que foi contada (mudou o nome no mesmo elemento = etapa nova = vista nova) */
  folhasAbertas: new Map<Element, string>(),
  pendentes: [] as Array<{ alvo: Element; tela: string; aba: string | null }>,
  desligar: [] as Array<() => void>,
};

const agora = () => Date.now();
const visivel = () => !estado.noFundo && (typeof document === "undefined" || document.visibilityState !== "hidden");
const ligada = () => estado.instalado && medicaoTotalLigada();

const somar = (mapa: Mapa, chave: string, qtd: number) => {
  const m = r[mapa];
  if (!m.has(chave) && m.size >= TETOS[mapa]) { r.fora[mapa] = (r.fora[mapa] ?? 0) + 1; return; }
  m.set(chave, (m.get(chave) ?? 0) + qtd);
  if (!estado.acumulandoDesde) estado.acumulandoDesde = agora();
};

function zerarResumo(): void {
  r = novoResumo();
  estado.msAtivo = 0;
  estado.acumulandoDesde = 0;
}

const abrirTrecho = () => {
  if (!estado.tela || !visivel()) return;
  estado.trechoDesde = agora();
  estado.trechoChave = `${estado.tela}|${estado.aba ?? ""}`;
};
const fecharTrecho = () => {
  if (!estado.trechoDesde) return;
  const ms = Math.min(Math.max(0, agora() - estado.trechoDesde), TETO_TRECHO_MS);
  estado.trechoDesde = 0;
  if (ms <= 0 || !medicaoTotalLigada()) return;
  somar("s", estado.trechoChave, ms);
  estado.msAtivo += ms;
};

/* ─────────────────────────── API pra quem renderiza ─────────────────────────── */

/** A rota mudou (App.tsx). Fora das telas do app, para de contar. */
export function anotarTela(pathname: string): void {
  try {
    const tela = telaDaRota(pathname);
    if (tela === estado.tela) return;
    fecharTrecho();
    estado.tela = tela;
    estado.aba = null;
    if (!estado.instalado) return;
    if (tela) {
      if (ligada()) somar("t", `${tela}|`, 1);
      abrirTrecho();
      conectarObservadores();
      void carregarDicionario();
      agendarVarredura();
    } else {
      desconectarObservadores();
    }
  } catch { /* medir nunca derruba a navegação */ }
}

/** A aba do módulo mudou (TrackedModule). O id vem do código. */
export function anotarAba(modulo: string, aba: string | null | undefined): void {
  try {
    if (!estado.instalado) return;
    const a = limparId(aba);
    if (!a) return;
    if (estado.tela !== modulo) {
      // só adota o módulo se a ROTA for dele (a demo do funil, /preview, nunca conta)
      if (!TELAS.has(modulo) || telaDaRota(typeof window !== "undefined" ? window.location.pathname : "") !== modulo) return;
      anotarTela(`/${modulo}`);
    }
    if (a === estado.aba) return;
    fecharTrecho();
    estado.aba = a;
    if (ligada()) somar("t", `${estado.tela}|${a}`, 1);
    abrirTrecho();
  } catch { /* idem */ }
}

/** Conta um uso que não é clique (segurar, arrastar, deslizar). Nomes FIXOS do código. */
export function contarUso(controle: string, bloco = "", folha = ""): void {
  try {
    if (!estado.tela || !ligada()) return;
    const nome = limparAtributo(controle, MAX.controle);
    if (!nome) return;
    somar("n", montarChave([estado.tela, estado.aba ?? "", limparAtributo(folha, MAX.folha) ?? "", limparAtributo(bloco, MAX.bloco) ?? "", nome]), 1);
    verificarCheio();
  } catch { /* idem */ }
}

/** A medição de cards viu um card na tela (30%): vira "bloco visto", com o nome pela peneira. */
export function anotarVistaDeCard(el: Element, modulo: string, aba: string | null): void {
  try {
    if (!estado.tela || !ligada()) return;
    if (!dicionario) { void carregarDicionario().then(() => anotarVistaDeCard(el, modulo, aba)); return; }
    const nome = tituloSeguroDoCard(el);
    if (!nome) return;
    const tela = TELAS.has(modulo) ? modulo : estado.tela;
    anotarBlocoVisto(`${tela}|${limparId(aba) ?? estado.aba ?? ""}|${nome}`);
  } catch { /* idem */ }
}

const anotarBlocoVisto = (chave: string) => {
  if (estado.vistos.has(chave)) return;
  estado.vistos.add(chave);
  somar("b", chave, 1);
};

/* ─────────────────────────── toques ─────────────────────────── */

/** Bateu o teto de chaves: manda o que tem e começa outro (no máximo 1× a cada 2 min; depois, conta em `fora`). */
function verificarCheio(): void {
  if (r.n.size >= TETOS.n && agora() - estado.ultimoCheio > 2 * 60_000) {
    estado.ultimoCheio = agora();
    descarregarResumo("cheio");
  }
}

const contarToque = (alvo: Element, tela: string, aba: string | null) => {
  const chave = chaveDoToque(alvo, tela, aba);
  if (!chave) return;
  somar("n", chave, 1);
  verificarCheio();
};

function processarPendentes(): void {
  const fila = estado.pendentes.splice(0);
  for (const p of fila) { try { contarToque(p.alvo, p.tela, p.aba); } catch { /* noop */ } }
}

const aoTocar = (ev: Event) => {
  try {
    if (!estado.tela) return;
    if (!ev.isTrusted && !estado.opcoes.aceitarSinteticos) return;
    const dedupe = estado.opcoes.dedupeMs ?? 40;
    if (dedupe > 0 && ev.timeStamp >= estado.ultimoToque && ev.timeStamp - estado.ultimoToque < dedupe) return;
    estado.ultimoToque = ev.timeStamp;
    if (!ligada()) return;
    const t = ev.target as Node | null;
    const alvo = t instanceof Element ? t : t?.parentElement ?? null;
    if (!alvo) return;
    if (!dicionario) {
      // o dicionário ainda chegando (1º segundo): guarda o toque e conta quando ele chegar
      if (estado.pendentes.length < 20) estado.pendentes.push({ alvo, tela: estado.tela, aba: estado.aba });
      void carregarDicionario();
      return;
    }
    contarToque(alvo, estado.tela, estado.aba);
  } catch { /* medir nunca derruba o toque */ }
};

/* ─────────────────────────── folhas e blocos vistos ─────────────────────────── */

let mo: MutationObserver | null = null;
let io: IntersectionObserver | null = null;
const observados = new WeakSet<Element>();
let varreduraAgendada: ReturnType<typeof setTimeout> | null = null;

const agendarVarredura = () => {
  if (varreduraAgendada !== null || !estado.instalado) return;
  varreduraAgendada = setTimeout(() => { varreduraAgendada = null; varrer(); }, 400);
};

/** Folhas abertas agora (sem as que estão dentro de outra marcada) e blocos explícitos novos. */
export function varrer(): void {
  try {
    if (!estado.tela || !ligada()) { estado.folhasAbertas = new Map(); return; }
    const abertas = new Map<Element, string>();
    const contadas = new Set<string>();
    document.querySelectorAll(SEL_FOLHA_VISTA).forEach((el) => {
      if (el.parentElement?.closest(SEL_FOLHA_VISTA)) return; // a de fora é que conta
      const nome = nomeDaFolha(el);
      abertas.set(el, nome);
      if (estado.folhasAbertas.get(el) === nome) return; // já contada com esse nome (etapa)
      const chave = `${estado.tela}|${estado.aba ?? ""}|${nome}`;
      if (contadas.has(chave)) return;
      contadas.add(chave);
      somar("f", chave, 1);
    });
    estado.folhasAbertas = abertas;
    if (io) {
      document.querySelectorAll(SEL_BLOCO_VISTO).forEach((el) => {
        if (observados.has(el) || ehControleNativo(el)) return;
        observados.add(el);
        io!.observe(el);
      });
    }
  } catch { /* idem */ }
}

const conectarObservadores = () => {
  if (typeof document === "undefined") return;
  if (!mo && typeof MutationObserver !== "undefined") {
    mo = new MutationObserver(agendarVarredura);
    // etapa nova numa folha que fica aberta troca o data-folha no mesmo elemento (montar finanças/rotina)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-folha", "data-camada-guia"] });
  }
  if (!io && typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        io?.unobserve(e.target);
        if (!estado.tela || !ligada()) continue;
        const nome = blocoExplicito(e.target);
        if (nome) anotarBlocoVisto(`${estado.tela}|${estado.aba ?? ""}|${nome}`);
      }
    }, { threshold: 0.3 });
  }
};
const desconectarObservadores = () => {
  mo?.disconnect(); mo = null;
  io?.disconnect(); io = null;
  if (varreduraAgendada !== null) { clearTimeout(varreduraAgendada); varreduraAgendada = null; }
  estado.folhasAbertas = new Map();
};

/* ─────────────────────────── envio ─────────────────────────── */

export type MotivoDoEnvio = "fundo" | "saida" | "timer" | "cheio" | "teste";

const objeto = (m: Map<string, number>, div = 1): Record<string, number> | undefined => {
  if (!m.size) return undefined;
  const o: Record<string, number> = {};
  for (const [k, v] of m) o[k] = div === 1 ? v : Math.max(1, Math.round(v / div));
  return o;
};

/** Fecha o resumo e manda UM `uso_resumo`. Vazio não manda. Devolve o que mandou (testes). */
export function descarregarResumo(motivo: MotivoDoEnvio = "fundo"): Record<string, unknown> | null {
  try {
    fecharTrecho();
    if (!ligada()) { zerarResumo(); return null; }
    // só tempo (voltou pra mesma tela e saiu sem tocar): espera juntar 30 s — trocar de aba no navegador
    // a cada instante não vira um evento por troca
    const vazio = !r.n.size && !r.t.size && !r.f.size && !r.b.size && estado.msAtivo < 30_000;
    if (vazio) { if (visivel()) abrirTrecho(); return null; }
    const payload: Record<string, unknown> = { v: 1, seq: ++estado.seq, motivo, ms: Math.round(estado.msAtivo) };
    const n = objeto(r.n), t = objeto(r.t), s = objeto(r.s, 1000), f = objeto(r.f), b = objeto(r.b);
    if (n) payload.n = n;
    if (t) payload.t = t;
    if (s) payload.s = s;
    if (f) payload.f = f;
    if (b) payload.b = b;
    if (Object.keys(r.fora).length) payload.fora = { ...r.fora };
    zerarResumo();
    // despedida (fundo/saída) vai pelo keepalive; com o app aberto, o caminho normal
    if (motivo === "timer" || motivo === "cheio") trackEvent("uso_resumo", payload);
    else trackEventBeacon("uso_resumo", payload);
    if (visivel()) abrirTrecho(); // o relógio da tela continua (no fundo, quem reabre é a volta)
    return payload;
  } catch {
    return null;
  }
}

const aoIrProFundo = () => {
  if (estado.noFundo) return;
  estado.noFundo = true;
  descarregarResumo("fundo");
};
const aoVoltar = () => {
  if (!estado.noFundo) return;
  estado.noFundo = false;
  abrirTrecho();
};
const aoMudarVisibilidade = () => {
  if (document.visibilityState === "hidden") aoIrProFundo();
  else aoVoltar();
};
const aoSairDaPagina = () => { descarregarResumo("saida"); };
const aoTique = () => {
  if (!visivel() || !estado.acumulandoDesde) return;
  if (agora() - estado.acumulandoDesde >= (estado.opcoes.idadeMaxMs ?? IDADE_MAX_MS)) descarregarResumo("timer");
};

/**
 * Liga a medição (main.tsx, antes do React). Idempotente. Devolve a função que desliga (testes).
 * O dicionário carrega quando a 1ª tela do app aparece — no site, a landing nunca baixa ele.
 */
export function instalarMedicaoTotal(opcoes: OpcoesMedicaoTotal = {}): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  if (estado.instalado) return desinstalarMedicaoTotal;
  estado.instalado = true;
  estado.opcoes = opcoes;
  estado.noFundo = false;
  document.addEventListener("click", aoTocar, true);
  document.addEventListener("visibilitychange", aoMudarVisibilidade);
  window.addEventListener("pagehide", aoSairDaPagina);
  const tique = setInterval(aoTique, opcoes.tiqueMs ?? 60_000);
  estado.desligar.push(() => {
    document.removeEventListener("click", aoTocar, true);
    document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    window.removeEventListener("pagehide", aoSairDaPagina);
    clearInterval(tique);
  });
  // app das lojas: o segundo plano pelo Capacitor (o visibilitychange do WKWebView nem sempre chega)
  if (isNativeShell()) {
    let vivo = true;
    let remover: (() => void) | null = null;
    import("@capacitor/app")
      .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => { if (isActive) aoVoltar(); else aoIrProFundo(); }))
      .then((h) => { if (vivo) remover = () => { void h.remove(); }; else void h.remove(); })
      .catch(() => { /* sem plugin: fica o visibilitychange */ });
    estado.desligar.push(() => { vivo = false; remover?.(); });
  }
  const tela = estado.tela;
  estado.tela = null;
  anotarTela(typeof window !== "undefined" ? (tela ? `/${tela}` : window.location.pathname) : "");
  return desinstalarMedicaoTotal;
}

/** Desliga tudo (testes; e quem quiser parar de vez). O que estava contado é descartado. */
export function desinstalarMedicaoTotal(): void {
  for (const f of estado.desligar.splice(0)) { try { f(); } catch { /* noop */ } }
  desconectarObservadores();
  estado.instalado = false;
  estado.tela = null;
  estado.aba = null;
  estado.trechoDesde = 0;
  estado.noFundo = false;
  estado.pendentes = [];
  estado.vistos = new Set();
  zerarResumo();
}

/* ─────────────────────────── só testes ─────────────────────────── */

/** A tela e a aba que a medição acha que estão abertas. */
export const _telaEAba = (): { tela: string | null; aba: string | null } => ({ tela: estado.tela, aba: estado.aba });
/** O resumo como está agora (sem mandar). */
export function _resumoAtual(): { n: Record<string, number>; t: Record<string, number>; s: Record<string, number>; f: Record<string, number>; b: Record<string, number>; fora: Partial<Record<Mapa, number>> } {
  return {
    n: Object.fromEntries(r.n), t: Object.fromEntries(r.t), s: Object.fromEntries(r.s),
    f: Object.fromEntries(r.f), b: Object.fromEntries(r.b), fora: { ...r.fora },
  };
}
/** Zera tudo: instalação, chave remota, peneira, dicionário e sequência. */
export function _zerarMedicaoTotal(): void {
  desinstalarMedicaoTotal();
  remota = null;
  estado.seq = 0;
  estado.ultimoToque = -Infinity;
  estado.ultimoCheio = 0;
  estado.opcoes = {};
  registrarLeitorDosDados(null);
  _definirDicionario(null);
  chaveDasPropsDoReact = null;
}
