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
 * DESLIGADO POR PADRÃO: `MISSAO_DOSES = "off"` = o app de hoje, byte a byte
 * (nenhum card, nenhuma faixa, nenhum evento novo — travado em
 * src/test/missao-doses.test.tsx). Só web: no app das lojas (isNativeShell) a
 * chave é ignorada nesta etapa. QA sem mexer em ninguém, como o Funil B:
 *   · `?missao-doses=on` liga só neste navegador (`off` força desligado,
 *     `auto` desfaz, `recomecar` apaga a missão deste navegador e segue ligado);
 *   · `?missao-doses-dia=1|2|3` simula o dia da missão (`auto` volta ao
 *     relógio) — pra ver os 3 dias sem esperar.
 * O estado da missão mora no localStorage deste navegador (como a Missão do
 * iPhone, `core-missao`): nada vai pro servidor além dos REGISTROS que os
 * chips gravam — esses são dados de verdade da conta, pelo mesmo `set` que o
 * módulo usa.
 */
import { isNativeShell } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import type { AreaKey } from "@/lib/funnel";
import type { TipoDoItem } from "@/lib/demo-guiada";

export type ModoMissaoDoses = "off" | "on";
export const MISSAO_DOSES: ModoMissaoDoses = "off";

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

/** A missão em doses está ligada NESTE navegador? Nativo: nunca (nesta etapa). Força de QA > chave. */
export function missaoDosesLigada(modo: ModoMissaoDoses = MISSAO_DOSES): boolean {
  if (isNativeShell()) return false;
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
  financas: { modulo: "financas", nome: "Finanças", emoji: "💰", rota: "/financas", onde: "nas suas Finanças", cor: "#FFF4C2", tipo: "gasto", pedido: "Toca em 1 gasto de hoje", toque: "1 gasto", chaves: ["finance-expenses"], seletor: '[data-spotlight="add-expense"]', olhar: { titulo: "Esse painel soma sozinho", texto: "Cada gasto que você toca entra na linha de cima e o mês soma sozinho — é daí que sai quanto dá pra gastar hoje." } },
  rotina: { modulo: "rotina", nome: "Rotina", emoji: "📅", rota: "/rotina", onde: "na sua Rotina", cor: "#FFE4EC", tipo: "habito", pedido: "Marca 1 hábito no quadradinho", toque: "1 hábito", chaves: ["rotina-habits-checked", "rotina-habits"], seletor: '[data-spotlight="add-habit"]', olhar: { titulo: "A linha da semana", texto: "Cada quadradinho marcado vira um dia na sua sequência — a semana inteira cabe num olhar." } },
  saude: { modulo: "saude", nome: "Saúde", emoji: "❤️", rota: "/saude", onde: "na sua Saúde", cor: "#FFE1E1", tipo: "agua", pedido: "Marca 1 copo d'água", toque: "1 copo", chaves: ["core-saude-water"], seletor: '[data-spotlight="add-water"]', olhar: { titulo: "O copo que contou", texto: "Cada copo entra na meta do dia — e o CORE te lembra de bater ela." } },
  treino: { modulo: "treino", nome: "Treino", emoji: "🏋️", rota: "/treino", onde: "no seu Treino", cor: "#E3ECFF", tipo: "exercicio", pedido: "Anota 1 exercício", toque: "1 exercício", chaves: ["saude-workouts-v2"], seletor: '[data-spotlight="add-exercise"]', olhar: { titulo: "O seu treino da semana", texto: "O exercício entra no dia de hoje; anota a carga de cada série e vê a evolução." } },
  dieta: { modulo: "dieta", nome: "Dieta", emoji: "🥗", rota: "/dieta", onde: "na sua Dieta", cor: "#E2F7E6", pedido: "Marca 1 refeição de hoje", toque: "1 refeição", chaves: ["saude-meals", "dieta-diary"], olhar: { titulo: "O seu dia na dieta", texto: "Cada refeição marcada fecha o dia — o CORE mostra o que falta." } },
  desenvolvimento: { modulo: "desenvolvimento", nome: "Metas", emoji: "🎯", rota: "/desenvolvimento", onde: "nas suas Metas", cor: "#EEE6FF", tipo: "meta", pedido: "Escolhe 1 meta sua", toque: "1 meta", chaves: ["goals-board-v2"], seletor: '[data-spotlight="add-goal"]', olhar: { titulo: "A meta com plano", texto: "A meta ganha passos; cada passo feito aparece aqui." } },
  hiperfoco: { modulo: "hiperfoco", nome: "Hiperfoco", emoji: "🧠", rota: "/hiperfoco", onde: "no seu Hiperfoco", cor: "#DFF1FF", pedido: "Anota 1 pensamento", toque: "1 pensamento", chaves: ["hiperfoco-thoughts", "mente-dreams"], olhar: { titulo: "A mente no papel", texto: "O que está na cabeça vai pro papel — e sai da cabeça." } },
  estudos: { modulo: "estudos", nome: "Estudos", emoji: "📚", rota: "/estudos", onde: "nos seus Estudos", cor: "#FFF4C2", pedido: "Anota 1 matéria", toque: "1 matéria", chaves: ["estudos-subjects", "estudos-aprendizados", "estudos-pomodoro-count"], olhar: { titulo: "A sua grade", texto: "A matéria entra na grade; revisões e provas ficam no lugar." } },
  carreira: { modulo: "carreira", nome: "Carreira", emoji: "💼", rota: "/carreira", onde: "na sua Carreira", cor: "#EDEFF3", pedido: "Anota 1 tarefa do dia", toque: "1 tarefa", chaves: ["career-day-tasks", "career-skills"], olhar: { titulo: "O seu dia de trabalho", texto: "As fases do dia e as tarefas ficam no mesmo lugar." } },
  biblioteca: { modulo: "biblioteca", nome: "Biblioteca", emoji: "📖", rota: "/biblioteca", onde: "na sua Biblioteca", cor: "#FFE9D6", pedido: "Marca 1 página lida", toque: "1 página", chaves: ["lib-books", "lib-read-log"], olhar: { titulo: "A sua estante", texto: "Cada página marcada avança a barra do livro." } },
  casa: { modulo: "casa", nome: "Casa", emoji: "🏠", rota: "/casa", onde: "na sua Casa", cor: "#E6F8D9", pedido: "Anota 1 item da compra", toque: "1 item", chaves: ["casa-shopping-list", "casa-maint-tasks"], olhar: { titulo: "A lista da casa", texto: "O item entra na lista; no mercado, é só marcar." } },
  beleza: { modulo: "beleza", nome: "Beleza", emoji: "💄", rota: "/beleza", onde: "na sua Beleza", cor: "#FFE4F1", pedido: "Marca 1 passo do skincare", toque: "1 passo", chaves: ["skincare-morning-checked", "skincare-night-checked", "skincare-daily-checkin"], olhar: { titulo: "A rotina de hoje", texto: "Cada passo marcado fecha a rotina da manhã ou da noite." } },
  viagens: { modulo: "viagens", nome: "Viagens", emoji: "✈️", rota: "/viagens", onde: "nas suas Viagens", cor: "#E3E8FF", pedido: "Anota 1 destino", toque: "1 destino", chaves: ["travel-bucket"], olhar: { titulo: "A sua lista de destinos", texto: "O destino entra na lista; depois vem o roteiro e a mala." } },
  relacionamentos: { modulo: "relacionamentos", nome: "Relações", emoji: "💞", rota: "/relacionamentos", onde: "nas suas Relações", cor: "#FFE1E7", pedido: "Anota 1 pessoa", toque: "1 pessoa", chaves: ["rel-people", "rel-dates", "rel-moments"], olhar: { titulo: "As pessoas que importam", texto: "Datas e momentos ficam ligados à pessoa." } },
  pet: { modulo: "pet", nome: "Pet", emoji: "🐾", rota: "/pet", onde: "no seu Pet", cor: "#FFF4C2", pedido: "Marca 1 cuidado do pet", toque: "1 cuidado", chaves: ["pet-cuidados", "pet-list", "pet-diary"], olhar: { titulo: "A agenda do pet", texto: "Vacina, banho, remédio: cada cuidado marcado entra na agenda." } },
  detox: { modulo: "detox", nome: "Detox", emoji: "📵", rota: "/detox", onde: "no seu Detox", cor: "#EDEFF3", pedido: "Marca 1 hábito de detox", toque: "1 hábito", chaves: ["detox-habits", "detox-diary"], olhar: { titulo: "Menos tela, mais presença", texto: "Cada hábito marcado é um pedaço do dia de volta." } },
};

