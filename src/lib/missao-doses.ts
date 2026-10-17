/**
 * MISSÃO EM DOSES + card "SEU DIA" — protótipo na WEB (02/10/2026).
 *
 * O desenho (caminho D do estudo do tutorial longo, scratchpad
 * tutorial-longo/relatorio.md): a pessoa escolhe 3 módulos SÓ PRA MISSÃO (o
 * app continua com os 16 liberados — pedido do dono), a área da porta vem
 * primeiro e dá pra trocar; 1 módulo por dia (~40 s): 1 toque com chips (um
 * registro de verdade) + 1 "olhar explicado"; a comemoração combina o de
 * amanhã (e a hora do lembrete); o card "SEU DIA" fica no topo da Home
 * (missão 1/3 → 3/3 e o passo de hoje, pendências de hoje, score, sequência,
 * adesivo mais perto) e leva ao passo do dia; "fazer o de amanhã agora" pra
 * quem quer tudo hoje; no dia 3, "O que você construiu".
 *
 * PULAR (seção 5 do estudo): link discreto "Explorar por conta própria" nas
 * boas-vindas (a missão continua no card); dentro do módulo não há "pular
 * tudo" nos primeiros 20 s (toque fora já solta o anel) — o "Pular" da faixa
 * aparece depois; "Pular este passo" no passo de olhar; nunca trava dura.
 *
 * DESLIGADO POR PADRÃO NA WEB: `MISSAO_DOSES = "off"` = o site de hoje, byte a
 * byte (nenhum card, nenhuma faixa, nenhum evento novo — travado em
 * src/test/missao-doses.test.tsx).
 *
 * LIGADA NO APP DAS LOJAS (03/10, versão 1.0.10): `MISSAO_DOSES_APP = "on"` —
 * rollback = "off" + build. Dado que mandou: dos 364 pagantes de 8–45 dias, quem
 * fica usou 4 módulos e fez ~22 registros nas 48 h (quem some: 2 e 6); voltar no
 * dia 2 dobra a chance de ficar (24% × 10%). No app ela vale SÓ PRA QUEM É NOVO
 * nesta versão (conta < 48 h, `missaoDosesMandaNoApp`) e SUBSTITUI o que a
 * pessoa nova via antes — nunca duas missões na tela:
 *   · a Missão dos 3 dias do iPhone (MissaoDoTrial, `core-missao`): quem já está
 *     com ela em andamento (veio da 1.0.9) termina a antiga; quem é novo não a
 *     recebe mais;
 *   · o tutorial de módulos (QuickStartOnboarding + SpotlightOverlay, flag
 *     `force-new-user-tutorial`): a Home limpa a flag quando a missão manda, como
 *     já fazia pra Missão do iPhone.
 * A hora combinada na comemoração vira a hora do Lembrete do dia 2
 * (lib/lembrete-dia2) — uma notificação só, com o passo de amanhã.
 *
 * QA (só na web; no app a chave do app decide), como o Funil B:
 *   · `?missao-doses=on` liga só neste navegador (`off` força desligado,
 *     `auto` desfaz, `recomecar` apaga a missão deste navegador e segue ligado);
 *   · `?missao-doses-dia=1|2|3` simula o dia da missão (`auto` volta ao
 *     relógio) — pra ver os 3 dias sem esperar.
 * O estado da missão mora no localStorage deste navegador (como a Missão do
 * iPhone, `core-missao`): nada vai pro servidor além dos REGISTROS que os
 * chips gravam — esses são dados de verdade da conta, pelo mesmo `set` que o
 * módulo usa.
 */
import { isNativeShell, plataformaApp } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import { missaoAtual } from "@/lib/teste-gratis";
import type { AreaKey } from "@/lib/funnel";
import type { TipoDoItem } from "@/lib/demo-guiada";
import { bracoFixo, bracoGravado, dia1CheioLigado, modoUmPorDia, type BracoDia1, type PlanoAmanha } from "@/lib/dia1-cheio";

export type ModoMissaoDoses = "off" | "on";
/** A web: desligada (02/10). */
export const MISSAO_DOSES: ModoMissaoDoses = "off";
/** O app das lojas (iPhone e Android), 1.0.10: ligada pra quem é novo. ROLLBACK = "off". */
export const MISSAO_DOSES_APP: ModoMissaoDoses = "on";

/** Conta com menos de 48 h — a mesma régua do tutorial e do PortaoBoasVindas. */
export const contaNova = (criadoEm?: string | null, agora: number = Date.now()): boolean =>
  !!criadoEm && agora - new Date(criadoEm).getTime() < 48 * 3600e3;

/**
 * NO APP, A MISSÃO EM DOSES MANDA? (03/10) É a pergunta que a Home (tutorial), a
 * MissaoDoTrial (Missão antiga) e a própria orquestra fazem — uma resposta só:
 *   · já nasceu neste aparelho → sim, até o fim (quem começou termina);
 *   · há Missão antiga (`core-missao`, 1.0.9) → não: a antiga termina;
 *   · senão, só pra conta nova (< 48 h). Cliente antigo que atualizou não vê nada.
 */
export function missaoDosesMandaNoApp(criadoEm?: string | null): boolean {
  if (!isNativeShell() || MISSAO_DOSES_APP !== "on") return false;
  if (lerMissao()) return true;
  if (missaoAtual()) return false;
  return contaNova(criadoEm);
}

/**
 * O LINK DE QA (`?missao-doses=on`) — DESLIGADO em 02/10 (dono: "desativa aquele
 * link do tutorial, tem muita coisa a melhorar, mas agora vamos esperar — fazer
 * sem métricas é a mesma coisa que nada"). Com `false`, o link não liga nada e
 * quem já tinha a força gravada volta ao normal na próxima visita. O código da
 * missão fica guardado pra quando voltarmos a ela. Religar = `true` + push.
 * (Os testes ligam por `globalThis.__QA_MISSAO_DOSES__`.)
 */
