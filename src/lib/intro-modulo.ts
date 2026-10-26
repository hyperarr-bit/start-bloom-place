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
  CAFE_DA_MANHA, COMODOS_DA_INTRO, DESTINOS_DA_INTRO, ESPELHO_DA_INTRO, HUMORES_DA_INTRO, PETS_DA_INTRO, TREINOS_DE_HOJE,
  adicionarCurso, adicionarCursoDesejado, adicionarLivro, adicionarPessoaDoComeco, adicionarPessoaPropria, anotarCafeDaManha, anotarComodoProprio,
  anotarContaFixa, anotarContaFixaPropria, anotarDestino, anotarEspelhoDoDia, anotarHumor, anotarItemDoMercado, anotarMetaDeCurtoPrazo, anotarMotivacao,
  anotarPensamento, anotarSono, anotarTarefaDoComodo, anotarTarefaDoTrabalho, cadastrarPet, cadastrarPetProprio, comecarDetox,
  criarMeta, diaDaSemana as diaDaSemanaDoTreino, montarSkincare, montarTreinoDeHoje, montarTreinoProprio,
  type ContextoDaAcao, type TreinoDeHoje,
} from "@/lib/intro-modulo-acoes";
import type { NumeroDaEscolha } from "@/components/ui/escolha-rapida";
import { planoVazio } from "@/lib/treino-plano";
import { cardPorTitulo } from "@/lib/conhecer-mais";
import { localDayKey } from "@/lib/utils";
import { CHAVE_MONTAR_FINANCAS } from "@/lib/montar-financas";
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

/* ───── 1.0.17: o passo da intro NA TELA (pro `modulo_intro_saiu`: a intro saiu sem "Pronto" nem "Agora não") ─────
 * 1.0.18: o passo (e o que já entrou) também fica no aparelho, junto da marca "aberta" — é por ele que a 2ª aparição
 * RETOMA onde parou (ver `retomadaDaIntro`). */
let passoNaTela: { modulo: string; passo: number } | null = null;
export const marcarPassoDaIntro = (modulo: string, passo: number, rotulos?: string[]): void => {
  passoNaTela = { modulo, passo };
  anotarRetomadaDaIntro(modulo, passo, rotulos);
};
export const passoDaIntroNaTela = (modulo: string): number | null => (passoNaTela?.modulo === modulo ? passoNaTela.passo : null);

/* ───── marcas: aparelho e conta ───── */
export type Leitor = <T>(k: string, f: T) => T;
export type Escritor = (k: string, v: unknown) => void;

export const introVistaNesteAparelho = (moduleId: string): boolean => !!ls.get(chaveIntroVista(moduleId));
/** O valor guarda o desfecho: "feita@<iso>", "pulada@<iso>" ou "dose@<iso>". */
export const marcarIntroVistaNoAparelho = (moduleId: string, como: FimDaIntro = "feita"): void => ls.set(chaveIntroVista(moduleId), `${como}@${new Date().toISOString()}`);
export const introAbertaNesteAparelho = (moduleId: string): boolean => !!ls.get(chaveIntroAberta(moduleId));
/**
 * 1.0.18: o valor da marca "aberta" é `{ em, passo, rotulos }` — quando a intro apareceu, em que passo ela estava
 * (1-based, o `numero` da faixa) e o que já tinha entrado. Versões antigas gravavam só o ISO: vale como "aberta, sem
 * retomada" (volta do começo, como antes).
 */
export interface RetomadaDaIntro { passo: number; rotulos: string[] }
export const marcarIntroAbertaNoAparelho = (moduleId: string): void => ls.set(chaveIntroAberta(moduleId), JSON.stringify({ em: new Date().toISOString() }));
const lerAberta = (moduleId: string): { em?: string; passo?: number; rotulos?: string[] } | null => {
  const v = ls.get(chaveIntroAberta(moduleId));
  if (!v) return null;
  try { const j = JSON.parse(v); return j && typeof j === "object" ? j : {}; } catch { return {}; }
};
/** Grava o passo (e o que entrou) na marca "aberta" — só enquanto a intro ainda não terminou. Nunca lança. */
export const anotarRetomadaDaIntro = (moduleId: string, passo: number, rotulos?: string[]): void => {
  try {
    const a = lerAberta(moduleId);
    if (!a || (ls.get(chaveIntroVista(moduleId)) ?? "").startsWith("feita")) return;
    ls.set(chaveIntroAberta(moduleId), JSON.stringify({ em: a.em ?? new Date().toISOString(), passo, rotulos: rotulos ?? a.rotulos ?? [] }));
  } catch { /* storage bloqueado */ }
};
/**
 * Onde a intro parou da última vez (B1, QA 21/10: Detox/Treino abandonados no passo 2 depois de o passo 1 gravar
 * o hábito/treino nunca voltavam — o módulo "tinha dado"). null = nunca apareceu, ou apareceu sem passar do 1º passo.
 */
export const retomadaDaIntro = (moduleId: string): RetomadaDaIntro | null => {
  const a = lerAberta(moduleId);
  if (!a || typeof a.passo !== "number" || a.passo < 2) return null;
  return { passo: a.passo, rotulos: Array.isArray(a.rotulos) ? a.rotulos.filter((r): r is string => typeof r === "string") : [] };
};
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
/** 1.0.18 (dias23): o CustomEvent da janela quando a intro de um módulo TERMINA na tela ("Pronto" = feita, "Pular" =
 *  pulada) — a missão escuta: a intro do módulo escolhido no dia 2 é a dose 2. `detail: { modulo, como }`. */
