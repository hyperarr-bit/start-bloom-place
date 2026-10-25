/**
 * NAVEGAÇÃO EM 3 ABAS (1.0.17, parte 3 — 19/10).
 *
 * Pedido do dono: "melhora o menu, tá muito confuso, muita coisa — vê como os outros fazem". O menu
 * era a folha da conta (avatar ⌄ da Home, ~10 itens), e a Home tinha ~6 superfícies de menu, cada uma
 * com um gesto (avatar, sol, paleta que desce, sanfona, ⋯, engrenagem). O padrão dos apps de
 * referência (Cal AI, Structured, Todoist, Duolingo, Finch, Apple Saúde; HIG: 3–5 abas, sem hambúrguer)
 * é uma barra embaixo com poucos destinos e a conta numa página cheia. Aqui: Hoje · Módulos · Você.
 *
 * CHAVE ÚNICA `NAV_ABAS`, DESLIGADA (decisão do dono 19/10: a estrutura NÃO vai na 1.0.17, é mudança
 * grande e fica pra depois; e a regra dele: tela que o cliente conhece não muda de cara sem print
 * aprovado). Desligada = o app de hoje, byte a byte na tela: avatar/sol/paleta no topo da Home,
 * engrenagem nos módulos, sem barra, e /modulos · /voce · /voce/aparencia redirecionam pra /home.
 * O ramo pode entrar no main assim. Ligar = trocar aqui pra "on".
 *
 * QA: no navegador `?nav-abas=on|off|auto` (guarda neste navegador, como `?tour-home=`); em qualquer
 * build, `VITE_NAV_ABAS=1` liga (dev server dos prints, build de QA). No app das lojas o link é ignorado.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoChave = "off" | "on";
/** ROLLBACK/LIGAR = trocar aqui. */
export const NAV_ABAS: ModoChave = "off";

export const PARAM_NAV_ABAS = "nav-abas";
/** Força de QA do navegador (fora dos prefixos que as vassouras do cache apagam). */
export const CHAVE_FORCA_NAV_ABAS = "nav-abas-force";

const envLiga = (): boolean => {
  try { return import.meta.env.VITE_NAV_ABAS === "1"; } catch { return false; }
};

let ultimaBusca: string | null = null;
/** Guarda `?nav-abas=` deste navegador (lido 1x por busca). No app das lojas não faz nada. */
export function guardarForcaNavDaUrl(busca?: string): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try { p = new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const texto = p.toString();
  if (texto === ultimaBusca) return;
  ultimaBusca = texto;
  const v = p.get(PARAM_NAV_ABAS);
  try {
    if (v === "on" || v === "off") localStorage.setItem(CHAVE_FORCA_NAV_ABAS, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA_NAV_ABAS);
  } catch { /* storage bloqueado: vale a chave */ }
}

/** "A navegação em abas está ligada AQUI?" — chave + VITE_NAV_ABAS + força do navegador. */
export function navAbasLigada(modo: ModoChave = NAV_ABAS): boolean {
  if (envLiga()) return true;
  if (!isNativeShell()) {
    try {
      const f = localStorage.getItem(CHAVE_FORCA_NAV_ABAS);
      if (f === "on" || f === "off") return f === "on";
    } catch { /* noop */ }
  }
  return modo === "on";
}

export type IdDaAba = "hoje" | "modulos" | "voce";
export const ABAS: ReadonlyArray<{ id: IdDaAba; rota: string; rotulo: string }> = [
  { id: "hoje", rota: "/home", rotulo: "Hoje" },
  { id: "modulos", rota: "/modulos", rotulo: "Módulos" },
  { id: "voce", rota: "/voce", rotulo: "Você" },
];

/** A barra só existe nas 3 telas-raiz. Dentro de módulo, nas páginas do Você (Ajuda, Conquistas,
 *  Aparência…), no funil, paywall, cadastro e site: sem barra (cada uma tem a própria seta ←). */
export const abaDaRota = (pathname: string): IdDaAba | null => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ABAS.find((a) => a.rota === p)?.id ?? null;
};

/** Camadas que pedem a tela inteira: a barra some enquanto existem. */
export const SELETOR_CAMADAS = '[data-camada-guia], [data-momento]';
/** Atributos que as peças guiadas (missão em doses, funil da missão, intro do módulo) põem no <html>. */
export const ATRIBUTOS_DE_CAMADA = [
  "data-missao-dose",
  "data-missao-doses-faixa",
  "data-missao-tutorial",
  "data-funil-missao",
  "data-intro-modulo-faixa",
  "data-conhecer-mais",
] as const;
/** A tela-raiz pronta (Home sem tutorial/carregamento, Módulos, Você) marca o próprio contêiner com isto. */
export const ATRIBUTO_RAIZ = "data-nav-raiz";