export const QA_MISSAO_DOSES = false;
const qaHabilitado = (): boolean =>
  QA_MISSAO_DOSES || (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ === true;

export const CHAVE_FORCA_MISSAO_DOSES = "missao-doses-force";
export const CHAVE_DIA_QA = "missao-doses-dia";
export const CHAVE_ESTADO_MISSAO_DOSES = "missao-doses";
export const PARAM_QA_MISSAO_DOSES = "missao-doses";
export const PARAM_DIA_MISSAO_DOSES = "missao-doses-dia";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado: vale a chave */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/**
 * A força de QA pelo LINK (o dono testa sem console): grava no aparelho, porque
 * a Home → módulo → Home passa por várias páginas e o link não vai junto.
 */
export function guardarForcaDaUrl(busca?: string | URLSearchParams): void {
  if (!qaHabilitado()) { ls.del(CHAVE_FORCA_MISSAO_DOSES); ls.del(CHAVE_DIA_QA); return; }
  let p: URLSearchParams;
  try {
    p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
  } catch { return; }
  const v = p.get(PARAM_QA_MISSAO_DOSES);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_MISSAO_DOSES, v);
  else if (v === "auto") { ls.del(CHAVE_FORCA_MISSAO_DOSES); ls.del(CHAVE_DIA_QA); }
  else if (v === "recomecar") { ls.set(CHAVE_FORCA_MISSAO_DOSES, "on"); ls.del(CHAVE_ESTADO_MISSAO_DOSES); ls.del(CHAVE_DIA_QA); }
  const d = p.get(PARAM_DIA_MISSAO_DOSES);
  if (d === "1" || d === "2" || d === "3") ls.set(CHAVE_DIA_QA, d);
  else if (d === "auto") ls.del(CHAVE_DIA_QA);
}

export const forcaDaMissaoDoses = (): "on" | "off" | null => {
  const f = ls.get(CHAVE_FORCA_MISSAO_DOSES);
  return f === "on" || f === "off" ? f : null;
};

/** O dia simulado pelo QA (`?missao-doses-dia=`), ou null = o relógio. */
export const diaDeQa = (): 1 | 2 | 3 | null => {
  const d = ls.get(CHAVE_DIA_QA);
  return d === "1" || d === "2" || d === "3" ? (Number(d) as 1 | 2 | 3) : null;
};

/**
 * A missão em doses está ligada AQUI? No app das lojas: a chave do app (a força de
 * QA do link não vale no shell — quem decide se ela NASCE é missaoDosesMandaNoApp).
 * Na web: a força de QA > chave.
 */
export function missaoDosesLigada(modo: ModoMissaoDoses = MISSAO_DOSES, modoApp: ModoMissaoDoses = MISSAO_DOSES_APP): boolean {
  if (isNativeShell()) return modoApp === "on";
  if (!qaHabilitado()) return modo === "on";
  const f = forcaDaMissaoDoses();
  if (f === "on") return true;
  if (f === "off") return false;
  return modo === "on";
}

/* ------------------------------------------------------------------ os 16 módulos */

export type ModuloDaMissao =
  | "financas" | "rotina" | "saude" | "treino" | "dieta" | "desenvolvimento" | "hiperfoco" | "estudos"
  | "carreira" | "biblioteca" | "casa" | "beleza" | "viagens" | "relacionamentos" | "pet" | "detox";

export interface PassoDoModulo {
  modulo: ModuloDaMissao;
  nome: string;
  emoji: string;
  rota: string;
  /** cor de fundo do tile na escolha (pastel do planner) */
  cor: string;
  /** o tipo da demo guiada (tem chips, anel e "olhar" prontos em alvos.ts); sem ele, o passo é só a instrução */
  tipo?: TipoDoItem;
  /** "Toca em 1 gasto de hoje" — a linha do card e das boas-vindas */
  pedido: string;
  /** "nas suas Finanças" — a comemoração diz "Café · R$ 12 já está nas suas Finanças" */
  onde: string;
  /** o nome curto do toque ("1 gasto") */
  toque: string;
  /** as chaves do módulo que a missão escuta pra saber que o toque aconteceu */
  chaves: string[];
  /** onde fica o botão de adicionar (fail-open: sem âncora, só a instrução) */
  seletor?: string;
  /** o "olhar explicado" depois do toque */
  olhar: { titulo: string; texto: string };
}

