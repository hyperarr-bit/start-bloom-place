/**
 * AS AÇÕES DE 1 TOQUE DO ESTADO VAZIO (intro do módulo, 16/10) — funções puras.
 *
 * Cada uma recebe o `get`/`gravar` da conta e escreve conteúdo DE VERDADE no formato que o
 * módulo já lê (a mesma forma que o próprio módulo grava quando a pessoa digita), pra o
 * módulo abrir com algo dentro em vez de uma tela em branco. Nenhuma inventa dado pessoal:
 * o que entra é um começo editável (3 itens no mercado, um modelo de treino, uma meta pronta),
 * ou o que a pessoa escolheu num chip (o café de hoje, o curso, o livro, o que quer largar).
 *
 * Quem chama (EstadoVazio) grava com `set` + `avisarEscritaDeFora` — a tela do módulo guarda a
 * chave num usePersistedState e precisa ver a escrita na hora. Aqui só se decide O QUE gravar.
 */
import { CATEGORIAS_PADRAO_MERCADO, type CategoriaMercado } from "@/lib/mercado";
import { MODELOS, aplicarModelo } from "@/lib/treino-plano";
import { gravacoesDoItem } from "@/lib/demo-guiada-registro";
import { normalizarItem } from "@/lib/demo-guiada";
import { CHAVE_TAREFAS_CARREIRA, type TarefaDoDia } from "@/lib/tarefas";
import { localDayKey } from "@/lib/utils";

export type Leitor = <T>(chave: string, reserva: T) => T;
export type Gravador = (chave: string, valor: unknown) => void;
export interface ContextoDaAcao {
  get: Leitor;
  gravar: Gravador;
  /** só testes: o "hoje" fixo */
  hoje?: Date;
}

const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
/** O nome do dia da semana como os módulos gravam (Dieta, Treino, Rotina). */
export const diaDaSemana = (d: Date = new Date()): string => DIAS[(d.getDay() + 6) % 7];
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const id = (sufixo: string) => `intro-${Date.now().toString(36)}-${sufixo}`;

/* ───── Casa › Mercado: leite, pão e café ───── */
export const ITENS_DO_MERCADO: Array<{ categoria: string; texto: string }> = [
  { categoria: "3", texto: "Leite" }, // Laticínios e Frios
  { categoria: "5", texto: "Pão" }, // Padaria
  { categoria: "4", texto: "Café" }, // Mercearia
];
export function comecarMercado({ get, gravar }: ContextoDaAcao): void {
  const atual = get<unknown>("casa-grocery-categories", CATEGORIAS_PADRAO_MERCADO);
  const cats: CategoriaMercado[] = Array.isArray(atual) && atual.length ? (atual as CategoriaMercado[]) : CATEGORIAS_PADRAO_MERCADO;
  const agora = Date.now();
  const proximo = cats.map((c) => {
    const novos = ITENS_DO_MERCADO.filter((i) => i.categoria === c.id && !(c.items ?? []).some((x) => x.text.toLowerCase() === i.texto.toLowerCase()));
    return novos.length ? { ...c, items: [...(c.items ?? []), ...novos.map((i, k) => ({ id: `${agora + k}-${i.categoria}`, text: i.texto, done: false }))] } : c;
  });
  gravar("casa-grocery-categories", proximo);
}

/* ───── Treino: o modelo "Full Body 3x" (3 dias, corpo todo — o mais fácil de manter) ───── */
export const MODELO_DA_INTRO = "Full Body 3x";
export function montarTreino({ get, gravar }: ContextoDaAcao): void {
  const modelo = MODELOS.find((m) => m.name === MODELO_DA_INTRO) ?? MODELOS[MODELOS.length - 1];
  const r = aplicarModelo(mapa(get<unknown>("saude-workouts-v2", {})) as Parameters<typeof aplicarModelo>[0], modelo);
  gravar("saude-workouts-v2", r.plano);
  gravar("treino-active-days", r.diasAtivos);
}

