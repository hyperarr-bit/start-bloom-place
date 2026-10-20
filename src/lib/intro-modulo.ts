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
 * Então o formato é um só, o que funciona — a PRIMEIRA AÇÃO dentro do módulo real (17/10, dono: "o melhor mesmo é o de
 * SAÚDE: deixar assim em todos os módulos — mais completo, simples de fazer"; e "nenhum módulo abre sem tutorial na
 * 1ª abertura"):
 *   · GUIADA (anel + post-it + "olha" no resumo) em Finanças, Rotina e Saúde, os 3 que seguram gente (volta depois
 *     da 1ª semana 21–24%; os outros 4–11%) — IntroGuiada;
 *   · DE 1 TOQUE (o padrão da Saúde sem o "olha"): a faixa de planner no topo com "Pular" sempre à vista, o post-it
 *     ANCORADO no controle real do módulo (sem âncora, solto embaixo da faixa), 1 chip = 1 registro de verdade no
 *     formato do módulo, o cartão do fim com o que entrou ("Pão com café já está aqui…"), a oferta opcional "Ver mais
 *     N dicas · 1 min" (só onde há passeio) e "Pronto" — nos outros 13 (IntroDeUmToque). Sem vídeo, sem card
 *     empurrando o módulo. Treino tem 2 passos (monta o treino de hoje → marca o 1º exercício: a ação #1 do módulo).
 *   · A ação de cada chip é a MAIS USADA do módulo na 1ª semana dos pagantes (dados 17/10, scratchpad
 *     definitiva/dados-intro): água, hábito, gasto, marcar treino, cardápio do dia, cursos, "lendo agora",
 *     cômodo da casa, meta, tarefa do dia, hábito de detox, pessoas, pet, destino "sonho", skincare.
 *   · O quiz de 2 perguntas do Treino (EscolherTreino) existe, mas só roda como 1ª dose da missão na área "corpo" —
 *     "não quero que a pessoa clique em um módulo e apareça um quiz" (dono, 17/10). Os cartões SAEM do fluxo.
 *   · UMA vez por módulo: feita ou pulada, por qualquer caminho (a dose da missão feita conta como feita), nunca volta.
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
import { lerMissao, missaoDosesLigada, type DiaDaMissao } from "@/lib/missao-doses";
import {
  CAFE_DA_MANHA, DESTINOS_DA_INTRO, PETS_DA_INTRO, TREINOS_DE_HOJE, adicionarCurso, adicionarLivro, adicionarPessoaDoComeco, anotarCafeDaManha, anotarDestino,
  COMODOS_DA_INTRO, DESTINOS_PLANEJANDO, ESPELHO_DA_INTRO, HUMORES_DA_INTRO, adicionarCursoDesejado, anotarContaFixa, anotarItemDoMercado, anotarEspelhoDoDia, anotarHumor, anotarMetaDeCurtoPrazo,
  anotarMotivacao, anotarPensamento, anotarRefeicao, anotarSkill, anotarSono, anotarTarefaDoComodo, anotarTarefaDoTrabalho, cadastrarPet, comecarDetox, criarMeta,
  diaDaSemana as diaDaSemanaDoTreino, marcarPaginaDoLivro, montarSkincare, montarTreinoDeHoje, type ContextoDaAcao, type TreinoDeHoje,
} from "@/lib/intro-modulo-acoes";
import { planoVazio } from "@/lib/treino-plano";
import { cardPorTitulo } from "@/lib/conhecer-mais";
import { localDayKey } from "@/lib/utils";
import { CHAVE_PASSOS as CHAVE_PASSOS_BELEZA, CHAVE_PERFIL as CHAVE_PERFIL_BELEZA, OPCOES_PELE, type TipoDePele } from "@/lib/beleza-rotina";

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
/** "feita" = a pessoa fez a 1ª ação na intro · "pulada" = fechou sem fazer · "dose" = a dose da missão daquele módulo foi feita
 *  (17/10: o tutorial é UMA vez por módulo — a dose conta como vista pra sempre, mas NÃO entra na lista de "feitas", que é só
 *  pra missão virar continuação: a dose já é a missão, e a retomada do 1º gasto depois do Montar lê `introConcluida`). */
export type FimDaIntro = "feita" | "pulada" | "dose";

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
/** O valor guarda o desfecho: "feita@<iso>", "pulada@<iso>" ou "dose@<iso>". */
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
  return chavesDoTutorialAntigo(moduleId).some((k) => {
    const spot = get<unknown>(k, "");
    return spot === "true" || spot === true;
  });
};
/** O tutorial antigo grava com a chave DELE: Metas é `metas` lá e `desenvolvimento` aqui — vale qualquer uma das duas. */
const APELIDOS_DO_TUTORIAL_ANTIGO: Record<string, string[]> = { desenvolvimento: ["metas"] };
export const chavesDoTutorialAntigo = (moduleId: string): string[] =>
  [moduleId, ...(APELIDOS_DO_TUTORIAL_ANTIGO[moduleId] ?? [])].map((m) => `spotlight-done-${m}`);

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
  /** 17/10: os passos depois do "olha" (rodam na IntroDeUmToque, que mostra o cartão do fim) */
  maisPassos?: PassoDaIntro[];
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
/**
 * UM PASSO da intro de 1 toque (17/10, o padrão da Saúde pra TODOS os módulos): o post-it com a pergunta e os
 * chips, ancorado no controle real do módulo (`alvo`; sem ele, o post-it fica solto embaixo da faixa) — 1 toque
 * grava de verdade (`executar`) e o que entrou vira a confirmação ("<rótulo> já está aqui"). Quando o conteúdo é
 * da pessoa (Mente), o chip é um `foco`: abre o campo real e o passo espera a gravação pelas chaves (`escutar`).
 */
export interface PassoDaIntro {
  /** a faixa deste passo ("anota o sono"); sem ele, o `pedido` da intro */
  pedido?: string;
  pergunta: string;
  descricao?: string;
  opcoes: OpcaoDaIntro[];
  /** um passo de OLHAR: o anel num card real com um balão de 1 frase e "Entendi" — sem ação; card ausente = pulado */
  olhar?: { titulo: string; texto: string };
  /** grava o que ela escolheu; devolve o rótulo do que entrou (sem retorno = o rótulo do chip) */
  executar?: (ctx: ContextoDaAcao, opcao: OpcaoDaIntro) => string | void;
  /** o chip abre o campo real (`abrir` = o toque que faz o campo existir) e o passo espera `escutar` */
  foco?: { seletor: string; abrir?: () => void };
  /** chaves da conta que o passo escuta depois do foco: mudou → o rótulo do que entrou (null = ainda não) */
  escutar?: { chaves: string[]; rotulo: (valor: unknown, anterior: unknown, chave: string) => string | null };
  /** o controle real que o anel abraça (a aba dele, se mora em outra) */
  alvo?: { aba?: string; achar: () => Element | null; abaixo?: boolean };
  /**
   * O módulo JÁ faz essa pergunta (Beleza: o quiz "Monte sua rotina"): achado o `alvo`, o passo USA o controle do
   * módulo — o anel nele, o post-it só com esta instrução e SEM chips (nada de pergunta dobrada), e o passo espera o
   * `escutar`. Sem o alvo (módulo não montou), valem a `pergunta` e os chips de sempre.
   */
  quandoNoModulo?: { pergunta: string; descricao?: string; rotulo?: string };
  /** depois de gravar: um toque no DOM do módulo (abrir a aba HOJE, rolar até a lista…) */
  depois?: () => void;
}
export interface IntroDeUmToqueConfig extends IntroBase {
  formato: "toque";
  /** a faixa: "Primeira vez aqui · anota o café de hoje" */
  pedido: string;
  passos: PassoDaIntro[];
  /** a frase do cartão do fim, depois do que entrou */
  pronto: string;
}
export type IntroConfig = IntroGuiadaConfig | IntroDeUmToqueConfig;

const op = (emoji: string, rotulo: string, id: string): OpcaoDaIntro => ({ emoji, rotulo, id });
const porSeletor = (seletor: string) => (): Element | null => { try { return document.querySelector(seletor); } catch { return null; } };
/** A linha do formulário (campo + botão) em volta de um campo: o anel abraça ela toda. */
const linhaDoCampo = (seletor: string) => (): Element | null => { try { const el = document.querySelector(seletor); return el?.parentElement ?? el; } catch { return null; } };
const seletorDoCardDeHoje = '[data-spotlight="first-day"]';

const olharPorTitulo = (re: RegExp) => (): Element | null => cardPorTitulo(re);
const linhaDeHojeDaRotina = (): Element | null => {
  try { const btn = document.querySelector('[data-spotlight="add-habit"]'); return btn ? btn.closest("section, .rounded-2xl, .rounded-xl, .rounded-lg") ?? btn : null; } catch { return null; }
};
const humores = HUMORES_DA_INTRO.map((h) => op(h.emoji, h.rotulo, h.id));

/**
 * OS PASSOS DE CADA MÓDULO (17/10, dono: "tipo Finanças, que tem vários"): 3–4 passos, cada um a ação mais usada
 * seguinte do módulo na 1ª semana dos pagantes (N = 629, scratchpad/definitiva/dados-intro/RESULTADO.md), no modelo
 * ação → olha → ação. Os 3 guiados (Finanças/Rotina/Saúde) fazem a 1ª ação e o "olha" na IntroGuiada e seguem em
 * `maisPassos`; os outros 13 rodam inteiros na IntroDeUmToque.
 */
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
    // 3) custos fixos (57%) → 4) olha o card deles
    maisPassos: [{
      pedido: "anota 1 conta fixa", pergunta: "Uma conta que vem todo mês:",
      opcoes: [op("🏠", "Aluguel", "aluguel"), op("💡", "Luz", "luz"), op("📶", "Internet", "internet")],
      executar: (ctx, o) => anotarContaFixa(ctx, o.id),
      alvo: { aba: "MEU FINANCEIRO", achar: olharPorTitulo(/^CUSTOS FIXOS$/i), abaixo: true },
    }, {
      pedido: "olha as contas fixas", pergunta: "", opcoes: [],
      olhar: { titulo: "Custos fixos", texto: "As contas de todo mês ficam aqui. O ✓ marca como paga — e o Meu Mês já desconta." },
      alvo: { aba: "MEU FINANCEIRO", achar: olharPorTitulo(/^CUSTOS FIXOS$/i) },
    }],
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
    // (criar → marcar → olha a semana) + 4) "Como você está hoje?" (24%)
    maisPassos: [{
      pedido: "conta como você está", pergunta: "Como você está hoje?",
      opcoes: humores,
      executar: (ctx, o) => anotarHumor(ctx, "mood-log", o.id),
      alvo: { aba: "MINHA SEMANA", achar: olharPorTitulo(/COMO VOC[ÊE] EST[ÁA] HOJE/i), abaixo: true },
    }],
  },
  saude: {
    formato: "guiada", moduleId: "saude", nome: "Saúde", tipo: "agua",
    pedido: "marca 1 copo d'água",
    olhar: { titulo: "O copo que contou", texto: "Cada copo entra na meta do dia. O CORE te lembra de bater ela." },
    pronto: "Saúde é isso: água, sono e remédio, um toque cada.",
    cor: { faixa: "#FFE1E1", tinta: "#7f1d1d", acento: "#dc2626" },
    vazio: (get) => vazias(get, ["core-saude-water", "water-log", "core-saude-sleep", "core-saude-supplement-log"]),
    // (água → olha) + 3) sono (21%) → 4) olha o IMC (28%)
    maisPassos: [{
      pedido: "anota o sono", pergunta: "Quantas horas você dormiu?",
      opcoes: [op("😴", "6 h", "6"), op("😊", "7 h", "7"), op("🌙", "8 h", "8")],
      executar: (ctx, o) => anotarSono(ctx, Number(o.id)),
      alvo: { aba: "HOJE", achar: olharPorTitulo(/^Sono$/i), abaixo: true },
    }, {
      pedido: "olha o IMC", pergunta: "", opcoes: [],
      olhar: { titulo: "Calculadora IMC", texto: "Altura e peso uma vez, e o IMC sai na hora. A Evolução guarda as medidas ao longo do tempo." },
      alvo: { aba: "HOJE", achar: olharPorTitulo(/CALCULADORA IMC/i) },
    }],
  },

  /* ───────── de vários passos (o motor de 1 toque): ação → olha → ação ───────── */
  treino: {
    formato: "toque", moduleId: "treino", nome: "Treino",
    pedido: "monta o treino de hoje",
    pronto: "Marca cada série no HOJE quando fizer — o descanso começa sozinho.",
    passos: [{
      pergunta: "Qual treino você faz hoje?",
      descricao: "Toca num e o treino de hoje entra pronto, exercício por exercício.",
      opcoes: TREINOS_DE_HOJE.map((t) => op(t.emoji, t.rotulo, t.id)),
      executar: (ctx, o) => { const r = montarTreinoDeHoje(ctx, o.id as TreinoDeHoje); return `${r.rotulo} (${r.exercicios} exercícios)`; },
      // o plano vazio abre no PLANO: o post-it fica no cabeçalho do MEU PLANO DA SEMANA (a coluna de hoje é dali)
      alvo: { aba: "PLANO", achar: porSeletor('[data-testid="plano-semana"] h2'), abaixo: true },
      depois: () => abrirAbaDoModulo("HOJE"),
    }, {
      // 2º passo = a ação #1 do Treino na 1ª semana (marcar treino feito, 40%): o quadradinho da 1ª série de HOJE
      pedido: "marca a 1ª série", pergunta: "Fez o primeiro? Marca ali",
      descricao: "É o quadradinho do 1º exercício de hoje. Cada série marcada já conta o descanso.",
      opcoes: [],
      // o módulo grava a série marcada na sessão do dia (treino-sessao: series[k][i].feito) e o exercício inteiro no plano (done)
      escutar: { chaves: ["treino-sessao", "saude-workouts-v2"], rotulo: (valor, _ant, chave) => {
        if (chave === "treino-sessao") {
          const series = mapa(mapa(valor).series);
          return Object.values(series).some((l) => lista(l).some((s) => mapa(s).feito === true)) ? "a 1ª série marcada" : null;
        }
        const dia = mapa(mapa(valor)[diaDaSemanaDoTreino()]);
        const feito = lista(dia.exercises).find((e) => mapa(e).done === true);
        return feito ? `${String(mapa(feito).name ?? "o 1º exercício")} feito` : null;
      } },
      alvo: { aba: "HOJE", achar: porSeletor('[data-testid="treino-hoje"] button[aria-label^="Marcar "]') },
    }, {
      // 3) a semana (dias ativos / constância, 21%)
      pedido: "olha a sua semana", pergunta: "", opcoes: [],
      olhar: { titulo: "A sua semana", texto: "Quantos treinos você fez e a sua sequência. A meta é sua: 3, 4 ou 5 por semana." },
      alvo: { aba: "SEMANA", achar: porSeletor('[data-testid="treino-semana"]') },
    }, {
      // 4) os modelos prontos (11%)
      pedido: "olha os modelos", pergunta: "", opcoes: [],
      olhar: { titulo: "Modelos prontos", texto: "Um toque monta a semana inteira com 5 exercícios por dia. Séries, repetições e carga você ajusta depois." },
      alvo: { aba: "PLANO", achar: porSeletor('[data-testid="modelos-prontos"]') },
    }],
    cor: { faixa: "#DCEBFF", tinta: "#1e3a8a", acento: "#2563eb" },
    vazio: (get) => planoVazio(get<unknown>("saude-workouts-v2", null)) && vazias(get, ["saude-workout-log"]),
    // o EscolherTreino da missão (1ª dose da área "corpo") na tela: a intro espera; com o modelo aplicado o módulo tem dado
    montar: { evento: "escolher-treino:fim", atributo: "data-escolher-treino" },
  },
  dieta: {
    formato: "toque", moduleId: "dieta", nome: "Dieta",
    pedido: "anota o café de hoje",
    pronto: "Dieta é isso: cada refeição no dia dela. Dá pra copiar um dia pros outros.",
    passos: [{
      pergunta: "O que foi o seu café da manhã hoje?",
      opcoes: [op("☕", "Pão com café", "pao_com_cafe"), op("🥚", "Ovos mexidos", "ovos"), op("🍌", "Fruta com iogurte", "fruta_iogurte")],
      executar: (ctx, o) => anotarCafeDaManha(ctx, o.rotulo),
      // o card de HOJE do cardápio (nasce recolhido no celular: abre antes de apontar — SÓ o botão "Abrir <dia>",
      // nunca o gatilho do "Limpar cardápio", que também tem aria-expanded; bug de 16/10)
      alvo: { aba: "CARDÁPIO", achar: () => {
        const hoje = document.querySelector(seletorDoCardDeHoje);
        if (!hoje) return null;
        try { hoje.querySelector<HTMLElement>('button[aria-label^="Abrir "]:not([aria-haspopup])')?.click(); } catch { /* noop */ }
        return hoje.querySelector("button") ? hoje.firstElementChild ?? hoje : hoje;
      }, abaixo: true },
    }, {
      // 2) olha o dia no cardápio (o dia é a ação #1 da Dieta, 9%)
      pedido: "olha o seu dia", pergunta: "", opcoes: [],
      olhar: { titulo: "O seu dia no cardápio", texto: "O café entrou na refeição de hoje. As outras você preenche quando quiser — e dá pra copiar o dia inteiro pros outros." },
      alvo: { aba: "CARDÁPIO", achar: porSeletor(seletorDoCardDeHoje) },
    }, {
      // 3) mais uma refeição de hoje
      pedido: "anota o almoço", pergunta: "E o almoço de hoje?",
      opcoes: [op("🍗", "Frango com arroz", "frango_arroz"), op("🥗", "Salada com proteína", "salada"), op("🍝", "Macarrão", "macarrao")],
      executar: (ctx, o) => anotarRefeicao(ctx, "Almoço", o.rotulo),
      alvo: { aba: "CARDÁPIO", achar: porSeletor(seletorDoCardDeHoje), abaixo: true },
    }],
    cor: { faixa: "#E3F6E0", tinta: "#14532d", acento: "#16a34a" },
    vazio: (get) => {
      const plano = mapa(get<unknown>("saude-meals", {}));
      const semRefeicao = Object.values(plano).every((d) => Object.values(mapa(d)).every((r) => semConteudo(r)));
      return semRefeicao && vazias(get, ["dieta-recipes-v2", "dieta-smart-list"]);
    },
  },
  estudos: {
    formato: "toque", moduleId: "estudos", nome: "Estudos",
    pedido: "anota 1 curso",
    pronto: "Estudos é isso: cada curso com as aulas feitas, o caderno e as provas.",
    passos: [{
      pergunta: "O que você está estudando?",
      descricao: "Só o nome por enquanto. Link e aulas você completa depois.",
      opcoes: [op("🇬🇧", "Inglês", "ingles"), op("🎓", "Faculdade", "faculdade"), op("📚", "Concurso", "concurso")],
      executar: (ctx, o) => adicionarCurso(ctx, o.rotulo),
      alvo: { achar: linhaDoCampo('input[placeholder="Adicionar curso..."]') },
    }, {
      // 2) olha o curso (cursos em andamento: 12%, a ação #1)
      pedido: "olha o seu curso", pergunta: "", opcoes: [],
      olhar: { titulo: "O curso entrou", texto: "Toca nele pra pôr o link, as aulas feitas e as anotações. A barra anda a cada aula." },
      alvo: { achar: olharPorTitulo(/CURSOS EM ANDAMENTO/i) },
    }, {
      // 3) um curso que ela quer (cursos que desejo)
      pedido: "anota 1 que você quer", pergunta: "E um curso que você quer fazer?",
      opcoes: [op("📊", "Excel", "excel"), op("🇪🇸", "Espanhol", "espanhol"), op("📣", "Marketing digital", "marketing")],
      executar: (ctx, o) => adicionarCursoDesejado(ctx, o.rotulo),
      alvo: { achar: olharPorTitulo(/CURSOS QUE DESEJO/i), abaixo: true },
    }],
    cor: { faixa: "#E4E6FF", tinta: "#312e81", acento: "#4f46e5" },
    vazio: (get) => vazias(get, ["estudos-cursos-andamento", "estudos-notebooks", "estudos-exams", "estudos-subjects"]),
  },
  biblioteca: {
    formato: "toque", moduleId: "biblioteca", nome: "Biblioteca",
    pedido: "põe 1 livro na estante",
    pronto: "Biblioteca é isso: capa, página atual e anotações. A meta do ano conta sozinha.",
    passos: [{
      pergunta: "Qual você está lendo (ou quer começar)?",
      descricao: "Entra como 'lendo'. O seu livro você adiciona pelo link ou pelo título.",
      opcoes: [op("📘", "Hábitos Atômicos", "habitos_atomicos"), op("📗", "O Poder do Hábito", "poder_do_habito"), op("📙", "Essencialismo", "essencialismo")],
      executar: (ctx, o) => adicionarLivro(ctx, { titulo: o.rotulo, autor: LIVROS[o.id]?.autor ?? "", capa: LIVROS[o.id]?.capa ?? "" }),
      alvo: { achar: porSeletor('button[aria-label="Adicionar livro"]') },
    }, {
      // 2) olha o "Lendo agora" (14%, a ação #1)
      pedido: "olha o Lendo agora", pergunta: "", opcoes: [],
      olhar: { titulo: "Lendo agora", texto: "O livro fica aqui com a capa e a barra de páginas. Toca nele pra anotar frases e a página." },
      alvo: { achar: olharPorTitulo(/LENDO AGORA/i) },
    }, {
      // 3) a página atual (a barra anda)
      pedido: "marca a página", pergunta: "Em que página você está?",
      opcoes: [op("📖", "Começando", "1"), op("📄", "Página 50", "50"), op("📑", "Página 120", "120")],
      executar: (ctx, o) => marcarPaginaDoLivro(ctx, Number(o.id)),
      alvo: { achar: olharPorTitulo(/LENDO AGORA/i), abaixo: true },
    }],
    cor: { faixa: "#FFE9D6", tinta: "#7c2d12", acento: "#ea580c" },
    vazio: (get) => vazias(get, ["lib-books"]),
  },
  casa: {
    formato: "toque", moduleId: "casa", nome: "Casa",
    pedido: "organiza 1 cômodo",
    pronto: "Casa é isso: cada cômodo com as tarefas dele; o mercado e a despensa ficam nas outras abas.",
    passos: [{
      pergunta: "Qual cômodo você quer organizar primeiro?",
      descricao: "Toca num e a 1ª tarefa dele já entra.",
      opcoes: COMODOS_DA_INTRO.map((c) => op(c.emoji, c.rotulo, c.id)),
      executar: (ctx, o) => anotarTarefaDoComodo(ctx, o.id),
      alvo: { aba: "CÔMODOS", achar: linhaDoCampo('input[placeholder="Adicionar item..."]') },
    }, {
      // 2) olha o cômodo (cômodos: 9%, a ação #1)
      pedido: "olha o cômodo", pergunta: "", opcoes: [],
      olhar: { titulo: "O cômodo com a tarefa", texto: "Cada cômodo tem a lista dele. Toca no quadradinho quando fizer — e põe as suas." },
      alvo: { aba: "CÔMODOS", achar: olharPorTitulo(/^(COZINHA|QUARTO|BANHEIRO)$/i) },
    }, {
      // 3) o mercado (lista)
      pedido: "anota 1 item do mercado", pergunta: "O que está faltando no mercado?",
      opcoes: [op("🥛", "Leite", "leite"), op("🍞", "Pão", "pao"), op("☕", "Café", "cafe")],
      executar: (ctx, o) => anotarItemDoMercado(ctx, o.rotulo),
      alvo: { aba: "MERCADO", achar: linhaDoCampo('input[placeholder="Adicionar..."]') },
    }, {
      // 4) a limpeza (6%)
      pedido: "olha a limpeza", pergunta: "", opcoes: [],
      olhar: { titulo: "Rotina de limpeza", texto: "O que é de todo dia, da semana e do mês, pra marcar quando fizer. O app renova sozinho." },
      alvo: { aba: "ROTINA", achar: olharPorTitulo(/LIMPEZA DI[ÁA]RIA/i) },
    }],
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
    formato: "toque", moduleId: "desenvolvimento", nome: "Metas",
    pedido: "escolhe 1 meta sua",
    pronto: "Metas é isso: cada meta vira um quadro com etapas pra marcar.",
    passos: [{
      pergunta: "Qual meta você quer tirar do papel?",
      descricao: "A meta nasce com duas etapas pra você preencher.",
      opcoes: [op("🏃", "Correr 5 km", "correr_5km"), op("💰", "Guardar R$ 1.000", "guardar_1000"), op("📚", "Ler 12 livros", "ler_12_livros")],
      executar: (ctx, o) => criarMeta(ctx, o.rotulo),
      alvo: { aba: "METAS", achar: porSeletor('[data-spotlight="add-goal"]') },
    }, {
      // 2) olha a meta
      pedido: "olha a sua meta", pergunta: "", opcoes: [],
      olhar: { titulo: "A meta com etapas", texto: "Toca nela pra ver o quadro: cada etapa feita aparece aqui." },
      alvo: { aba: "METAS", achar: porSeletor('[data-spotlight="add-goal"]') },
    }, {
      // 3) "O que me motiva" (16%, a ação #1 do módulo)
      pedido: "conta o que te motiva", pergunta: "O que te motiva a acordar?",
      opcoes: [op("👨‍👩‍👧", "Minha família", "familia"), op("💪", "Minha saúde", "saude"), op("🏡", "Minha independência", "independencia")],
      executar: (ctx, o) => { anotarMotivacao(ctx, o.rotulo); },
      alvo: { aba: "SOBRE MIM", achar: olharPorTitulo(/O QUE ME MOTIVA/i), abaixo: true },
    }, {
      // 4) o humor (8%)
      pedido: "marca o humor", pergunta: "Como está o seu humor hoje?",
      opcoes: humores,
      executar: (ctx, o) => anotarHumor(ctx, "dp-mood-log", o.id),
      alvo: { aba: "HUMOR & SCORE", achar: olharPorTitulo(/HUMOR/i), abaixo: true },
    }],
    cor: { faixa: "#EFE2FF", tinta: "#4c1d95", acento: "#7c3aed" },
    vazio: (get) => vazias(get, ["goals-board-v2", "dp-gratitude", "dp-mood-log", "dp-motivations"]),
  },
  carreira: {
    formato: "toque", moduleId: "carreira", nome: "Carreira",
    pedido: "anota 1 tarefa de hoje",
    pronto: "Carreira é isso: o Pomodoro, os contadores e as tarefas do dia numa folha só.",
    passos: [{
      pergunta: "Uma tarefa do trabalho pra hoje:",
      opcoes: [op("📧", "Responder e-mails", "emails"), op("📊", "Fechar o relatório", "relatorio"), op("📞", "Ligar pro cliente", "cliente")],
      executar: (ctx, o) => anotarTarefaDoTrabalho(ctx, o.rotulo),
      alvo: { aba: "Meu Dia", achar: linhaDoCampo('input[placeholder="Nova tarefa do trabalho..."]') },
    }, {
      // 2) olha o Meu Dia (fases + pomodoro: as ações #1 e #3)
      pedido: "olha o seu dia", pergunta: "", opcoes: [],
      olhar: { titulo: "O seu dia de trabalho", texto: "A tarefa entrou na lista de hoje. Em cima ficam o Pomodoro pra focar e os contadores do que você faz todo dia." },
      alvo: { aba: "Meu Dia", achar: linhaDoCampo('input[placeholder="Nova tarefa do trabalho..."]') },
    }, {
      // 3) uma skill (a aba Skills)
      pedido: "anota 1 skill", pergunta: "Uma skill que você quer evoluir:",
      opcoes: [op("🇬🇧", "Inglês", "ingles"), op("📊", "Excel", "excel"), op("🗣️", "Falar em público", "falar")],
      executar: (ctx, o) => { anotarSkill(ctx, o.rotulo); },
      alvo: { aba: "Skills", achar: olharPorTitulo(/SKILL/i), abaixo: true },
    }],
    cor: { faixa: "#E6EAF0", tinta: "#1e293b", acento: "#475569" },
    vazio: (get) => {
      const fases = lista(get<unknown>("career-day-phases", []));
      const semContagem = fases.every((f) => Object.keys(mapa(mapa(f).counts)).length === 0);
      return semContagem && vazias(get, ["career-day-tasks", "career-jobs", "career-skills", "career-contacts", "career-portfolio"]);
    },
  },
  detox: {
    formato: "toque", moduleId: "detox", nome: "Detox",
    pedido: "escolhe o que largar",
    pronto: "Detox é isso: um check-in por dia vira a sua sequência. Se escorregar, recomeça sem drama.",
    passos: [{
      pergunta: "O que você quer parar?",
      descricao: "Começa a contar hoje.",
      opcoes: [op("📱", "Redes sociais à noite", "redes_sociais"), op("🍬", "Açúcar", "acucar"), op("🚬", "Cigarro", "cigarro")],
      executar: (ctx, o) => comecarDetox(ctx, { nome: o.rotulo, icone: o.emoji }),
      alvo: { aba: "RASTREADOR", achar: linhaDoCampo('input[placeholder^="O que quer parar?"]') },
    }, {
      // 2) o check-in de hoje (registro do dia): a ação no módulo
      pedido: "faz o check-in de hoje", pergunta: "Hoje você segurou? Marca o check-in",
      descricao: "É o botão do dia, no card do hábito. Cada dia marcado soma na sequência.",
      opcoes: [],
      escutar: { chaves: ["detox-habits"], rotulo: (valor) => {
        const hoje = localDayKey();
        return lista(valor).some((h) => lista(mapa(h).checkins).some((c) => String(c).startsWith(hoje)) || String(mapa(h).lastCheckin ?? "").startsWith(hoje)) ? "o check-in de hoje" : null;
      } },
      // o botão "Estou limpo hoje" mora dentro do card do hábito ABERTO: sem ele na tela, abre o card (toca no nome) e tenta de novo
      alvo: { aba: "RASTREADOR", achar: () => {
        try {
          const botao = Array.from(document.querySelectorAll("button")).find((b) => /estou limpo hoje|confirmado hoje/i.test(b.textContent ?? ""));
          if (botao) return botao;
          const nome = Array.from(document.querySelectorAll<HTMLElement>("main h3, main h4, main p, main span")).find((e) => /redes sociais à noite|açúcar|cigarro/i.test((e.textContent ?? "").trim()) && (e.textContent ?? "").length < 40);
          nome?.closest<HTMLElement>("[class*='rounded']")?.click();
          return null;
        } catch { return null; }
      } },
    }, {
      // 3) as stats
      pedido: "olha a sequência", pergunta: "", opcoes: [],
      olhar: { titulo: "A sua sequência", texto: "Dias seguidos, recorde e recaídas, num gráfico só. Recaiu? Marca e recomeça — sem drama." },
      alvo: { aba: "STATS", achar: () => { try { return document.querySelector("main section, main .rounded-2xl, main .rounded-xl"); } catch { return null; } } },
    }],
    cor: { faixa: "#EAF7D2", tinta: "#365314", acento: "#65a30d" },
    vazio: (get) => vazias(get, ["detox-habits", "detox-diary"]),
  },
  hiperfoco: {
    formato: "toque", moduleId: "hiperfoco", nome: "Mente",
    pedido: "tira 1 pensamento da cabeça",
    pronto: "Mente é isso: cada pensamento fica na hora em que apareceu. Depois você acha tudo pela busca.",
    passos: [{
      pergunta: "O que está na sua cabeça agora?",
      descricao: "Toca num pra ver como fica, ou escreve o seu.",
      opcoes: [op("📝", "Uma pendência pra resolver", "pendencia"), op("💡", "Uma ideia pra não perder", "ideia"), op("😮‍💨", "Uma preocupação de hoje", "preocupacao")],
      executar: (ctx, o) => anotarPensamento(ctx, o.rotulo),
      // a linha do tempo abre o campo da HORA que a pessoa toca: toca na hora de agora e aponta pro campo
      alvo: { aba: "DIA", achar: () => {
        try {
          const campo = document.querySelector('textarea[placeholder="O que está pensando?"], input[placeholder="O que está pensando?"]');
          if (campo) return campo.parentElement ?? campo;
          const hora = `${String(new Date().getHours()).padStart(2, "0")}:00`;
          return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => (b.textContent ?? "").trim().startsWith(hora)) ?? null;
        } catch { return null; }
      } },
    }, {
      // 2) olha a linha do dia
      pedido: "olha o seu dia", pergunta: "", opcoes: [],
      olhar: { titulo: "Ficou na hora de agora", texto: "Cada pensamento fica na hora em que apareceu. A BUSCA acha qualquer um depois." },
      alvo: { aba: "DIA", achar: () => { try { const hora = `${String(new Date().getHours()).padStart(2, "0")}:00`; return Array.from(document.querySelectorAll<HTMLElement>("button, div")).find((b) => (b.textContent ?? "").trim().startsWith(hora) && b.getBoundingClientRect().height < 200) ?? null; } catch { return null; } } },
    }, {
      // 3) uma meta de curto prazo (a ação #1 da Mente: 4%)
      pedido: "anota 1 meta de curto prazo", pergunta: "Uma meta pras próximas semanas:",
      opcoes: [op("📵", "Menos tela à noite", "tela"), op("📖", "Terminar um livro", "livro"), op("🏃", "Treinar 3x na semana", "treino")],
      executar: (ctx, o) => { anotarMetaDeCurtoPrazo(ctx, o.rotulo); },
      alvo: { aba: "METAS", achar: olharPorTitulo(/CURTO PRAZO/i), abaixo: true },
    }],
    cor: { faixa: "#ECE4FF", tinta: "#4c1d95", acento: "#6d28d9" },
    vazio: (get) => vazias(get, ["hiperfoco-thoughts", "mente-dreams"]),
  },
  viagens: {
    formato: "toque", moduleId: "viagens", nome: "Viagens",
    pedido: "anota 1 destino",
    pronto: "Viagens é isso: primeiro o destino; roteiro, mala e orçamento vêm quando a viagem ficar de pé.",
    passos: [{
      pergunta: "Pra onde você quer ir?",
      opcoes: [op("🏖️", "Praia no Nordeste", "nordeste"), op("🏔️", "Gramado", "gramado"), op("✈️", "Europa", "europa")],
      executar: (ctx, o) => anotarDestino(ctx, DESTINOS_DA_INTRO[o.id] ?? { name: o.rotulo, country: "", continent: "" }),
      alvo: { achar: linhaDoCampo('input[placeholder="Destino..."], input[placeholder="Destino"]') },
    }, {
      // 2) olha a lista
      pedido: "olha a sua lista", pergunta: "", opcoes: [],
      olhar: { titulo: "O destino entrou como sonho", texto: "Sonho, planejando ou próximo: a etiqueta muda quando a viagem avança. Nota e foto você põe tocando nele." },
      alvo: { achar: () => { try { const el = document.querySelector('[aria-label^="Editar "]'); return el?.closest(".rounded-2xl, .rounded-xl, li, section") ?? el; } catch { return null; } } },
    }, {
      // 3) a próxima de verdade (planejando)
      pedido: "anota a próxima", pergunta: "E a próxima viagem de verdade?",
      opcoes: [op("🌵", "Chapada dos Veadeiros", "chapada"), op("🐠", "Fernando de Noronha", "noronha"), op("🥩", "Buenos Aires", "buenos_aires")],
      executar: (ctx, o) => { anotarDestino(ctx, DESTINOS_PLANEJANDO[o.id] ?? { name: o.rotulo, country: "", continent: "" }, "planejando"); return `${o.rotulo} (planejando)`; },
      alvo: { achar: linhaDoCampo('input[placeholder="Destino..."], input[placeholder="Destino"]') },
    }],
    cor: { faixa: "#D9F4F0", tinta: "#134e4a", acento: "#0d9488" },
    vazio: (get) => vazias(get, ["travel-bucket"]),
  },
  beleza: {
    formato: "toque", moduleId: "beleza", nome: "Beleza",
    pedido: "monta o seu skincare",
    pronto: "Beleza é isso: a rotina da manhã e da noite, um toque por passo.",
    passos: [{
      // 1) o quiz do PRÓPRIO módulo ("Monte sua rotina", 3 perguntas): o anel nele e o passo espera a rotina nascer
      //    (rev3, 17/10: o post-it com Oleosa/Mista/Seca cobria o quiz com a mesma pergunta). Sem o quiz na tela, os chips.
      pergunta: "Como é a sua pele?",
      descricao: "Toca num e a rotina de manhã e de noite nasce pra ela. Depois você ajusta.",
      opcoes: [op("💧", "Oleosa", "oleosa"), op("🌗", "Mista", "mista"), op("🍃", "Seca", "seca")],
      executar: (ctx, o) => { montarSkincare(ctx, o.id as TipoDePele); return `Skincare pra pele ${o.rotulo.toLowerCase()}`; },
      quandoNoModulo: { pergunta: "Responde aqui as 3 perguntas", descricao: "A rotina de manhã e de noite nasce pra sua pele. Depois você ajusta.", rotulo: "3 toques" },
      escutar: {
        chaves: [CHAVE_PERFIL_BELEZA, CHAVE_PASSOS_BELEZA.manha, CHAVE_PASSOS_BELEZA.noite],
        rotulo: (valor, _anterior, chave) => {
          if (chave === CHAVE_PERFIL_BELEZA) {
            const pele = (valor as { pele?: string } | null)?.pele;
            const rotulo = OPCOES_PELE.find((o) => o.id === pele)?.rotulo;
            return rotulo ? `Skincare pra pele ${rotulo.toLowerCase()}` : null;
          }
          return Array.isArray(valor) && valor.length ? "Sua rotina de manhã e de noite" : null;
        },
      },
      alvo: { aba: "SKINCARE", achar: porSeletor('[data-testid="montar-rotina"]') },
    }, {
      // 2) olha a rotina pronta (rotina da manhã: 9%)
      pedido: "olha a sua rotina", pergunta: "", opcoes: [],
      olhar: { titulo: "A rotina nasceu", texto: "Manhã e noite, passo a passo. Toca num passo pra escolher o produto e os dias da semana." },
      alvo: { aba: "SKINCARE", achar: porSeletor('[data-card="skincare-de-hoje"], [data-testid="rotina-pronta"]') },
    }, {
      // 3) o Espelho do dia (11%, a ação #1 da Beleza)
      pedido: "faz o espelho do dia", pergunta: "Como a sua pele está hoje?",
      opcoes: ESPELHO_DA_INTRO.map((e) => op(e.emoji, e.rotulo, e.id)),
      executar: (ctx, o) => anotarEspelhoDoDia(ctx, o.id),
      alvo: { aba: "SKINCARE", achar: olharPorTitulo(/ESPELHO/i), abaixo: true },
    }],
    cor: { faixa: "#FFE4F1", tinta: "#831843", acento: "#db2777" },
    vazio: (get) => vazias(get, [CHAVE_PASSOS_BELEZA.manha, CHAVE_PASSOS_BELEZA.noite, "beauty-products", "skincare-daily-checkin"]),
  },
  relacionamentos: {
    formato: "toque", moduleId: "relacionamentos", nome: "Relações",
    pedido: "anota 1 pessoa que importa",
    pronto: "Relações é isso: datas e momentos ficam ligados à pessoa. O nome você completa na ficha.",
    passos: [{
      pergunta: "Quem importa pra você?",
      opcoes: [op("🌷", "Mãe", "mae"), op("💛", "Meu amor", "amor"), op("✨", "Melhor amiga", "melhor-amiga")],
      executar: (ctx, o) => adicionarPessoaDoComeco(ctx, o.id),
      alvo: { aba: "PESSOAS", achar: porSeletor('[data-testid="comeco-pronto"], [data-testid="pessoas-vazio"], [data-testid="adicionar-pessoa"]') },
    }, {
      // 2) olha a pessoa (pessoas: 11%, a ação #1)
      pedido: "olha a ficha", pergunta: "", opcoes: [],
      olhar: { titulo: "A pessoa entrou", texto: "Toca nela pra pôr o nome, o aniversário e o que lembrar (gostos, tamanho, alergias)." },
      alvo: { aba: "PESSOAS", achar: porSeletor('[data-testid="lista-pessoas"]') },
    }, {
      // 3) mais uma pessoa
      pedido: "anota mais 1", pergunta: "Mais alguém?",
      opcoes: [op("☕", "Pai", "pai"), op("🌻", "Irmã", "irma"), op("🧶", "Avó", "avo")],
      executar: (ctx, o) => adicionarPessoaDoComeco(ctx, o.id),
      alvo: { aba: "PESSOAS", achar: porSeletor('[data-testid="comeco-pronto"], [data-testid="lista-pessoas"]'), abaixo: true },
    }, {
      // 4) as datas
      pedido: "olha as datas", pergunta: "", opcoes: [],
      olhar: { titulo: "O ano em datas", texto: "Aniversários e datas especiais, mês a mês. O app avisa na véspera." },
      alvo: { aba: "DATAS", achar: porSeletor('[data-testid="ano-em-datas"], [data-testid="lista-datas"]') },
    }],
    cor: { faixa: "#FFE1E7", tinta: "#881337", acento: "#e11d48" },
    vazio: (get) => vazias(get, ["rel-people", "rel-dates", "rel-moments", "relacoes-pessoas"]),
  },
  pet: {
    formato: "toque", moduleId: "pet", nome: "Pet",
    pedido: "cadastra o seu pet",
    pronto: "Pet é isso: com ele cadastrado, vacina, banho e remédio entram na agenda dele. O nome você troca na ficha.",
    passos: [{
      pergunta: "Seu pet é…",
      opcoes: PETS_DA_INTRO.map((p) => op(p.emoji, p.rotulo, p.id)),
      executar: (ctx, o) => cadastrarPet(ctx, o.id as "cao" | "gato" | "outro"),
      alvo: { achar: porSeletor('[data-testid="comeco-pronto"], [data-testid="pet-vazio"]') },
    }, {
      // 2) a rotina de hoje: marca a comida (a ação no módulo)
      pedido: "marca a comida de hoje", pergunta: "Já deu comida hoje? Marca ali",
      descricao: "É a rotina do dia do seu pet. Cada item marcado conta o dia.",
      opcoes: [],
      escutar: { chaves: [`pet-routine-${localDayKey()}`], rotulo: (valor) => (Object.values(mapa(valor)).some((t) => Object.values(mapa(t)).some((v) => v === true)) ? "a comida de hoje" : null) },
      alvo: { achar: () => { try { const c = document.querySelector('[data-card="PET DE HOJE"]'); return c?.querySelector("button, input, [role=checkbox]") ?? c; } catch { return null; } } },
    }, {
      // 3) a carteirinha
      pedido: "olha a carteirinha", pergunta: "", opcoes: [],
      olhar: { titulo: "A carteirinha", texto: "Vacina, vermífugo, banho e remédio com a data certa. O app avisa quando chegar a hora." },
      alvo: { achar: porSeletor('[data-testid="montar-carteirinha"], [data-testid="novo-cuidado-abrir"], [data-testid="completar-carteirinha"]') },
    }],
    cor: { faixa: "#FFF4C2", tinta: "#78350f", acento: "#d97706" },
    vazio: (get) => vazias(get, ["pet-list", "pet-diary", "pet-cuidados", "pet-expenses"]),
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

/** Toca na aba do módulo pelo rótulo (o mesmo toque que a pessoa daria). */
export const abrirAbaDoModulo = tocarAba;
/** Treino: acende o 1º exercício de HOJE por uns segundos (o quadradinho de marcar) — o passo depois do treino montado. */
export function acenderPrimeiroExercicio(): void {
  try {
    const alvo = document.querySelector<HTMLElement>('[data-testid="treino-hoje"] button[aria-label^="Marcar "], [data-testid="treino-hoje"] button[aria-label^="Abrir "]');
    if (!alvo) return;
    alvo.scrollIntoView?.({ behavior: "smooth", block: "center" });
    alvo.classList.add("im-destaque");
    window.setTimeout(() => alvo.classList.remove("im-destaque"), 3200);
  } catch { /* sem DOM */ }
}

/** TODOS os 16 módulos têm intro (dono, 17/10: "nenhum módulo abre sem tutorial na 1ª abertura"): 3 guiadas + 13 de 1 toque. */
export const MODULOS_COM_INTRO: readonly string[] = Object.keys(INTROS);
/** (vazias desde 17/10 — ficam pros testes antigos e pra porta do módulo) */
export const MODULOS_SEM_INTRO: readonly string[] = [];
export const MODULOS_SEM_NADA: readonly string[] = [];

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

/* 17/10 (revisor, rev3): o plano B local ("o próximo passo pendente, se é de hoje ou atrasado") saiu. Ele não
 * conferia boas-vindas / doseAbreHoje / o fim da janela da missão — no braço A depois do dia 7 (ou antes das
 * boas-vindas) o módulo da dose pendente ficava SEM dose e SEM tutorial. Só vale `moduloDaMissaoHoje()`, que é a
 * mesma régua da faixa da dose (MissaoDosesNaWeb). */

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
    const hoje = moduloDaMissaoHoje();
    if (hoje === moduleId) return true;
    const m = lerMissao();
    if (!m) return false;
    const modulos = m.modulos as string[];
    if (([1, 2, 3] as DiaDaMissao[]).some((n) => !!m.feitos[n] && modulos[n - 1] === moduleId)) return true;
  } catch { /* sem storage: segue */ }
  return false;
}

