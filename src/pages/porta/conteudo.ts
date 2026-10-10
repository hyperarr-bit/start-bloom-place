/**
 * O CONTEÚDO DA PORTA iPHONE (/comece) — perguntas, respostas, plano e a
 * régua do "com × sem o CORE". Puro, sem React.
 *
 * Adaptado do funil Cal AI do app 1.0.14 (ramo v14: lib/funil-numeros,
 * pages/funis/w/compromissos) com duas regras da Porta:
 *   · SEM PREÇO e sem "R$" em lugar nenhum (o gráfico do dinheiro não tem
 *     valor em reais: mostra a forma da curva, não um número inventado);
 *   · copy curta, frases de até ~12 palavras, sem travessão explicativo.
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

/** Tela 2: 1 toque, muda por área. */
export const PERGUNTA_2: Record<AreaPorta, { q: string; opts: Opcao[] }> = {
  dinheiro: {
    q: "Você sabe quanto sobra no fim do mês?",
    opts: [
      { id: "sei", emoji: "🎯", label: "Sei certinho" },
      { id: "mais_ou_menos", emoji: "🤏", label: "Mais ou menos" },
      { id: "nao_sei", emoji: "🤷", label: "Não faço ideia" },
      { id: "nao_sobra", emoji: "😬", label: "Não sobra nada" },
    ],
  },
  rotina: {
    q: "Quantos dias por semana você consegue manter uma rotina?",
    opts: [
      { id: "0", emoji: "😮‍💨", label: "Quase nenhum" },
      { id: "1-2", emoji: "🙂", label: "1 ou 2" },
      { id: "3-4", emoji: "💪", label: "3 ou 4" },
      { id: "5+", emoji: "🔥", label: "5 ou mais" },
    ],
  },
  corpo: {
    q: "Quantos dias por semana você treina hoje?",
    opts: [
      { id: "0", emoji: "🛋️", label: "Nenhum" },
      { id: "1-2", emoji: "🚶", label: "1 ou 2" },
      { id: "3-4", emoji: "🏃", label: "3 ou 4" },
      { id: "5+", emoji: "🔥", label: "5 ou mais" },
    ],
  },
  saude: {
    q: "Como andam sua água e seu sono?",
    opts: [
      { id: "em_dia", emoji: "😌", label: "Os dois em dia" },
      { id: "um_falha", emoji: "😐", label: "Um dos dois falha" },
      { id: "dois_falham", emoji: "😵", label: "Os dois falham" },
      { id: "nem_reparo", emoji: "🤷", label: "Nem reparo" },
    ],
  },
  metas: {
    q: "Quantas metas saíram do papel este ano?",
    opts: [
      { id: "nenhuma", emoji: "📝", label: "Nenhuma" },
      { id: "uma", emoji: "☝️", label: "Uma" },
      { id: "algumas", emoji: "✌️", label: "Algumas" },
      { id: "nem_lembro", emoji: "🤷", label: "Nem lembro quais eram" },
    ],
  },
};