export const EVENTO_INTRO_FIM = "intro-modulo:fim";
export const avisarFimDaIntro = (moduleId: string, como: FimDaIntro): void => {
  try { window.dispatchEvent(new CustomEvent(EVENTO_INTRO_FIM, { detail: { modulo: moduleId, como } })); } catch { /* sem window */ }
};
/**
 * 1.0.18 (revisor 22/10): a intro deste módulo está NA TELA agora (entre aparecer e terminar/sair)? A 2ª aparição
 * (retomada) já grava "vista" ao montar — quem decide pela marca "vista" (a missão, pra saber se a intro do módulo
 * escolhido no dia 2 ainda é a dose 2) lê isto também, senão monta o passo guiado por cima da intro retomada.
 * Só memória (não sobrevive a fechar o app): a marca é da tela, não do aparelho.
 */
const introsNaTela = new Set<string>();
export const marcarIntroNaTela = (moduleId: string, naTela: boolean): void => { if (naTela) introsNaTela.add(moduleId); else introsNaTela.delete(moduleId); };
export const introNaTela = (moduleId: string): boolean => introsNaTela.has(moduleId);
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
  /** lê o número do card agora, SEM arredondar quando dá (a conta por trás do que ele mostra) */
  ler: (el: Element) => number | null;
  /** o que o card MOSTRA pra um número lido (padrão: arredondado) */
  exibir?: (bruto: number) => number;
  /** o que o card MOSTRAVA antes do registro, a partir do número lido agora (bruto) e do valor registrado */
  antes: (bruto: number, valor: number) => number;
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
/** O que o card QUANTO POSSO GASTAR HOJE mostra pra um por-dia: livre ≤ 0 → "R$ 0" (cantSpend); senão arredondado. */
export const exibidoNoPossoGastar = (porDia: number): number => (porDia <= 0 ? 0 : Math.round(porDia));
const reaisInteiros = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
/** O card QUANTO POSSO GASTAR HOJE do Dashboard de Finanças (components/Dashboard.tsx, data-missao="posso-gastar"). */
export const OLHAR_POSSO_GASTAR: OlharNoResumo = {
  quando: (get) => !semConteudo(get<unknown>("finance-incomes", undefined)),
  abrir: () => tocarAba("DASHBOARD"),
  achar: () => document.querySelector('[data-missao="posso-gastar"]'),
  // 23/10: lê a conta SEM arredondar (data-livre ÷ data-dias, a mesma do computeDailyBudget) — reconstruir o "antes"
  // a partir do número já arredondado errava R$ 1 (card R$ 267 → balão "R$ 266 → R$ 265"; card R$ 0 → "R$ 1 → R$ 0")
  ler: (el) => {
    const livre = Number(el.getAttribute("data-livre")), dias = Number(el.getAttribute("data-dias"));
    if (el.hasAttribute("data-livre") && Number.isFinite(livre) && dias > 0) return livre / dias;
    return lerReaisDoTexto(el.querySelector("p")?.textContent);
  },
  exibir: exibidoNoPossoGastar,
  // o gasto sai inteiro do livre: antes = (livre + valor) ÷ dias, arredondado do mesmo jeito que o card
  antes: (bruto, valor) => exibidoNoPossoGastar(bruto + valor / diasRestantesNoMes()),
  numero: { titulo: "Dá pra gastar hoje", formatar: reaisInteiros },
  titulo: "Seu número do dia",
  texto: "Cada gasto mexe nele na hora.",
};
export interface OpcaoDaIntro { emoji: string; rotulo: string; /** o que vai pro evento (sem acento/emoji) */ id: string; /** 1.0.17: a opção dela com número (o R$ da conta, as horas de sono, a página) */ valor?: number }
/** 1.0.17: o id da opção que a pessoa ESCREVEU no "+ Outro" (o rótulo é o texto dela) — o `executar` grava por texto. */
export const ID_OUTRO_DA_INTRO = "outro";
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
  /**
   * 1.0.17 (dono 19/10: "e se ela não comeu nenhuma daquelas?"): o "+ Outro" dos chips — o campo abre ali mesmo e o
   * `executar` recebe `{ id: ID_OUTRO_DA_INTRO, rotulo: <o texto dela> }`. Padrão: ligado em todo passo com chips e
   * `executar`; `false` desliga (tipo de pele: a rotina nasce de um dos 3).
   */
  outro?: { placeholder?: string; comValor?: boolean; numero?: NumeroDaEscolha } | false;
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
  quandoNoModulo?: {
    pergunta: string; descricao?: string; rotulo?: string;
    /** só quando o alvo achado é ESTE controle (Pet/Relações: o cartão "começo pronto" que faz a mesma pergunta; o
     *  vazio/"adicionar" sem a pergunta segue com os chips). Sem `so`: qualquer alvo achado (Beleza). */
    so?: string;
  };
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
  /**
   * 1.0.18 (dados 17–23/10: Relacionamentos 58%, Viagens 55%, Dieta 53%, Biblioteca 45%, Carreira 43% pulavam; Beleza,
   * curta e prática, 67% concluíam): "curta" = 1 passo só, registrar a 1ª coisa. Vai em todo `modulo_intro_*` como
   * `versao` pra medir contra a versão longa.
   */
  versao?: "curta";
}
export type IntroConfig = IntroGuiadaConfig | IntroDeUmToqueConfig;

const op = (emoji: string, rotulo: string, id: string): OpcaoDaIntro => ({ emoji, rotulo, id });
const porSeletor = (seletor: string) => (): Element | null => { try { return document.querySelector(seletor); } catch { return null; } };
/**
 * Treino: o quadradinho da 1ª SÉRIE do 1º exercício de HOJE (TabelaDeSeries: "Marcar a série 1 de <nome>"); sem a tabela
 * (cardio, exercício recolhido), o 1º "Marcar <nome>" do HOJE — nunca o "Marcar o treino de ontem/anteontem" do Esqueceu?.
 * UM seletor pros 3 lugares que apontam pra ele (o passo 2 da intro, acenderPrimeiroExercicio e o EscolherTreino da missão).
 */