/**
 * O tutorial antigo (SpotlightOverlay) marca `spotlight-done-<módulo>` pra toda conta logada na 1ª abertura. Se
 * NESTA abertura a intro só não aparece porque a missão segura o módulo (a dose de hoje é dele), essa marca não pode
 * ser gravada: senão, se a dose não for feita, o módulo vira "já apresentado" e perde o tutorial pra sempre (rev3).
 * `moduleKey` é a chave do tutorial antigo (Metas = "metas").
 */
export function tutorialAntigoPodeMarcarVisto(moduleKey: string, get: Leitor): boolean {
  try {
    const id = Object.entries(APELIDOS_DO_TUTORIAL_ANTIGO).find(([, apelidos]) => apelidos.includes(moduleKey))?.[0] ?? moduleKey;
    if (!INTROS[id] || !introLigada()) return true;
    if (introVistaNesteAparelho(id) || introVistaNaConta(id, get)) return true;
    return !introBloqueadaPelaMissao(id);
  } catch { return true; }
}

/* ───── ação rápida da Home (1.0.17) ─────
 * Revisão do 1º dia da 1.0.16: "Beber água"/"Registrar sono" na Home gravam nas MESMAS chaves que o `vazio` da Saúde
 * confere — quem marcava água antes de abrir Saúde caía em "com_dado" e o módulo abria sem tutorial (fura a regra dura:
 * nenhum módulo abre pela 1ª vez sem tutorial). Agora a ação rápida anota o módulo NESTA CONTA quando, na hora do toque,
 * ele ainda estava vazio e nunca apresentado; na decisão, esse dado não conta. Veterano (módulo já com dado na hora do
 * toque) nunca é anotado, então segue sem intro. */