/** A ordem da grade de escolha (a mesma do mockup). */
export const ORDEM_MODULOS: ModuloDaMissao[] = ["financas", "rotina", "saude", "treino", "dieta", "desenvolvimento", "hiperfoco", "estudos", "carreira", "biblioteca", "casa", "beleza", "viagens", "relacionamentos", "pet", "detox"];

export const MODULO_DA_AREA: Record<AreaKey, ModuloDaMissao> = { dinheiro: "financas", rotina: "rotina", corpo: "treino", saude: "saude", metas: "desenvolvimento" };

export const ehModulo = (x: unknown): x is ModuloDaMissao => typeof x === "string" && x in MODULOS;

/** Os 3 padrão: a área da porta primeiro, depois Finanças → Rotina → Saúde (sem repetir). */
export function modulosPadrao(area: string | null | undefined): [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao] {
  const primeiro = area && area in MODULO_DA_AREA ? MODULO_DA_AREA[area as AreaKey] : null;
  const out: ModuloDaMissao[] = primeiro ? [primeiro] : [];
  for (const m of ["financas", "rotina", "saude"] as ModuloDaMissao[]) {
    if (out.length === 3) break;
    if (!out.includes(m)) out.push(m);
  }
  return out as [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao];
}

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
}

export function lerMissao(): EstadoMissaoDoses | null {
  try {
    const raw = ls.get(CHAVE_ESTADO_MISSAO_DOSES);
    if (!raw) return null;
    const m = JSON.parse(raw) as EstadoMissaoDoses;
    if (!m || m.v !== 1 || typeof m.inicio !== "string" || !Array.isArray(m.modulos) || m.modulos.length !== 3 || !m.modulos.every(ehModulo)) return null;
    return { feitos: {}, boasVindas: false, ...m };
  } catch { return null; }
}

/** O card da Home e a orquestra escutam este evento pra reler o estado (as duas moram em árvores diferentes). */
export const EVENTO_MISSAO_DOSES = "missao-doses:mudou";
const avisar = () => { try { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); } catch { /* sem window */ } };

export function gravarMissao(m: EstadoMissaoDoses): EstadoMissaoDoses {
  ls.set(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(m));
  avisar();
  return m;
}

export function iniciarMissao(modulos: [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao], hoje: string = localDayKey(), scoreNoInicio?: number): EstadoMissaoDoses {
  return gravarMissao({ v: 1, inicio: hoje, modulos, feitos: {}, boasVindas: false, scoreNoInicio });
}

export const apagarMissao = (): void => { ls.del(CHAVE_ESTADO_MISSAO_DOSES); avisar(); };

/** Um evento de medição da missão em doses (todos levam `prototipo: "web"` nesta etapa). */
export const eventoDaMissao = (dados: Record<string, unknown> = {}): Record<string, unknown> => ({ ...dados, prototipo: "web" });

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