export const SELETOR_PRIMEIRA_SERIE_DE_HOJE = '[data-testid="treino-hoje"] button[aria-label^="Marcar a série 1"], [data-testid="treino-hoje"] button[aria-label^="Marcar "]:not([aria-label*="ontem"])';
/** A linha do formulário (campo + botão) em volta de um campo: o anel abraça ela toda. */
const linhaDoCampo = (seletor: string) => (): Element | null => { try { const el = document.querySelector(seletor); return el?.parentElement ?? el; } catch { return null; } };
const seletorDoCardDeHoje = '[data-spotlight="first-day"]';

const olharPorTitulo = (re: RegExp) => (): Element | null => cardPorTitulo(re);
const linhaDeHojeDaRotina = (): Element | null => {
  try { const btn = document.querySelector('[data-spotlight="add-habit"]'); return btn ? btn.closest("section, .rounded-2xl, .rounded-xl, .rounded-lg") ?? btn : null; } catch { return null; }
};
const humores = HUMORES_DA_INTRO.map((h) => op(h.emoji, h.rotulo, h.id));
/** 1.0.17: o nome do hábito de detox que a intro acabou de criar (o "+ Outro" dela também) — o passo do check-in acha o card dele. */
let detoxDaIntro = "";

/**
 * OS PASSOS DE CADA MÓDULO (17/10, dono: "tipo Finanças, que tem vários"): 3–4 passos, cada um a ação mais usada
 * seguinte do módulo na 1ª semana dos pagantes (N = 629, scratchpad/definitiva/dados-intro/RESULTADO.md), no modelo
 * ação → olha → ação. Os 3 guiados (Finanças/Rotina/Saúde) fazem a 1ª ação e o "olha" na IntroGuiada e seguem em
 * `maisPassos`; os outros 13 rodam inteiros na IntroDeUmToque.
 */
/* 1.0.17 (dono, dado da 1.0.16: 41 de 50 pulos são no PASSO 1 — o tamanho não é o problema): os passos da 1.0.16
 * ficam; muda a copy (curta, uma ideia por passo), o "Agora não" quieto e o "+ Outro" (EscolhaRapida) nas listas. */
/** Pet/Relações (quandoNoModulo): quem ENTROU na lista (o nome do último novo) — a escuta do passo; null = nada novo. */
const CHAVE_PESSOAS_REL = "rel-people";
const CHAVE_PETS_INTRO = "pet-list";
function novoNaLista(valor: unknown, anterior: unknown): string | null {
  const agora = Array.isArray(valor) ? valor : [];
  const antes = Array.isArray(anterior) ? anterior : [];
  if (agora.length <= antes.length) return null;
  const ids = new Set(antes.map((x) => String((x as { id?: unknown } | null)?.id ?? "")));
  const novo = agora.filter((x) => !ids.has(String((x as { id?: unknown } | null)?.id ?? ""))).at(-1) ?? agora.at(-1);
  const nome = String((novo as { name?: unknown } | null)?.name ?? "").trim();
  return nome || "Cadastrado";
}