export const MODULOS: Record<ModuloDaMissao, PassoDoModulo> = {
  financas: { modulo: "financas", nome: "Finanças", emoji: "💰", rota: "/financas", onde: "nas suas Finanças", cor: "#FFF4C2", tipo: "gasto", pedido: "Toca em 1 gasto de hoje", toque: "1 gasto", chaves: ["finance-expenses"], seletor: '[data-spotlight="add-expense"]', olhar: { titulo: "Olha o seu mês", texto: "O gasto entrou no dia de hoje e o 'Saiu' do mês somou sozinho — é daí que sai quanto dá pra gastar hoje." } },
  rotina: { modulo: "rotina", nome: "Rotina", emoji: "📅", rota: "/rotina", onde: "na sua Rotina", cor: "#FFE4EC", tipo: "habito", pedido: "Marca 1 hábito no quadradinho", toque: "1 hábito", chaves: ["rotina-habits-checked", "rotina-habits"], seletor: '[data-spotlight="add-habit"]', olhar: { titulo: "A linha da semana", texto: "Cada quadradinho marcado vira um dia na sua sequência — a semana inteira cabe num olhar." } },
  saude: { modulo: "saude", nome: "Saúde", emoji: "❤️", rota: "/saude", onde: "na sua Saúde", cor: "#FFE1E1", tipo: "agua", pedido: "Marca 1 copo d'água", toque: "1 copo", chaves: ["core-saude-water"], seletor: '[data-spotlight="add-water"]', olhar: { titulo: "O copo que contou", texto: "Cada copo entra na meta do dia — e o CORE te lembra de bater ela." } },
  treino: { modulo: "treino", nome: "Treino", emoji: "🏋️", rota: "/treino", onde: "no seu Treino", cor: "#E3ECFF", tipo: "exercicio", pedido: "Anota 1 exercício", toque: "1 exercício", chaves: ["saude-workouts-v2"], seletor: '[data-spotlight="add-exercise"]', olhar: { titulo: "O seu treino da semana", texto: "O exercício entra no dia de hoje; anota a carga de cada série e vê a evolução." } },
  dieta: { modulo: "dieta", nome: "Dieta", emoji: "🥗", rota: "/dieta", onde: "na sua Dieta", cor: "#E2F7E6", pedido: "Anota 1 refeição de hoje", toque: "1 refeição", chaves: ["saude-meals", "core-dieta-log", "dieta-diary-v2"], olhar: { titulo: "O seu dia na dieta", texto: "Cada refeição anotada fecha o dia — o CORE mostra o que falta." } },
  desenvolvimento: { modulo: "desenvolvimento", nome: "Metas", emoji: "🎯", rota: "/desenvolvimento", onde: "nas suas Metas", cor: "#EEE6FF", tipo: "meta", pedido: "Escolhe 1 meta sua", toque: "1 meta", chaves: ["goals-board-v2"], seletor: '[data-spotlight="add-goal"]', olhar: { titulo: "A meta com plano", texto: "A meta ganha passos; cada passo feito aparece aqui." } },
  hiperfoco: { modulo: "hiperfoco", nome: "Hiperfoco", emoji: "🧠", rota: "/hiperfoco", onde: "no seu Hiperfoco", cor: "#DFF1FF", pedido: "Anota 1 pensamento", toque: "1 pensamento", chaves: ["hiperfoco-thoughts", "mente-dreams"], olhar: { titulo: "A mente no papel", texto: "O que está na cabeça vai pro papel — e sai da cabeça." } },
  estudos: { modulo: "estudos", nome: "Estudos", emoji: "📚", rota: "/estudos", onde: "nos seus Estudos", cor: "#FFF4C2", pedido: "Anota 1 matéria", toque: "1 matéria", chaves: ["estudos-subjects", "estudos-aprendizados", "estudos-pomodoro-count"], olhar: { titulo: "A sua grade", texto: "A matéria entra na grade; revisões e provas ficam no lugar." } },
  carreira: { modulo: "carreira", nome: "Carreira", emoji: "💼", rota: "/carreira", onde: "na sua Carreira", cor: "#EDEFF3", pedido: "Anota 1 tarefa do dia", toque: "1 tarefa", chaves: ["career-day-tasks", "career-skills"], olhar: { titulo: "O seu dia de trabalho", texto: "As fases do dia e as tarefas ficam no mesmo lugar." } },
  biblioteca: { modulo: "biblioteca", nome: "Biblioteca", emoji: "📖", rota: "/biblioteca", onde: "na sua Biblioteca", cor: "#FFE9D6", pedido: "Anota 1 livro que você está lendo", toque: "1 livro", chaves: ["lib-books", "lib-read-log"], olhar: { titulo: "A sua estante", texto: "O livro entra na estante; cada página marcada avança a barra dele." } },
  casa: { modulo: "casa", nome: "Casa", emoji: "🏠", rota: "/casa", onde: "na sua Casa", cor: "#E6F8D9", pedido: "Anota 1 item da compra", toque: "1 item", chaves: ["casa-shopping-list", "casa-maint-tasks"], olhar: { titulo: "A lista da casa", texto: "O item entra na lista; no mercado, é só marcar." } },
  beleza: { modulo: "beleza", nome: "Beleza", emoji: "💄", rota: "/beleza", onde: "na sua Beleza", cor: "#FFE4F1", pedido: "Marca 1 passo da rotina de hoje", toque: "1 passo", chaves: ["skincare-morning-checked", "skincare-night-checked", "skincare-daily-checkin", "skincare-de-hoje", "skincare-do-dia", "skincare-diary"], olhar: { titulo: "A rotina de hoje", texto: "Cada passo marcado fecha a rotina da manhã ou da noite." } },
  viagens: { modulo: "viagens", nome: "Viagens", emoji: "✈️", rota: "/viagens", onde: "nas suas Viagens", cor: "#E3E8FF", pedido: "Anota 1 destino", toque: "1 destino", chaves: ["travel-bucket"], olhar: { titulo: "A sua lista de destinos", texto: "O destino entra na lista; depois vem o roteiro e a mala." } },
  relacionamentos: { modulo: "relacionamentos", nome: "Relações", emoji: "💞", rota: "/relacionamentos", onde: "nas suas Relações", cor: "#FFE1E7", pedido: "Anota 1 pessoa que importa", toque: "1 pessoa", chaves: ["rel-people", "rel-dates", "rel-moments", "relacoes-pessoas", "relacoes-datas", "relacoes-momentos"], olhar: { titulo: "As pessoas que importam", texto: "Datas e momentos ficam ligados à pessoa." } },
  pet: { modulo: "pet", nome: "Pet", emoji: "🐾", rota: "/pet", onde: "no seu Pet", cor: "#FFF4C2", pedido: "Cadastra o seu pet", toque: "1 pet", chaves: ["pet-list", "pet-diary", "pet-cuidados", "pet-expenses"], olhar: { titulo: "A agenda do pet", texto: "Com o pet cadastrado, vacina, banho e remédio entram na agenda dele." } },
  detox: { modulo: "detox", nome: "Detox", emoji: "📵", rota: "/detox", onde: "no seu Detox", cor: "#EDEFF3", pedido: "Cria 1 hábito de detox", toque: "1 hábito", chaves: ["detox-habits", "detox-diary"], olhar: { titulo: "Menos tela, mais presença", texto: "Cada hábito marcado é um pedaço do dia de volta." } },
};

/** A ordem da grade de escolha (a mesma do mockup). */
export const ORDEM_MODULOS: ModuloDaMissao[] = ["financas", "rotina", "saude", "treino", "dieta", "desenvolvimento", "hiperfoco", "estudos", "carreira", "biblioteca", "casa", "beleza", "viagens", "relacionamentos", "pet", "detox"];

export const MODULO_DA_AREA: Record<AreaKey, ModuloDaMissao> = { dinheiro: "financas", rotina: "rotina", corpo: "treino", saude: "saude", metas: "desenvolvimento" };
/**
 * Os companheiros da 1ª dose (16/10, 1.0.16): a área da porta SEMPRE primeiro (a escolha dela manda);
 * depois Finanças → Rotina → Saúde. Só "Treino e dieta" (corpo) puxa a Saúde pra 2ª dose: é o mesmo
 * assunto (corpo) e a dose de Saúde (1 copo d'água, 1 toque) é a que mais converte como 1ª/2ª
 * experiência (34% × 9% do Treino) — quem escolheu corpo não fica dois dias sem ver nada do corpo.
 */
const COMPANHEIROS: Partial<Record<AreaKey, ModuloDaMissao[]>> = { corpo: ["saude", "financas", "rotina"] };

export const ehModulo = (x: unknown): x is ModuloDaMissao => typeof x === "string" && x in MODULOS;

/** Os 3 padrão: a área da porta primeiro, depois Finanças → Rotina → Saúde (sem repetir). */
export function modulosPadrao(area: string | null | undefined): [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao] {
  const primeiro = area && area in MODULO_DA_AREA ? MODULO_DA_AREA[area as AreaKey] : null;
  const out: ModuloDaMissao[] = primeiro ? [primeiro] : [];
  const resto = (area && COMPANHEIROS[area as AreaKey]) || (["financas", "rotina", "saude"] as ModuloDaMissao[]);
  for (const m of resto) {
    if (out.length === 3) break;
    if (!out.includes(m)) out.push(m);
  }
  return out as [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao];
}

