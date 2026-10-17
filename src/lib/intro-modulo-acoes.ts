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
import { EXERCICIOS_POR_GRUPO, MODELOS, aplicarModelo, exercicioDaSugestao, exercicioNovo, exerciciosDoModelo } from "@/lib/treino-plano";
import type { ExercicioDoPlano } from "@/lib/treino-series";
import { CHAVE_PASSOS, CHAVE_PERFIL, gerarRotina, type PerfilDaPele, type TipoDePele } from "@/lib/beleza-rotina";
import { CHAVE_PESSOAS, COMECO_PRONTO, type SugestaoDeInicio } from "@/lib/relacoes";
import { CHAVE_PETS, chaveTarefasDoPet, rotinaPadraoDe } from "@/lib/pet";
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

/** 1 TOQUE = 1 item (17/10, padrão da Saúde): o chip grava só o que ela escolheu, na categoria certa. */
export function anotarItemDoMercado({ get, gravar }: ContextoDaAcao, texto: string): void {
  const item = ITENS_DO_MERCADO.find((i) => i.texto.toLowerCase() === texto.trim().toLowerCase()) ?? { categoria: "4", texto: texto.trim() };
  const atual = get<unknown>("casa-grocery-categories", CATEGORIAS_PADRAO_MERCADO);
  const cats: CategoriaMercado[] = Array.isArray(atual) && atual.length ? (atual as CategoriaMercado[]) : CATEGORIAS_PADRAO_MERCADO;
  const destino = cats.find((c) => c.id === item.categoria) ?? cats[0];
  if (!destino || (destino.items ?? []).some((x) => x.text.toLowerCase() === item.texto.toLowerCase())) return;
  gravar("casa-grocery-categories", cats.map((c) => (c === destino ? { ...c, items: [...(c.items ?? []), { id: `${Date.now()}-${c.id}`, text: item.texto, done: false }] } : c)));
}

/* ───── Casa › Cômodos: 1 tarefa típica no cômodo que ela escolheu (dado 17/10: abrir um cômodo é a ação #1 da Casa na
 * 1ª semana — Cozinha 9% da coorte; a lista do mercado nem entra no top 6). Os cômodos padrão do módulo nascem junto. */
export const COMODOS_DA_INTRO: Array<{ id: string; emoji: string; rotulo: string; comodo: string; tarefa: string }> = [
  { id: "cozinha", emoji: "🍳", rotulo: "Cozinha", comodo: "COZINHA", tarefa: "Lavar a louça" },
  { id: "quarto", emoji: "🛏️", rotulo: "Quarto", comodo: "QUARTO", tarefa: "Arrumar a cama" },
  { id: "banheiro", emoji: "🚿", rotulo: "Banheiro", comodo: "BANHEIRO", tarefa: "Limpar o box" },
];
const COMODOS_PADRAO = [
  { id: "1", name: "COZINHA", color: "bg-yellow-200 dark:bg-yellow-900/40", tasks: [] }, { id: "2", name: "SALA", color: "bg-blue-200 dark:bg-blue-900/40", tasks: [] },
  { id: "3", name: "QUARTO", color: "bg-purple-200 dark:bg-purple-900/40", tasks: [] }, { id: "4", name: "BANHEIRO", color: "bg-cyan-200 dark:bg-cyan-900/40", tasks: [] },
  { id: "5", name: "ÁREA DE SERVIÇO", color: "bg-green-200 dark:bg-green-900/40", tasks: [] }, { id: "6", name: "ESCRITÓRIO", color: "bg-orange-200 dark:bg-orange-900/40", tasks: [] },
];
export function anotarTarefaDoComodo({ get, gravar }: ContextoDaAcao, id: string): string {
  const c = COMODOS_DA_INTRO.find((x) => x.id === id) ?? COMODOS_DA_INTRO[0];
  const atual = lista(get<unknown>("casa-rooms", []));
  const rooms = (atual.length ? atual : COMODOS_PADRAO) as Array<{ id: string; name: string; tasks: Array<{ id: string; text: string; done: boolean }> }>;
  const alvo = rooms.find((r) => String(r.name ?? "").toUpperCase() === c.comodo) ?? rooms[0];
  if (!alvo) return c.tarefa;
  const tarefas = lista(alvo.tasks) as Array<{ id: string; text: string; done: boolean }>;
  if (tarefas.some((t) => String(t.text ?? "").trim().toLowerCase() === c.tarefa.toLowerCase())) return c.tarefa;
  gravar("casa-rooms", rooms.map((r) => (r === alvo ? { ...r, tasks: [...tarefas, { id: `${Date.now()}`, text: c.tarefa, done: false }] } : r)));
  return `${c.tarefa} (${c.rotulo})`;
}

