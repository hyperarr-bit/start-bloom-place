/**
 * O CONTEÚDO DA PORTA iPHONE (/comece) — perguntas, respostas, plano e a
 * régua do "com × sem o CORE". Puro, sem React.
 *
 * As perguntas, a régua do gráfico e os degraus do plano são os do funil novo
 * do app 1.0.14 (ramo v14: lib/funnel, lib/funil-numeros, funis/w/compromissos).
 * Regra da Porta: SEM o PREÇO do produto (nada de 97,90, mensal, anual). Valor
 * de gasto da própria pessoa ("R$ 300 somem por mês") pode ter R$ (dono 10/10).
 */

export type AreaPorta = "dinheiro" | "rotina" | "corpo" | "saude" | "metas";
export type EscolhaPorta = AreaPorta | "tudo";

export type Opcao = { id: string; emoji: string; label: string; sub?: string };

/** Tela 1. "Tudo" segue pela rota do dinheiro (Finanças), como no app. */
export const PERGUNTA_AREA = "O que você quer arrumar primeiro?";
export const OPCOES_AREA: Array<Opcao & { id: EscolhaPorta }> = [
  { id: "dinheiro", emoji: "💰", label: "Dinheiro", sub: "gastos, contas, cartão" },
  { id: "rotina", emoji: "📅", label: "Rotina", sub: "hábitos, tarefas, semana" },
  { id: "corpo", emoji: "💪", label: "Corpo", sub: "treino e dieta" },
  { id: "saude", emoji: "❤️", label: "Saúde", sub: "água, sono, remédios" },
  { id: "metas", emoji: "🎯", label: "Metas", sub: "objetivos com passo a passo" },
  { id: "tudo", emoji: "😵", label: "Tudo", sub: "a gente começa pelo dinheiro" },
];

export const rotaDe = (e: EscolhaPorta | null | undefined): AreaPorta => (e && e !== "tudo" ? e : "dinheiro");

export const NOME_DA_AREA: Record<AreaPorta, { emoji: string; nome: string }> = {
  dinheiro: { emoji: "💰", nome: "Dinheiro" },
  rotina: { emoji: "📅", nome: "Rotina" },
  corpo: { emoji: "💪", nome: "Corpo" },
  saude: { emoji: "❤️", nome: "Saúde" },
  metas: { emoji: "🎯", nome: "Metas" },
};