/**
 * O "MONTE O SEU MÓDULO" (1.0.16, regra final do dono, 17/10). O quiz curto que já deixa o módulo com a cara dela
 * só nasce como a 1ª DOSE da missão — e a 1ª dose é sempre a área que ela escolheu no funil (`modulosPadrao` põe a
 * área primeiro; "Tudo, sinceramente" já mora em dinheiro). Vale igual nos dois braços (A: dia 1; B: a 1ª das 3).
 * Abrir um módulo por conta própria NUNCA abre o quiz, e as outras doses (2ª e 3ª) são a dose guiada simples — ou
 * a continuação, se a introdução daquele módulo já foi feita.
 *   financas        → "Vamos montar suas Finanças" → 1º gasto guiado → o número cai → o MEU MÊS
 *   rotina          → "Rotina pronta em 3 toques" (ramo v1016-rotina) → "marca o primeiro"
 *   treino (corpo)  → "Escolher treino" (ramo v1016-cartoes): 2 perguntas → modelo → marca o 1º exercício
 *   desenvolvimento → a meta guiada de 1 toque da introdução do módulo (ramo v1016-cartoes)
 * Saúde (e qualquer outro) não tem quiz: a 1ª dose é a guiada simples. Quem encaixa cada um é o PassoDoDia.
 */
export type SetupDaDose = "montar-financas" | "montar-rotina" | "escolher-treino" | "meta-guiada";
export const SETUP_DO_MODULO: Partial<Record<ModuloDaMissao, SetupDaDose>> = {
  financas: "montar-financas", rotina: "montar-rotina", treino: "escolher-treino", desenvolvimento: "meta-guiada",
};
export const setupDaDose = (n: number, modulo: ModuloDaMissao, modo: "dose" | "aprofundar" = "dose"): SetupDaDose | null =>
  n === 1 && modo === "dose" ? SETUP_DO_MODULO[modulo] ?? null : null;

/* ------------------------------------------------------------------ o estado */

export type DiaDaMissao = 1 | 2 | 3;
export type Lembrete = "8h" | "12h" | "20h" | "sem";

export interface EstadoMissaoDoses {
  v: 1;
  /** o dia (local) em que a missão nasceu */
  inicio: string;
  modulos: [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao];
  /** o que já foi feito, por passo (1..3): o dia e o rótulo do registro ("Café · R$ 12") */
  feitos: Partial<Record<DiaDaMissao, { dia: string; rotulo: string; score?: number }>>;
  boasVindas: boolean;
  explorou?: boolean;
  lembrete?: Lembrete;
  /** "Pular" dentro do módulo: o dia em que pulou (o passo não volta sozinho naquele dia; o card oferece) */
  pulados?: Partial<Record<DiaDaMissao, string>>;
  fimVisto?: boolean;
  /** o score do dia na abertura (pra "ontem 20 → hoje 45" no final) */
  scoreNoInicio?: number;
  /* ── 10/10 (chave DIA1_CHEIO, desligada; lib/dia1-cheio) — todos opcionais: a missão de
     hoje lê e grava sem eles, e um estado antigo continua válido (lerMissao não os exige). ── */
  /** o braço do teste "dia 1 cheio" (cópia de core-dia1-braco; sobrevive ao logout junto com a missão) */
  braco?: BracoDia1;
  /** braço B: "Agora não" no meio das doses — o dia e a dose em que parou */
  agoraNao?: { dia: string; indice: DiaDaMissao };
  /** braço B: o plano de amanhã combinado na folha (vira a hora do Lembrete do dia 2) */
  planoAmanha?: PlanoAmanha;
  /** braço B: pulou a folha do plano neste dia (não insiste) */
  planoAmanhaPulado?: string;
  /** braço B: o dia em que as 3 doses ficaram feitas */
  completaEm?: string;
  /** braço B, dias 2 e 3 ("aprofundar"): por dia, os módulos em que já houve 1 uso real */
  aprofundados?: Record<string, ModuloDaMissao[]>;
  /** braço B (10/10): o 4º passo da missão = o tour da Home ("Arrumar sua Home"); `via` = "tour" | "sem_tour" (tour indisponível/já feito) */
  homeTour?: { dia: string; via: "tour" | "sem_tour" };
  /** 1.0.16, braço A (uma dose por dia): o convite "Dia N da missão" na Home, por dia — "foi" (tocou em
   *  fazer) ou "depois" (Agora não). 1x por dia: mora AQUI (chave `missao-doses`, que nenhuma vassoura leva). */
  convites?: Record<string, "foi" | "depois">;
  /** 1.0.16: quantas vezes o convite apareceu SEM decisão no dia (fechou o app com ele aberto): no 2º, chega por hoje */
  convitesVistos?: Record<string, number>;
  /** 1.0.16 (4.8): o DONO da missão — hash do id da conta (nunca o id). Outra conta no mesmo aparelho não herda. */
  dono?: string;
  /** 1.0.16 (17/10): o 1º gasto guiado depois do Montar está PENDENTE (a dose `n` já está gravada) — fechou o app no
   *  meio, a dose volta no passo do gasto ao reabrir no mesmo dia (retomadaDoGasto). Sai quando o gasto entra, ela
   *  pula, ou a comemoração aparece. */
  gastoGuiado?: { n: DiaDaMissao; dia: string; retomadas?: number };
  /** 1.0.16, braço A: "Sem lembrete" na folha do plano de amanhã (o dia) — não insiste */
  planoAPulado?: string;
  /** 1.0.16, braço A: as dicas de 1 balão dos dias 2 (score) e 3 (widgets), já mostradas (o dia) */
  dicas?: Partial<Record<2 | 3, string>>;
  /** 1.0.16: os adesivos que as comemorações das doses MOSTRARAM — ids REAIS do registro de Conquistas
   *  ("first-expense", "sequencia-2"…) ou a marca sem id ("marca:dia-1"). Só dado: quem dá o adesivo é o
   *  registro (a regra do próprio adesivo); a comemoração só mostra e marca como visto. */
  adesivosMostrados?: string[];
  /** 1.0.16, braço A: o score do dia quando a dose N abriu — a dica do dia 2 diz "foi de X pra Y" */
  scoreAntes?: Partial<Record<DiaDaMissao, number>>;
  /** 1.0.16, braço A: quem tocou "Explorar por conta própria" já saiu da Home uma vez (o tour curto entra na volta) */
  saiuDaHome?: boolean;
}

/**
 * 1.0.16 (4.8): o DONO da sessão — o hash da conta logada. Com ele definido, `lerMissao()` ignora a missão de
 * OUTRA conta deste aparelho, pra TODO mundo que lê a missão (Home, tour, Momentos, cartões, lembretes), não só
 * a orquestra. Quem define é a orquestra, a cada render com a conta (MissaoDosesNaWeb). Missão sem dono (a
 * de antes da 1.0.16) vale pra qualquer conta, como sempre.
 */
