/**
 * O NÚMERO DELA (10/10, funil Cal AI — lib/funil-calai) — lib pura, sem React.
 *
 * O funil W guarda a rota e as respostas no aparelho (pages/funis/w/retomada:
 * CHAVES_FUNIL_W.area / .respostas). Aqui elas viram O QUE o passo "sem o CORE ×
 * com o CORE" (GraficoComSem), o plano de 3 dias e o paywall falam — pela rota
 * (dono 10/10: "o gráfico de dias perdidos não faz sentido na Rotina; em Finanças
 * faz, é metrificado; Rotina e Metas têm que ser copy, não número; Treino dá pra
 * metrificar"):
 *
 *   dinheiro → `tipo: "reais"`, GRÁFICO: quanto some por mês (quiz_3 "gasto"). "Não
 *              faço ideia"/sem resposta usa a MEDIANA (R$ 500) e marca `estimado`.
 *   corpo    → `tipo: "treinos"`, GRÁFICO: treinos por semana hoje (da pergunta de
 *              consistência da rota; mediana 2) — sem o CORE caem pra 1 em 12 semanas,
 *              com o CORE sobem pra 3 e ficam.
 *   rotina, metas (e saude) → `tipo: "copy"`, SEM número: dois cards "sem × com" com
 *            3 linhas cada (`copy`).
 *   "Tudo, sinceramente" (porta) → é a rota dinheiro, como hoje (dono 10/10: "volta a ir
 *            pelo caminho de Finanças"): mesmo quiz, gráfico em R$ e plano de Finanças.
 *            `portaTudo()` diz quando a porta foi essa (os eventos levam `area: "tudo"`).
 *
 * Nada aqui grava: só lê. Chaves retrocompatíveis (as mesmas de hoje).
 */
import { GASTO_ANCHOR, PORTA_TUDO, type AreaKey } from "@/lib/funnel";
import { CHAVES_FUNIL_W, lerChave } from "@/pages/funis/w/retomada";

/** A rota do passo: as áreas do funil (a porta "Tudo" cai em dinheiro). */
export type RotaDoPasso = AreaKey;

export type NumeroDaRota = {
  rota: RotaDoPasso;
  /** reais e treinos têm gráfico; copy é a tela de cards. */
  tipo: "reais" | "treinos" | "copy";
  formato: "grafico" | "copy";
  /** Por mês (reais) ou por semana (treinos). 0 na copy. */
  valor: number;
  /** Rótulo pronto pra copy ("R$ 500", "2 treinos"). "" na copy. */
  rotulo: string;
  /** Veio da mediana da rota, não da resposta dela. */
  estimado: boolean;
  /** A resposta crua do quiz, quando houve. */
  resposta: string | null;
  /** As 3 linhas de cada lado (só `tipo: "copy"`). */
  copy?: { sem: string[]; com: string[] };
};

/** Mediana da rota dinheiro (a faixa "R$ 300 a R$ 500" é a mais escolhida: 500). */
export const MEDIANA_REAIS = 500;
/** Mediana da rota treino: 2 treinos por semana. */
export const MEDIANA_TREINOS = 2;
/** Horizonte do gráfico e da copy ("até {mês}"): 3 meses. */
export const MESES_DO_GRAFICO = 3;
/** O gráfico de treino anda por semana: 12 semanas = os 3 meses. */
export const SEMANAS_DO_GRAFICO = 12;
/** Com o CORE: 3 treinos por semana, sem falhar. */
export const TREINOS_COM_CORE = 3;

/** Resposta de "gasto" → R$ por mês (a mesma régua do GASTO_ANCHOR do funil). */
export const REAIS_POR_RESPOSTA: Record<string, number> = {
  "Menos de R$ 100": 100,
  "R$ 100 a R$ 300": 300,
  "R$ 300 a R$ 500": 500,
  "Mais de R$ 500": 800,
};

/** Resposta de consistência da rota corpo ("quantas vezes já recomeçou") → treinos por semana hoje. */
export const TREINOS_POR_RESPOSTA: Record<string, number> = {
  "Essa vai ser a primeira": 2,
  "Umas 2 ou 3": 2,
  "Perdi a conta": 1,
  "Tô na ativa, mas sem controle": 3,
};

/** As 3 linhas de cada lado, por rota de copy (voz direta, mulher de 25–34, sem promessa garantida). */
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

/** A linha de abertura de quem entrou por "Tudo, sinceramente": começa pelo dinheiro, o resto vem nos dias 2 e 3. */
export const ABERTURA_TUDO = "Vamos começar pelo mais importante: o dinheiro. Rotina e saúde entram nos dias 2 e 3.";

/** O CTA do passo, por rota. */
export const CTA_POR_ROTA: Record<RotaDoPasso, string> = {
  dinheiro: "Quero ver pra onde vai",
  corpo: "Quero manter o ritmo",
  rotina: "Quero uma rotina que fica",
  metas: "Quero tirar do papel",
  saude: "Quero me cuidar de verdade",
};

export const formatarReais = (n: number): string => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

const ROTAS: RotaDoPasso[] = ["dinheiro", "rotina", "corpo", "saude", "metas"];

/** A rota do passo: a área gravada (a porta "Tudo" já mora em dinheiro). */
export function rotaDoPasso(rota: string | null | undefined): RotaDoPasso {
  return rota && (ROTAS as string[]).includes(rota) ? (rota as RotaDoPasso) : "dinheiro";
}

/** A porta foi "Tudo, sinceramente"? (vale pra os eventos levarem `area: "tudo"` e pra linha de abertura) */
export const portaTudo = (respostas: Record<string, string> | null | undefined): boolean => respostas?.area_label === PORTA_TUDO.label;

