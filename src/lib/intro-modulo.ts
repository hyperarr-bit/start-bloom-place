/**
 * INTRO DO MÓDULO — protótipo (16/10/2026), chave DESLIGADA.
 *
 * Pergunta do dono: "como a pessoa nova aprende os módulos? Os cartões (texto + mockup
 * reconstruído) não ajudaram; um tutorial guiado nos 16 todo mundo ia pular."
 *
 * O que os dados de 28/09→16/10 dizem (scratchpad/cartoes/analise.mjs, 464 contas novas):
 *   · cartões: mediana de 1 cartão visto e 5 s por deck; 53% fecham em menos de 5 s; nos 4
 *     módulos onde dá pra medir registro, registrar em 10 min ficou igual às dicas antigas
 *     (25% × 21%) e o tempo até o 1º registro também (20 s × 20 s);
 *   · a DOSE GUIADA da missão (anel no controle real + post-it com chips) faz a pessoa agir:
 *     Rotina 86% registram em 10 min (× 18% de quem pulou a missão, mesma build), Saúde 89%
 *     (× 23%), Finanças 68%; quem viu o passo faz o toque em 64/87/94%.
 *
 * Então o formato é UM SÓ, o que já funciona: a primeira ação guiada dentro do módulo real
 * (reaproveitando as peças da missão: Anel, PostItDaMissao, alvos), e NÃO um deck. Só nos
 * módulos que seguram gente (Finanças, Rotina, Saúde — os 3 com volta de 21–24% depois da
 * 1ª semana; os outros ficam entre 4% e 11%). Os demais módulos ganham um ESTADO VAZIO com
 * uma captura REAL do módulo em uso (vídeo curto com poster) + 1 ação de 1 toque que já
 * deixa o módulo com conteúdo (protótipo: Casa › Mercado).
 *
 * Fora do funil da missão: a intro só aparece num módulo que NÃO é da missão da pessoa (a
 * dose É a intro dele) e 1x por aparelho + 1x por conta.
 *
 * Chave: `INTRO_MODULO = "off"` = o app de hoje, byte a byte (BoasVindasDoModulo segue pros
 * cartões/dicas). QA só no navegador: `?intro-modulo=on|off|auto` (a força fica no
 * localStorage, como `?cartoes=`). No app das lojas a força é ignorada — a ligação de
 * verdade vem do metadata remoto do RevenueCat (`intro_modulo: on`, mesmo caminho de
 * ofertas-saida.ts) ou da constante, pra ter rollback sem build.
 */
import { isNativeShell } from "@/lib/native-shell";
import type { TipoDoItem } from "@/lib/demo-guiada";

export type ModoIntro = "off" | "on";
/** ROLLBACK/LIGAR = trocar aqui (ou `intro_modulo` no metadata da offering do RC). */
export const INTRO_MODULO: ModoIntro = "off";
export const PARAM_INTRO = "intro-modulo";
export const CHAVE_FORCA_INTRO = "intro-modulo-force";
/** 1x por APARELHO: `core-intro-vista-<módulo>` (prefixo em chaves-do-aparelho.ts). */
export const chaveIntroVista = (moduleId: string) => `core-intro-vista-${moduleId}`;
/** 1x por CONTA: a lista de módulos com intro vista, gravada no user_data (sobe e volta na hidratação). */
export const CHAVE_INTRO_VISTAS_CONTA = "core-intro-vistas";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/* ───── metadata remota (preenchida por quem lê as offerings do RC, como ofertas-saida) ───── */
let remota: ModoIntro | null = null;
export function registrarIntroRemota(offerings: unknown): void {
  try {
    type Off = { identifier?: string; metadata?: Record<string, unknown> } | null | undefined;
    const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
    const lista: Off[] = [o?.current, ...Object.values(o?.all ?? {})];
    let achada: ModoIntro | null = null;
    for (const off of lista) {
      const v = off?.metadata?.intro_modulo;
      if (v === "on" || v === "off") { achada = v; if (off === o?.current) break; }
    }
    remota = achada;
  } catch { /* metadata estranha: fica como estava */ }
}
export const _zerarIntroRemota = (): void => { remota = null; };

let ultimaBuscaLida: string | null = null;
/** Guarda `?intro-modulo=on|off|auto` neste navegador (nunca no app das lojas). */
export function guardarForcaDaIntro(busca?: string | URLSearchParams): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const texto = p.toString();
  if (texto === ultimaBuscaLida) return;
  ultimaBuscaLida = texto;
  const v = p.get(PARAM_INTRO);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_INTRO, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_INTRO);
}

/** Está ligada AQUI? força de QA (só navegador) > metadata do RC > constante. */
export function introLigada(modo: ModoIntro = INTRO_MODULO): boolean {
  if (!isNativeShell()) {
    const f = ls.get(CHAVE_FORCA_INTRO);
    if (f === "on" || f === "off") return f === "on";
  }
  if (remota) return remota === "on";
  return modo === "on";
}

