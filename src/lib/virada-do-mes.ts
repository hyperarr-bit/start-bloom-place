/**
 * A virada do mês que nunca acontecia (01/08).
 *
 * SINTOMA que chegou: "abri a retrospectiva de julho e apareceu treino".
 *
 * CAUSA, confirmada na conta real do dono: o módulo de Finanças guarda o mês
 * CORRENTE em chaves sem prefixo (`finance-expenses`) e os meses passados em
 * chaves com data (`finance-2026-julho-expenses`). Quando o mês vira, o nome
 * do balde muda — mas ninguém move o conteúdo. Nada, em lugar nenhum do
 * código, escrevia `finance-{ano}-{mes}-*` na virada. O único escritor era o
 * cartão de virada, e ele só copia o mês anterior PRA FRENTE; nunca arquiva.
 *
 * O estrago tem duas caras:
 *   1. a retrospectiva de julho procura `finance-2026-julho-*`, não acha nada,
 *      conclui "esse mês não teve dinheiro" e pula os slides de dinheiro —
 *      abrindo direto no primeiro slide de vida, que é treino;
 *   2. pior e invisível: `getMonthTotals` SOMA o array inteiro sem olhar a
 *      data de cada item. Então o balde É o mês. Na conta do dono, o balde
 *      "de agosto" continha lançamentos de 2026-05-01 até 2026-06-10 — meses
 *      de gasto antigo sendo exibidos como gasto do mês atual.
 *
 * E o cartão de virada se auto-desligava exatamente aqui: ele decide se
 * aparece perguntando se o mês anterior tem dados, olhando a chave arquivada
 * — que está vazia justamente porque nada arquiva. Só agia quando não era
 * mais preciso.
 *
 * ESTA correção separa por DATA DO LANÇAMENTO, não por "de quem era o balde".
 * É o único critério que sobrevive a viradas já perdidas: um gasto de
 * 2026-05-01 pertence a maio, tenha ele passado por quantos meses tiver.
 *
 * O que NÃO entra aqui, de propósito: `finance-fixed-expenses` e
 * `finance-dueDays` não têm data por item — são recorrentes, valem "todo mês"
 * por natureza. Chutar de que mês eles eram seria inventar dado. Eles seguem
 * no balde corrente e continuam sendo copiados adiante pelo cartão de virada.
 */

import { getMonthKey } from "@/components/finance/storage-keys";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface Lancamento {
  id?: string | number;
  date?: string;
  [campo: string]: unknown;
}

export interface Separacao {
  /** Fica no balde do mês corrente (`finance-expenses` / `finance-incomes`). */
  ficam: Lancamento[];
  /** chave lógica arquivada → itens que passam a morar nela. */
  arquivar: Record<string, Lancamento[]>;
  movidos: number;
}

/**
 * Ano-mês de uma data "YYYY-MM-DD" lida como data LOCAL.
 *
 * `new Date("2026-05-01")` seria interpretado como UTC e, no fuso do Brasil,
 * voltaria dia 30/04 — jogando o lançamento pro mês errado exatamente na
 * virada, que é onde isto tem que estar certo. Por isso é parse de texto.
 */
const anoMesDe = (data: unknown): { ano: number; mes: number } | null => {
  if (typeof data !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1;
  if (!Number.isFinite(ano) || mes < 0 || mes > 11) return null;
  return { ano, mes };
};

/** Chave lógica do mês arquivado: `finance-2026-julho-expenses`. */
export const chaveArquivada = (ano: number, mes: number, sufixo: string) =>
  `finance-${ano}-${getMonthKey(MESES[mes])}-${sufixo}`;

/**
 * Separa o balde corrente entre "é do mês atual" e "pertence a um mês
 * passado". Item sem data legível FICA — na dúvida não se mexe no dado de
 * ninguém.
 */
export const separarPorMes = (
  itens: Lancamento[],
  hoje: Date,
  sufixo: "expenses" | "incomes",
): Separacao => {
  const ficam: Lancamento[] = [];
  const arquivar: Record<string, Lancamento[]> = {};
  let movidos = 0;

  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  for (const item of Array.isArray(itens) ? itens : []) {
    const quando = anoMesDe(item?.date);
    if (!quando || (quando.ano === anoAtual && quando.mes === mesAtual)) {
      ficam.push(item);
      continue;
    }
    // Data no FUTURO também fica: lançamento agendado é do mês corrente na
    // cabeça de quem lançou, e arquivá-lo o esconderia da própria pessoa.
    if (quando.ano > anoAtual || (quando.ano === anoAtual && quando.mes > mesAtual)) {
      ficam.push(item);
      continue;
    }
    const chave = chaveArquivada(quando.ano, quando.mes, sufixo);
    (arquivar[chave] ??= []).push(item);
    movidos++;
  }

  return { ficam, arquivar, movidos };
};

/**
 * Junta o que vai ser arquivado com o que já existe na chave do mês passado,
 * sem duplicar. Rodar duas vezes tem que dar o mesmo resultado de rodar uma —
 * esta função é o que garante isso.
 */
export const mesclarSemDuplicar = (
  existentes: Lancamento[],
  novos: Lancamento[],
): Lancamento[] => {
  const base = Array.isArray(existentes) ? existentes : [];
  const vistos = new Set(base.map((i) => String(i?.id ?? "")).filter(Boolean));
  const saida = [...base];
  for (const item of novos) {
    const id = String(item?.id ?? "");
    if (id && vistos.has(id)) continue;
    if (id) vistos.add(id);
    saida.push(item);
  }
  return saida;
};