let donoDaSessao: string | undefined;
export function definirDonoDaMissao(userId: string | null | undefined): void { donoDaSessao = donoDaConta(userId); }

export function lerMissao(): EstadoMissaoDoses | null {
  try {
    const raw = ls.get(CHAVE_ESTADO_MISSAO_DOSES);
    if (!raw) return null;
    const m = JSON.parse(raw) as EstadoMissaoDoses;
    if (!m || m.v !== 1 || typeof m.inicio !== "string" || !Array.isArray(m.modulos) || m.modulos.length !== 3 || !m.modulos.every(ehModulo)) return null;
    if (m.dono && donoDaSessao && m.dono !== donoDaSessao) return null; // a missão é de outra conta deste aparelho
    return { feitos: {}, boasVindas: false, ...m };
  } catch { return null; }
}

/** O card da Home e a orquestra escutam este evento pra reler o estado (as duas moram em árvores diferentes). */
export const EVENTO_MISSAO_DOSES = "missao-doses:mudou";
/** O CustomEvent da janela quando as 3 doses ficam feitas (o tour da Home escuta). */
export const EVENTO_MISSAO_COMPLETA = "missao-doses:completa";
const avisar = () => { try { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); } catch { /* sem window */ } };

export function gravarMissao(m: EstadoMissaoDoses): EstadoMissaoDoses {
  ls.set(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(m));
  avisar();
  return m;
}

export function iniciarMissao(modulos: [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao], hoje: string = localDayKey(), scoreNoInicio?: number, braco?: BracoDia1 | null): EstadoMissaoDoses {
  // o braço só entra no estado quando existe (chave DIA1_CHEIO ligada): desligada, o JSON gravado é o de hoje
  return gravarMissao({ v: 1, inicio: hoje, modulos, feitos: {}, boasVindas: false, scoreNoInicio, ...(braco ? { braco } : {}) });
}

export const apagarMissao = (): void => { ls.del(CHAVE_ESTADO_MISSAO_DOSES); avisar(); };

/** 1.0.16 (4.8): a CÓPIA da missão na conta (useUserData) — reinstalar/trocar de aparelho restaura. */
export const CHAVE_MISSAO_NA_CONTA = "missao-doses-conta";

