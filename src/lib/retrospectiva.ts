import { readMonthData } from "@/components/finance/storage-keys";
import { buildWrappedData, type WrappedData } from "@/components/wrapped/MonthlyWrapped";

/**
 * Retrospectiva do mês — a camada de DADOS (27/07).
 *
 * Até aqui a retrospectiva só sabia falar de dinheiro. Isso a tornava
 * invisível pra metade da base: quem usa o CORE pra hábito, leitura e treino
 * abria e não via nada. Como agora existe uma NOTIFICAÇÃO mensal chamando a
 * pessoa pra cá, mandar alguém pra uma tela vazia seria pior do que não
 * mandar. Então a retrospectiva passa a ler a vida inteira, e as finanças
 * viram um bloco entre outros.
 *
 * Tudo é lido do mesmo lugar que os módulos escrevem (localStorage por
 * usuário), sem servidor: a retrospectiva funciona offline e no avião.
 */

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface RetroVida {
  /** dias com QUALQUER atividade marcada no heatmap */
  diasAtivos: number;
  /** dias do mês já vividos (o mês corrente não conta o futuro) */
  diasPossiveis: number;
  /** maior sequência de dias ativos DENTRO do mês */
  melhorSequencia: number;
  treinos: number;
  livros: { titulo: string; autor: string }[];
  paginas: number;
  diasDeDiario: number;
  /** média 1–5 do humor registrado, null se ninguém registrou */
  humorMedio: number | null;
  /** dia com o melhor humor do mês (e qual foi) */
  melhorDia: { dia: number; nota: number } | null;
  copos: number;
}

export interface RetroMes {
  mes: string;
  ano: number;
  financas: WrappedData | null;
  vida: RetroVida | null;
  perfil: { emoji: string; name: string; line: string };
}

const naFaixa = (chave: string, ano: number, mesIdx: number) =>
  chave.startsWith(`${ano}-${String(mesIdx + 1).padStart(2, "0")}-`);

const diaDe = (chave: string) => Number(chave.slice(8, 10));

const nivel = (v: unknown) => (typeof v === "number" ? v : v === true ? 1 : 0);

/** Dias do mês que já aconteceram — em Julho corrente, dia 27 e não 31. */
const diasPossiveisDe = (ano: number, mesIdx: number) => {
  const hoje = new Date();
  const noMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mesIdx;
  return noMesAtual ? hoje.getDate() : new Date(ano, mesIdx + 1, 0).getDate();
};

type Livro = { title?: string; author?: string; status?: string; pages?: number; endDate?: string };
type Entrada = { gratitude?: string[]; learned?: string; tomorrow?: string };

/**
 * Snapshot dos módulos de vida, lido UMA vez.
 *
 * Sem isto, a tela que lista 12 meses reparsearia `journal-entries` (que
 * passa fácil de 50KB) doze vezes seguidas na montagem — jank puro por um
 * dado que não muda entre um mês e outro. As chaves aqui são globais e
 * indexadas por data; quem recorta o mês é o construtor.
 */
export interface DadosDaVida {
  heatmap: Record<string, boolean | number>;
  treinos: string[];
  acervo: Livro[];
  diario: Record<string, Entrada>;
  humor: Record<string, { mood?: number }>;
  agua: Record<string, number>;
  aguaSaude: Record<string, number>;
}

export const lerDadosDaVida = (userId: string | null): DadosDaVida => {
  const ler = <T,>(chave: string, padrao: T): T => (readMonthData(userId, chave) ?? padrao) as T;
  return {
    heatmap: ler("heatmap-log", {}),
    treinos: ler("saude-workout-log", []),
    acervo: ler("lib-books", []),
    diario: ler("journal-entries", {}),
    humor: ler("mood-log", {}),
    agua: ler("water-log", {}),
    aguaSaude: ler("core-saude-water", {}),
  };
};

/**
 * Recorta um mês do snapshot. Devolve null quando NADA aconteceu — assim quem
 * chama sabe que não há bloco a mostrar, em vez de exibir uma tela cheia de
 * zeros.
 */
