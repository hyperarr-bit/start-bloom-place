/**
 * O NÚMERO DELA (10/10, funil Cal AI — lib/funil-calai) — lib pura, sem React.
 *
 * O funil W guarda a rota e as respostas no aparelho (pages/funis/w/retomada:
 * CHAVES_FUNIL_W.area / .respostas). Aqui elas viram UM número com unidade, pra
 * o gráfico "sem o CORE × com o CORE" (GraficoComSem), o plano de 3 dias e o
 * paywall falarem do MESMO valor:
 *
 *   rota dinheiro → `tipo: "reais"`: quanto some por mês (quiz_3 "gasto"). "Não
 *                   faço ideia" (ou sem resposta) usa a MEDIANA da rota (R$ 500,
 *                   a faixa mais escolhida) e marca `estimado: true`.
 *   outras rotas  → `tipo: "dias"`: dias organizados POR MÊS sem sistema, lidos da
 *                   pergunta de consistência da rota (rotina: "quanto tempo mantém
 *                   um hábito"; corpo: recomeços; saúde: sinais; metas: espera).
 *                   Sem resposta: mediana 7 dias, `estimado: true`.
 *
 * Nada aqui grava: só lê. Chaves retrocompatíveis (as mesmas de hoje).
 */
import { GASTO_ANCHOR, type AreaKey } from "@/lib/funnel";
import { CHAVES_FUNIL_W, lerChave } from "@/pages/funis/w/retomada";

export type NumeroDaRota = {
  rota: AreaKey;
  tipo: "reais" | "dias";
  /** Por mês: R$ que somem (reais) ou dias organizados (dias). */
  valor: number;
  /** Rótulo pronto pra copy ("R$ 500", "7 dias"). */
  rotulo: string;
  /** Veio da mediana da rota, não da resposta dela. */
  estimado: boolean;
  /** A resposta crua do quiz, quando houve. */
  resposta: string | null;
};

/** Mediana da rota dinheiro (a faixa "R$ 300 a R$ 500" é a mais escolhida: 500). */
export const MEDIANA_REAIS = 500;
/** Mediana das rotas de vida: uma semana organizada por mês. */
export const MEDIANA_DIAS = 7;
/** Horizonte do gráfico e da copy ("até {mês}"): 3 meses. */
export const MESES_DO_GRAFICO = 3;

/** Resposta de "gasto" → R$ por mês (a mesma régua do GASTO_ANCHOR do funil). */
export const REAIS_POR_RESPOSTA: Record<string, number> = {
  "Menos de R$ 100": 100,
  "R$ 100 a R$ 300": 300,
  "R$ 300 a R$ 500": 500,
  "Mais de R$ 500": 800,
};

/** Resposta de consistência → dias organizados por mês, por rota. */
export const DIAS_POR_RESPOSTA: Record<Exclude<AreaKey, "dinheiro">, Record<string, number>> = {
  rotina: { "Uns 3 dias": 3, "Uma semana": 7, "Um mês, aí largo": 12, "Nunca consegui manter": 2 },
  corpo: { "Essa vai ser a primeira": 7, "Umas 2 ou 3": 7, "Perdi a conta": 4, "Tô na ativa, mas sem controle": 12 },
  saude: { "Cansaço o dia todo": 5, "Sono ruim": 6, "Ansiedade e estresse": 5, "Tô bem — quero prevenir": 12 },
  metas: { "Surgiu agora": 10, "Uns meses": 7, "Mais de um ano": 4, "Anos… nem conto mais": 2 },
};

export const formatarReais = (n: number): string => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

