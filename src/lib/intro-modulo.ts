/**
 * INTRO DO MÓDULO (1.0.16) — como a pessoa nova aprende cada módulo.
 *
 * O que os dados de 28/09→16/10 disseram (scratchpad/cartoes/analise.mjs, 464 contas novas):
 *   · os cartões de boas-vindas eram FECHADOS, não lidos: mediana de 1 cartão e 5 s por deck, 53%
 *     fecham em menos de 5 s; registrar em 10 min igual às dicas antigas (25% × 21%);
 *   · a DOSE GUIADA da missão (anel no controle real + post-it com chips) faz a pessoa agir:
 *     Rotina 86% registram em 10 min (× 18% de quem pulou a missão), Saúde 89% (× 23%);
 *   · dentro dos cartões, só o "Fazer agora" movia (51% × 13%).
 *
 * Então o formato é um só, o que funciona — a PRIMEIRA AÇÃO dentro do módulo real:
 *   · GUIADA (anel + post-it + "olha" no resumo) em Finanças, Rotina e Saúde, os 3 que seguram
 *     gente (volta depois da 1ª semana 21–24%; os outros 4–11%);
 *   · ESTADO VAZIO com uma captura REAL do módulo em uso (vídeo curto, mudo, em loop, com poster,
 *     claro e escuro, embarcado em public/intro) + 1 frase + 1 ação de 1 toque que já deixa o
 *     módulo com conteúdo de verdade — nos outros módulos (Dieta, Estudos, Biblioteca, Casa,
 *     Desenvolvimento, Carreira, Detox; em Mente e Viagens o toque abre o campo real, porque o
 *     conteúdo é da pessoa);
 *   · Treino, Relações, Pet e Beleza ficam sem intro: a tela vazia deles JÁ é o primeiro passo
 *     ("Comece com um modelo pronto", Começo pronto, "quem é o seu pet", as 3 perguntas do skincare).
 *     O quiz de 2 perguntas do Treino (EscolherTreino) existe, mas só roda como 1ª dose da missão na
 *     área "corpo" — "não quero que a pessoa clique em um módulo e apareça um quiz" (dono, 17/10).
 *   · Os cartões SAEM do fluxo com a chave ligada (o código fica de reserva).
 *
 * QUANDO aparece — todas estas, na conta carregada (`loaded`):
 *   · chave ligada; o módulo tem intro; o módulo está VAZIO (quem já tem dado nunca vê intro);
 *   · nunca vista neste aparelho (core-intro-vista-<m>) nem nesta conta (core-intro-vistas no
 *     user_data — vale pra 2 aparelhos) e o módulo não foi apresentado antes de outro jeito
 *     (dicas fechadas, cartões vistos, tutorial antigo feito);
 *   · missão em doses: nunca com uma dose na tela, nunca no módulo da dose de HOJE enquanto ela
 *     está por fazer, nunca num módulo cuja dose já foi feita (a dose É a intro dele) — e SÓ isso:
 *     Rotina/Saúde antes do dia deles mostram a intro na 1ª abertura (dono, 17/10) — ver
 *     `introBloqueadaPelaMissao`; o que a intro deixou feito está em `introConcluida()` pra missão;
 *   · nenhuma outra guia (holofote, festa, tutorial antigo) por cima.
 * Marca "vista" só ao TERMINAR — "feita@…" ou "pulada@…" no aparelho, e na conta a lista de vistas
 * (core-intro-vistas) e a de feitas (core-intro-feitas). Fechar o app no meio = volta 1 vez; na 2ª
 * aparição já marca (core-intro-aberta-<m>), pra nunca virar insistência.
 *
 * CHAVE: `INTRO_MODULO` (web) nasce off; `INTRO_MODULO_APP` (app das lojas) nasce ON. No app a
 * metadata `intro_modulo: "on" | "off"` da offering do RevenueCat manda em cima da constante
 * (rollback sem build — registrada em revenuecat.ts junto das ofertas de saída). QA no navegador:
 * `?intro-modulo=on|off|auto` (a força fica no localStorage; ignorada no app das lojas).
 */
import { isNativeShell } from "@/lib/native-shell";
import type { TipoDoItem } from "@/lib/demo-guiada";
import * as missaoDoses from "@/lib/missao-doses";
import { diaDaMissao, ehBracoB, lerMissao, missaoDosesLigada, passoPendente, type DiaDaMissao } from "@/lib/missao-doses";
import {
  CAFE_DA_MANHA, adicionarCurso, adicionarLivro, anotarCafeDaManha, anotarTarefaDoTrabalho, comecarDetox, comecarMercado, criarMeta,
  type ContextoDaAcao,
} from "@/lib/intro-modulo-acoes";