/* ───── Treino: um modelo pronto (o EscolherTreino da missão escolhe qual; padrão "Full Body 3x", o mais fácil de manter) ───── */
export const MODELO_DA_INTRO = "Full Body 3x";
export function montarTreino({ get, gravar }: ContextoDaAcao, nomeDoModelo: string = MODELO_DA_INTRO): { nome: string; diasAtivos: string[] } {
  const modelo = MODELOS.find((m) => m.name === nomeDoModelo) ?? MODELOS.find((m) => m.name === MODELO_DA_INTRO) ?? MODELOS[MODELOS.length - 1];
  const r = aplicarModelo(mapa(get<unknown>("saude-workouts-v2", {})) as Parameters<typeof aplicarModelo>[0], modelo);
  gravar("saude-workouts-v2", r.plano);
  gravar("treino-active-days", r.diasAtivos);
  return { nome: modelo.name, diasAtivos: r.diasAtivos };
}
/** As 2 perguntas do EscolherTreino → o modelo EXISTENTE que casa (sem modelo "em casa" na lista: Full Body, com aviso). */
export type OndeTreina = "academia" | "casa";
export type DiasPorSemana = "2-3" | "4" | "5-6";
export function modeloPara(onde: OndeTreina, dias: DiasPorSemana): { nome: string; aviso?: string } {
  if (onde === "casa") return { nome: "Full Body 3x", aviso: "Os exercícios são de academia: troca pelos que dá pra fazer em casa (o nome é só tocar)." };
  if (dias === "4") return { nome: "Upper / Lower" };
  if (dias === "5-6") return { nome: "Push / Pull / Legs" };
  return { nome: "Full Body 3x" };
}

/* ───── Treino: O TREINO DE HOJE em 1 toque (17/10, dono: "tipo Rotina, mais completo") ─────
 * O chip monta o dia de HOJE no plano real (saude-workouts-v2[dia] com os grupos e 5 exercícios de academia, ou a
 * lista de casa / a corrida) e deixa hoje como dia de treino — a aba HOJE abre com o treino pronto, série por série. */
