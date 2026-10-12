/**
 * O CONTEÚDO DA PORTA iPHONE (/comece) — o topo, as perguntas e as respostas. Puro, sem React.
 *
 * v5 (12/10, dono: "quero o funil igual o do Dinzo, mesmo design, só adaptando o quiz"): topo fixo
 * (logo · PLANO GRATUITO · "Monte seu plano de 3 dias" · "4 perguntas rápidas…") + UM card onde tudo
 * acontece: área → dor → número → "como você organiza hoje" → conta → sucesso. Opções SÓ TEXTO (sem emoji).
 * A dor e o número são os do funil novo do app 1.0.14 (ramo v14: lib/funnel, lib/funil-numeros).
 * Regra da Porta: SEM o PREÇO do produto (nem valor, nem "mensal", nem "anual").
 */

export type AreaPorta = "dinheiro" | "rotina" | "corpo" | "saude" | "metas";
export type EscolhaPorta = AreaPorta | "tudo";

export type Opcao = { id: string; label: string };

/* ------------------------------------------------ o topo (igual em todos os passos) */
export const SELO_TOPO = "Plano gratuito";
export const TITULO_TOPO = "Monte seu plano de 3 dias";
export const SUB_TOPO = "4 perguntas rápidas, e sua conta fica pronta em menos de um minuto.";

/* ------------------------------------------------ passo 1: a área */
/** "Tudo" segue pela rota do dinheiro (Finanças), como no app. "Treino e dieta" = a área corpo. */
export const PERGUNTA_AREA = "O que você quer organizar primeiro?";
export const OPCOES_AREA: Array<Opcao & { id: EscolhaPorta }> = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "rotina", label: "Rotina" },
  { id: "corpo", label: "Treino e dieta" },
  { id: "saude", label: "Saúde" },
  { id: "metas", label: "Metas" },
  { id: "tudo", label: "Tudo" },
];

export const rotaDe = (e: EscolhaPorta | null | undefined): AreaPorta => (e && e !== "tudo" ? e : "dinheiro");

/* ------------------------------------------------ passo 4: como organiza hoje (multi-seleção) */
export const PERGUNTA_ORGANIZA = "Como você organiza isso hoje?";
export const DICA_ORGANIZA = "Pode marcar mais de um.";
export const OPCOES_ORGANIZA: Opcao[] = [
  { id: "nao_organizo", label: "Não organizo" },
  { id: "notas", label: "Bloco de notas" },
  { id: "planilha", label: "Planilha" },
  { id: "outro_app", label: "Outro app" },
  { id: "cabeca", label: "Só de cabeça" },
];
/** "Não organizo" não combina com as outras: marcar ela desmarca o resto (e vice-versa). */
export const ORGANIZA_EXCLUSIVA = "nao_organizo";
export function alternarOrganiza(sel: string[], id: string): string[] {
  if (sel.includes(id)) return sel.filter((x) => x !== id);
  if (id === ORGANIZA_EXCLUSIVA) return [id];
  return [...sel.filter((x) => x !== ORGANIZA_EXCLUSIVA), id];
}

/* ------------------------------------------------ a dor e o número: AS MESMAS DO APP
 *
 * 10/10 (dono, depois dos prints da v1: "achei a escolha das perguntas estranha"):
 * as perguntas são as MESMAS do funil novo do app (FUNIL_CALAI, ramo v14:
 * lib/funnel QUIZ/AREA_TRACKS + a sequência do ComecarW com a chave ligada):
 *   · a DOR (quiz_1, "atrapalha") da área — passo 2;
 *   · o NÚMERO da rota (passo 3): dinheiro (e "Tudo") = quiz_3 "gasto"; as outras = quiz_2 "consistencia".
 * Mesmos textos, mesmas opções, mesma ordem. Nada de pergunta nova.
 */
export type PerguntaPorta = { key: string; q: string; opts: Opcao[] };
/** Opção da DOR: o Dia 1 do plano sai dela (`tema` = qual degrau padrão ela já cobre, pra não repetir nos dias 2 e 3). */
export type OpcaoDor = Opcao & { dia1: string; tema: 0 | 1 | 2 | null };