/* ------------------------------------------------ telas 2 e 3: AS MESMAS DO APP
 *
 * 10/10 (dono, depois dos prints da v1: "achei a escolha das perguntas estranha"):
 * as perguntas 2 e 3 são as MESMAS do funil novo do app (FUNIL_CALAI, ramo v14:
 * lib/funnel QUIZ/AREA_TRACKS + a sequência do ComecarW com a chave ligada):
 *   · tela 2 = quiz_1, a DOR ("atrapalha") da área;
 *   · tela 3 = o NÚMERO da rota: dinheiro (e "Tudo") = quiz_3 "gasto"; as outras = quiz_2 "consistencia".
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
      { id: "gasto_sem_perceber", emoji: "💳", label: "Gasto sem perceber", dia1: "Anota os gastos de hoje e vê quanto somam", tema: 0 },
      { id: "esqueco_contas", emoji: "📅", label: "Esqueço contas", dia1: "Coloca as contas do mês e recebe aviso antes de vencer", tema: 1 },
      { id: "nao_guardo", emoji: "🏦", label: "Não consigo guardar dinheiro", dia1: "Cria sua primeira meta pra guardar dinheiro", tema: null },
      { id: "pra_onde_vai", emoji: "🤷", label: "Não sei pra onde meu dinheiro vai", dia1: "Anota 1 gasto e vê o mês somar sozinho", tema: 0 },
      { id: "organizar_tudo", emoji: "🧹", label: "Quero organizar tudo", dia1: "Anota 1 gasto e vê o mês somar sozinho", tema: 0 },
    ],
  },
  rotina: {
    key: "atrapalha",
    q: "O que mais bagunça sua rotina hoje?",
    opts: [
      { id: "sem_plano", emoji: "😴", label: "Acordo sem plano nenhum", dia1: "Monta o dia de amanhã em 2 minutos", tema: 1 },
      { id: "celular", emoji: "📱", label: "Perco horas no celular", dia1: "Troca 15 minutos de celular por 1 hábito e marca", tema: 0 },
      { id: "nao_termino", emoji: "🌀", label: "Começo mil coisas e não termino", dia1: "Escolhe 1 coisa só e marca feito hoje", tema: 0 },
      { id: "esqueco_tarefas", emoji: "📅", label: "Esqueço tarefas e compromissos", dia1: "Coloca as tarefas da semana com lembrete", tema: null },
      { id: "organizar_tudo", emoji: "🧹", label: "Quero organizar tudo", dia1: "Marca 1 hábito e vê sua semana ganhar vida", tema: 0 },
    ],
  },
  corpo: {
    key: "atrapalha",
    q: "O que mais te trava hoje?",
    opts: [
      { id: "desisto", emoji: "🏋️", label: "Começo a treinar e desisto", dia1: "Anota o treino de hoje e começa sua sequência", tema: 0 },
      { id: "como_mal", emoji: "🍔", label: "Como mal e nem percebo", dia1: "Marca as refeições de hoje, sem contar caloria", tema: 1 },
      { id: "sem_plano", emoji: "📋", label: "Não tenho plano de treino nem dieta", dia1: "Monta o treino da semana em 3 minutos", tema: null },
      { id: "constancia", emoji: "😩", label: "Falta constância, não vontade", dia1: "Anota 1 exercício e começa sua sequência", tema: 0 },
      { id: "organizar_tudo", emoji: "🧹", label: "Quero organizar tudo", dia1: "Anota 1 exercício e a carga de hoje", tema: 0 },
    ],
  },
  saude: {
    key: "atrapalha",
    q: "O que você mais negligencia hoje?",
    opts: [
      { id: "agua", emoji: "💧", label: "Beber água", dia1: "Marca 1 copo d'água e bate a meta do dia", tema: 0 },
      { id: "sono", emoji: "😴", label: "Dormir direito", dia1: "Registra o sono de hoje e começa a ver o padrão", tema: 1 },
      { id: "vitaminas", emoji: "💊", label: "Vitaminas e remédios na hora", dia1: "Coloca vitaminas e remédios com lembrete na hora certa", tema: null },
      { id: "exames", emoji: "💉", label: "Exames e check-ups", dia1: "Anota seus próximos exames com lembrete", tema: null },
      { id: "tudo", emoji: "🧹", label: "Um pouco de tudo", dia1: "Marca 1 copo d'água e bate a meta do dia", tema: 0 },
    ],
  },
  metas: {
    key: "atrapalha",
    q: "O que acontece com as suas metas?",
    opts: [
      { id: "na_cabeca", emoji: "📝", label: "Ficam na cabeça, nunca no papel", dia1: "Escreve 1 meta e divide em passos pequenos", tema: 0 },
      { id: "janeiro", emoji: "🎆", label: "Empolgo em janeiro, esqueço em março", dia1: "Coloca sua meta com data e o primeiro passo", tema: 0 },
      { id: "tantas", emoji: "🌀", label: "Tenho tantas que não sei por onde começar", dia1: "Escolhe a meta mais importante e guarda o resto", tema: 0 },
      { id: "nao_saio", emoji: "🔁", label: "Sinto que não saio do lugar", dia1: "Faz um passo pequeno hoje e marca feito", tema: 1 },
      { id: "organizar_tudo", emoji: "🧹", label: "Quero organizar tudo", dia1: "Escolhe 1 meta e divide em passos", tema: 0 },
    ],
  },
};

export const PERGUNTA_NUMERO: Record<AreaPorta, PerguntaPorta & { key: "gasto" | "consistencia" }> = {
  dinheiro: {
    key: "gasto",
    q: "Quanto você acha que gasta sem perceber, por mês?",
    opts: [
      { id: "menos_100", emoji: "💰", label: "Menos de R$ 100" },
      { id: "100_300", emoji: "💵", label: "R$ 100 a R$ 300" },
      { id: "300_500", emoji: "💵", label: "R$ 300 a R$ 500" },
      { id: "mais_500", emoji: "🔥", label: "Mais de R$ 500" },
      { id: "nao_sei", emoji: "🤷", label: "Não faço ideia" },
    ],
  },
  rotina: {
    key: "consistencia",
    q: "Quanto tempo você costuma manter um hábito novo?",
    opts: [
      { id: "3_dias", emoji: "🙃", label: "Uns 3 dias" },
      { id: "semana", emoji: "📆", label: "Uma semana" },
      { id: "mes", emoji: "🌗", label: "Um mês, aí largo" },
      { id: "nunca", emoji: "🤷", label: "Nunca consegui manter" },
    ],
  },
  corpo: {
    key: "consistencia",
    q: "Quantas vezes você já recomeçou treino ou dieta?",
    opts: [
      { id: "primeira", emoji: "🌱", label: "Essa vai ser a primeira" },
      { id: "2_ou_3", emoji: "✌️", label: "Umas 2 ou 3" },
      { id: "perdi_a_conta", emoji: "😅", label: "Perdi a conta" },
      { id: "na_ativa", emoji: "🏃", label: "Tô na ativa, mas sem controle" },
    ],
  },
  saude: {
    key: "consistencia",
    q: "Como seu corpo anda te avisando?",
    opts: [
      { id: "cansaco", emoji: "😩", label: "Cansaço o dia todo" },
      { id: "sono_ruim", emoji: "🌙", label: "Sono ruim" },
      { id: "ansiedade", emoji: "😰", label: "Ansiedade e estresse" },
      { id: "prevenir", emoji: "🛡️", label: "Tô bem — quero prevenir" },
    ],
  },
  metas: {
    key: "consistencia",
    q: "Quanto tempo faz que essa meta te espera?",
    opts: [
      { id: "agora", emoji: "🌱", label: "Surgiu agora" },
      { id: "meses", emoji: "📆", label: "Uns meses" },
      { id: "ano", emoji: "🗓️", label: "Mais de um ano" },
      { id: "anos", emoji: "😔", label: "Anos… nem conto mais" },
    ],
  },
};

/** A linha em cima da pergunta de quem entrou por "Tudo" (a mesma do app: v14 lib/funil-numeros ABERTURA_TUDO). */
export const ABERTURA_TUDO = "Vamos começar pelo mais importante: o dinheiro. Rotina e saúde entram nos dias 2 e 3.";

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