export type TreinoDeHoje = "peito_triceps" | "costas_biceps" | "pernas" | "em_casa" | "corrida";
export const TREINOS_DE_HOJE: Array<{ id: TreinoDeHoje; emoji: string; rotulo: string; musculos: string[]; exercicios?: () => ExercicioDoPlano[] }> = [
  { id: "peito_triceps", emoji: "🏋️", rotulo: "Peito e tríceps", musculos: ["Peito", "Tríceps"] },
  { id: "costas_biceps", emoji: "💪", rotulo: "Costas e bíceps", musculos: ["Costas", "Bíceps"] },
  { id: "pernas", emoji: "🦵", rotulo: "Pernas", musculos: ["Pernas"] },
  // em casa: sem máquina — os 5 que dá pra fazer no chão da sala (o resto do catálogo é de academia)
  { id: "em_casa", emoji: "🏠", rotulo: "Em casa", musculos: ["Full Body"], exercicios: () => [
    exercicioDaSugestao(EXERCICIOS_POR_GRUPO.Peito.find((e) => e.name === "Flexão de braço")!),
    exercicioNovo("Agachamento livre", { sets: "3", reps: "15" }),
    exercicioNovo("Afundo", { sets: "3", reps: "10" }),
    exercicioDaSugestao(EXERCICIOS_POR_GRUPO["Abdômen"].find((e) => e.name === "Prancha")!),
    exercicioNovo("Abdominal supra", { sets: "3", reps: "20" }),
  ] },
  { id: "corrida", emoji: "🏃", rotulo: "Corrida", musculos: ["Cardio"], exercicios: () => [exercicioNovo("Corrida", { tipo: "cardio", duracao: "20" })] },
];
export function montarTreinoDeHoje({ get, gravar, hoje }: ContextoDaAcao, id: TreinoDeHoje): { rotulo: string; dia: string; exercicios: number } {
  const t = TREINOS_DE_HOJE.find((x) => x.id === id) ?? TREINOS_DE_HOJE[0];
  const dia = diaDaSemana(hoje);
  const plano = mapa(get<unknown>("saude-workouts-v2", {}));
  const atual = mapa(plano[dia]);
  // dia que JÁ tem exercício fica com os dele (como o aplicarModelo faz); vazio ganha o treino do chip
  const existentes = lista(atual.exercises) as ExercicioDoPlano[];
  const exercicios = existentes.length ? existentes : (t.exercicios ? t.exercicios() : exerciciosDoModelo(t.musculos));
  gravar("saude-workouts-v2", { ...plano, [dia]: { ...atual, muscles: t.musculos, exercises: exercicios } });
  const ativos = lista(get<unknown>("treino-active-days", ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"])).filter((d): d is string => typeof d === "string");
  if (!ativos.includes(dia)) gravar("treino-active-days", [...ativos, dia]);
  return { rotulo: t.rotulo, dia, exercicios: exercicios.length };
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
export function adicionarLivro({ get, gravar, hoje }: ContextoDaAcao, livro: { titulo: string; autor: string; capa?: string }): void {
  const livros = lista(get<unknown>("lib-books", []));
  if (livros.some((l) => String(mapa(l).title ?? "").trim().toLowerCase() === livro.titulo.toLowerCase())) return;
  gravar("lib-books", [...livros, {
    id: id("livro"), title: livro.titulo, author: livro.autor, cover: livro.capa ?? "", status: "lendo", rating: 0, genre: "", pages: 0, currentPage: 0,
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

/* ───── Mente: um pensamento na hora de agora (o formato da linha do tempo: {dia: {hora: [pensamento]}}) ───── */
export function anotarPensamento({ get, gravar, hoje }: ContextoDaAcao, texto: string): void {
  const agora = hoje ?? new Date();
  const dia = localDayKey(agora);
  const hora = agora.getHours();
  const tudo = mapa(get<unknown>("hiperfoco-thoughts", {}));
  const doDia = mapa(tudo[dia]);
  const daHora = lista(doDia[hora]);
  if (daHora.some((t) => String(mapa(t).text ?? "").trim().toLowerCase() === texto.trim().toLowerCase())) return;
  gravar("hiperfoco-thoughts", { ...tudo, [dia]: { ...doDia, [hora]: [...daHora, { id: id("pensamento"), text: texto.trim(), tags: [], hour: hora }] } });
}

/* ───── Viagens: um destino na lista (o formato do BucketList) ───── */
export const DESTINOS_DA_INTRO: Record<string, { name: string; country: string; continent: string }> = {
  nordeste: { name: "Praia no Nordeste", country: "Brasil", continent: "América do Sul" },
  gramado: { name: "Gramado", country: "Brasil", continent: "América do Sul" },
  europa: { name: "Europa", country: "", continent: "Europa" },
};
export function anotarDestino({ get, gravar }: ContextoDaAcao, destino: { name: string; country: string; continent: string }): void {
  const lista_ = lista(get<unknown>("travel-bucket", []));
  if (lista_.some((d) => String(mapa(d).name ?? "").trim().toLowerCase() === destino.name.toLowerCase())) return;
  gravar("travel-bucket", [...lista_, { id: id("destino"), name: destino.name, country: destino.country, continent: destino.continent, notes: "", visited: false, rating: 0, photoUrl: "", priority: "sonho" }]);
}

/* ───── Beleza: o skincare nasce pro tipo de pele dela (o mesmo gerador das 3 perguntas; objetivo básico, nível iniciante) ───── */
export function montarSkincare({ get, gravar }: ContextoDaAcao, pele: TipoDePele): { passos: number } {
  const perfil: PerfilDaPele = { pele, objetivo: "basico", nivel: "iniciante" };
  const evitar = lista(get<unknown>("skincare-triggers", [])).filter((x): x is string => typeof x === "string");
  const r = gerarRotina(perfil, evitar);
  const manha = lista(get<unknown>(CHAVE_PASSOS.manha, []));
  const noite = lista(get<unknown>(CHAVE_PASSOS.noite, []));
  if (!manha.length) gravar(CHAVE_PASSOS.manha, r.manha);
  if (!noite.length) gravar(CHAVE_PASSOS.noite, r.noite);
  gravar(CHAVE_PERFIL, { ...mapa(get<unknown>(CHAVE_PERFIL, {})), ...perfil });
  return { passos: (manha.length ? manha.length : r.manha.length) + (noite.length ? noite.length : r.noite.length) };
}

/* ───── Relações: uma pessoa do começo pronto (o formato de rel-people; o nome ela completa na ficha) ───── */
export function adicionarPessoaDoComeco({ get, gravar }: ContextoDaAcao, sugestaoId: string): string {
  const s: SugestaoDeInicio = COMECO_PRONTO.find((x) => x.id === sugestaoId) ?? COMECO_PRONTO[0];
  const pessoas = lista(get<unknown>(CHAVE_PESSOAS, []));
  const nome = s.nome || s.rotulo;
  if (pessoas.some((p) => String(mapa(p).relation ?? "").trim().toLowerCase() === s.relation.toLowerCase())) return nome;
  gravar(CHAVE_PESSOAS, [...pessoas, { id: id("pessoa"), name: nome, relation: s.relation, birthday: "", notes: "", circulo: s.circulo }]);
  return nome;
}

/* ───── Pet: o pet nasce pela espécie, com a rotina padrão dela (o nome ela troca na ficha) ───── */
export const PETS_DA_INTRO: Array<{ id: "cao" | "gato" | "outro"; emoji: string; rotulo: string; nome: string; species: string }> = [
  { id: "cao", emoji: "🐶", rotulo: "Cachorro", nome: "Meu cachorro", species: "Cachorro" },
  { id: "gato", emoji: "🐱", rotulo: "Gato", nome: "Meu gato", species: "Gato" },
  { id: "outro", emoji: "🐾", rotulo: "Outro bicho", nome: "Meu pet", species: "Pet" },
];
export function cadastrarPet({ get, gravar }: ContextoDaAcao, especie: "cao" | "gato" | "outro"): string {
  const p = PETS_DA_INTRO.find((x) => x.id === especie) ?? PETS_DA_INTRO[0];
  const pets = lista(get<unknown>(CHAVE_PETS, []));
  if (pets.length) return String(mapa(pets[0]).name ?? p.nome);
  const petId = id("pet");
  gravar(CHAVE_PETS, [{ id: petId, name: p.nome, species: p.species, breed: "", weight: "", birthday: "", faixa: "adulto", criadoEm: new Date().toISOString() }]);
  gravar(chaveTarefasDoPet(petId), rotinaPadraoDe(especie));
  return p.nome;
}