export type ModoIntro = "off" | "on";
/** Web (Vercel): fica desligada — a intro é do app. ROLLBACK/LIGAR na web = trocar aqui. */
export const INTRO_MODULO: ModoIntro = "off";
/** App das lojas (1.0.16): LIGADA. Rollback sem build = `intro_modulo: "off"` na offering do RC; com build = trocar aqui. */
export const INTRO_MODULO_APP: ModoIntro = "on";
export const PARAM_INTRO = "intro-modulo";
export const CHAVE_FORCA_INTRO = "intro-modulo-force";
/** 1x por APARELHO (terminou: feita ou pulada): `core-intro-vista-<módulo>` (prefixo em chaves-do-aparelho.ts). */
export const chaveIntroVista = (moduleId: string) => `core-intro-vista-${moduleId}`;
/** Já APARECEU neste aparelho (mesmo sem terminar): a 2ª aparição é a última. */
export const chaveIntroAberta = (moduleId: string) => `core-intro-aberta-${moduleId}`;
/** 1x por CONTA: a lista de módulos com intro vista (feita OU pulada), no user_data (sobe e volta na hidratação — vale pro 2º aparelho). */
export const CHAVE_INTRO_VISTAS_CONTA = "core-intro-vistas";
/** Na CONTA: a lista de módulos com intro FEITA (a ação aconteceu) — a missão lê pra não repetir a 1ª ação na dose. */
export const CHAVE_INTRO_FEITAS_CONTA = "core-intro-feitas";
export type FimDaIntro = "feita" | "pulada";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/* ───── metadata remota (preenchida por quem lê as offerings do RC — revenuecat.ts) ───── */
let remota: ModoIntro | null = null;
export function registrarIntroRemota(offerings: unknown): void {
  try {
    type Off = { identifier?: string; metadata?: Record<string, unknown> } | null | undefined;
    const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
    const lista: Off[] = [o?.current, ...Object.values(o?.all ?? {})];
    let achada: ModoIntro | null = null;
    for (const off of lista) {
      const v = String(off?.metadata?.intro_modulo ?? "").toLowerCase();
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

/** Está ligada AQUI? app: metadata do RC > constante do app · web: força de QA > metadata > constante da web. */
export function introLigada(modo: ModoIntro = INTRO_MODULO, modoApp: ModoIntro = INTRO_MODULO_APP): boolean {
  if (isNativeShell()) return remota ? remota === "on" : modoApp === "on";
  const f = ls.get(CHAVE_FORCA_INTRO);
  if (f === "on" || f === "off") return f === "on";
  if (remota) return remota === "on";
  return modo === "on";
}

/* ───── marcas: aparelho e conta ───── */
export type Leitor = <T>(k: string, f: T) => T;
export type Escritor = (k: string, v: unknown) => void;

export const introVistaNesteAparelho = (moduleId: string): boolean => !!ls.get(chaveIntroVista(moduleId));
/** O valor guarda o desfecho: "feita@<iso>" ou "pulada@<iso>". */
export const marcarIntroVistaNoAparelho = (moduleId: string, como: FimDaIntro = "feita"): void => ls.set(chaveIntroVista(moduleId), `${como}@${new Date().toISOString()}`);
export const introAbertaNesteAparelho = (moduleId: string): boolean => !!ls.get(chaveIntroAberta(moduleId));
export const marcarIntroAbertaNoAparelho = (moduleId: string): void => ls.set(chaveIntroAberta(moduleId), new Date().toISOString());
/** Só testes/dev. */
export const _apagarIntroVista = (moduleId: string): void => { ls.del(chaveIntroVista(moduleId)); ls.del(chaveIntroAberta(moduleId)); };

export const introVistaNaConta = (moduleId: string, get: Leitor): boolean => {
  const lista = get<unknown>(CHAVE_INTRO_VISTAS_CONTA, []);
  return Array.isArray(lista) && lista.includes(moduleId);
};
export const marcarIntroVistaNaConta = (moduleId: string, get: Leitor, set: Escritor): void => {
  const lista = get<unknown>(CHAVE_INTRO_VISTAS_CONTA, []);
  const arr = Array.isArray(lista) ? (lista as string[]) : [];
  if (!arr.includes(moduleId)) set(CHAVE_INTRO_VISTAS_CONTA, [...arr, moduleId]);
};
/** Terminou (feita ou pulada): aparelho + conta; "feita" também entra na lista de feitas da conta. */
export const marcarIntroVista = (moduleId: string, get: Leitor, set: Escritor, como: FimDaIntro = "feita"): void => {
  marcarIntroVistaNoAparelho(moduleId, como);
  marcarIntroVistaNaConta(moduleId, get, set);
  if (como === "feita") {
    const lista = get<unknown>(CHAVE_INTRO_FEITAS_CONTA, []);
    const arr = Array.isArray(lista) ? (lista as string[]) : [];
    if (!arr.includes(moduleId)) set(CHAVE_INTRO_FEITAS_CONTA, [...arr, moduleId]);
  }
};

/**
 * A intro deste módulo foi FEITA (a pessoa fez a 1ª ação — pular não conta)? Pra missão em doses adaptar a
 * dose dos dias 2/3 (continuação em vez de repetir a 1ª ação). Seguro de chamar em qualquer lugar: lê a marca
 * do aparelho e a lista de feitas da conta — pelo `get` de quem tem o user_data na mão, ou direto do cache do
 * user_data no localStorage (`u:<id>:core-intro-feitas` / `guest:core-intro-feitas`) quando não tem.
 */
export function introConcluida(modulo: string, get?: Leitor): boolean {
  if ((ls.get(chaveIntroVista(modulo)) ?? "").startsWith("feita")) return true;
  if (get) {
    const lista = get<unknown>(CHAVE_INTRO_FEITAS_CONTA, []);
    return Array.isArray(lista) && lista.includes(modulo);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k !== `guest:${CHAVE_INTRO_FEITAS_CONTA}` && !(k.startsWith("u:") && k.endsWith(`:${CHAVE_INTRO_FEITAS_CONTA}`))) continue;
      const v = JSON.parse(localStorage.getItem(k) ?? "null");
      if (Array.isArray(v) && v.includes(modulo)) return true;
    }
  } catch { /* storage bloqueado ou valor estranho */ }
  return false;
}

/** O módulo já foi apresentado de OUTRO jeito (dicas antigas fechadas, cartões vistos, tutorial antigo)? Então é conta de antes. */
export const moduloJaApresentado = (moduleId: string, get: Leitor): boolean => {
  if (!!ls.get(`core-cartoes-vistos-${moduleId}`)) return true;
  const tip = get<unknown>(`core-tip-seen-${moduleId}`, "");
  if (tip === "true" || tip === true) return true;
  const spot = get<unknown>(`spotlight-done-${moduleId}`, "");
  return spot === "true" || spot === true;
};

/* ───── o módulo está vazio? ───── */
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** null/[]/{}/"" (e lista ou mapa só com vazios dentro) = sem conteúdo. */
export const semConteudo = (v: unknown): boolean => {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (typeof v === "number") return !v;
  if (typeof v === "boolean") return !v;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
};
const vazias = (get: Leitor, chaves: string[]): boolean => chaves.every((k) => semConteudo(get<unknown>(k, undefined)));

/* ───── o que cada módulo ganha ───── */
export interface CorDaIntro { faixa: string; tinta: string; acento: string }
/**
 * O "montar" do módulo (ramos v1016-financas / v1016-rotina; merge depois): um setup que só roda como a
 * 1ª dose da missão na área escolhida no funil (dono, 17/10: "não quero que a pessoa clique em um módulo e
 * apareça um quiz"). Enquanto está na tela marca `<html <atributo>>`; ao terminar dispara na window o
 * `<evento>` com `detail.resultado` ("pronto" | …). A intro ESPERA ele sair e começa logo depois.
 * Numa abertura por curiosidade o montar não aparece e a intro roda como sempre — a espera é inofensiva.
 */
export interface MontarDoModulo { evento: string; atributo: string }
interface IntroBase {
  moduleId: string;
  nome: string;
  cor: CorDaIntro;
  /** O módulo está sem nada (conta nova)? Quem já tem dado nunca vê a intro. */
  vazio: (get: Leitor) => boolean;
  montar?: MontarDoModulo;
}
/**
 * Um "olhar" alternativo num resumo que mora em OUTRA aba (Finanças: o card QUANTO POSSO GASTAR HOJE,
 * no Dashboard — o número que a pessoa acabou de ver no Montar). Só vale quando `quando(get)` diz que
 * faz sentido (tem renda); senão a intro olha o resumo padrão do alvo (MEU MÊS).
 */
export interface OlharNoResumo {
  quando: (get: Leitor) => boolean;
  /** abre a aba onde o resumo mora (depois do registro) */
  abrir: () => void;
  /** acha o card (depois de abrir a aba; a intro espera até ~1,5 s por ele) */
  achar: () => Element | null;
  /** lê o número que o card mostra agora */
  ler: (el: Element) => number | null;
  /** o número de ANTES do registro, a partir do de depois e do valor registrado */
  antes: (depois: number, valor: number) => number;
  numero: { titulo: string; formatar: (n: number) => string };
  titulo: string;
  texto: string;
}
export interface IntroGuiadaConfig extends IntroBase {
  formato: "guiada";
  /** Tipo do item da demo guiada (alvos.ts): o anel, os chips e o "olhar" vêm dali. */
  tipo: TipoDoItem;
  /** A faixa: "Primeira vez aqui · toca em 1 gasto". */
  pedido: string;
  /** O balão do olhar. */
  olhar: { titulo: string; texto: string };
  /** A frase do cartão pequeno do fim, depois do que ela anotou. */
  pronto: string;
  olharNoResumo?: OlharNoResumo;
  /** O post-it quando a intro começa logo depois do montar ("pronto"): Rotina = "marca o primeiro quando fizer". */
  depoisDoMontar?: { pergunta: string; descricao?: string };
}

/* ───── Montar Finanças (ramo v1016-financas; merge depois) ─────
 * O Montar ("Vamos montar suas Finanças": renda → contas fixas → "Você pode gastar hoje R$ X") marca
 * `<html data-montar-financas>` enquanto está na tela e, ao terminar, dispara na window o evento
 * `montar-financas:fim` com `detail.resultado` ("pronto" | …). A intro de Finanças ESPERA o Montar sair
 * e começa logo em seguida — o Montar grava renda e contas fixas, e a intro continua valendo porque a
 * elegibilidade de Finanças é "nenhum gasto VARIÁVEL ainda" (finance-expenses), não "nenhum dado". */
export const EVENTO_MONTAR_FINANCAS_FIM = "montar-financas:fim";
export const ATRIBUTO_MONTAR_FINANCAS = "data-montar-financas";
export const MONTAR_FINANCAS: MontarDoModulo = { evento: EVENTO_MONTAR_FINANCAS_FIM, atributo: ATRIBUTO_MONTAR_FINANCAS };
/* Montar Rotina ("Rotina pronta em 3 toques", ramo v1016-rotina): hora de acordar, itens que não podem faltar,
 * lembrete da manhã → a Rotina nasce preenchida; a intro vira "marca o primeiro quando fizer". */
export const EVENTO_MONTAR_ROTINA_FIM = "montar-rotina:fim";
export const ATRIBUTO_MONTAR_ROTINA = "data-montar-rotina";
export const MONTAR_ROTINA: MontarDoModulo = { evento: EVENTO_MONTAR_ROTINA_FIM, atributo: ATRIBUTO_MONTAR_ROTINA };
/** O montar deste módulo está na tela agora? */
export const montarNaTela = (montar?: MontarDoModulo): boolean => { try { return !!montar && document.documentElement.hasAttribute(montar.atributo); } catch { return false; } };

/** Toca na aba do módulo pelo rótulo (o mesmo toque que a pessoa daria). */
const tocarAba = (rotulo: string): void => {
  try {
    const alvo = rotulo.toUpperCase();
    const botoes = Array.from(document.querySelectorAll<HTMLElement>('header button, [role="tablist"] button, [role="tab"], .notion-tab'));
    botoes.find((b) => (b.textContent ?? "").toUpperCase().includes(alvo))?.click();
  } catch { /* sem DOM */ }
};
/** "R$ 1.234,56" → 1234.56 */
const lerReaisDoTexto = (texto: string | null | undefined): number | null => {
  const m = (texto ?? "").match(/R\$\s*([\d.]+(?:,\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
/** Dias restantes no mês, contando hoje — a mesma conta do computeDailyBudget (lib/finance-totals). */
const diasRestantesNoMes = (agora: Date = new Date()): number => new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate() - agora.getDate() + 1;
const reaisInteiros = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
/** O card QUANTO POSSO GASTAR HOJE do Dashboard de Finanças (components/Dashboard.tsx, data-missao="posso-gastar"). */
export const OLHAR_POSSO_GASTAR: OlharNoResumo = {
  quando: (get) => !semConteudo(get<unknown>("finance-incomes", undefined)),
  abrir: () => tocarAba("DASHBOARD"),
  achar: () => document.querySelector('[data-missao="posso-gastar"]'),
  ler: (el) => lerReaisDoTexto(el.querySelector("p")?.textContent),
  // o por-dia cai exatamente valor ÷ dias restantes (computeDailyBudget): o de antes sai daí
  antes: (depois, valor) => Math.round(depois + valor / diasRestantesNoMes()),
  numero: { titulo: "Hoje dá pra gastar", formatar: reaisInteiros },
  titulo: "Esse número é o seu guia do dia",
  texto: "O café já está descontado aqui. Cada gasto que você anota mexe nele na hora — é por ele que você decide o resto do dia.",
};
export interface OpcaoDaIntro { emoji: string; rotulo: string; /** o que vai pro evento (sem acento/emoji) */ id: string }
export type AcaoVazio =
  /** 1 botão que grava um começo pronto. */
  | { tipo: "botao"; rotulo: string; detalhe: string; executar: (ctx: ContextoDaAcao) => void }
  /** uma pergunta e 3 chips: cada chip é 1 toque que grava o que a pessoa escolheu. */
  | { tipo: "chips"; pergunta: string; opcoes: OpcaoDaIntro[]; detalhe: string; executar: (ctx: ContextoDaAcao, opcao: OpcaoDaIntro) => void }
  /** o conteúdo é da pessoa (um pensamento, um destino): o toque abre o campo real do módulo.
   *  `abrir` = o toque que faz o campo existir (a Mente só mostra o campo da hora depois de tocar nela). */
  | { tipo: "foco"; rotulo: string; detalhe: string; seletor: string; abrir?: () => void };
export interface MidiaDaIntro {
  /** captura real do módulo em uso, por tema (public/intro) */
  video: { claro: string; escuro: string };
  poster: { claro: string; escuro: string };
  /** o que a captura mostra (só pra leitor de tela) */
  alt: string;
}
export interface EstadoVazioConfig extends IntroBase {
  formato: "vazio";
  /** A aba onde a ação acontece (o toque abre ela, pelo rótulo). */
  aba?: string;
  titulo: string;
  texto: string;
  midia: MidiaDaIntro;
  acao: AcaoVazio;
  /** Depois de gravar: um toque no DOM do módulo (abrir o dia de hoje no cardápio, por exemplo). */
  depois?: () => void;
}
export type IntroConfig = IntroGuiadaConfig | EstadoVazioConfig;

/** Rola até o elemento ficar logo abaixo do cabeçalho fixo do módulo (scrollIntoView "start" deixaria ele escondido atrás). */
const rolarAbaixoDoCabecalho = (el: Element): void => {
  try {
    const cabecalho = document.querySelector("header.sticky");
    const topo = cabecalho ? cabecalho.getBoundingClientRect().bottom : 0;
    const y = window.scrollY + el.getBoundingClientRect().top - topo - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  } catch { /* sem DOM */ }
};
const midia = (nome: string, alt: string): MidiaDaIntro => ({
  video: { claro: `/intro/${nome}.mp4`, escuro: `/intro/${nome}-escuro.mp4` },
  poster: { claro: `/intro/${nome}.jpg`, escuro: `/intro/${nome}-escuro.jpg` },
  alt,
});
const op = (emoji: string, rotulo: string, id: string): OpcaoDaIntro => ({ emoji, rotulo, id });

export const INTROS: Record<string, IntroConfig> = {
  /* ───────── guiadas: a dose, sem a missão em volta ───────── */
  financas: {
    formato: "guiada", moduleId: "financas", nome: "Finanças", tipo: "gasto",
    pedido: "toca em 1 gasto seu",
    olhar: { titulo: "Olha o seu mês", texto: "O gasto entrou no dia de hoje e o 'Saiu' do mês somou sozinho. É daí que sai quanto dá pra gastar hoje." },
    pronto: "Finanças é isso: você anota, o mês soma.",
    // depois do Montar (renda + contas fixas), o "olha" vai no QUANTO POSSO GASTAR HOJE do Dashboard — o número que ela acabou de ver
    olharNoResumo: OLHAR_POSSO_GASTAR,
    cor: { faixa: "#FFF4C2", tinta: "#7a5a00", acento: "#d97706" },
    // elegível = nenhum gasto VARIÁVEL ainda; renda e contas fixas do Montar não contam (a intro ensina a anotar o gasto)
    vazio: (get) => vazias(get, ["finance-expenses"]),
    montar: MONTAR_FINANCAS,
  },
  rotina: {
    formato: "guiada", moduleId: "rotina", nome: "Rotina", tipo: "habito",
    pedido: "marca 1 hábito de hoje",
    olhar: { titulo: "A linha da semana", texto: "Cada quadradinho marcado vira um dia na sua sequência. A semana inteira cabe num olhar." },
    pronto: "Rotina é isso: um quadradinho por dia.",
    depoisDoMontar: { pergunta: "Marca o primeiro quando fizer", descricao: "A linha de HOJE: toca no quadradinho do hábito que você já fez." },
    cor: { faixa: "#DDF5E4", tinta: "#14532d", acento: "#059669" },
    // elegível = NENHUM quadradinho marcado ainda; os hábitos criados pelo montar não contam como dado
    vazio: (get) => {
      const grade = mapa(get<unknown>("rotina-habits-checked", {}));
      const marcou = Object.values(grade).some((dia) => lista(dia).some((x) => x === true));
      return !marcou && vazias(get, ["core-rotina-habit-log"]);
    },
    montar: MONTAR_ROTINA,
  },
  saude: {
    formato: "guiada", moduleId: "saude", nome: "Saúde", tipo: "agua",
    pedido: "marca 1 copo d'água",
    olhar: { titulo: "O copo que contou", texto: "Cada copo entra na meta do dia. O CORE te lembra de bater ela." },
    pronto: "Saúde é isso: água, sono e remédio, um toque cada.",
    cor: { faixa: "#FFE1E1", tinta: "#7f1d1d", acento: "#dc2626" },
    vazio: (get) => vazias(get, ["core-saude-water", "water-log", "core-saude-sleep", "core-saude-supplement-log"]),
  },

  /* ───────── estado vazio com captura real + 1 toque que grava ───────── */
  dieta: {
    formato: "vazio", moduleId: "dieta", nome: "Dieta", aba: "CARDÁPIO",
    titulo: "Seu cardápio da semana",
    texto: "Um dia por vez, o que você come em cada refeição. Dá pra copiar um dia pros outros.",
    midia: midia("dieta", "A Dieta em uso: o cardápio de hoje aberto"),
    acao: {
      tipo: "chips", pergunta: "O que foi o seu café da manhã hoje?",
      opcoes: [op("☕", "Pão com café", "pao_com_cafe"), op("🥚", "Ovos mexidos", "ovos"), op("🍌", "Fruta com iogurte", "fruta_iogurte")],
      detalhe: "Entra no dia de hoje. As outras refeições você preenche quando quiser.",
      executar: (ctx, o) => anotarCafeDaManha(ctx, o.rotulo),
    },
    depois: () => {
      // o card de hoje do cardápio pode nascer recolhido no celular: abre pra ela ver a refeição que entrou.
      // SÓ o botão "Abrir <dia>" do próprio card — `button[aria-expanded="false"]` também casa com o gatilho do
      // diálogo "Limpar cardápio" (Radix marca aria-expanded nele), e isso abriu o diálogo de apagar (16/10).
      try {
        const hoje = document.querySelector('[data-spotlight="first-day"]');
        const abrir = hoje?.querySelector<HTMLElement>('button[aria-label^="Abrir "]:not([aria-haspopup])');
        abrir?.click();
        // a semana começa na segunda: rola até HOJE (logo abaixo do cabeçalho fixo) pra ela ver o café que entrou
        if (hoje) rolarAbaixoDoCabecalho(hoje);
      } catch { /* sem DOM */ }
    },
    cor: { faixa: "#E3F6E0", tinta: "#14532d", acento: "#16a34a" },
    vazio: (get) => {
      const plano = mapa(get<unknown>("saude-meals", {}));
      const semRefeicao = Object.values(plano).every((d) => Object.values(mapa(d)).every((r) => semConteudo(r)));
      return semRefeicao && vazias(get, ["dieta-recipes-v2", "dieta-smart-list"]);
    },
  },
  estudos: {
    formato: "vazio", moduleId: "estudos", nome: "Estudos",
    titulo: "Seus cursos num lugar só",
    texto: "Cada curso com as aulas feitas, o caderno e as provas. Você vê quanto já andou.",
    midia: midia("estudos", "Os Estudos em uso: um curso ganhando mais uma aula"),
    acao: {
      tipo: "chips", pergunta: "O que você está estudando?",
      opcoes: [op("🇬🇧", "Inglês", "ingles"), op("🎓", "Faculdade", "faculdade"), op("📚", "Concurso", "concurso")],
      detalhe: "Só o nome por enquanto. Link e aulas você completa depois.",
      executar: (ctx, o) => adicionarCurso(ctx, o.rotulo),
    },
    cor: { faixa: "#E4E6FF", tinta: "#312e81", acento: "#4f46e5" },
    vazio: (get) => vazias(get, ["estudos-cursos-andamento", "estudos-notebooks", "estudos-exams", "estudos-subjects"]),
  },
  biblioteca: {
    formato: "vazio", moduleId: "biblioteca", nome: "Biblioteca",
    titulo: "Sua estante, com o que você está lendo",
    texto: "Capa, página atual e anotações. A meta do ano conta sozinha.",
    midia: midia("biblioteca", "A Biblioteca em uso: a página atual de um livro subindo"),
    acao: {
      tipo: "chips", pergunta: "Qual você está lendo (ou quer começar)?",
      opcoes: [op("📘", "Hábitos Atômicos", "habitos_atomicos"), op("📗", "O Poder do Hábito", "poder_do_habito"), op("📙", "Essencialismo", "essencialismo")],
      detalhe: "Entra como 'lendo'. O seu livro você adiciona pelo link ou pelo título.",
      executar: (ctx, o) => adicionarLivro(ctx, { titulo: o.rotulo, autor: LIVROS[o.id]?.autor ?? "", capa: LIVROS[o.id]?.capa ?? "" }),
    },
    cor: { faixa: "#FFE9D6", tinta: "#7c2d12", acento: "#ea580c" },
    vazio: (get) => vazias(get, ["lib-books"]),
  },
  casa: {
    formato: "vazio", moduleId: "casa", nome: "Casa", aba: "MERCADO",
    titulo: "A lista do mercado, pronta pra marcar",
    texto: "Você anota em casa e vai marcando no mercado. O que acabar na Despensa cai aqui sozinho.",
    midia: midia("casa", "A Casa em uso: itens da lista do mercado sendo marcados"),
    acao: { tipo: "botao", rotulo: "Começar com 3 itens", detalhe: "Leite, pão e café entram na lista. Depois você troca.", executar: comecarMercado },
    cor: { faixa: "#DDF4F8", tinta: "#155e75", acento: "#0e7490" },
    vazio: (get) => {
      const cats = lista(get<unknown>("casa-grocery-categories", []));
      const semItem = cats.every((c) => lista(mapa(c).items).length === 0);
      const comodos = lista(get<unknown>("casa-rooms", []));
      const semTarefa = comodos.every((c) => lista(mapa(c).tasks).length === 0);
      return semItem && semTarefa && vazias(get, ["casa-maint-tasks", "casa-shopping-list"]);
    },
  },
  desenvolvimento: {
    formato: "vazio", moduleId: "desenvolvimento", nome: "Desenvolvimento", aba: "METAS",
    titulo: "Suas metas, quebradas em passos",
    texto: "Cada meta vira um quadro com etapas pra marcar. É assim que ela sai do papel.",
    midia: midia("desenvolvimento", "As Metas em uso: etapas de uma meta sendo marcadas"),
    acao: {
      tipo: "chips", pergunta: "Qual meta você quer tirar do papel?",
      opcoes: [op("🏃", "Correr 5 km", "correr_5km"), op("💰", "Guardar R$ 1.000", "guardar_1000"), op("📚", "Ler 12 livros", "ler_12_livros")],
      detalhe: "A meta nasce com duas etapas pra você preencher.",
      executar: (ctx, o) => criarMeta(ctx, o.rotulo),
    },
    cor: { faixa: "#EFE2FF", tinta: "#4c1d95", acento: "#7c3aed" },
    vazio: (get) => vazias(get, ["goals-board-v2", "dp-gratitude", "dp-mood-log", "dp-motivations"]),
  },
  carreira: {
    formato: "vazio", moduleId: "carreira", nome: "Carreira", aba: "Meu Dia",
    titulo: "Seu dia de trabalho numa folha",
    texto: "Pomodoro pra focar, contadores do que você faz todo dia e as tarefas de hoje, tudo numa tela só.",
    depois: () => {
      // a lista de tarefas fica abaixo do Pomodoro e das fases: rola até ela pra a tarefa que entrou aparecer
      try { document.querySelector('input[placeholder="Nova tarefa do trabalho..."]')?.scrollIntoView?.({ behavior: "smooth", block: "center" }); } catch { /* sem DOM */ }
    },
    midia: midia("carreira", "A Carreira em uso: uma tarefa do dia sendo marcada"),
    acao: {
      tipo: "chips", pergunta: "Uma tarefa do trabalho pra hoje:",
      opcoes: [op("📧", "Responder e-mails", "emails"), op("📊", "Fechar o relatório", "relatorio"), op("📞", "Ligar pro cliente", "cliente")],
      detalhe: "Entra na lista de hoje. Depois você põe as suas.",
      executar: (ctx, o) => anotarTarefaDoTrabalho(ctx, o.rotulo),
    },
    cor: { faixa: "#E6EAF0", tinta: "#1e293b", acento: "#475569" },
    vazio: (get) => {
      const fases = lista(get<unknown>("career-day-phases", []));
      const semContagem = fases.every((f) => Object.keys(mapa(mapa(f).counts)).length === 0);
      return semContagem && vazias(get, ["career-day-tasks", "career-jobs", "career-skills", "career-contacts", "career-portfolio"]);
    },
  },
  detox: {
    formato: "vazio", moduleId: "detox", nome: "Detox",
    titulo: "O que você quer largar",
    texto: "Um check-in por dia vira a sua sequência. Se escorregar, recomeça sem drama.",
    midia: midia("detox", "O Detox em uso: o check-in do dia sendo marcado"),
    acao: {
      tipo: "chips", pergunta: "O que você quer parar?",
      opcoes: [op("📱", "Redes sociais à noite", "redes_sociais"), op("🍬", "Açúcar", "acucar"), op("🚬", "Cigarro", "cigarro")],
      detalhe: "Começa a contar hoje.",
      executar: (ctx, o) => comecarDetox(ctx, { nome: o.rotulo, icone: o.emoji }),
    },
    cor: { faixa: "#EAF7D2", tinta: "#365314", acento: "#65a30d" },
    vazio: (get) => vazias(get, ["detox-habits", "detox-diary"]),
  },

  /* ───────── estado vazio com captura real + o toque abre o campo (o conteúdo é da pessoa) ───────── */
  hiperfoco: {
    formato: "vazio", moduleId: "hiperfoco", nome: "Mente",
    titulo: "Tira da cabeça, põe aqui",
    texto: "Cada pensamento fica na hora em que apareceu. Depois você acha tudo pela busca.",
    midia: midia("hiperfoco", "A Mente em uso: um pensamento sendo anotado"),
    acao: {
      tipo: "foco", rotulo: "Anotar 1 pensamento", detalhe: "Uma linha basta. Tira da cabeça e pronto.",
      seletor: 'textarea[placeholder="O que está pensando?"], input[placeholder="O que está pensando?"]',
      // a linha do tempo da Mente abre o campo da HORA que a pessoa toca: toca na hora de agora por ela
      abrir: () => {
        try {
          const hora = `${String(new Date().getHours()).padStart(2, "0")}:00`;
          const linha = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => (b.textContent ?? "").trim().startsWith(hora));
          linha?.click();
        } catch { /* sem DOM */ }
      },
    },
    cor: { faixa: "#ECE4FF", tinta: "#4c1d95", acento: "#6d28d9" },
    vazio: (get) => vazias(get, ["hiperfoco-thoughts", "mente-dreams"]),
  },
  viagens: {
    formato: "vazio", moduleId: "viagens", nome: "Viagens",
    titulo: "Os lugares que você quer conhecer",
    texto: "Primeiro o destino. Roteiro, mala e orçamento vêm quando a viagem ficar de pé.",
    midia: midia("viagens", "As Viagens em uso: um destino novo entrando na lista"),
    acao: { tipo: "foco", rotulo: "Anotar 1 destino", detalhe: "Só o nome do lugar.", seletor: 'input[placeholder="Destino..."], input[placeholder="Destino"]' },
    cor: { faixa: "#D9F4F0", tinta: "#134e4a", acento: "#0d9488" },
    vazio: (get) => vazias(get, ["travel-bucket"]),
  },
};
/** Os 3 livros dos chips: autor e CAPA (Open Library, a mesma fonte de capas da function fetch-book-metadata — o
 *  "adicionar por título" do módulo não busca capa, só o "por link"; o chip entrega o livro já com capa). */
const LIVROS: Record<string, { autor: string; capa: string }> = {
  habitos_atomicos: { autor: "James Clear", capa: "https://covers.openlibrary.org/b/isbn/9788550807560-L.jpg" },
  poder_do_habito: { autor: "Charles Duhigg", capa: "https://covers.openlibrary.org/b/isbn/9788539004119-L.jpg" },
  essencialismo: { autor: "Greg McKeown", capa: "https://covers.openlibrary.org/b/isbn/9788543102146-L.jpg" },
};
export { CAFE_DA_MANHA };

/** Módulos com intro (3 guiadas + 9 estados vazios). Treino, Relações, Pet e Beleza ficam com a tela vazia deles. */
export const MODULOS_COM_INTRO: readonly string[] = Object.keys(INTROS);
export const MODULOS_SEM_INTRO: readonly string[] = ["treino", "relacionamentos", "pet", "beleza"];
/** Com a intro ligada, nem o "Dicas para começar" antigo: a tela vazia do módulo é o 1º passo (Treino: "Comece com um
 *  modelo pronto"; o EscolherTreino só roda como 1ª dose da missão — dono, 17/10). */
export const MODULOS_SEM_NADA: readonly string[] = ["treino"];

/* ───── a missão em doses ───── */
/**
 * PONTO DE LIGAÇÃO com o ramo da missão (merge depois): a missão passa a exportar
 * `moduloDaMissaoHoje(): string | null` de lib/missao-doses e a marcar
 * `document.documentElement.dataset.missaoDose = "1"` enquanto uma dose está na tela.
 * Aqui os dois são lidos sem depender de existirem: o dataset direto, e a função pelo namespace do
 * módulo (se ainda não existir, vale só a regra local abaixo). Nada a trocar depois do merge.
 */
const moduloDaMissaoHoje = (): string | null => {
  const fn = (missaoDoses as unknown as { moduloDaMissaoHoje?: () => string | null }).moduloDaMissaoHoje;
  if (typeof fn !== "function") return null;
  try { return fn() ?? null; } catch { return null; }
};
/** Uma dose da missão está na tela agora (marca do ramo da missão)? */
export const doseNaTela = (): boolean => { try { return document.documentElement.dataset.missaoDose === "1"; } catch { return false; } };

/**
 * ANTES do merge do ramo da missão, "o módulo da dose de HOJE" sai do estado da missão: o próximo passo por
 * fazer, se ele é de hoje (ou atrasado) no calendário da missão — no braço B (dia 1 cheio) as 3 doses são de hoje.
 */
const moduloDaDoseDeHojeLocal = (): string | null => {
  const m = lerMissao();
  if (!m || m.explorou) return null;
  const p = passoPendente(m);
  if (!p) return null;
  return ehBracoB(m) || p.n <= diaDaMissao(m) ? p.modulo : null;
};

/**
 * A missão em doses bloqueia a intro deste módulo? SÓ nestes 3 casos (dono, 17/10: "ele vai querer ver Rotina na
 * primeira vez, não vai esperar o dia 2"):
 *   (a) uma dose está na tela agora;
 *   (b) é o módulo da dose de HOJE e ela ainda está por fazer (a dose É a intro dele);
 *   (c) a dose deste módulo JÁ FOI FEITA (a dose usa o mesmo anel/post-it — seria repetir a mesma ação).
 * Qualquer outro módulo — inclusive Rotina/Saúde antes do dia deles na missão — mostra a intro na 1ª abertura.
 * O que a intro deixou feito fica em `introConcluida()`: a missão lê e transforma a dose dos dias 2/3 em continuação.
 */
export function introBloqueadaPelaMissao(moduleId: string): boolean {
  if (doseNaTela()) return true;
  try {
    if (!missaoDosesLigada()) return false;
    const hoje = moduloDaMissaoHoje() ?? moduloDaDoseDeHojeLocal();
    if (hoje === moduleId) return true;
    const m = lerMissao();
    if (!m) return false;
    const modulos = m.modulos as string[];
    if (([1, 2, 3] as DiaDaMissao[]).some((n) => !!m.feitos[n] && modulos[n - 1] === moduleId)) return true;
  } catch { /* sem storage: segue */ }
  return false;
}

/* ───── a decisão ───── */
export type MotivoSemIntro = "desligada" | "sem_intro" | "ja_vista" | "ja_apresentado" | "com_dado" | "missao" | "outra_guia";
/** Mostra a intro deste módulo? `null` = mostra; senão o motivo de não mostrar (pros testes e pro dev). */
export function porQueNaoMostrar(moduleId: string, get: Leitor, extras: { outraGuiaAtiva?: boolean } = {}): MotivoSemIntro | null {
  const config = INTROS[moduleId];
  if (!config) return "sem_intro";
  if (!introLigada()) return "desligada";
  if (introVistaNesteAparelho(moduleId) || introVistaNaConta(moduleId, get)) return "ja_vista";
  if (moduloJaApresentado(moduleId, get)) return "ja_apresentado";
  let vazio = true;
  try { vazio = config.vazio(get); } catch { vazio = true; }
  if (!vazio) return "com_dado";
  if (introBloqueadaPelaMissao(moduleId)) return "missao";
  if (extras.outraGuiaAtiva) return "outra_guia";
  return null;
}
export const mostrarIntro = (moduleId: string, get: Leitor, extras: { outraGuiaAtiva?: boolean } = {}): boolean => porQueNaoMostrar(moduleId, get, extras) === null;
