import { type Badge, type BadgeCategoria, type Raridade, XP_RARIDADE } from "./types";
import { chaveArquivada } from "@/lib/virada-do-mes";
import { medirVida, recordeDeSequencia } from "./badges-vida";
import { CHAVE_ACOES_CONQUISTAS, mapa, itens, texto, numero, diaValido } from "@/lib/conquistas-acoes";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { segundaDe } from "@/lib/treino-constancia";
import { normalizarNome, seriesDaEntrada } from "@/lib/treino-series";
import { recordesDoMes } from "@/lib/treino-evolucao";

export type LeitorCatalogo = <T>(chave: string, padrao: T) => T;
/** Conceitos retirados na curadoria aprovada. Conquistados ficam nas memórias, com o XP original. */
export const IDS_ARQUIVADOS = new Set([
  "multi-income", "budget-master", "saver-40", "investor-10k", "investor-50k", "investor-100k", "diversified",
  "rotina-7", "rotina-60", "dieta-7", "dieta-30", "agua-30", "agua-100", "remedio-7", "medidas-4", "pet-7",
]);
export interface ConceitoNovo {
  id: string; nome: string; descricao: string; categoria: BadgeCategoria; raridade: Raridade;
  alvo: number; medida: string; cena: string; rota?: string;
}
const c = (id: string, nome: string, descricao: string, categoria: BadgeCategoria, medida: string, cena: string, alvo = 1, raridade: Raridade = "comum", rota?: string): ConceitoNovo => ({id, nome, descricao, categoria, medida, cena, alvo, raridade, rota});
/** União dos DOIS planos. Os 20 conceitos iniciais continuam, sem duplicar Do meu jeito / limites. */
export const NOVAS_CONQUISTAS: ConceitoNovo[] = [
  c("foco-1", "Minha bolha", "Conclua sua primeira sessão de foco", "rotina", "foco", "Woman in headphones comfortably sitting inside a transparent soap bubble, open notebook on knees."),
  c("diario-1", "Página minha", "Escreva seu primeiro registro no diário", "rotina", "diario", "Close-up of an adult hand writing in an open notebook, sleeve and a single red bookmark."),
  c("humor-1", "Como eu tô", "Registre seu humor pela primeira vez", "rotina", "humor", "Young man looking into a small hand mirror, quiet thoughtful expression, tiny red heart on mirror handle."),
  c("foco-3", "Foco de novo", "Conclua sessões de foco em 3 dias diferentes", "rotina", "diasFoco", "Woman with a messy bun at a compact desk, red desk lamp, focused side profile.", 3, "raro"),
  c("habito-criado", "Do meu jeito", "Crie um hábito e marque-o como feito", "rotina", "habitoCriado", "Person in red overalls carefully adjusting one small sun-shaped gear with a wrench."),
  c("leitura-primeira", "Primeira página", "Marque seu primeiro dia de leitura", "leitura", "leitura", "Person peeking delightedly around the edge of a large open book, only nose eyes and hands visible."),
  c("leitura-nota", "Entrelinhas", "Guarde uma anotação ou citação de um livro", "leitura", "notaLivro", "Hand drawing a red underline in a tiny open book, underline becoming a little ribbon."),
  c("leitura-3", "Leitura de cabeceira", "Marque leitura em 3 dias diferentes", "leitura", "leitura", "Cozy bedside table with red reading lamp, book and eyeglasses, no character.", 3, "raro"),
  c("sono-1", "Boa noite", "Registre sua primeira noite de sono", "saude", "sono", "Young woman asleep under a red patchwork blanket hugging a pillow, side view, minimal peaceful face."),
  c("agua-3", "Mais um gole", "Registre água em 3 dias diferentes", "saude", "agua", "Hand pouring water from a red striped jug into a clear glass, beautiful curved water arc.", 3),
  c("receita-3", "Receita da casa", "Guarde 3 receitas suas", "dieta", "receitas", "Recipe notebook tied with a red ribbon, wooden spoon slipped under the ribbon.", 3, "raro"),
  c("dieta-plano", "Antes da fome", "Personalize seu primeiro plano de refeições", "dieta", "planoRefeicoes", "Person seen from above arranging three simple containers into a lunch box, red cloth beneath."),
  c("finance-limite", "Até aqui", "Defina seu primeiro limite de gastos por categoria", "finance", "limite", "Woman drawing a bold red line in front of a tiny shopping cart with an oversized pencil."),
  c("viagem-plano", "Mala de ideias", "Salve o planejamento de uma viagem", "vida", "viagem", "Open small suitcase with a folded paper map lifting like a sail and a red luggage tag.", 1, "comum", "/viagens"),
  c("momento-1", "Primeira lembrança", "Guarde seu primeiro momento", "vida", "momentos", "Two hands holding a small instant photo of a sunset with a single red sun.", 1, "comum", "/relacionamentos"),
  c("meta-passo", "Passo dado", "Crie e preencha uma etapa de uma meta", "vida", "passo", "Person stepping onto the first stair of a folded paper staircase, red shoe.", 1, "comum", "/desenvolvimento"),
  c("estudos-revisao-5", "De cabeça", "Responda 5 revisões dos estudos", "vida", "revisoes", "Student balancing a tiny red light bulb on top of a stack of flashcards, playful confident face.", 5, "raro", "/estudos"),
  c("detox-1", "Desconectei", "Faça seu primeiro registro no diário do detox", "vida", "detox", "Phone resting face down, a tiny paper hammock attached to it with a person relaxing.", 1, "comum", "/detox"),
  c("retorno", "Volta por cima", "Volte a registrar depois de 7 dias sem anotações", "sequencia", "retorno", "A young adult vaulting a gently curved red ribbon like a low hurdle, energetic side silhouette."),
  c("mes-20", "Meu mês em páginas", "Anote algo em 20 dias de um mesmo mês", "sequencia", "diasMes", "A small notebook fanning open into a circular paper flower, red stitched spine.", 20, "epico"),
  c("treino-plano", "Plano de ataque", "Monte ou personalize seu plano de treino", "treino", "planoTreino", "Overhead view of athlete drawing a plan on a workout clipboard, red wrist wrap, one dumbbell nearby."),
  c("treino-completo", "Missão cumprida", "Conclua todas as séries previstas de uma sessão", "treino", "completo", "Athletic woman slumped happily on a gym bench, red towel over head, satisfied relaxed posture."),
  c("treino-nota", "Diário de treino", "Salve uma anotação de uma sessão de treino", "treino", "notaTreino", "Slim athletic man sitting cross-legged on floor writing on a small notebook resting on one knee, red sneakers."),
  c("treino-carga", "Um passo acima", "Conclua uma série com mais carga que numa sessão anterior do mesmo exercício", "treino", "carga", "Athletic woman stepping onto a short stack of weight plates as stairs, one red plate, strong clean silhouette.", 1, "raro"),
  c("treino-semana", "Semana cumprida", "Alcance sua meta semanal de treinos", "treino", "semanaTreino", "Pair of gym sneakers resting on a workout card with small checkmarks, red laces.", 1, "raro"),
  c("treino-7", "Peguei o ritmo", "Registre treinos em 7 dias diferentes", "treino", "treinos", "Athletic man casually entering a simple gym doorway, red duffel bag on shoulder, rear three-quarter view.", 7, "raro"),
  c("tarefa-1", "Tirei da cabeça", "Crie sua primeira tarefa de hoje", "rotina", "tarefa", "Woman gently pulling a tangled red thread from above her head onto a small paper list, clever minimal visual metaphor."),
  c("tarefa-feita", "Resolvido", "Conclua sua primeira tarefa de hoje", "rotina", "tarefaFeita", "A tiny person sitting astride a large red pencil as it draws a single big check mark."),
  c("compromisso-1", "Hora marcada", "Cadastre um compromisso com data e horário", "rotina", "compromisso", "Hand pinning a red thumbtack onto a little standing desk calendar, elegant close-up."),
  c("urgencia-feita", "Prioridade resolvida", "Cadastre e conclua uma urgência", "rotina", "urgencia", "Person extinguishing a tiny red flame on a task note using a little teacup of water."),
  c("contador-3", "No meu ritmo", "Use um contador da rotina em 3 dias diferentes", "rotina", "contador", "Person turning a small mechanical tally counter crank, red handle, playful side view.", 3),
  c("rotina-semana", "Semana organizada", "Personalize sua agenda e marque hábitos em 3 dias da mesma semana", "rotina", "semanaRotina", "A week planner folded like a paper accordion with a red pencil threaded through it.", 3, "raro"),
  c("rotina-revisao", "Olhei pra semana", "Escreva sua primeira reflexão na revisão semanal", "rotina", "revisaoSemana", "Person sitting backwards on a chair looking over a small winding paper path, red scarf."),
  c("finance-conta", "Primeira conta paga", "Marque sua primeira conta como paga", "finance", "contaPaga", "A paper receipt folded into a deckchair with a tiny person relaxing on it, red sunglasses."),
  c("finance-3", "De olho nas contas", "Registre movimentações em 3 dias diferentes", "finance", "diasFinancas", "Young man examining a long receipt with a magnifying glass, red sweater cuff.", 3),
  c("saude-remedio", "Cuidado anotado", "Cadastre seu primeiro medicamento", "saude", "remedio", "Hands placing a small medicine box with a red stripe beside a neat handwritten care note, no pills scattered."),
  c("saude-log", "Saúde no papel", "Registre uma consulta ou exame no log médico", "saude", "medico", "Woman holding a small medical folder against her chest, red tab, warm calm face."),
  c("dieta-refeicao", "À mesa", "Registre sua primeira refeição", "dieta", "refeicoes", "Top view of a simple plate with rice vegetables and a fork, red gingham napkin, minimal details."),
  c("dieta-semana", "Minha semana à mesa", "Registre sua alimentação nos 7 dias de uma semana", "dieta", "semanaDieta", "Person proudly carrying a red tray with a compact row of simple lunch boxes.", 7, "raro"),
  c("dieta-jejum", "Meu intervalo", "Use o registro de jejum pela primeira vez", "dieta", "jejum", "A small kitchen timer beside a folded red napkin and empty clean plate, calm still life."),
  c("carreira-candidatura", "Me coloquei no jogo", "Registre sua primeira candidatura", "carreira", "candidatura", "Young woman sending a paper airplane made from a resume, red sleeve, determined three-quarter profile."),
  c("carreira-projeto", "Feito por mim", "Adicione seu primeiro projeto ao portfólio", "carreira", "projeto", "Young man proudly holding a tiny handmade architectural model, red roof, square glasses."),
  c("carreira-ensaio", "Ensaio geral", "Escreva uma resposta e marque-a como praticada na preparação de entrevista", "carreira", "ensaio", "Woman rehearsing in front of a small standing mirror holding cue cards, red headband."),
  c("acao-rapida", "Num toque", "Conclua sua primeira ação rápida", "geral", "rapida", "Close-up fingertip pressing a small red button that releases one drawn four-point star."),
  c("treino-25", "Força de vontade", "Registre treinos em 25 dias diferentes", "treino", "treinos", "Athletic man adjusting teal wrist wraps beside a barbell, navy tank top. Reuses the original Máquina illustration.", 25, "raro"),
];