export const PERGUNTA_DOR: Record<AreaPorta, { key: "atrapalha"; q: string; opts: OpcaoDor[] }> = {
  dinheiro: {
    key: "atrapalha",
    q: "O que mais te atrapalha hoje?",
    opts: [
      { id: "gasto_sem_perceber", label: "Gasto sem perceber", dia1: "Anota os gastos de hoje e vê quanto somam", tema: 0 },
      { id: "esqueco_contas", label: "Esqueço contas", dia1: "Coloca as contas do mês e recebe aviso antes de vencer", tema: 1 },
      { id: "nao_guardo", label: "Não consigo guardar dinheiro", dia1: "Cria sua primeira meta pra guardar dinheiro", tema: null },
      { id: "pra_onde_vai", label: "Não sei pra onde meu dinheiro vai", dia1: "Anota 1 gasto e vê o mês somar sozinho", tema: 0 },
      { id: "organizar_tudo", label: "Quero organizar tudo", dia1: "Anota 1 gasto e vê o mês somar sozinho", tema: 0 },
    ],
  },
  rotina: {
    key: "atrapalha",
    q: "O que mais bagunça sua rotina hoje?",
    opts: [
      { id: "sem_plano", label: "Acordo sem plano nenhum", dia1: "Monta o dia de amanhã em 2 minutos", tema: 1 },
      { id: "celular", label: "Perco horas no celular", dia1: "Troca 15 minutos de celular por 1 hábito e marca", tema: 0 },
      { id: "nao_termino", label: "Começo mil coisas e não termino", dia1: "Escolhe 1 coisa só e marca feito hoje", tema: 0 },
      { id: "esqueco_tarefas", label: "Esqueço tarefas e compromissos", dia1: "Coloca as tarefas da semana com lembrete", tema: null },
      { id: "organizar_tudo", label: "Quero organizar tudo", dia1: "Marca 1 hábito e vê sua semana ganhar vida", tema: 0 },
    ],
  },
  corpo: {
    key: "atrapalha",
    q: "O que mais te trava hoje?",
    opts: [
      { id: "desisto", label: "Começo a treinar e desisto", dia1: "Anota o treino de hoje e começa sua sequência", tema: 0 },
      { id: "como_mal", label: "Como mal e nem percebo", dia1: "Marca as refeições de hoje, sem contar caloria", tema: 1 },
      { id: "sem_plano", label: "Não tenho plano de treino nem dieta", dia1: "Monta o treino da semana em 3 minutos", tema: null },
      { id: "constancia", label: "Falta constância, não vontade", dia1: "Anota 1 exercício e começa sua sequência", tema: 0 },
      { id: "organizar_tudo", label: "Quero organizar tudo", dia1: "Anota 1 exercício e a carga de hoje", tema: 0 },
    ],
  },
  saude: {
    key: "atrapalha",
    q: "O que você mais negligencia hoje?",
    opts: [
      { id: "agua", label: "Beber água", dia1: "Marca 1 copo d'água e bate a meta do dia", tema: 0 },
      { id: "sono", label: "Dormir direito", dia1: "Registra o sono de hoje e começa a ver o padrão", tema: 1 },
      { id: "vitaminas", label: "Vitaminas e remédios na hora", dia1: "Coloca vitaminas e remédios com lembrete na hora certa", tema: null },
      { id: "exames", label: "Exames e check-ups", dia1: "Anota seus próximos exames com lembrete", tema: null },
      { id: "tudo", label: "Um pouco de tudo", dia1: "Marca 1 copo d'água e bate a meta do dia", tema: 0 },
    ],
  },
  metas: {
    key: "atrapalha",
    q: "O que acontece com as suas metas?",
    opts: [
      { id: "na_cabeca", label: "Ficam na cabeça, nunca no papel", dia1: "Escreve 1 meta e divide em passos pequenos", tema: 0 },
      { id: "janeiro", label: "Empolgo em janeiro, esqueço em março", dia1: "Coloca sua meta com data e o primeiro passo", tema: 0 },
      { id: "tantas", label: "Tenho tantas que não sei por onde começar", dia1: "Escolhe a meta mais importante e guarda o resto", tema: 0 },
      { id: "nao_saio", label: "Sinto que não saio do lugar", dia1: "Faz um passo pequeno hoje e marca feito", tema: 1 },
      { id: "organizar_tudo", label: "Quero organizar tudo", dia1: "Escolhe 1 meta e divide em passos", tema: 0 },
    ],
  },
};