export const introVistaNesteAparelho = (moduleId: string): boolean => !!ls.get(chaveIntroVista(moduleId));
export const marcarIntroVistaNoAparelho = (moduleId: string): void => ls.set(chaveIntroVista(moduleId), new Date().toISOString());
export const _apagarIntroVista = (moduleId: string): void => ls.del(chaveIntroVista(moduleId));

/** A intro deste módulo já foi vista nesta CONTA (lista no user_data)? */
export const introVistaNaConta = (moduleId: string, get: <T>(k: string, f: T) => T): boolean => {
  const lista = get<unknown>(CHAVE_INTRO_VISTAS_CONTA, []);
  return Array.isArray(lista) && lista.includes(moduleId);
};
export const marcarIntroVistaNaConta = (moduleId: string, get: <T>(k: string, f: T) => T, set: (k: string, v: unknown) => void): void => {
  const lista = get<unknown>(CHAVE_INTRO_VISTAS_CONTA, []);
  const arr = Array.isArray(lista) ? (lista as string[]) : [];
  if (!arr.includes(moduleId)) set(CHAVE_INTRO_VISTAS_CONTA, [...arr, moduleId]);
};

/* ───── o que cada módulo ganha ───── */

export interface IntroGuiadaConfig {
  formato: "guiada";
  moduleId: string;
  nome: string;
  /** Tipo do item da demo guiada (alvos.ts): o anel, os chips e o "olhar" vêm dali. */
  tipo: TipoDoItem;
  /** A faixa: "Primeira vez aqui · toca em 1 gasto". */
  pedido: string;
  /** O balão do olhar (mesmo texto da missão). */
  olhar: { titulo: string; texto: string };
  /** A frase do "pronto" (toast), com o que ela anotou no lugar de {item}. */
  pronto: string;
  /** Paleta da faixa (planner: faixa sólida + caixa alta). */
  cor: { faixa: string; tinta: string };
}
export interface EstadoVazioConfig {
  formato: "vazio";
  moduleId: string;
  nome: string;
  /** A aba onde a ação acontece (a intro toca nela). */
  aba?: string;
  titulo: string;
  texto: string;
  /** Captura REAL do módulo em uso, embarcada no app: vídeo curto (mudo, loop) + poster. */
  midia: { video: string; poster: string; legenda: string };
  /** A ação de 1 toque: o rótulo e o que ela grava (feito pelo componente). */
  acao: { rotulo: string; detalhe: string };
  cor: { faixa: string; tinta: string; acento: string };
}
export type IntroConfig = IntroGuiadaConfig | EstadoVazioConfig;

export const INTROS: Record<string, IntroConfig> = {
  financas: {
    formato: "guiada", moduleId: "financas", nome: "Finanças", tipo: "gasto",
    pedido: "toca em 1 gasto seu",
    olhar: { titulo: "Olha o seu mês", texto: "O gasto entrou no dia de hoje e o 'Saiu' do mês somou sozinho — é daí que sai quanto dá pra gastar hoje." },
    pronto: "Finanças é isso: você anota, o mês soma.",
    cor: { faixa: "#FFF4C2", tinta: "#7a5a00" },
  },
  rotina: {
    formato: "guiada", moduleId: "rotina", nome: "Rotina", tipo: "habito",
    pedido: "marca 1 hábito de hoje",
    olhar: { titulo: "A linha da semana", texto: "Cada quadradinho marcado vira um dia na sua sequência — a semana inteira cabe num olhar." },
    pronto: "Rotina é isso: um quadradinho por dia.",
    cor: { faixa: "#DDF5E4", tinta: "#14532d" },
  },
  saude: {
    formato: "guiada", moduleId: "saude", nome: "Saúde", tipo: "agua",
    pedido: "marca 1 copo d'água",
    olhar: { titulo: "O copo que contou", texto: "Cada copo entra na meta do dia — e o CORE te lembra de bater ela." },
    pronto: "Saúde é isso: água, sono e remédio, um toque cada.",
    cor: { faixa: "#FFE1E1", tinta: "#7f1d1d" },
  },
  casa: {
    formato: "vazio", moduleId: "casa", nome: "Casa", aba: "mercado",
    titulo: "Sua lista do mercado, pronta pra marcar",
    texto: "Anota em casa, marca no mercado. O que acabou na Despensa cai aqui sozinho.",
    midia: { video: "/intro/casa-mercado.mp4", poster: "/intro/casa-mercado.jpg", legenda: "O Mercado em uso — gravado do app" },
    acao: { rotulo: "Começar com 3 itens", detalhe: "Leite, pão e café entram na lista; você troca depois." },
    cor: { faixa: "#DDF4F8", tinta: "#155e75", acento: "#0e7490" },
  },
};

/** Módulos com intro (os 3 guiados + o estado vazio de exemplo). */
export const MODULOS_COM_INTRO: readonly string[] = Object.keys(INTROS);