/* ───── Dieta: o café da manhã de hoje, no cardápio ───── */
export const CAFE_DA_MANHA = "Café da Manhã";
const REFEICOES_PADRAO = ["Café da Manhã", "Almoço", "Lanche", "Janta"];
export function anotarCafeDaManha({ get, gravar, hoje }: ContextoDaAcao, texto: string): void {
  const dia = diaDaSemana(hoje);
  const refeicoes = lista(get<unknown>("dieta-meals-config", REFEICOES_PADRAO)).filter((r): r is string => typeof r === "string");
  const plano = mapa(get<unknown>("saude-meals", {}));
  const doDia = { ...Object.fromEntries((refeicoes.length ? refeicoes : REFEICOES_PADRAO).map((r) => [r, ""])), ...mapa(plano[dia]) };
  gravar("saude-meals", { ...plano, [dia]: { ...doDia, [CAFE_DA_MANHA]: texto } });
}

/* ───── Estudos: um curso em andamento ───── */
export function adicionarCurso({ get, gravar }: ContextoDaAcao, nome: string): void {
  const cursos = lista(get<unknown>("estudos-cursos-andamento", []));
  if (cursos.some((c) => String(mapa(c).name ?? "").trim().toLowerCase() === nome.trim().toLowerCase())) return;
  gravar("estudos-cursos-andamento", [...cursos, { id: id("curso"), name: nome.trim() }]);
}

/* ───── Biblioteca: um livro "lendo" (a mesma forma do livro novo da estante) ───── */
export function adicionarLivro({ get, gravar, hoje }: ContextoDaAcao, livro: { titulo: string; autor: string }): void {
  const livros = lista(get<unknown>("lib-books", []));
  if (livros.some((l) => String(mapa(l).title ?? "").trim().toLowerCase() === livro.titulo.toLowerCase())) return;
  gravar("lib-books", [...livros, {
    id: id("livro"), title: livro.titulo, author: livro.autor, cover: "", status: "lendo", rating: 0, genre: "", pages: 0, currentPage: 0,
    notes: "", startDate: localDayKey(hoje ?? new Date()), endDate: "", goalDate: "", quotes: [], lentTo: "", lentDate: "", lentReturnDate: "",
  }]);
}

/* ───── Desenvolvimento › Metas: a meta nasce com as duas etapas do quadro (a forma da emptyGoal) ───── */
export function criarMeta({ get, gravar, hoje }: ContextoDaAcao, nome: string): void {
  const item = normalizarItem({ tipo: "meta", nome });
  if (!item) return;
  for (const g of gravacoesDoItem(item, hoje ?? new Date(), "conta")) {
    const proximo = g.proximo(get<unknown>(g.chave, undefined));
    if (proximo !== undefined) gravar(g.chave, proximo);
  }
}

/* ───── Carreira › Meu Dia: uma tarefa do trabalho pra hoje ───── */
export function anotarTarefaDoTrabalho({ get, gravar, hoje }: ContextoDaAcao, texto: string): void {
  const tarefas = lista(get<unknown>(CHAVE_TAREFAS_CARREIRA, [])) as TarefaDoDia[];
  const dia = localDayKey(hoje ?? new Date());
  if (tarefas.some((t) => t && t.dia === dia && String(t.texto ?? "").trim().toLowerCase() === texto.trim().toLowerCase())) return;
  gravar(CHAVE_TAREFAS_CARREIRA, [...tarefas, { id: id("tarefa"), texto: texto.trim(), feito: false, dia }]);
}

/* ───── Detox: o que a pessoa quer largar, contando a partir de hoje ───── */
export function comecarDetox({ get, gravar, hoje }: ContextoDaAcao, habito: { nome: string; icone: string }): void {
  const habitos = lista(get<unknown>("detox-habits", []));
  if (habitos.some((h) => String(mapa(h).name ?? "").trim().toLowerCase() === habito.nome.toLowerCase())) return;
  const dia = localDayKey(hoje ?? new Date());
  gravar("detox-habits", [...habitos, { id: id("detox"), name: habito.nome, icon: habito.icone, startDate: dia, createdAt: dia, relapses: [], record: 0, checkins: [] }]);
}