/** Monta o número a partir de rota + respostas (puro; é o que o funil grava). */
export function numeroDaRotaDe(rota: AreaKey | null | undefined, respostas: Record<string, string> | null | undefined): NumeroDaRota {
  const r: AreaKey = rota === "dinheiro" || (rota && rota in DIAS_POR_RESPOSTA) ? rota : "dinheiro";
  if (r === "dinheiro") {
    const resposta = respostas?.gasto ?? null;
    const v = resposta ? REAIS_POR_RESPOSTA[resposta] : undefined;
    const valor = v ?? MEDIANA_REAIS;
    // "Mais de R$ 500" fica "R$ 500+" na copy, como no GASTO_ANCHOR de hoje
    const rotulo = resposta && GASTO_ANCHOR[resposta] ? GASTO_ANCHOR[resposta]!.month : formatarReais(valor);
    return { rota: r, tipo: "reais", valor, rotulo, estimado: v === undefined, resposta };
  }
  const resposta = respostas?.consistencia ?? null;
  const v = resposta ? DIAS_POR_RESPOSTA[r][resposta] : undefined;
  const valor = v ?? MEDIANA_DIAS;
  return { rota: r, tipo: "dias", valor, rotulo: `${valor} ${valor === 1 ? "dia" : "dias"}`, estimado: v === undefined, resposta };
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
 * A projeção do gráfico, por mês, pra `MESES_DO_GRAFICO` meses — do "hoje" (ponto 0)
 * até o mês alvo. Devolve as duas séries em valores ABSOLUTOS da unidade:
 *   reais: `sem` = acumulado que some (cresce linear); `com` = o que ainda escapa com
 *          registro (achata: 40% no 1º mês, 15% no 2º, 10% nos seguintes).
 *   dias:  `sem` = dias PERDIDOS acumulados (30 − valor por mês); `com` = dias perdidos
 *          com o CORE (caem: 10, 5, 3 por mês).
 */
export function projecao(n: NumeroDaRota, meses: number = MESES_DO_GRAFICO): { sem: number[]; com: number[] } {
  const sem = [0];
  const com = [0];
  const escapa = n.tipo === "reais" ? [0.4, 0.15, 0.1, 0.1, 0.1, 0.1] : [];
  const perdidosCom = [10, 5, 3, 3, 3, 3];
  for (let m = 1; m <= meses; m++) {
    if (n.tipo === "reais") {
      sem.push(n.valor * m);
      com.push(com[m - 1] + n.valor * (escapa[m - 1] ?? 0.1));
    } else {
      sem.push(sem[m - 1] + Math.max(0, 30 - n.valor));
      com.push(com[m - 1] + (perdidosCom[m - 1] ?? 3));
    }
  }
  return { sem: sem.map((v) => Math.round(v)), com: com.map((v) => Math.round(v)) };
}

/** A copy do gráfico, pronta: título em duas linhas + legenda + CTA, por tipo. */
export function copyDoGrafico(n: NumeroDaRota, hoje: Date = new Date()): { titulo: string; subtitulo: string; legenda: string; cta: string; semRotulo: string; comRotulo: string } {
  const p = projecao(n);
  const alvo = mesAlvo(hoje);
  const total = p.sem[p.sem.length - 1];
  if (n.tipo === "reais") {
    return {
      titulo: n.estimado ? `Em média, ${n.rotulo} somem por mês.` : `${n.rotulo} somem por mês.`,
      subtitulo: `Até ${alvo}, ${formatarReais(total)} sem rastro.`,
      legenda: "Com o CORE você vê pra onde vai cada real.",
      cta: "Quero ver pra onde vai",
      semRotulo: "Sem o CORE",
      comRotulo: "Com o CORE",
    };
  }
  const LEGENDA: Record<Exclude<AreaKey, "dinheiro">, string> = {
    rotina: "Com o CORE, o dia se organiza sozinho — e a sequência não quebra.",
    corpo: "Com o CORE, treino e dieta no mesmo lugar — sem recomeçar do zero.",
    saude: "Com o CORE, água, sono e vitaminas na hora — no automático.",
    metas: "Com o CORE, a meta vira plano que você vê todo dia.",
  };
  return {
    titulo: n.estimado ? `Em média, ${n.rotulo} organizados por mês.` : `Hoje são ${n.rotulo} organizados por mês.`,
    subtitulo: `Até ${alvo}, ${total} dias perdidos.`,
    legenda: LEGENDA[n.rota as Exclude<AreaKey, "dinheiro">],
    cta: "Quero meus dias de volta",
    semRotulo: "Sem o CORE",
    comRotulo: "Com o CORE",
  };
}