export const INTROS: Record<string, IntroConfig> = {
  /* ───────── guiadas: a dose, sem a missão em volta ───────── */
  financas: {
    formato: "guiada", moduleId: "financas", nome: "Finanças", tipo: "gasto",
    pedido: "anote 1 gasto",
    olhar: { titulo: "Seu mês", texto: "Cada gasto soma aqui." },
    pronto: "Você anota, o mês soma.",
    // depois do Montar (renda + contas fixas), o "olha" vai no QUANTO POSSO GASTAR HOJE do Dashboard — o número que ela acabou de ver
    olharNoResumo: OLHAR_POSSO_GASTAR,
    cor: { faixa: "#FFF4C2", tinta: "#7a5a00", acento: "#d97706" },
    // elegível = nenhum gasto VARIÁVEL ainda; renda e contas fixas do Montar não contam (a intro ensina a anotar o gasto)
    vazio: (get) => vazias(get, ["finance-expenses"]),
    montar: MONTAR_FINANCAS,
    // 3) custos fixos (57%) → 4) olha o card deles
    maisPassos: [{
      pedido: "anote 1 conta fixa", pergunta: "Uma conta que vem todo mês?",
      opcoes: [op("🏠", "Aluguel", "aluguel"), op("💡", "Luz", "luz"), op("📶", "Internet", "internet")],
      outro: { placeholder: "Ex.: Academia", comValor: true },
      executar: (ctx, o) => (o.id === ID_OUTRO_DA_INTRO ? anotarContaFixaPropria(ctx, o.rotulo, o.valor ?? 0) : anotarContaFixa(ctx, o.id)),
      alvo: { aba: "MEU FINANCEIRO", achar: olharPorTitulo(/^CUSTOS FIXOS$/i), abaixo: true },
    }, {
      pedido: "olhe as contas fixas", pergunta: "", opcoes: [],
      olhar: { titulo: "Contas fixas", texto: "O ✓ marca como paga." },
      alvo: { aba: "MEU FINANCEIRO", achar: olharPorTitulo(/^CUSTOS FIXOS$/i) },
    }],
  },
  rotina: {
    formato: "guiada", moduleId: "rotina", nome: "Rotina", tipo: "habito",
    pedido: "marque 1 hábito",
    olhar: { titulo: "Sua semana", texto: "Cada quadradinho vira um dia seguido." },
    pronto: "Um quadradinho por dia.",
    depoisDoMontar: { pergunta: "Marque o primeiro quando fizer", descricao: "Toque no quadradinho de hoje." },
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
      pedido: "conte como você está", pergunta: "Como você está hoje?",
      opcoes: humores,
      outro: false, // humor é uma escala (o módulo grava a nota)
      executar: (ctx, o) => anotarHumor(ctx, "mood-log", o.id),
      alvo: { aba: "MINHA SEMANA", achar: olharPorTitulo(/COMO VOC[ÊE] EST[ÁA] HOJE/i), abaixo: true },
    }],
  },
  saude: {
    formato: "guiada", moduleId: "saude", nome: "Saúde", tipo: "agua",
    pedido: "marque 1 copo d'água",
    olhar: { titulo: "O copo contou", texto: "Cada copo soma na meta do dia." },
    pronto: "Água, sono e remédio: um toque cada.",
    cor: { faixa: "#FFE1E1", tinta: "#7f1d1d", acento: "#dc2626" },
    vazio: (get) => vazias(get, ["core-saude-water", "water-log", "core-saude-sleep", "core-saude-supplement-log"]),
    // (água → olha) + 3) sono (21%) → 4) olha o IMC (28%)
    maisPassos: [{
      pedido: "anote o sono", pergunta: "Quantas horas você dormiu?",
      opcoes: [op("😴", "6 h", "6"), op("😊", "7 h", "7"), op("🌙", "8 h", "8")],
      outro: { numero: { min: 3, max: 12, inicial: 7, formatar: (n) => `${n} h`, rotulo: "Outro" } },
      executar: (ctx, o) => anotarSono(ctx, o.id === ID_OUTRO_DA_INTRO ? Number(o.valor ?? 7) : Number(o.id)),
      alvo: { aba: "HOJE", achar: olharPorTitulo(/^Sono$/i), abaixo: true },
    }, {
      pedido: "olhe o IMC", pergunta: "", opcoes: [],
      olhar: { titulo: "Calculadora IMC", texto: "Altura e peso uma vez, o IMC sai na hora." },
      alvo: { aba: "HOJE", achar: olharPorTitulo(/CALCULADORA IMC/i) },
    }],
  },

  /* ───────── de vários passos (o motor de 1 toque): ação → olha → ação ───────── */
  treino: {
    formato: "toque", moduleId: "treino", nome: "Treino",
    pedido: "monte o treino de hoje",
    pronto: "Marque cada série quando fizer.",
    passos: [{
      pergunta: "Qual treino você faz hoje?",
      opcoes: TREINOS_DE_HOJE.map((t) => op(t.emoji, t.rotulo, t.id)),
      outro: { placeholder: "Ex.: Natação" },
      executar: (ctx, o) => {
        if (o.id === ID_OUTRO_DA_INTRO) return montarTreinoProprio(ctx, o.rotulo).rotulo;
        const r = montarTreinoDeHoje(ctx, o.id as TreinoDeHoje); return `${r.rotulo} (${r.exercicios} exercícios)`;
      },
      // o plano vazio abre no PLANO: o post-it fica no cabeçalho do MEU PLANO DA SEMANA (a coluna de hoje é dali)
      alvo: { aba: "PLANO", achar: porSeletor('[data-testid="plano-semana"] h2'), abaixo: true },
      depois: () => abrirAbaDoModulo("HOJE"),
    }, {
      // 2º passo = a ação #1 do Treino na 1ª semana (marcar treino feito, 40%): o quadradinho da 1ª série de HOJE
      pedido: "marque a 1ª série", pergunta: "Fez o primeiro? Marque ali.",
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
      alvo: { aba: "HOJE", achar: porSeletor(SELETOR_PRIMEIRA_SERIE_DE_HOJE) },
    }, {
      // 3) a semana (dias ativos / constância, 21%)
      pedido: "olhe a sua semana", pergunta: "", opcoes: [],
      olhar: { titulo: "Sua semana", texto: "Treinos feitos e a sua sequência." },
      alvo: { aba: "SEMANA", achar: porSeletor('[data-testid="treino-semana"]') },
    }, {
      // 4) os modelos prontos (11%)
      pedido: "olhe os modelos", pergunta: "", opcoes: [],
      olhar: { titulo: "Modelos prontos", texto: "Um toque monta a semana inteira." },
      alvo: { aba: "PLANO", achar: porSeletor('[data-testid="modelos-prontos"]') },
    }],
    cor: { faixa: "#DCEBFF", tinta: "#1e3a8a", acento: "#2563eb" },
    vazio: (get) => planoVazio(get<unknown>("saude-workouts-v2", null)) && vazias(get, ["saude-workout-log"]),
    // o EscolherTreino da missão (1ª dose da área "corpo") na tela: a intro espera; com o modelo aplicado o módulo tem dado
    montar: { evento: "escolher-treino:fim", atributo: "data-escolher-treino" },
  },
  dieta: {
    formato: "toque", moduleId: "dieta", nome: "Dieta",
    pedido: "anote o café de hoje",
    pronto: "Almoço e jantar, quando quiser.",
    versao: "curta",
    passos: [{
      pergunta: "O que você comeu no café?",
      opcoes: [op("☕", "Pão com café", "pao_com_cafe"), op("🥚", "Ovos mexidos", "ovos"), op("🍌", "Fruta com iogurte", "fruta_iogurte")],
      outro: { placeholder: "Ex.: Tapioca" },
      executar: (ctx, o) => anotarCafeDaManha(ctx, o.rotulo),
      // o card de HOJE do cardápio (nasce recolhido no celular: abre antes de apontar — SÓ o botão "Abrir <dia>",
      // nunca o gatilho do "Limpar cardápio", que também tem aria-expanded; bug de 16/10)
      alvo: { aba: "CARDÁPIO", achar: () => {
        const hoje = document.querySelector(seletorDoCardDeHoje);
        if (!hoje) return null;
        try { hoje.querySelector<HTMLElement>('button[aria-label^="Abrir "]:not([aria-haspopup])')?.click(); } catch { /* noop */ }
        return hoje.querySelector("button") ? hoje.firstElementChild ?? hoje : hoje;
      }, abaixo: true },
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
    pedido: "anote 1 curso",
    pronto: "Cada curso com suas aulas e provas.",
    passos: [{
      pergunta: "O que você está estudando?",
      opcoes: [op("🇬🇧", "Inglês", "ingles"), op("🎓", "Faculdade", "faculdade"), op("📚", "Concurso", "concurso")],
      outro: { placeholder: "Ex.: Programação" },
      executar: (ctx, o) => adicionarCurso(ctx, o.rotulo),
      alvo: { achar: linhaDoCampo('input[placeholder="Adicionar curso..."]') },
    }, {
      // 2) olha o curso (cursos em andamento: 12%, a ação #1)
      pedido: "olhe o seu curso", pergunta: "", opcoes: [],
      olhar: { titulo: "Seu curso entrou", texto: "Toque nele pra pôr aulas e anotações." },
      alvo: { achar: olharPorTitulo(/CURSOS EM ANDAMENTO/i) },
    }, {
      // 3) um curso que ela quer (cursos que desejo)
      pedido: "anote 1 que você quer", pergunta: "E um curso que você quer fazer?",
      opcoes: [op("📊", "Excel", "excel"), op("🇪🇸", "Espanhol", "espanhol"), op("📣", "Marketing digital", "marketing")],
      outro: { placeholder: "Ex.: Fotografia" },
      executar: (ctx, o) => adicionarCursoDesejado(ctx, o.rotulo),
      alvo: { achar: olharPorTitulo(/CURSOS QUE DESEJO/i), abaixo: true },
    }],
    cor: { faixa: "#E4E6FF", tinta: "#312e81", acento: "#4f46e5" },
    vazio: (get) => vazias(get, ["estudos-cursos-andamento", "estudos-notebooks", "estudos-exams", "estudos-subjects"]),
  },
  biblioteca: {
    formato: "toque", moduleId: "biblioteca", nome: "Biblioteca",
    pedido: "ponha 1 livro na estante",
    pronto: "Marque a página quando ler.",
    versao: "curta",
    passos: [{
      pergunta: "O que você está lendo?",
      opcoes: [op("📘", "Hábitos Atômicos", "habitos_atomicos"), op("📗", "O Poder do Hábito", "poder_do_habito"), op("📙", "Essencialismo", "essencialismo")],
      outro: { placeholder: "Título do livro" },
      executar: (ctx, o) => adicionarLivro(ctx, { titulo: o.rotulo, autor: LIVROS[o.id]?.autor ?? "", capa: LIVROS[o.id]?.capa ?? "" }),
      alvo: { achar: porSeletor('button[aria-label="Adicionar livro"]') },
    }],
    cor: { faixa: "#FFE9D6", tinta: "#7c2d12", acento: "#ea580c" },
    vazio: (get) => vazias(get, ["lib-books"]),
  },
  casa: {
    formato: "toque", moduleId: "casa", nome: "Casa",
    pedido: "organize 1 cômodo",
    pronto: "Cada cômodo com as tarefas dele.",
    passos: [{
      pergunta: "Qual cômodo primeiro?",
      opcoes: COMODOS_DA_INTRO.map((c) => op(c.emoji, c.rotulo, c.id)),
      outro: { placeholder: "Ex.: Lavanderia" },
      executar: (ctx, o) => (o.id === ID_OUTRO_DA_INTRO ? anotarComodoProprio(ctx, o.rotulo) : anotarTarefaDoComodo(ctx, o.id)),
      alvo: { aba: "CÔMODOS", achar: linhaDoCampo('input[placeholder="Adicionar item..."]') },
    }, {
      // 2) olha o cômodo (cômodos: 9%, a ação #1)
      pedido: "olhe o cômodo", pergunta: "", opcoes: [],
      olhar: { titulo: "Seu cômodo", texto: "Marque cada tarefa quando fizer." },
      alvo: { aba: "CÔMODOS", achar: olharPorTitulo(/^(COZINHA|QUARTO|BANHEIRO)$/i) },
    }, {
      // 3) o mercado (lista)
      pedido: "anote 1 item do mercado", pergunta: "O que falta no mercado?",
      opcoes: [op("🥛", "Leite", "leite"), op("🍞", "Pão", "pao"), op("☕", "Café", "cafe")],
      outro: { placeholder: "Ex.: Arroz" },
      executar: (ctx, o) => anotarItemDoMercado(ctx, o.rotulo),
      alvo: { aba: "MERCADO", achar: linhaDoCampo('input[placeholder="Adicionar..."]') },
    }, {
      // 4) a limpeza (6%)
      pedido: "olhe a limpeza", pergunta: "", opcoes: [],
      olhar: { titulo: "Rotina de limpeza", texto: "Dia, semana e mês. O app renova sozinho." },
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
    pedido: "escolha 1 meta",
    pronto: "Cada meta vira um quadro com etapas.",
    passos: [{
      pergunta: "Qual meta você quer tirar do papel?",
      opcoes: [op("🏃", "Correr 5 km", "correr_5km"), op("💰", "Guardar R$ 1.000", "guardar_1000"), op("📚", "Ler 12 livros", "ler_12_livros")],
      outro: { placeholder: "Ex.: Aprender a nadar" },
      executar: (ctx, o) => criarMeta(ctx, o.rotulo),
      alvo: { aba: "METAS", achar: porSeletor('[data-spotlight="add-goal"]') },
    }, {
      // 2) olha a meta
      pedido: "olhe a sua meta", pergunta: "", opcoes: [],
      olhar: { titulo: "Sua meta", texto: "Toque nela pra ver as etapas." },
      alvo: { aba: "METAS", achar: porSeletor('[data-spotlight="add-goal"]') },
    }, {
      // 3) "O que me motiva" (16%, a ação #1 do módulo)
      pedido: "conte o que te motiva", pergunta: "O que te motiva a acordar?",
      opcoes: [op("👨‍👩‍👧", "Minha família", "familia"), op("💪", "Minha saúde", "saude"), op("🏡", "Minha independência", "independencia")],
      outro: { placeholder: "Ex.: Meus filhos" },
      executar: (ctx, o) => { anotarMotivacao(ctx, o.rotulo); },
      alvo: { aba: "SOBRE MIM", achar: olharPorTitulo(/O QUE ME MOTIVA/i), abaixo: true },
    }, {
      // 4) o humor (8%)
      pedido: "marque o humor", pergunta: "Como está o seu humor hoje?",
      opcoes: humores,
      outro: false, // humor é uma escala (o módulo grava a nota)
      executar: (ctx, o) => anotarHumor(ctx, "dp-mood-log", o.id),
      alvo: { aba: "HUMOR & SCORE", achar: olharPorTitulo(/HUMOR/i), abaixo: true },
    }],
    cor: { faixa: "#EFE2FF", tinta: "#4c1d95", acento: "#7c3aed" },
    vazio: (get) => vazias(get, ["goals-board-v2", "dp-gratitude", "dp-mood-log", "dp-motivations"]),
  },
  carreira: {
    formato: "toque", moduleId: "carreira", nome: "Carreira",
    pedido: "anote 1 tarefa",
    pronto: "Marque quando terminar.",
    versao: "curta",
    passos: [{
      pergunta: "Uma tarefa pra hoje?",
      opcoes: [op("📧", "Responder e-mails", "emails"), op("📊", "Fechar o relatório", "relatorio"), op("📞", "Ligar pro cliente", "cliente")],
      outro: { placeholder: "Ex.: Revisar a proposta" },
      executar: (ctx, o) => anotarTarefaDoTrabalho(ctx, o.rotulo),
      alvo: { aba: "Meu Dia", achar: linhaDoCampo('input[placeholder="Nova tarefa do trabalho..."]') },
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
    pedido: "escolha o que largar",
    pronto: "Um check-in por dia vira sua sequência.",
    passos: [{
      pergunta: "O que você quer largar?",
      opcoes: [op("📱", "Redes sociais à noite", "redes_sociais"), op("🍬", "Açúcar", "acucar"), op("🚬", "Cigarro", "cigarro")],
      outro: { placeholder: "Ex.: Refrigerante" },
      executar: (ctx, o) => { detoxDaIntro = o.rotulo; comecarDetox(ctx, { nome: o.rotulo, icone: o.id === ID_OUTRO_DA_INTRO ? "✨" : o.emoji }); },
      alvo: { aba: "RASTREADOR", achar: linhaDoCampo('input[placeholder^="O que quer parar?"]') },
    }, {
      // 2) o check-in de hoje (registro do dia): a ação no módulo
      pedido: "faça o check-in de hoje", pergunta: "Hoje você segurou? Marque o check-in.",
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
          const nomes = ["redes sociais à noite", "açúcar", "cigarro", detoxDaIntro.toLowerCase()].filter(Boolean);
          const nome = Array.from(document.querySelectorAll<HTMLElement>("main h3, main h4, main p, main span")).find((e) => nomes.includes((e.textContent ?? "").trim().toLowerCase()) && (e.textContent ?? "").length < 40);
          nome?.closest<HTMLElement>("[class*='rounded']")?.click();
          return null;
        } catch { return null; }
      } },
    }, {
      // 3) as stats
      pedido: "olhe a sequência", pergunta: "", opcoes: [],
      olhar: { titulo: "Sua sequência", texto: "Recaiu? Marque e recomece, sem drama." },
      alvo: { aba: "STATS", achar: () => { try { return document.querySelector("main section, main .rounded-2xl, main .rounded-xl"); } catch { return null; } } },
    }],
    cor: { faixa: "#EAF7D2", tinta: "#365314", acento: "#65a30d" },
    vazio: (get) => vazias(get, ["detox-habits", "detox-diary"]),
  },
  hiperfoco: {
    formato: "toque", moduleId: "hiperfoco", nome: "Mente",
    pedido: "tire 1 pensamento da cabeça",
    pronto: "Cada pensamento fica na hora em que apareceu.",
    passos: [{
      pergunta: "O que está na sua cabeça agora?",
      opcoes: [op("📝", "Uma pendência pra resolver", "pendencia"), op("💡", "Uma ideia pra não perder", "ideia"), op("😮‍💨", "Uma preocupação de hoje", "preocupacao")],
      outro: { placeholder: "Escreva o que pensou" },
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
      pedido: "olhe o seu dia", pergunta: "", opcoes: [],
      olhar: { titulo: "Ficou na hora de agora", texto: "A busca acha qualquer um depois." },
      alvo: { aba: "DIA", achar: () => { try { const hora = `${String(new Date().getHours()).padStart(2, "0")}:00`; return Array.from(document.querySelectorAll<HTMLElement>("button, div")).find((b) => (b.textContent ?? "").trim().startsWith(hora) && b.getBoundingClientRect().height < 200) ?? null; } catch { return null; } } },
    }, {
      // 3) uma meta de curto prazo (a ação #1 da Mente: 4%)
      pedido: "anote 1 meta curta", pergunta: "Uma meta pras próximas semanas?",
      opcoes: [op("📵", "Menos tela à noite", "tela"), op("📖", "Terminar um livro", "livro"), op("🏃", "Treinar 3x na semana", "treino")],
      outro: { placeholder: "Ex.: Dormir antes das 23h" },
      executar: (ctx, o) => { anotarMetaDeCurtoPrazo(ctx, o.rotulo); },
      alvo: { aba: "METAS", achar: olharPorTitulo(/CURTO PRAZO/i), abaixo: true },
    }],
    cor: { faixa: "#ECE4FF", tinta: "#4c1d95", acento: "#6d28d9" },
    vazio: (get) => vazias(get, ["hiperfoco-thoughts", "mente-dreams"]),
  },
  viagens: {
    formato: "toque", moduleId: "viagens", nome: "Viagens",
    pedido: "anote 1 destino",
    pronto: "Datas e roteiro vêm depois.",
    versao: "curta",
    passos: [{
      pergunta: "Pra onde você quer ir?",
      opcoes: [op("🏖️", "Praia no Nordeste", "nordeste"), op("🏔️", "Gramado", "gramado"), op("✈️", "Europa", "europa")],
      outro: { placeholder: "Ex.: Bonito" },
      executar: (ctx, o) => anotarDestino(ctx, DESTINOS_DA_INTRO[o.id] ?? { name: o.rotulo, country: "", continent: "" }),
      alvo: { achar: linhaDoCampo('input[placeholder="Destino..."], input[placeholder="Destino"]') },
    }],
    cor: { faixa: "#D9F4F0", tinta: "#134e4a", acento: "#0d9488" },
    vazio: (get) => vazias(get, ["travel-bucket"]),
  },
  beleza: {
    formato: "toque", moduleId: "beleza", nome: "Beleza",
    pedido: "monte o seu skincare",
    pronto: "Manhã e noite, um toque por passo.",
    passos: [{
      // 1) o quiz do PRÓPRIO módulo ("Monte sua rotina", 3 perguntas): o anel nele e o passo espera a rotina nascer
      //    (rev3, 17/10: o post-it com Oleosa/Mista/Seca cobria o quiz com a mesma pergunta). Sem o quiz na tela, os chips.
      pergunta: "Como é a sua pele?",
      opcoes: [op("💧", "Oleosa", "oleosa"), op("🌗", "Mista", "mista"), op("🍃", "Seca", "seca")],
      outro: false, // tipo de pele não tem "outro": a rotina nasce de um dos 3
      executar: (ctx, o) => { montarSkincare(ctx, o.id as TipoDePele); return `Skincare pra pele ${o.rotulo.toLowerCase()}`; },
      quandoNoModulo: { pergunta: "Responda aqui as 3 perguntas", rotulo: "3 toques" },
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
      pedido: "olhe a sua rotina", pergunta: "", opcoes: [],
      olhar: { titulo: "Sua rotina nasceu", texto: "Toque num passo pra escolher o produto." },
      alvo: { aba: "SKINCARE", achar: porSeletor('[data-card="skincare-de-hoje"], [data-testid="rotina-pronta"]') },
    }, {
      // 3) o Espelho do dia (11%, a ação #1 da Beleza)
      pedido: "faça o espelho do dia", pergunta: "Como a sua pele está hoje?",
      opcoes: ESPELHO_DA_INTRO.map((e) => op(e.emoji, e.rotulo, e.id)),
      outro: false, // o espelho do dia é uma escala do módulo
      executar: (ctx, o) => anotarEspelhoDoDia(ctx, o.id),
      alvo: { aba: "SKINCARE", achar: olharPorTitulo(/ESPELHO/i), abaixo: true },
    }],
    cor: { faixa: "#FFE4F1", tinta: "#831843", acento: "#db2777" },
    vazio: (get) => vazias(get, [CHAVE_PASSOS_BELEZA.manha, CHAVE_PASSOS_BELEZA.noite, "beauty-products", "skincare-daily-checkin"]),
  },
  relacionamentos: {
    formato: "toque", moduleId: "relacionamentos", nome: "Relações",
    pedido: "anote 1 pessoa",
    pronto: "Toque nela pra pôr o aniversário.",
    versao: "curta",
    passos: [{
      pergunta: "Quem importa pra você?",
      opcoes: [op("🌷", "Mãe", "mae"), op("💛", "Meu amor", "amor"), op("✨", "Melhor amiga", "melhor-amiga")],
      outro: { placeholder: "Nome ou apelido" },
      executar: (ctx, o) => (o.id === ID_OUTRO_DA_INTRO ? adicionarPessoaPropria(ctx, o.rotulo) : adicionarPessoaDoComeco(ctx, o.id)),
      // varredura 26/10 (como a Beleza, c271c441): o cartão "Comece por aqui" do módulo JÁ pergunta quem importa (8
      // pessoas) — com ele na tela, o post-it só aponta pra ele, sem repetir Mãe/Meu amor/Melhor amiga; o passo espera a
      // pessoa entrar na lista (rel-people). Sem o cartão (lista vazia/"adicionar"), os chips de sempre.
      quandoNoModulo: { pergunta: "Escolha aqui quem importa", descricao: "Toque numa pessoa e guarde. O aniversário pode ficar pra depois.", rotulo: "1 toque", so: '[data-testid="comeco-pronto"]' },
      escutar: { chaves: [CHAVE_PESSOAS_REL], rotulo: (valor, anterior) => novoNaLista(valor, anterior) },
      alvo: { aba: "PESSOAS", achar: porSeletor('[data-testid="comeco-pronto"], [data-testid="pessoas-vazio"], [data-testid="adicionar-pessoa"]') },
    }],
    cor: { faixa: "#FFE1E7", tinta: "#881337", acento: "#e11d48" },
    vazio: (get) => vazias(get, ["rel-people", "rel-dates", "rel-moments", "relacoes-pessoas"]),
  },
  pet: {
    formato: "toque", moduleId: "pet", nome: "Pet",
    pedido: "cadastre o seu pet",
    pronto: "Vacina, banho e remédio na agenda dele.",
    passos: [{
      pergunta: "Seu pet é…",
      opcoes: PETS_DA_INTRO.map((p) => op(p.emoji, p.rotulo, p.id)),
      outro: { placeholder: "Ex.: Calopsita" },
      executar: (ctx, o) => (o.id === ID_OUTRO_DA_INTRO ? cadastrarPetProprio(ctx, o.rotulo) : cadastrarPet(ctx, o.id as "cao" | "gato" | "outro")),
      // varredura 26/10 (como a Beleza, c271c441): o cartão "Novo RG do pet" JÁ pergunta "Quem é o seu pet?" — com ele na
      // tela, o post-it só aponta pra ele (sem Cachorro/Gato/Outro bicho repetidos) e o passo espera o pet nascer
      // (pet-list). Sem o cartão, os chips de sempre.
      quandoNoModulo: { pergunta: "Responda aqui no cartão", descricao: "Em 3 toques seu pet ganha RG, a rotina e a carteirinha.", rotulo: "3 toques", so: '[data-testid="comeco-pronto"]' },
      escutar: { chaves: [CHAVE_PETS_INTRO], rotulo: (valor, anterior) => novoNaLista(valor, anterior) },
      alvo: { achar: porSeletor('[data-testid="comeco-pronto"], [data-testid="pet-vazio"]') },
    }, {
      // 2) a rotina de hoje: marca a comida (a ação no módulo)
      pedido: "marque a comida de hoje", pergunta: "Já deu comida hoje? Marque ali.",
      opcoes: [],
      escutar: { chaves: [`pet-routine-${localDayKey()}`], rotulo: (valor) => (Object.values(mapa(valor)).some((t) => Object.values(mapa(t)).some((v) => v === true)) ? "a comida de hoje" : null) },
      alvo: { achar: () => { try { const c = document.querySelector('[data-card="PET DE HOJE"]'); return c?.querySelector("button, input, [role=checkbox]") ?? c; } catch { return null; } } },
    }, {
      // 3) a carteirinha
      pedido: "olhe a carteirinha", pergunta: "", opcoes: [],
      olhar: { titulo: "A carteirinha", texto: "O app avisa quando chegar a hora." },
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
    const alvo = document.querySelector<HTMLElement>(`${SELETOR_PRIMEIRA_SERIE_DE_HOJE}, [data-testid="treino-hoje"] button[aria-label^="Abrir "]`);
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
    // 1.0.18 (dias23): o módulo que ela ESCOLHEU no dia 2 — a dose 2 É a intro dele (nunca bloqueia)
    if (missaoDoses.introEhADoseDoDia2(lerMissao(), moduleId)) return false;
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
    if (introVistaNesteAparelho(id) || introVistaNaConta(id, get) || introVistaPeloMontar(id, get)) return true;
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

/* ───── Finanças montada (1.0.18, dono 23/10) ─────
 * Quem TERMINOU o "Montar Finanças" (renda → contas → "Você pode gastar hoje R$ X" — a marca `core-montar-financas`
 * com `r: "pronto"`, no aparelho ou na conta) já teve o guia de Finanças: o tutorial do módulo conta como VISTO e não
 * aparece. A regra dura ("nenhum módulo abre a 1ª vez sem tutorial") segue valendo — o Montar foi o tutorial. Quem
 * pulou o Montar ("pulou") ou nunca montou continua vendo o tutorial. Só leitura: nada novo é gravado. */
const montouFinancas = (get?: Leitor): boolean => {
  const pronto = (raw: unknown): boolean => {
    if (!raw) return false;
    try { const v = typeof raw === "object" ? raw : JSON.parse(String(raw)); return !!v && (v as { r?: unknown }).r === "pronto"; } catch { return false; }
  };
  if (pronto(ls.get(CHAVE_MONTAR_FINANCAS))) return true;
  try { return pronto(get?.<unknown>(CHAVE_MONTAR_FINANCAS, null)); } catch { return false; }
};
/** O tutorial deste módulo conta como visto por outro guia já feito (Finanças: o Montar terminado)? */
export const introVistaPeloMontar = (moduleId: string, get?: Leitor): boolean => moduleId === "financas" && montouFinancas(get);

/* ───── a decisão ───── */
export type MotivoSemIntro = "desligada" | "sem_intro" | "ja_vista" | "ja_apresentado" | "com_dado" | "missao" | "outra_guia";
/** Mostra a intro deste módulo? `null` = mostra; senão o motivo de não mostrar (pros testes e pro dev). */
export function porQueNaoMostrar(moduleId: string, get: Leitor, extras: { outraGuiaAtiva?: boolean } = {}): MotivoSemIntro | null {
  const config = INTROS[moduleId];
  if (!config) return "sem_intro";
  if (!introLigada()) return "desligada";
  if (introVistaNesteAparelho(moduleId) || introVistaNaConta(moduleId, get)) return "ja_vista";
  if (introVistaPeloMontar(moduleId, get)) return "ja_vista";
  if (moduloJaApresentado(moduleId, get)) return "ja_apresentado";
  let vazio = true;
  try { vazio = config.vazio(get); } catch { vazio = true; }
  /* B1 (QA 21/10): a intro já APARECEU neste aparelho e não terminou → o dado do módulo veio dela mesma (o passo 1
   * gravou o hábito/treino) — não é "conta de antes"; a 2ª aparição retoma onde parou (IntroDoModulo marca vista). */
  if (!vazio && !dadoSoDaAcaoRapida(moduleId, get) && !introAbertaNesteAparelho(moduleId)) return "com_dado";
  if (introBloqueadaPelaMissao(moduleId)) return "missao";
  if (extras.outraGuiaAtiva) return "outra_guia";
  return null;
}
export const mostrarIntro = (moduleId: string, get: Leitor, extras: { outraGuiaAtiva?: boolean } = {}): boolean => porQueNaoMostrar(moduleId, get, extras) === null;