export const CHAVE_INTRO_ACAO_RAPIDA = "core-intro-acao-rapida";
/** ação rápida (QuickActions) → o módulo cuja checagem de "vazio" ela suja */
export const MODULO_DA_ACAO_RAPIDA: Readonly<Record<string, string>> = {
  water: "saude", sleep: "saude", workout: "treino", expense: "financas", detox: "detox", idea: "hiperfoco",
};
const listaDaConta = (get: Leitor, k: string): string[] => {
  const v = get<unknown>(k, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
};
export function dadoSoDaAcaoRapida(moduleId: string, get: Leitor): boolean {
  try { return listaDaConta(get, CHAVE_INTRO_ACAO_RAPIDA).includes(moduleId); } catch { return false; }
}
/** Chamar ANTES de gravar o dado da ação rápida. */
export function anotarAcaoRapida(acao: string, get: Leitor, set: (k: string, v: unknown) => void): void {
  try {
    const m = MODULO_DA_ACAO_RAPIDA[acao];
    const config = m ? INTROS[m] : undefined;
    if (!m || !config) return;
    if (dadoSoDaAcaoRapida(m, get)) return;
    if (introVistaNesteAparelho(m) || introVistaNaConta(m, get) || moduloJaApresentado(m, get)) return;
    let vazio = false;
    try { vazio = config.vazio(get); } catch { vazio = false; }
    if (!vazio) return;
    set(CHAVE_INTRO_ACAO_RAPIDA, [...listaDaConta(get, CHAVE_INTRO_ACAO_RAPIDA), m]);
  } catch { /* nunca atrapalha a ação rápida */ }
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
  if (!vazio && !dadoSoDaAcaoRapida(moduleId, get)) return "com_dado";
  if (introBloqueadaPelaMissao(moduleId)) return "missao";
  if (extras.outraGuiaAtiva) return "outra_guia";
  return null;
}
export const mostrarIntro = (moduleId: string, get: Leitor, extras: { outraGuiaAtiva?: boolean } = {}): boolean => porQueNaoMostrar(moduleId, get, extras) === null;