export const construirRetroVida = (
  ano: number,
  mesIdx: number,
  dados: DadosDaVida,
): RetroVida | null => {
  // ---- dias ativos + melhor sequência (heatmap da Rotina) ----
  const heatmap = dados.heatmap ?? {};
  const diasMarcados = Object.entries(heatmap)
    .filter(([k, v]) => naFaixa(k, ano, mesIdx) && nivel(v) > 0)
    .map(([k]) => diaDe(k))
    .sort((a, b) => a - b);

  let melhorSequencia = 0;
  let corrente = 0;
  let anterior = -99;
  for (const d of diasMarcados) {
    corrente = d === anterior + 1 ? corrente + 1 : 1;
    if (corrente > melhorSequencia) melhorSequencia = corrente;
    anterior = d;
  }

  // ---- treinos ----
  const log = dados.treinos;
  const treinos = (Array.isArray(log) ? log : []).filter((d) => typeof d === "string" && naFaixa(d, ano, mesIdx)).length;

  // ---- leitura: livro conta no mês em que foi TERMINADO ----
  const acervo = dados.acervo;
  const terminados = (Array.isArray(acervo) ? acervo : []).filter(
    (b) => b?.status === "lido" && typeof b?.endDate === "string" && naFaixa(b.endDate, ano, mesIdx),
  );
  const livros = terminados.map((b) => ({ titulo: b.title || "Sem título", autor: b.author || "" }));
  const paginas = terminados.reduce((s, b) => s + (Number(b.pages) || 0), 0);

  // ---- diário ----
  const diario = dados.diario ?? {};
  const diasDeDiario = Object.entries(diario).filter(([k, e]) => {
    if (!naFaixa(k, ano, mesIdx)) return false;
    const g = Array.isArray(e?.gratitude) ? e.gratitude.filter(Boolean).length : 0;
    return g > 0 || !!e?.learned || !!e?.tomorrow;
  }).length;

  // ---- humor ----
  const humor = dados.humor ?? {};
  const notas = Object.entries(humor)
    .filter(([k, v]) => naFaixa(k, ano, mesIdx) && Number(v?.mood) > 0)
    .map(([k, v]) => ({ dia: diaDe(k), nota: Number(v.mood) }));
  const humorMedio = notas.length ? notas.reduce((s, n) => s + n.nota, 0) / notas.length : null;
  const melhorDia = notas.length
    ? notas.reduce((melhor, n) => (n.nota > melhor.nota ? n : melhor), notas[0])
    : null;

  // ---- água (as duas chaves: o hub e o módulo Saúde escrevem em lugares diferentes) ----
  const somaCopos = (registro: Record<string, number>) =>
    Object.entries(registro ?? {})
      .filter(([k]) => naFaixa(k, ano, mesIdx))
      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  const copos = somaCopos(dados.agua) + somaCopos(dados.aguaSaude);

  const vazio =
    diasMarcados.length === 0 && treinos === 0 && livros.length === 0 &&
    diasDeDiario === 0 && humorMedio === null && copos === 0;
  if (vazio) return null;

  return {
    diasAtivos: diasMarcados.length,
    diasPossiveis: diasPossiveisDe(ano, mesIdx),
    melhorSequencia,
    treinos,
    livros,
    paginas,
    diasDeDiario,
    humorMedio,
    melhorDia,
    copos,
  };
};

/**
 * O "perfil do mês" — o slide que a pessoa printa e manda no grupo.
 *
 * A ordem importa: o perfil sai do que ela MAIS fez, não do módulo que o app
 * prefere. Um mês de 4 livros vira "Devorador de livros" mesmo com finanças
 * lançadas, porque foi ali que a pessoa se reconhece. Dinheiro só assume o
 * perfil quando o número é notável (guardou 30%+ ou fechou no vermelho).
 */
const perfilDoMes = (f: WrappedData | null, v: RetroVida | null): RetroMes["perfil"] => {
  const consistencia = v && v.diasPossiveis > 0 ? v.diasAtivos / v.diasPossiveis : 0;

  if (f && f.savingsRate >= 30) {
    return { emoji: "🐷", name: "Cofre Forte", line: `Guardou ${f.savingsRate.toFixed(0)}% da renda. Elite.` };
  }
  if (v && v.livros.length >= 3) {
    return { emoji: "📚", name: "Devorador de Livros", line: `${v.livros.length} livros terminados em um mês só.` };
  }
  if (v && v.treinos >= 12) {
    return { emoji: "🏋️", name: "Modo Atleta", line: `${v.treinos} treinos registrados. Sem desculpa.` };
  }
  if (consistencia >= 0.8) {
    return { emoji: "🔥", name: "Imparável", line: `Ativo em ${v!.diasAtivos} dos ${v!.diasPossiveis} dias do mês.` };
  }
  if (v && v.diasDeDiario >= 10) {
    return { emoji: "✨", name: "Observador", line: `${v.diasDeDiario} dias de diário. Poucos param pra pensar.` };
  }
  if (v && v.melhorSequencia >= 7) {
    return { emoji: "⛓️", name: "Corrente Longa", line: `${v.melhorSequencia} dias seguidos sem quebrar.` };
  }
  if (f && f.balance < 0) {
    return { emoji: "🌪️", name: "Mês Turbulento", line: "Saiu mais do que entrou. Acontece — agora tá no radar." };
  }
  if (f && f.savingsRate >= 10) {
    return { emoji: "⚖️", name: "Equilibrista", line: "Fechou no azul, com folga. Consistência é tudo." };
  }
  if (consistencia >= 0.5) {
    return { emoji: "🌱", name: "Em Construção", line: `Mais da metade do mês no jogo. Isso vira hábito.` };
  }
  if (f) {
    return { emoji: "🤏", name: "No Limite", line: "Fechou no azul... por pouco. Próximo mês a gente folga." };
  }
  return { emoji: "🧭", name: "Recomeço", line: "O mês foi curto por aqui. O próximo começa agora." };
};

/**
 * Monta a retrospectiva completa de um mês. Null quando não há NADA — nem
 * dinheiro nem vida. É esse null que a tela e a notificação usam pra decidir
 * se vale chamar a pessoa.
 */
export const construirRetroMes = (
  ano: number,
  mesIdx: number,
  userId: string | null,
  /** snapshot já lido — quem monta vários meses passa o mesmo pra todos */
  dados?: DadosDaVida,
): RetroMes | null => {
  const mes = MESES[mesIdx];
  const financas = buildWrappedData(mes, userId, ano);
  const vida = construirRetroVida(ano, mesIdx, dados ?? lerDadosDaVida(userId));
  if (!financas && !vida) return null;
  return { mes, ano, financas, vida, perfil: perfilDoMes(financas, vida) };
};

/** O mês anterior ao de hoje, com o ano certo na virada de dezembro. */
export const mesAnterior = () => {
  const hoje = new Date();
  const mesIdx = (hoje.getMonth() + 11) % 12;
  const ano = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
  return { ano, mesIdx };
};