/** Tela 3: "O que mais te atrapalha?" — 4 chips por área; a resposta vira o Dia 1. */
export const PERGUNTA_3 = "O que mais te atrapalha?";
export const PERGUNTA_3_OPCOES: Record<AreaPorta, Array<Opcao & { dia1: string }>> = {
  dinheiro: [
    { id: "gasto_pequeno", emoji: "☕", label: "Gasto pequeno que some", dia1: "Anota os gastos pequenos de hoje e vê quanto somam" },
    { id: "conta_esquecida", emoji: "📅", label: "Conta que eu esqueço", dia1: "Coloca as contas do mês e recebe aviso antes de vencer" },
    { id: "cartao", emoji: "💳", label: "Cartão que estoura", dia1: "Lança a fatura do cartão e vê o que mais pesa" },
    { id: "quanto_gastar", emoji: "🤔", label: "Não sei quanto posso gastar", dia1: "Vê quanto dá pra gastar hoje sem furar o mês" },
  ],
  rotina: [
    { id: "largo_no_meio", emoji: "🔁", label: "Começo e largo no meio", dia1: "Escolhe 1 hábito só e marca feito hoje" },
    { id: "dia_cheio", emoji: "🌀", label: "Dia cheio, nada feito", dia1: "Monta o dia de amanhã em 2 minutos" },
    { id: "esqueco", emoji: "🧠", label: "Esqueço o que combinei", dia1: "Coloca as tarefas da semana com lembrete" },
    { id: "animo", emoji: "🔋", label: "Falta ânimo", dia1: "Marca 1 coisa feita e vê a sequência começar" },
  ],
  corpo: [
    { id: "o_que_treinar", emoji: "🤷", label: "Não sei o que treinar", dia1: "Monta o treino da semana em 3 minutos" },
    { id: "constancia", emoji: "📉", label: "Falta constância", dia1: "Anota o treino de hoje e começa sua sequência" },
    { id: "dieta", emoji: "🥗", label: "Dieta que não dura", dia1: "Marca as refeições de hoje, sem contar caloria" },
    { id: "progresso", emoji: "📈", label: "Não vejo progresso", dia1: "Anota a carga de hoje pra comparar depois" },
  ],
  saude: [
    { id: "agua", emoji: "💧", label: "Esqueço de beber água", dia1: "Marca cada copo d'água e bate a meta de hoje" },
    { id: "sono", emoji: "😴", label: "Durmo mal", dia1: "Registra o sono de hoje e começa a ver o padrão" },
    { id: "remedio", emoji: "💊", label: "Esqueço remédio", dia1: "Coloca seus remédios com lembrete na hora certa" },
    { id: "energia", emoji: "🔋", label: "Pouca energia no dia", dia1: "Marca água e sono e vê o que pesa" },
  ],
  metas: [
    { id: "na_cabeca", emoji: "💭", label: "Fica só na cabeça", dia1: "Escreve 1 meta e divide em passos pequenos" },
    { id: "comeco_paro", emoji: "⏸️", label: "Começo e paro", dia1: "Faz o primeiro passo hoje e marca feito" },
    { id: "nao_vejo", emoji: "📊", label: "Não vejo progresso", dia1: "Marca o que andou e vê a barra subir" },
    { id: "demais", emoji: "📚", label: "São metas demais", dia1: "Escolhe a meta mais importante e guarda o resto" },
  ],
};

/**
 * O plano de 3 dias: o Dia 1 é o da resposta 3; os Dias 2 e 3 são os dois
 * primeiros degraus da MESMA área que ela não escolheu (a lista de cada área
 * já está na ordem em que faz sentido subir). Sem resposta, vale a ordem.
 */
export function planoDe3Dias(rota: AreaPorta, p3: string | null | undefined): { dia1: string; dia2: string; dia3: string; motivo: string | null } {
  const lista = PERGUNTA_3_OPCOES[rota];
  const escolhida = lista.find((o) => o.id === p3) ?? null;
  const resto = lista.filter((o) => o !== (escolhida ?? lista[0]));
  return { dia1: (escolhida ?? lista[0]).dia1, dia2: resto[0].dia1, dia3: resto[1].dia1, motivo: escolhida?.label ?? null };
}

/* ------------------------------------------------ tela 4: com × sem o CORE */

export type ComSem =
  | { tipo: "dinheiro"; eyebrow: string; titulo: string; subtitulo: string; legenda: string; cta: string }
  | { tipo: "treinos"; eyebrow: string; titulo: string; subtitulo: string; legenda: string; cta: string; hoje: number; sem: number[]; com: number[] }
  | { tipo: "copy"; eyebrow: string; titulo: string; subtitulo: string; legenda: string; cta: string; sem: string[]; com: string[] };

export const CTA_COM_SEM: Record<AreaPorta, string> = {
  dinheiro: "Quero ver pra onde vai",
  corpo: "Quero manter o ritmo",
  rotina: "Quero uma rotina que fica",
  metas: "Quero tirar do papel",
  saude: "Quero me cuidar de verdade",
};