const diasRegistro = (v: unknown, ok: (x: any) => boolean, hoje: string) => Object.entries(mapa(v)).filter(([d, x]) => diaValido(d) && d <= hoje && ok(x)).map(([d]) => d);
const datasLista = (v: unknown, hoje: string) => [...new Set((Array.isArray(v) ? v : []).filter(d => diaValido(d) && d <= hoje))] as string[];
const maxGrupo = (dias: string[], chave: (d: string) => string) => {
  const g: Record<string, number> = {};
  for (const d of new Set(dias)) { const k = chave(d); g[k] = (g[k] ?? 0) + 1; }
  return Math.max(0, ...Object.values(g));
};
const semana = (d: string) => localDayKey(segundaDe(parseLocalDay(d)));

export function medirCaderno(get: LeitorCatalogo, hoje = localDayKey()): Record<string, number> {
  const vida = medirVida(get, hoje);
  const acoes = mapa(get(CHAVE_ACOES_CONQUISTAS, {}));
  const acao = (k: string) => datasLista(acoes[k], hoje).length;
  const lerLista = (k: string) => itens(get(k, []));
  const habitos = mapa(get("rotina-habit-log", {}));
  const diasHabitos = diasRegistro(habitos, v => Array.isArray(v) && v.some(texto), hoje);
  const livros = lerLista("lib-books");
  const diasAgua = new Set(["water-log", "core-saude-water"].flatMap(k => diasRegistro(get(k, {}), v => numero(v) > 0, hoje)));
  const diasSono = new Set(["sleep-log", "core-saude-sleep"].flatMap(k => diasRegistro(get(k, {}), v => numero(v) > 0 && numero(v) <= 24, hoje)));
  const dietaDias = new Set([
    ...diasRegistro(get("dieta-diary-v2", {}), v => Object.values(mapa(v?.meals)).some((m: any) => typeof m?.followed === "boolean" || texto(m?.note)), hoje),
    ...diasRegistro(get("core-dieta-log", {}), v => Object.values(mapa(v)).some(x => x && typeof x === "object"), hoje),
  ]);
  const historico = lerLista("treino-exercise-history").filter(h => diaValido(h.date) && h.date <= hoje && h.tipo !== "cardio");
  const porExercicio = new Map<string, Map<string, number>>();
  for (const h of historico) {
    if (!texto(h.exercise)) continue;
    const nome = normalizarNome(h.exercise);
    const cargas = seriesDaEntrada(h).filter(s => s.reps > 0).map(s => s.carga);
    if (!cargas.length) continue;
    const ds = porExercicio.get(nome) ?? new Map<string, number>();
    ds.set(h.date, Math.max(ds.get(h.date) ?? 0, ...cargas)); porExercicio.set(nome, ds);
  }
  const carga = [...porExercicio.values()].some(ds => {
    let anterior: number | undefined;
    return [...ds.entries()].sort(([a], [b]) => a.localeCompare(b)).some(([,v]) => { const subiu = anterior !== undefined && v > anterior; anterior = v; return subiu; });
  });
  const treinos = datasLista(get("saude-workout-log", []), hoje);
  const dias = datasLista(get("core-dias-anotados", []), hoje).sort();
  const retorno = dias.some((d, i) => i > 0 && (parseLocalDay(d).getTime() - parseLocalDay(dias[i - 1]).getTime()) / 864e5 >= 8);
  const limites = mapa(get("finance-category-budgets", {}));
  const limitesPJ = mapa(get("finance-category-budgets-perfis", {}));
  const tarefas = lerLista("rotina-day-tasks").filter(t => texto(t.texto));
  const despesas = [...lerLista("finance-expenses"), ...lerLista("finance-incomes")];
  // A virada do mês move os lançamentos; o progresso continua atravessando meses.
  const referencia = parseLocalDay(hoje);
  for (let i = 1; i <= 24; i++) {
    const mes = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    despesas.push(...lerLista(chaveArquivada(mes.getFullYear(), mes.getMonth(), "expenses")), ...lerLista(chaveArquivada(mes.getFullYear(), mes.getMonth(), "incomes")));
  }
  const viagem = mapa(get("travel-trips-v2", {}));
  const metas = lerLista("goals-board-v2");
  return {
    foco: numero(get("pomodoro-total-focus", 0)) > 0 ? 1 : 0,
    diasFoco: diasRegistro(get("pomodoro-log", {}), v => numero(v) > 0, hoje).length,
    diario: vida.diasDeDiario, humor: vida.diasDeHumor,
    habitoCriado: Object.keys(acoes).some(k => k.startsWith("habito:") && acao(k) && diasHabitos.some(d => habitos[d].includes(k.slice(7)))) ? 1 : 0,
    habitos: diasHabitos.length, recordeHabitos: recordeDeSequencia(diasHabitos),
    leitura: datasLista(get("lib-read-log", []), hoje).length,
    notaLivro: livros.filter(b => texto(b.notes) || itens(b.quotes).some(q => texto(q.text))).length,
    sono: diasSono.size, agua: diasAgua.size, receitas: lerLista("dieta-recipes-v2").filter(r => texto(r.name)).length,
    planoRefeicoes: acao("plano-refeicoes"), limite: [...Object.values(limites), ...Object.values(limitesPJ).flatMap(p => Object.values(mapa(p)))].some(v => numero(v) > 0) ? 1 : 0,
    viagem: [...itens(viagem.trips), mapa(get("travel-budget-v2", {}))].filter(t => texto(t.destination)).length,
    momentos: lerLista("rel-moments").length,
    passo: metas.filter(g => itens(g.actionGroups).some(col => itens(col.tasks).some(t => texto(t.title) || texto(t.text)))) .length,
    revisoes: Object.values(mapa(get("estudos-revisoes", {}))).reduce((s, r) => s + Math.max(0, Math.floor(numero(r?.vezes))), 0), detox: vida.diasDeDetox, retorno: retorno ? 1 : 0, diasMes: maxGrupo(dias, d => d.slice(0,7)),
    planoTreino: acao("plano-treino"), completo: acao("treino-completo"),
    notaTreino: Object.values(mapa(get("treino-notas-sessoes", {}))).filter(texto).length,
    carga: carga ? 1 : 0,
    recorde: [...new Set(historico.map(h => h.date.slice(0, 7)))].some(m => recordesDoMes(historico, Number(m.slice(0,4)), Number(m.slice(5,7)) - 1).length > 0) ? 1 : 0,
    semanaTreino: maxGrupo(treinos, semana) >= vida.metaSemanal ? 1 : 0, treinos: treinos.length,
    tarefa: tarefas.length, tarefaFeita: tarefas.filter(t => t.feito === true).length,
    compromisso: lerLista("rotina-compromissos").filter(c => texto(c.titulo) && diaValido(c.data) && /^\d{2}:\d{2}$/.test(c.hora ?? "")).length,
    urgencia: lerLista("rotina-urgencies").filter(u => texto(u.text) && u.done === true).length,
    contador: new Set(lerLista("rotina-day-phases").flatMap(f => diasRegistro(f.counts, v => numero(v) > 0, hoje))).size,
    semanaRotina: acao("agenda-rotina") ? maxGrupo(diasHabitos, semana) : 0,
    revisaoSemana: Object.values(mapa(get("weekly-reviews", {}))).filter(r => texto(r?.wins) || texto(r?.improve) || texto(r?.focus)).length,
    contaPaga: lerLista("finance-dueDays").flatMap(d => itens(d.bills)).filter(b => b.paid === true).length,
    diasFinancas: new Set(despesas.map(d => d.date).filter(d => diaValido(d) && d <= hoje)).size,
    poupou: lerLista("finance-wishlist").some(w => numero(w.savedAmount) > 0) || acao("poupar") ? 1 : 0,
    diasPoupando: acao("poupar"), investiu: lerLista("finance-investments").filter(i => numero(i.currentValue) > 0 || numero(i.value) > 0).length,
    remedio: lerLista("core-saude-supplements").filter(s => texto(s.name)).length,
    medico: lerLista("core-saude-appointments").filter(a => texto(a.doctor) || texto(a.specialty)).length + lerLista("core-saude-exams-v2").filter(e => texto(e.name)).length,
    refeicoes: dietaDias.size, semanaDieta: maxGrupo([...dietaDias], semana), jejum: acao("jejum"),
    candidatura: lerLista("career-jobs").filter(j => texto(j.company) && texto(j.role)).length,
    projeto: lerLista("career-portfolio").filter(p => texto(p.title)).length,
    ensaio: lerLista("career-interview-prep").filter(q => texto(q.answer) && q.practiced === true).length,
    rapida: acao("acao-rapida"),
  };
}
function badge(c: ConceitoNovo, atual: number): Badge {
  const valor = Number.isFinite(atual) ? Math.max(0, atual) : 0;
  return {id: c.id, name: c.nome, description: c.descricao, category: c.categoria, raridade: c.raridade, xp: XP_RARIDADE[c.raridade], color: "green", icon: "✦", unlocked: valor >= c.alvo, progresso: { atual: Math.min(valor, c.alvo), alvo: c.alvo }, ...(c.rota ? {rota: {caminho: c.rota, nome: c.nome}} : {})};
}
/** Preserva os ids dos conceitos mantidos e o valor histórico das conquistas já ganhas. */
export function aplicarCatalogoCaderno(base: Badge[], get: LeitorCatalogo, gravadas: Record<string, string>, hoje = localDayKey()): Badge[] {
  const m = medirCaderno(get, hoje);
  const trocas: Record<string, [string, string, number, number]> = {
    "saver-20": ["Poupador", "Guarde o primeiro valor para um desejo, de qualquer tamanho", m.poupou, 1],
    "saver-60": ["Formiguinha", "Guarde um pouco para seus desejos em 7 dias diferentes", m.diasPoupando, 7],
    "investor-1k": ["Investidor", "Registre seu primeiro investimento, de qualquer valor", m.investiu, 1],
    "organizer": ["Cada coisa no lugar", "Categorize 5 despesas", base.find(b => b.id === "organizer")?.progresso?.atual ?? 0, 5],
    "treino-pr": ["Recordista", "Supere seu primeiro recorde pessoal no histórico de treinos", m.recorde, 1],
    "rotina-1": ["Primeiro Dia", "Marque seu primeiro hábito como feito", m.habitos, 1],
    "rotina-21": ["Pegando o ritmo", "Marque hábitos em 21 dias seguidos", m.recordeHabitos, 21],
  };
  return [...base.filter(b => !IDS_ARQUIVADOS.has(b.id) || !!gravadas[b.id]).map(b => {
    if (IDS_ARQUIVADOS.has(b.id)) return {...b, unlocked: true, arquivada: true};
    const t = trocas[b.id];
    if (!t) return b;
    return {...b, name: t[0], description: t[1], unlocked: t[2] >= t[3], progresso: {atual: Math.min(t[2], t[3]), alvo: t[3]}, formato: undefined, unidade: undefined};
  }), ...NOVAS_CONQUISTAS.map(c => badge(c, m[c.medida] ?? 0))];
}