/** O dono da missão: FNV-1a do id da conta (o id nunca é gravado nem enviado). */
export function donoDaConta(userId: string | null | undefined): string | undefined {
  if (!userId) return undefined;
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) { h ^= userId.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** A missão do aparelho vale pra ESTA conta? (sem dono gravado = missão antiga: vale) */
export const missaoDaConta = (m: EstadoMissaoDoses | null, userId: string | null | undefined): boolean =>
  !!m && (!m.dono || !userId || m.dono === donoDaConta(userId));

/** Valida uma missão vinda de fora (a cópia da conta). */
export function missaoValida(x: unknown): EstadoMissaoDoses | null {
  const m = x as EstadoMissaoDoses | null;
  if (!m || typeof m !== "object" || m.v !== 1 || typeof m.inicio !== "string" || !Array.isArray(m.modulos) || m.modulos.length !== 3 || !m.modulos.every(ehModulo)) return null;
  return { ...m, feitos: m.feitos ?? {}, boasVindas: !!m.boasVindas };
}

/** O que cada dose pede, curto (boas-vindas, convite, lembretes): "1 hábito, 20 s". */
export const DOSE_CURTA: Record<ModuloDaMissao, { texto: string; seg: number }> = {
  financas: { texto: "monte em 30 s", seg: 30 },
  rotina: { texto: "1 hábito, 20 s", seg: 20 },
  saude: { texto: "1 copo d'água, 10 s", seg: 10 },
  treino: { texto: "escolhe um treino pronto, 20 s", seg: 20 },
  dieta: { texto: "1 refeição, 20 s", seg: 20 },
  desenvolvimento: { texto: "1 meta, 20 s", seg: 20 },
  hiperfoco: { texto: "1 pensamento, 20 s", seg: 20 },
  estudos: { texto: "1 matéria, 20 s", seg: 20 },
  carreira: { texto: "1 tarefa, 20 s", seg: 20 },
  biblioteca: { texto: "1 livro, 20 s", seg: 20 },
  casa: { texto: "1 item, 20 s", seg: 20 },
  beleza: { texto: "1 passo, 20 s", seg: 20 },
  viagens: { texto: "1 destino, 20 s", seg: 20 },
  relacionamentos: { texto: "1 pessoa, 20 s", seg: 20 },
  pet: { texto: "o seu pet, 20 s", seg: 20 },
  detox: { texto: "1 hábito, 20 s", seg: 20 },
};

/**
 * Um evento de medição da missão em doses. Na web continua `prototipo: "web"` (a
 * série de 02/10 não muda); no app leva `prototipo: "app"`, a plataforma e a
 * versão do build — é o que separa a turma da 1.0.10 da da 1.0.9 nas consultas
 * (voltou no dia 2, dias de uso na 1ª semana).
 */
export const eventoDaMissao = (dados: Record<string, unknown> = {}): Record<string, unknown> => {
  const base = isNativeShell()
    ? { ...dados, prototipo: "app", plataforma: plataformaApp(), versao: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev" }
    : { ...dados, prototipo: "web" };
  // 10/10 (DIA1_CHEIO): com a chave ligada TODO evento da missão leva o braço — é por `variante`
  // que o teste se lê. Desligada, o payload é o de hoje, campo a campo.
  // 1.0.16: + `braco` legível ("um_por_dia" = A, "dia1_cheio" = B) e o modo remoto `missao_1_por_dia`.
  // 1.0.16: + `dia_cal` (o dia do CALENDÁRIO da missão: 1 = o dia em que nasceu) — "fez dose no dia 2+"
  const variante = varianteDia1();
  if (!variante) return base;
  let diaCal: number | null = null;
  let missaoId: string | null = null;
  try { const m = lerMissao(); diaCal = m ? diaDaMissao(m) : null; missaoId = m ? idDaMissao(m) : null; } catch { diaCal = null; }
  return { dia_cal: diaCal, missao_id: missaoId, ...base, variante, braco: variante === "A" ? "um_por_dia" : "dia1_cheio", missao_1_por_dia: modoUmPorDia() };
};
/** 1.0.16: um id estável da missão nos eventos (o hash da conta que já mora no estado + o dia em que ela nasceu) —
 *  junta o funil Montar → 1º gasto → olha → festa (montar_financas_* com origem "missao" e missao_doses_*). Sem
 *  e-mail nem id da conta: o `dono` é o hash FNV que a missão já guarda. */
export const idDaMissao = (m: EstadoMissaoDoses): string => `${m.dono ?? "anon"}-${m.inicio}`;
/** Os campos da missão pra quem é chamado POR ela (o Montar com origem "missao"): o braço, o id, o dia. */
export function camposDaMissaoNosEventos(): Record<string, unknown> {
  try {
    const e = eventoDaMissao();
    const m = lerMissao();
    return { ...(e.variante ? { variante: e.variante, braco: e.braco, missao_id: e.missao_id, dia_cal: e.dia_cal } : {}), ...(m ? { missao_modulo_1: m.modulos[0] } : {}) };
  } catch { return {}; }
}

/** O braço desta pessoa pros eventos (só com a chave DIA1_CHEIO ligada), ou null. */
export function varianteDia1(): BracoDia1 | null {
  if (!dia1CheioLigado()) return null;
  return lerMissao()?.braco ?? bracoFixo() ?? bracoGravado();
}

/** A missão está no braço B ("dia 1 cheio")? Com a chave desligada, nunca — mesmo que o braço tenha ficado gravado. */
export const ehBracoB = (m: EstadoMissaoDoses | null): boolean => !!m && dia1CheioLigado() && m.braco === "B";

/**
 * 1.0.16 — BRAÇO A = UMA DOSE POR DIA (metadata `missao_1_por_dia`, lib/dia1-cheio). Com a chave
 * desligada (braço null, a missão da 1.0.10) nada muda — nem com um "A" que ficou gravado.
 */
export const ehUmPorDia = (m: EstadoMissaoDoses | null): boolean => !!m && dia1CheioLigado() && m.braco === "A";

/** A dose de hoje está liberada? No braço A só UMA por dia local (nenhuma feita hoje); nos outros, sempre. */
export function doseLiberadaHoje(m: EstadoMissaoDoses, hoje: string = localDayKey()): boolean {
  if (!ehUmPorDia(m)) return true;
  return !([1, 2, 3] as DiaDaMissao[]).some((n) => m.feitos[n]?.dia === hoje);
}

/**
 * Braço A, reabriu num dia NOVO (dia ≥ 2 da missão): o convite "Dia N da missão · <módulo>" na Home
 * está devendo? 1x por dia (convites[hoje]); nunca pra quem escolheu "Explorar por conta própria",
 * nunca com a dose de hoje feita, pulada hoje, ou a missão cumprida.
 */
export function conviteDoDiaDevido(m: EstadoMissaoDoses | null, hoje: string = localDayKey()): boolean {
  if (!doseDeHojeDevida(m, hoje)) return false;
  if (diaDaMissao(m!, hoje) < 2) return false;
  if (m!.convites?.[hoje]) return false;
  // fechou o app com o convite aberto, sem decidir: mostra de novo 1 vez naquele dia; depois, só amanhã
  return (m!.convitesVistos?.[hoje] ?? 0) < 2;
}

/** A missão do braço A para no 7º dia do calendário (ou com as 3 doses). */
export const DIA_FIM_DA_MISSAO = 7;

/**
 * Braço A: há uma dose PRA HOJE ainda não feita? (a linha "Dose de hoje" nas Pendências, o convite,
 * o passo no módulo). Nunca pra quem escolheu "Explorar", depois do 7º dia, pulada hoje ou já feita hoje.
 */
export function doseDeHojeDevida(m: EstadoMissaoDoses | null, hoje: string = localDayKey()): boolean {
  if (!m || !ehUmPorDia(m) || !m.boasVindas || m.explorou) return false;
  if (missaoCumprida(m) || !doseLiberadaHoje(m, hoje)) return false;
  if (diaDaMissao(m, hoje) > DIA_FIM_DA_MISSAO) return false;
  const p = passoPendente(m);
  return !!p && m.pulados?.[p.n] !== hoje;
}

/** Braço A: a dose pode abrir hoje no módulo? (liberada e dentro dos 7 dias; nos outros braços, sempre) */
export function doseAbreHoje(m: EstadoMissaoDoses, hoje: string = localDayKey()): boolean {
  if (!ehUmPorDia(m)) return true;
  return doseLiberadaHoje(m, hoje) && diaDaMissao(m, hoje) <= DIA_FIM_DA_MISSAO;
}

/**
 * Braço A, dia 1: a folha "Amanhã a gente monta sua Rotina em 20 s. Que horas te lembro?" está devendo?
 * Depois da dose de hoje (e do tour curto, quem chama confere), 1x: some com a hora escolhida ou "Sem lembrete".
 */
export function precisaPlanoA(m: EstadoMissaoDoses | null, hoje: string = localDayKey()): boolean {
  if (!m || !ehUmPorDia(m) || !m.boasVindas || m.explorou || missaoCumprida(m)) return false;
  if (m.lembrete !== undefined || m.planoAPulado) return false;
  return ([1, 2, 3] as DiaDaMissao[]).some((n) => m.feitos[n]?.dia === hoje);
}

/** Dias seguidos (até hoje) com dose feita — a sequência da missão (a do hub, por registro, pode ser maior). */
export function sequenciaDaMissao(m: EstadoMissaoDoses, hoje: string = localDayKey()): number {
  const dias = new Set(Object.values(m.feitos).map((f) => f?.dia).filter(Boolean) as string[]);
  let n = 0;
  let cursor = hoje;
  while (dias.has(cursor) && n < 60) { n += 1; cursor = somarDias(cursor, -1); }
  return n;
}

/** Quantas doses já foram feitas (1..3). */
export const dosesFeitas = (m: EstadoMissaoDoses): number => ([1, 2, 3] as DiaDaMissao[]).filter((n) => m.feitos[n]).length;

/** Braço B: a missão do dia 1 tem 4 passos (3 doses + "Arrumar sua Home"); A tem 3. */
export const TOTAL_PASSOS_B = 4;
export const totalDePassos = (m: EstadoMissaoDoses | null): number => (ehBracoB(m) ? TOTAL_PASSOS_B : 3);
/** Passos feitos contando o 4º (B). */
export const passosFeitos = (m: EstadoMissaoDoses): number => dosesFeitas(m) + (ehBracoB(m) && m.homeTour ? 1 : 0);
/** Braço B: as 3 doses feitas e o tour da Home ainda por fazer (o 4º passo). */
export const passoHomePendente = (m: EstadoMissaoDoses | null): boolean => !!m && ehBracoB(m) && missaoCumprida(m) && !m.homeTour;
/** A missão inteira feita: A = 3 doses; B = 3 doses + o tour da Home. */
export const missaoCompleta = (m: EstadoMissaoDoses): boolean => missaoCumprida(m) && (!ehBracoB(m) || !!m.homeTour);

/**
 * Braço B — a folha do plano de amanhã ("O CORE te avisa do que importa… que horas te
 * lembro amanhã?") está devendo? É a ÚLTIMA coisa do dia 1: depois do 4º passo (tour da
 * Home → festa "Casa arrumada") ou depois de um "Agora não" no meio das doses.
 */
export function precisaPlanoAmanha(m: EstadoMissaoDoses, hoje: string = localDayKey()): boolean {
  if (!ehBracoB(m) || !m.boasVindas) return false;
  if (m.planoAmanha || m.planoAmanhaPulado === hoje) return false;
  if (diaDaMissao(m, hoje) !== 1) return false;
  return missaoCompleta(m) || m.agoraNao?.dia === hoje;
}

/**
 * A MISSÃO DO DIA 1 ESTÁ EM CENA? — os adesivos dos Momentos esperam (ficam na fila, sem virar "vistos").
 *   · braço B: do começo até a folha do plano de amanhã decidida (ela é o fim do dia 1);
 *   · braço A (1.0.16): as boas-vindas; e, com a dose de hoje feita, até o "Plano de amanhã" decidido — a
 *     sequência do dia 1 é dose → comemoração → tour curto → plano, e uma comemoração só por dose (desenho 8,
 *     4.4). Dose de hoje ainda não feita e nada da missão na tela (ela foi explorar): não segura nada. A dose
 *     na tela já segura sozinha (o atributo da faixa / da dose — Momentos.outraTelaAberta).
 * Quem pulou ("Explorar") libera na hora.
 */
export function missaoDoDiaEmCena(m: EstadoMissaoDoses | null, hoje: string = localDayKey()): boolean {
  if (!m || m.explorou) return false;
  if (ehUmPorDia(m)) {
    if (!m.boasVindas) return true;
    if (diaDaMissao(m, hoje) !== 1) return false;
    const fezHoje = ([1, 2, 3] as DiaDaMissao[]).some((n) => m.feitos[n]?.dia === hoje);
    return fezHoje && m.lembrete === undefined && !m.planoAPulado;
  }
  if (!ehBracoB(m)) return false;
  if (diaDaMissao(m, hoje) !== 1) return false;
  return !(m.planoAmanha || m.planoAmanhaPulado === hoje);
}

/**
 * 1.0.16 — O MÓDULO DA DOSE DE HOJE (contrato com Conquistas e com os cartões dos módulos): a dose que
 * pode abrir hoje e ainda não foi feita; senão a que foi feita HOJE; senão null (sem missão, boas-vindas
 * ainda na tela, "Explorar por conta própria", depois do 7º dia no braço A, ou nada pra hoje).
 * Estável: só lê a missão do aparelho (`missao-doses`), nunca grava.
 */
export function moduloDaMissaoHoje(hoje: string = localDayKey()): ModuloDaMissao | null {
  try {
    const m = lerMissao();
    if (!m || !m.boasVindas || m.explorou) return null;
    const pendente = passoPendente(m);
    if (pendente && doseAbreHoje(m, hoje) && m.pulados?.[pendente.n] !== hoje) return pendente.modulo;
    const feitaHoje = ([3, 2, 1] as DiaDaMissao[]).find((n) => m.feitos[n]?.dia === hoje);
    return feitaHoje ? m.modulos[feitaHoje - 1] : null;
  } catch { return null; }
}

/**
 * 1.0.16 — A INTRODUÇÃO DO MÓDULO JÁ FOI FEITA? (contrato com o ramo da introdução dos módulos, v1016-cartoes)
 * No braço A, quem abre Rotina ou Saúde no dia 1 por curiosidade ganha a 1ª ação guiada daquele módulo (o mesmo
 * anel/post-it das doses), gravada no aparelho em `core-intro-vista-<módulo>` e na conta em `core-intro-vistas`
 * (lista de ids). A dose daquele módulo nos dias 2–3 não repete a 1ª ação: vira CONTINUAÇÃO (Rotina: marcar o
 * hábito de hoje; Saúde: mais 1 copo, sem perguntar a meta de novo; Finanças: o gasto de hoje, sem o Montar).
 * Aquele ramo exporta `introConcluida(modulo)` em src/lib/intro-modulo.ts — que ainda não existe aqui: este
 * leitor lê as MESMAS chaves direto, pra valer antes e depois do merge (dá pra trocar por ele depois).
 */
export const PREFIXO_INTRO_VISTA = "core-intro-vista-";
export const CHAVE_INTRO_VISTAS_CONTA = "core-intro-vistas";
export function introDoModuloConcluida(modulo: string, get?: <T>(k: string, f: T) => T): boolean {
  try {
    if (ls.get(`core-intro-vista-${modulo}`)) return true;
    const daConta = get?.<unknown>(CHAVE_INTRO_VISTAS_CONTA, null);
    return Array.isArray(daConta) && daConta.includes(modulo);
  } catch { return false; }
}

/**
 * 1.0.16 — DOSE NA TELA (contrato com Conquistas e com os cartões dos módulos): enquanto QUALQUER peça da
 * dose está montada (a faixa, o "Vamos montar suas Finanças" da missão, o anel/post-it, a comemoração),
 * `<html data-missao-dose="1">`. Toast, popup de adesivo e cartão de boas-vindas do módulo ficam quietos.
 */
export const ATRIBUTO_DOSE_NA_TELA = "data-missao-dose";
let dosesNaTela = 0;
/** A peça da dose montou; devolve o "desmontou" (contagem: duas peças juntas não apagam o atributo uma da outra). */
export function marcarDoseNaTela(): () => void {
  dosesNaTela += 1;
  try { document.documentElement.setAttribute(ATRIBUTO_DOSE_NA_TELA, "1"); } catch { /* sem document */ }
  let feito = false;
  return () => {
    if (feito) return;
    feito = true;
    dosesNaTela = Math.max(0, dosesNaTela - 1);
    if (!dosesNaTela) { try { document.documentElement.removeAttribute(ATRIBUTO_DOSE_NA_TELA); } catch { /* sem document */ } }
  };
}
/** Alguma peça da dose está na tela agora? */
export const doseNaTela = (): boolean => { try { return document.documentElement.getAttribute(ATRIBUTO_DOSE_NA_TELA) === "1"; } catch { return false; } };

/**
 * Braço B, dias 2 e 3 ("aprofundar"): o módulo da missão em que ainda não houve 1 uso real
 * HOJE, ao entrar nele — ou null (fora dos dias 2–3, missão incompleta, módulo já aprofundado hoje).
 */
export function aprofundarPendente(m: EstadoMissaoDoses, rota: string, hoje: string = localDayKey()): { n: DiaDaMissao; modulo: ModuloDaMissao } | null {
  if (!ehBracoB(m) || !missaoCumprida(m)) return null;
  const dia = diaDaMissao(m, hoje);
  if (dia < 2 || dia > 3) return null;
  const feitosHoje = m.aprofundados?.[hoje] ?? [];
  for (const n of [1, 2, 3] as DiaDaMissao[]) {
    const modulo = m.modulos[n - 1];
    if (rota.startsWith(MODULOS[modulo].rota) && !feitosHoje.includes(modulo)) return { n, modulo };
  }
  return null;
}

/**
 * PONTO DE ENCAIXE DO TOUR DA HOME (10/10, pra quem fizer o tour): enquanto isto é true a
 * missão (ou a folha do plano de amanhã, ou "O que você construiu") ainda tem tela pra
 * mostrar — o tour deve ESPERAR. Reler ao evento EVENTO_MISSAO_DOSES (e ao `missao_completa`).
 */
/**
 * 1.0.16 (dono, 17/10 — "foca no primeiro passo de Finanças"; 67 saíram do app no meio do "anota 1 gasto"): o app
 * foi fechado/morto DEPOIS do Montar e ANTES do 1º gasto → reabrindo no MESMO dia, a dose volta direto no passo do
 * gasto, com os chips prontos. O Montar nunca recomeça (já está decidido e a dose, gravada). No máximo 2 retomadas
 * (a 3ª abertura sem o gasto é a Home de sempre); num dia novo, nada.
 */
export const MAX_RETOMADAS_DO_GASTO = 2;
export function retomadaDoGasto(m: EstadoMissaoDoses | null, hoje: string = localDayKey()): { n: DiaDaMissao; retomadas: number } | null {
  const g = m?.gastoGuiado;
  if (!m || !g || g.dia !== hoje || !m.feitos[g.n] || m.modulos[g.n - 1] !== "financas") return null;
  const retomadas = g.retomadas ?? 0;
  return retomadas < MAX_RETOMADAS_DO_GASTO ? { n: g.n, retomadas } : null;
}
export function missaoEmAndamento(m: EstadoMissaoDoses | null, hoje: string = localDayKey()): boolean {
  if (!m) return false;
  if (!m.boasVindas) return true;
  // o 1º gasto depois do Montar ficou no meio: a missão volta nele antes de qualquer tour/folha
  if (retomadaDoGasto(m, hoje)) return true;
  if (precisaPlanoAmanha(m, hoje)) return true;
  const dia = diaDaMissao(m, hoje);
  // 1.0.16, braço A: a dose de hoje já foi → a missão volta amanhã (o tour e os adesivos podem entrar);
  // num dia novo, o convite "Dia N da missão" é a tela que falta
  if (ehUmPorDia(m) && !missaoCumprida(m)) {
    if (!doseLiberadaHoje(m, hoje)) return false;
    if (dia >= 2) return conviteDoDiaDevido(m, hoje);
  }
  // dose por fazer no dia 1 (não pulada hoje; no B, "Agora não" encerra a sessão — a Home é da pessoa)
  if (!missaoCumprida(m)) return dia === 1 && m.pulados?.[passoPendente(m)?.n ?? 1] !== hoje && !(ehBracoB(m) && m.agoraNao?.dia === hoje);
  // B: as 3 doses feitas e o tour por fazer = o tour É o passo 4 (deveMostrarTourHome deixa passar: não é "em andamento")
  if (passoHomePendente(m)) return false;
  return !m.fimVisto && (!ehBracoB(m) || dia >= 3);
}

/** O dia da missão em que a pessoa está (1 = o dia em que nasceu), pelo relógio dela — ou pelo QA. */
export function diaDaMissao(m: EstadoMissaoDoses, hoje: string = localDayKey()): number {
  const qa = diaDeQa();
  if (qa) return qa;
  let d = 1;
  // conta em dias locais (sem fuso): quantos "amanhãs" desde o início
  let cursor = m.inicio;
  while (cursor < hoje && d < 60) { cursor = somarDias(cursor, 1); d += 1; }
  return d;
}

/** O próximo passo por fazer (1..3), ou null = missão cumprida. */
export function passoPendente(m: EstadoMissaoDoses): { n: DiaDaMissao; modulo: ModuloDaMissao } | null {
  for (const n of [1, 2, 3] as DiaDaMissao[]) {
    if (!m.feitos[n]) return { n, modulo: m.modulos[n - 1] };
  }
  return null;
}

export const missaoCumprida = (m: EstadoMissaoDoses): boolean => !!(m.feitos[1] && m.feitos[2] && m.feitos[3]);

/** O rótulo do passo n no card/boas-vindas, dado o dia de hoje: "HOJE", "AMANHÃ", "DIA 3", "ONTEM"… */
export function rotuloDoPasso(n: DiaDaMissao, m: EstadoMissaoDoses, hoje: string = localDayKey()): string {
  const feito = m.feitos[n];
  if (feito) return feito.dia === hoje ? "HOJE" : feito.dia === somarDias(hoje, -1) ? "ONTEM" : `DIA ${n}`;
  const dia = diaDaMissao(m, hoje);
  // por fazer: o de hoje (ou atrasado) é HOJE; o seguinte ao relógio é AMANHÃ; o resto, DIA n
  if (n <= dia) return "HOJE";
  if (n === dia + 1) return "AMANHÃ";
  return `DIA ${n}`;
}

/** O nome do dia da semana pro passo n (o calendário real da missão). */
export function diaDaSemanaDoPasso(n: DiaDaMissao, m: EstadoMissaoDoses, hoje: string = localDayKey()): string {
  const dia = diaDaMissao(m, hoje);
  const data = somarDias(hoje, n - dia);
  const d = new Date(`${data}T12:00:00`);
  const nome = d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** O que a pessoa fez no passo: "Café · R$ 12" / "Meditar marcado". */
export const rotuloDoFeito = (m: EstadoMissaoDoses, n: DiaDaMissao): string | null => m.feitos[n]?.rotulo ?? null;

export const HORAS_DO_LEMBRETE: Array<{ id: Lembrete; rotulo: string }> = [
  { id: "8h", rotulo: "8h" }, { id: "12h", rotulo: "12h" }, { id: "20h", rotulo: "20h" }, { id: "sem", rotulo: "sem aviso" },
];