/* ------------------------------------------------ tela 4: com × sem o CORE (porte de v14 lib/funil-numeros) */

export const MEDIANA_REAIS = 500;
export const MEDIANA_TREINOS = 2;
export const MESES_DO_GRAFICO = 3;
export const SEMANAS = 12;
export const TREINOS_COM_CORE = 3;
/** Resposta de "gasto" → R$ por mês (a régua do app). */
export const REAIS_POR_RESPOSTA: Record<string, number> = { menos_100: 100, "100_300": 300, "300_500": 500, mais_500: 800 };
/** "Mais de R$ 500" vira "R$ 500+" na copy, como no app. */
const ROTULO_REAIS: Record<string, string> = { menos_100: "R$ 100", "100_300": "R$ 300", "300_500": "R$ 500", mais_500: "R$ 500+" };
/** Consistência de Corpo → treinos por semana hoje (a régua do app). */
export const TREINOS_POR_RESPOSTA: Record<string, number> = { primeira: 2, "2_ou_3": 2, perdi_a_conta: 1, na_ativa: 3 };

export const formatarReais = (n: number): string => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

type Base = { eyebrow: string; titulo: string; subtitulo: string; legenda: string; cta: string };
export type ComSem =
  | (Base & { tipo: "reais" | "treinos"; sem: number[]; com: number[]; valor: number; estimado: boolean })
  | (Base & { tipo: "copy"; linhasSem: string[]; linhasCom: string[] });

export const CTA_COM_SEM: Record<AreaPorta, string> = {
  dinheiro: "Quero ver pra onde vai",
  corpo: "Quero manter o ritmo",
  rotina: "Quero uma rotina que fica",
  metas: "Quero tirar do papel",
  saude: "Quero me cuidar de verdade",
};

export const COPY_SEM_COM: Record<"rotina" | "metas" | "saude", { sem: string[]; com: string[] }> = {
  rotina: {
    sem: ["Dias que passam e nada muda", "Hábitos que você começa e abandona", "Rotina sempre pra depois"],
    com: ["Cada dia com um plano", "Hábitos que ficam", "Sequência que você não quer perder"],
  },
  metas: {
    sem: ["Objetivos que ficam só na cabeça", "Sonhos sem data", "Fim de ano igual ao começo"],
    com: ["Metas com passo a passo", "Progresso que você vê", "Sonhos com data"],
  },
  saude: {
    sem: ["Água que você esquece", "Sono que não rende", "Remédio lembrado tarde demais"],
    com: ["Água, sono e vitaminas no lugar", "Lembrete na hora certa", "Seu corpo num painel só"],
  },
};

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const mesAlvo = (hoje: Date = new Date(), meses: number = MESES_DO_GRAFICO): string => MESES_LONGOS[(hoje.getMonth() + meses) % 12];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesCurto = (hoje: Date, mais: number): string => MESES[(hoje.getMonth() + mais) % 12];