export const PERGUNTA_NUMERO: Record<AreaPorta, PerguntaPorta & { key: "gasto" | "consistencia" }> = {
  dinheiro: {
    key: "gasto",
    q: "Quanto você acha que gasta sem perceber, por mês?",
    opts: [
      { id: "menos_100", label: "Menos de R$ 100" },
      { id: "100_300", label: "R$ 100 a R$ 300" },
      { id: "300_500", label: "R$ 300 a R$ 500" },
      { id: "mais_500", label: "Mais de R$ 500" },
      { id: "nao_sei", label: "Não faço ideia" },
    ],
  },
  rotina: {
    key: "consistencia",
    q: "Quanto tempo você costuma manter um hábito novo?",
    opts: [
      { id: "3_dias", label: "Uns 3 dias" },
      { id: "semana", label: "Uma semana" },
      { id: "mes", label: "Um mês, aí largo" },
      { id: "nunca", label: "Nunca consegui manter" },
    ],
  },
  corpo: {
    key: "consistencia",
    q: "Quantas vezes você já recomeçou treino ou dieta?",
    opts: [
      { id: "primeira", label: "Essa vai ser a primeira" },
      { id: "2_ou_3", label: "Umas 2 ou 3" },
      { id: "perdi_a_conta", label: "Perdi a conta" },
      { id: "na_ativa", label: "Tô na ativa, mas sem controle" },
    ],
  },
  saude: {
    key: "consistencia",
    q: "Como seu corpo anda te avisando?",
    opts: [
      { id: "cansaco", label: "Cansaço o dia todo" },
      { id: "sono_ruim", label: "Sono ruim" },
      { id: "ansiedade", label: "Ansiedade e estresse" },
      { id: "prevenir", label: "Tô bem — quero prevenir" },
    ],
  },
  metas: {
    key: "consistencia",
    q: "Quanto tempo faz que essa meta te espera?",
    opts: [
      { id: "agora", label: "Surgiu agora" },
      { id: "meses", label: "Uns meses" },
      { id: "ano", label: "Mais de um ano" },
      { id: "anos", label: "Anos… nem conto mais" },
    ],
  },
};

/** A linha embaixo da pergunta de quem escolheu "Tudo" (a do app, encurtada: v14 lib/funil-numeros ABERTURA_TUDO). */
export const ABERTURA_TUDO = "Vamos começar pelo dinheiro. Rotina e saúde entram nos dias 2 e 3.";

export const labelDe = (opts: Opcao[], id: string | null | undefined): string | null => opts.find((o) => o.id === id)?.label ?? null;

/** Os degraus padrão de cada área (os do plano do app: v14 compromissos DIAS_POR_AREA). */
export const DIAS_POR_AREA: Record<AreaPorta, [string, string, string]> = {
  dinheiro: ["Anota 1 gasto e vê o mês somar sozinho", "Marca as contas do mês e recebe o aviso antes de vencer", "Vê quanto dá pra gastar hoje sem furar o mês"],
  rotina: ["Marca 1 hábito e vê sua semana ganhar vida", "Monta o dia de amanhã em 2 minutos", "Fecha 3 dias seguidos e vê a sequência crescer"],
  corpo: ["Anota 1 exercício e a carga de hoje", "Marca as refeições e vê o dia fechar", "Compara o treino com o de anteontem e sobe a carga"],
  saude: ["Marca 1 copo d'água e bate a meta do dia", "Registra o sono e vê o padrão da semana", "Fecha água, sono e remédio no mesmo dia"],
  metas: ["Escolhe 1 meta e divide em passos", "Faz o primeiro passo e marca feito", "Vê o progresso da semana e ajusta o rumo"],
};

/** O plano de 3 dias: o Dia 1 sai da DOR (tela 2); os Dias 2 e 3 são os degraus da área, tirando o que o Dia 1 já cobre. */
export function planoDe3Dias(rota: AreaPorta, dor: string | null | undefined): { dia1: string; dia2: string; dia3: string; motivo: string | null } {
  const op = PERGUNTA_DOR[rota].opts.find((o) => o.id === dor) ?? null;
  const dias = DIAS_POR_AREA[rota];
  const dia1 = op?.dia1 ?? dias[0];
  const tema = op ? op.tema : 0;
  const resto = dias.filter((_, i) => i !== (tema ?? 0));
  return { dia1, dia2: resto[0], dia3: resto[1], motivo: op?.label ?? null };
}

/* ------------------------------------------------ sucesso */

/** A welcome do app 1.0.14 com o "Já tem conta? Entrar" marcado (print do Simulador, 11/10). Android segue no print antigo. */
export const PRINT_TELA_INICIAL: Record<"ios" | "android", string> = {
  ios: "/porta/tela-inicial-1014-ios.jpg",
  android: "/como-entrar/1-tela-inicial-android.jpg",
};

/** O botão de entrar na welcome do app. A 1.0.14 (na loja desde 11/10) diz "Já tem conta? Entrar", logo ABAIXO
 *  do Começar (a 1.0.12 dizia "Já tenho conta? Entrar", no mesmo lugar). A Porta fala só "Entrar" + onde fica. */
export const TEXTO_ENTRAR_NO_APP = "Entrar";
export const ONDE_FICA_ENTRAR = "logo abaixo do botão Começar";