export const COPY_SEM_COM: Record<"rotina" | "metas" | "saude", { sem: string[]; com: string[] }> = {
  rotina: {
    sem: ["Dias que passam e nada muda", "Hábitos que você começa e larga", "Rotina sempre pra depois"],
    com: ["Cada dia com um plano", "Hábitos que ficam", "Sequência que você não quer perder"],
  },
  metas: {
    sem: ["Objetivos que ficam só na cabeça", "Sonhos sem data", "Fim de ano igual ao começo"],
    com: ["Metas com passo a passo", "Progresso que você vê", "Sonhos com data"],
  },
  saude: {
    sem: ["Água que você esquece", "Sono que não rende", "Remédio lembrado tarde demais"],
    com: ["Água, sono e remédios no lugar", "Lembrete na hora certa", "Sua saúde num painel só"],
  },
};

const EYEBROW_DINHEIRO: Record<string, string> = {
  sei: "Você já sabe o que sobra",
  mais_ou_menos: "Mais ou menos é onde ele some",
  nao_sei: "Normal, quase ninguém sabe",
  nao_sobra: "Quando não sobra, cada gasto conta",
};

/** Treinos por semana hoje, pela resposta da tela 2 de Corpo. */
export const TREINOS_HOJE: Record<string, number> = { "0": 0, "1-2": 2, "3-4": 3, "5+": 5 };
export const SEMANAS = 12;

export function projecaoTreinos(hoje: number): { sem: number[]; com: number[] } {
  const fimSem = Math.max(0, Math.floor(hoje / 2));
  const alvo = Math.max(hoje, 3);
  const sem: number[] = [], com: number[] = [];
  for (let s = 0; s <= SEMANAS; s++) {
    sem.push(Math.round((hoje - (hoje - fimSem) * (s / SEMANAS)) * 10) / 10);
    com.push(Math.round((hoje + (alvo - hoje) * Math.min(1, s / 4)) * 10) / 10);
  }
  return { sem, com };
}

export function comSemDa(rota: AreaPorta, p2: string | null | undefined): ComSem {
  const cta = CTA_COM_SEM[rota];
  if (rota === "dinheiro") {
    return {
      tipo: "dinheiro",
      eyebrow: EYEBROW_DINHEIRO[p2 ?? ""] ?? "Pela sua resposta",
      titulo: "Sem anotar, o dinheiro some.",
      subtitulo: "Com o CORE, você vê cada gasto.",
      legenda: "Anotar leva segundos. O que você vê, você controla.",
      cta,
    };
  }
  if (rota === "corpo") {
    const hoje = TREINOS_HOJE[p2 ?? ""] ?? 2;
    const { sem, com } = projecaoTreinos(hoje);
    const fim = sem[sem.length - 1];
    const alvo = com[com.length - 1];
    return {
      tipo: "treinos",
      eyebrow: "Pela sua resposta",
      titulo: hoje === 0 ? "Sem plano, o treino fica pra segunda." : `Sem plano, ${hoje} treinos viram ${fim} em 3 meses.`,
      subtitulo: `Com o CORE, ${alvo} por semana sem falhar.`,
      legenda: "Treino marcado é treino que acontece.",
      cta,
      hoje,
      sem,
      com,
    };
  }
  const linhas = COPY_SEM_COM[rota];
  return {
    tipo: "copy",
    eyebrow: "Pela sua resposta",
    titulo: "Sua vida sem o CORE",
    subtitulo: "e com o CORE",
    legenda: rota === "metas" ? "Meta com passo a passo sai do papel." : rota === "saude" ? "O cuidado de todo dia, no automático." : "Dez minutos por dia, no lugar certo.",
    cta,
    sem: linhas.sem,
    com: linhas.com,
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesCurto = (hoje: Date, mais: number): string => MESES[(hoje.getMonth() + mais) % 12];

/* ------------------------------------------------ tela 7 */

/** O texto do botão de entrar no app QUE ESTÁ NA LOJA hoje (AppWelcome: "Já tenho conta? Entrar").
 *  A 1.0.14 (funil Cal AI) diz "Já tem conta? Entrar" — trocar aqui quando ela for a da loja. */
export const TEXTO_ENTRAR_NO_APP = "Já tenho conta? Entrar";
/** O botão do código na tela de Entrar do app */
export const TEXTO_CODIGO_NO_APP = "Entrar sem senha";