export interface EstadoDaTela {
  ligada: boolean;
  logado: boolean;
  pathname: string;
  /** a tela-raiz está montada e pronta (sem tutorial nem carregamento por cima) */
  raizPronta: boolean;
  /** tour, missão, festa de adesivo, holofote… */
  camadaPorCima: boolean;
}

/** A regra inteira da visibilidade, pura (testada em src/test/nav-abas.test.tsx). */
export function barraVisivel(e: EstadoDaTela): boolean {
  return e.ligada && e.logado && abaDaRota(e.pathname) !== null && e.raizPronta && !e.camadaPorCima;
}

/**
 * Folhas e diálogos PADRÃO abertos (Radix Sheet/Dialog/AlertDialog, vaul): ficam em z-50, e uma barra fixa acima
 * disso (a barra de vidro da Home nova é z-60) apareceria POR CIMA deles — "Mostrar valores em R$ e peso?" e o
 * Nível nas Conquistas, o WidgetPicker na Home (revisor 26/10). Enquanto um existe, a barra some. As folhas da
 * própria Home nova (z-70, com fundo escurecido) não precisam: já cobrem a barra.
 */
export const SELETOR_DIALOGOS = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';
/** Lê o DOM: há folha/diálogo padrão aberto? */
export function dialogoAberto(doc: Document = document): boolean {
  try { return !!doc.querySelector(SELETOR_DIALOGOS); } catch { return false; }
}

/** Lê o DOM: há camada guiada por cima? a raiz está pronta? */
export function lerTela(doc: Document = document): { raizPronta: boolean; camadaPorCima: boolean } {
  try {
    const html = doc.documentElement;
    const camada = ATRIBUTOS_DE_CAMADA.some((a) => html.hasAttribute(a)) || !!doc.querySelector(SELETOR_CAMADAS);
    return { raizPronta: !!doc.querySelector(`[${ATRIBUTO_RAIZ}]`), camadaPorCima: camada };
  } catch {
    return { raizPronta: false, camadaPorCima: true };
  }
}

/**
 * Como trocar de aba sem bagunçar o Voltar do Android (o WebView volta no histórico; sem histórico, sai
 * do app). Padrão Material: Voltar numa aba que não é a inicial leva à inicial; na inicial, sai.
 *  · Hoje → outra aba: empilha (o Voltar devolve pra Hoje).
 *  · aba → aba (nenhuma é Hoje): substitui (a pilha não cresce a cada toque).
 *  · aba → Hoje: se a entrada logo abaixo é a Hoje que empilhou, volta 1; senão substitui.
 */
export type PlanoDeNavegacao = { tipo: "empilhar" | "substituir" | "voltar" | "nada" };
export function planoDeNavegacao(de: string, para: string, hojeLogoAbaixo: boolean): PlanoDeNavegacao {
  if (de === para) return { tipo: "nada" };
  if (para === "/home") return { tipo: hojeLogoAbaixo ? "voltar" : "substituir" };
  if (de === "/home") return { tipo: "empilhar" };
  return { tipo: "substituir" };
}

/* ---------------------------------------------------------------- de onde veio (seta ← das subpáginas)
 * Módulo aberto pela aba Módulos (ou Ajuda/Conquistas aberta pelo Você) volta pra ELA na seta ←, não pra
 * Hoje. sessionStorage (a sessão do app) e preso à rota de destino: qualquer outra entrada no módulo
 * (pendência, ação rápida, notificação) segue com o destino de sempre. Chegar numa aba apaga. */
const CHAVE_VOLTA = "nav-volta";

export function marcarVolta(para: string, volta: string): void {
  try { sessionStorage.setItem(CHAVE_VOLTA, JSON.stringify({ para, volta })); } catch { /* noop */ }
}
export function limparVolta(): void {
  try { sessionStorage.removeItem(CHAVE_VOLTA); } catch { /* noop */ }
}
/** Pra onde a seta ← de `pathname` leva: a aba de origem, se foi ela que abriu; senão `padrao`. */
export function destinoDaVolta(pathname: string, padrao: string): string {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_VOLTA) || "null") as { para?: unknown; volta?: unknown } | null;
    if (v && v.para === pathname && typeof v.volta === "string" && abaDaRota(v.volta)) return v.volta;
  } catch { /* noop */ }
  return padrao;
}