/** A projeção do app: reais = o que some acumulado × o que ainda escapa com registro; treinos = cai até 1 × sobe até 3. */
export function projecaoReais(valor: number): { sem: number[]; com: number[] } {
  const sem = [0], com = [0];
  const escapa = [0.4, 0.15, 0.1];
  for (let m = 1; m <= MESES_DO_GRAFICO; m++) { sem.push(valor * m); com.push(com[m - 1] + valor * (escapa[m - 1] ?? 0.1)); }
  return { sem: sem.map((v) => Math.round(v)), com: com.map((v) => Math.round(v)) };
}
export function projecaoTreinos(valor: number): { sem: number[]; com: number[] } {
  const sem: number[] = [], com: number[] = [];
  for (let s = 0; s <= SEMANAS; s++) {
    sem.push(Math.round((valor - (valor - 1) * (s / SEMANAS)) * 10) / 10);
    com.push(Math.round(Math.min(TREINOS_COM_CORE, valor + (TREINOS_COM_CORE - valor) * Math.min(1, s / 4)) * 10) / 10);
  }
  return { sem, com };
}

/** A tela 4 a partir da rota e da resposta da tela 3 (o número). A copy do app, sem travessão. */
export function comSemDa(rota: AreaPorta, numero: string | null | undefined, hoje: Date = new Date()): ComSem {
  const cta = CTA_COM_SEM[rota];
  if (rota === "dinheiro") {
    const v = numero ? REAIS_POR_RESPOSTA[numero] : undefined;
    const valor = v ?? MEDIANA_REAIS;
    const estimado = v === undefined;
    const rotulo = (numero && ROTULO_REAIS[numero]) || formatarReais(valor);
    const { sem, com } = projecaoReais(valor);
    return {
      tipo: "reais", eyebrow: "Pela sua resposta", cta, sem, com, valor, estimado,
      titulo: estimado ? `Em média, ${rotulo} somem por mês.` : `${rotulo} somem por mês.`,
      subtitulo: `Até ${mesAlvo(hoje)}, ${formatarReais(sem[sem.length - 1])} sem rastro.`,
      legenda: "Com o CORE você vê pra onde vai cada real.",
    };
  }
  if (rota === "corpo") {
    const v = numero ? TREINOS_POR_RESPOSTA[numero] : undefined;
    const valor = v ?? MEDIANA_TREINOS;
    const { sem, com } = projecaoTreinos(valor);
    const fim = sem[sem.length - 1];
    const rotulo = `${valor} ${valor === 1 ? "treino" : "treinos"}`;
    return {
      tipo: "treinos", eyebrow: "Pela sua resposta", cta, sem, com, valor, estimado: v === undefined,
      titulo: `Sem o CORE: ${rotulo} por semana ${valor === 1 ? "somem" : `viram ${String(fim).replace(".", ",")}`} em 3 meses.`,
      subtitulo: `Com o CORE: ${TREINOS_COM_CORE} por semana, sem falhar.`,
      legenda: "A consistência cai sozinha. Com treino e dieta no mesmo lugar, ela fica.",
    };
  }
  const l = COPY_SEM_COM[rota];
  return {
    tipo: "copy", eyebrow: "Pela sua resposta", cta, linhasSem: l.sem, linhasCom: l.com,
    titulo: "Sua vida sem o CORE",
    subtitulo: "× com o CORE",
    legenda: rota === "metas" ? "Meta com passo a passo é meta que sai do papel." : rota === "saude" ? "O cuidado de todo dia, no automático." : "Rotina que fica é rotina com lugar pra morar.",
  };
}

/* ------------------------------------------------ tela 7 */

/** O botão de entrar na welcome do app. A 1.0.12 da loja diz "Já tenho conta? Entrar" e a 1.0.14 (que vai pro ar
 *  sozinha quando a Apple aprovar) diz "Já tem conta? Entrar" — nas duas é o "Entrar" logo ABAIXO do Começar.
 *  Por isso a Porta fala só "Entrar" + onde fica (10/10). */
export const TEXTO_ENTRAR_NO_APP = "Entrar";
export const ONDE_FICA_ENTRAR = "logo abaixo do botão Começar";