/** Monta o número a partir de rota + respostas (puro; é o que o funil grava). */
export function numeroDaRotaDe(rota: string | null | undefined, respostas: Record<string, string> | null | undefined): NumeroDaRota {
  const r = rotaDoPasso(rota);
  if (r === "dinheiro") {
    const resposta = respostas?.gasto ?? null;
    const v = resposta ? REAIS_POR_RESPOSTA[resposta] : undefined;
    const valor = v ?? MEDIANA_REAIS;
    // "Mais de R$ 500" fica "R$ 500+" na copy, como no GASTO_ANCHOR de hoje
    const rotulo = resposta && GASTO_ANCHOR[resposta] ? GASTO_ANCHOR[resposta]!.month : formatarReais(valor);
    return { rota: r, tipo: "reais", formato: "grafico", valor, rotulo, estimado: v === undefined, resposta };
  }
  if (r === "corpo") {
    const resposta = respostas?.consistencia ?? null;
    const v = resposta ? TREINOS_POR_RESPOSTA[resposta] : undefined;
    const valor = v ?? MEDIANA_TREINOS;
    return { rota: r, tipo: "treinos", formato: "grafico", valor, rotulo: `${valor} ${valor === 1 ? "treino" : "treinos"}`, estimado: v === undefined, resposta };
  }
  return { rota: r, tipo: "copy", formato: "copy", valor: 0, rotulo: "", estimado: false, resposta: null, copy: COPY_SEM_COM[r] };
}

/** O número dela, lido das chaves do funil já gravadas no aparelho. */
export function numeroDaRota(): NumeroDaRota {
  const rota = lerChave<AreaKey>(CHAVES_FUNIL_W.area);
  const respostas = lerChave<Record<string, string>>(CHAVES_FUNIL_W.respostas);
  return numeroDaRotaDe(rota, respostas);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** O mês daqui a `meses` ("até janeiro"). */
export function mesAlvo(hoje: Date = new Date(), meses: number = MESES_DO_GRAFICO): string {
  return MESES[(hoje.getMonth() + meses) % 12];
}

/**
 * A projeção do gráfico. Devolve as duas séries em valores ABSOLUTOS da unidade:
 *   reais (por mês, 0..3): `sem` = acumulado que some (cresce linear); `com` = o que
 *          ainda escapa com registro (achata: 40% no 1º mês, 15% no 2º, 10% nos seguintes).
 *   treinos (por semana, 0..12): `sem` = de `valor` caindo linear até 1 (a consistência
 *          cai); `com` = de `valor` subindo até 3 em 4 semanas e ficando lá.
 *   copy: séries vazias (não há gráfico).
 */
export function projecao(n: NumeroDaRota, meses: number = MESES_DO_GRAFICO): { sem: number[]; com: number[] } {
  if (n.tipo === "reais") {
    const sem = [0], com = [0];
    const escapa = [0.4, 0.15, 0.1, 0.1, 0.1, 0.1];
    for (let m = 1; m <= meses; m++) {
      sem.push(n.valor * m);
      com.push(com[m - 1] + n.valor * (escapa[m - 1] ?? 0.1));
    }
    return { sem: sem.map((v) => Math.round(v)), com: com.map((v) => Math.round(v)) };
  }
  if (n.tipo === "treinos") {
    const sem: number[] = [], com: number[] = [];
    for (let s = 0; s <= SEMANAS_DO_GRAFICO; s++) {
      sem.push(Math.round((n.valor - (n.valor - 1) * (s / SEMANAS_DO_GRAFICO)) * 10) / 10);
      com.push(Math.round(Math.min(TREINOS_COM_CORE, n.valor + (TREINOS_COM_CORE - n.valor) * Math.min(1, s / 4)) * 10) / 10);
    }
    return { sem, com };
  }
  return { sem: [], com: [] };
}

/** A copy do passo, pronta: título em duas linhas + legenda + CTA, por tipo. */
export function copyDoGrafico(n: NumeroDaRota, hoje: Date = new Date()): { titulo: string; subtitulo: string; legenda: string; cta: string; semRotulo: string; comRotulo: string } {
  const comum = { cta: CTA_POR_ROTA[n.rota], semRotulo: "Sem o CORE", comRotulo: "Com o CORE" };
  if (n.tipo === "reais") {
    const p = projecao(n);
    const total = p.sem[p.sem.length - 1];
    return {
      ...comum,
      titulo: n.estimado ? `Em média, ${n.rotulo} somem por mês.` : `${n.rotulo} somem por mês.`,
      subtitulo: `Até ${mesAlvo(hoje)}, ${formatarReais(total)} sem rastro.`,
      legenda: "Com o CORE você vê pra onde vai cada real.",
    };
  }
  if (n.tipo === "treinos") {
    const p = projecao(n);
    const fim = p.sem[p.sem.length - 1];
    return {
      ...comum,
      titulo: `Sem o CORE: ${n.rotulo} por semana ${n.valor === 1 ? "somem" : `viram ${fim}`} em 3 meses.`,
      subtitulo: `Com o CORE: ${TREINOS_COM_CORE} por semana, sem falhar.`,
      legenda: "A consistência cai sozinha. Com treino e dieta no mesmo lugar, ela fica.",
    };
  }
  return {
    ...comum,
    titulo: "Sua vida sem o CORE",
    subtitulo: "× com o CORE",
    legenda: n.rota === "metas" ? "Meta com passo a passo é meta que sai do papel." : n.rota === "saude" ? "O cuidado de todo dia, no automático." : "Rotina que fica é rotina com lugar pra morar.",
  };
}
