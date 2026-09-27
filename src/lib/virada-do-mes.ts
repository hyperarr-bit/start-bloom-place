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
 * (26/09: os dois ganharam CARIMBO de mês e, com ele, retrato no mês que
 * acabou — as contas em lib/virada-contas, os fixos em `viradaDeFixos`,
 * mais abaixo.)
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

/* ═══ OS CUSTOS FIXOS DO MÊS QUE ACABOU (26/09, auditoria da virada) ═══
 *
 * O parágrafo lá de cima ("o que NÃO entra aqui") valia pra separar por
 * DATA: fixo não tem data por item. Só que todo leitor de mês passado —
 * retrospectiva do dia 1º, Comparação Mensal e Anual, gráficos do
 * Dashboard, resumo da virada — procura `finance-{ano}-{mes}-fixed`, e
 * ninguém escrevia essa chave (só a planilha do mês, se a pessoa editasse
 * lá). No dia 1º o aluguel de setembro sumia de SETEMBRO: "saiu" menor,
 * "% guardado" maior, "Poupador" onde não houve poupança.
 *
 * O que dá pra afirmar sem inventar: na primeira abertura do mês novo, a
 * lista de `finance-fixed-expenses` é a que valia no mês da ÚLTIMA virada
 * que a viu (ninguém mexe nela entre uma abertura e outra). Esse mês vai
 * num carimbo NOVO (`finance-fixed-expenses-mes`, aditivo como o das
 * contas). Duas travas contra dado inventado:
 *   - mês SEM movimento (nenhuma receita/gasto datado nele) não ganha
 *     retrato: um mês em que a pessoa não usou Finanças viraria "saiu
 *     R$ 2.000, entrou R$ 0" na retrospectiva;
 *   - quem chama nunca grava por cima de chave que já existe (planilha
 *     editada), nem cria arquivo com lista vazia.
 * Transição: sem carimbo (todo mundo em 01/10/2026, a chave é nova), o mês
 * do retrato é o anterior do calendário — valendo a mesma trava de
 * movimento.
 */
export const CHAVE_FIXOS = "finance-fixed-expenses";
/** Chave NOVA (26/09): de que mês é a lista que está em `finance-fixed-expenses`. */
export const CHAVE_CARIMBO_FIXOS = "finance-fixed-expenses-mes";

/** "YYYY-MM" LOCAL (mesma regra do mesCorrenteId de lib/virada-contas —
 *  repetida aqui porque virada-contas importa este arquivo). */
const mesLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ehMes = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const mesAntesDe = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
};

export interface ViradaDeFixos {
  /** Retrato a guardar no mês que acabou — null se o mês não é sabido ou não teve movimento. */
  arquivo: { chave: string; fixos: unknown[] } | null;
  /** Carimbo novo (o mês de agora). */
  carimbo: string;
}

/**
 * Decide o retrato dos fixos. `null` = nada a fazer (o caminho de toda
 * abertura normal). `teveMovimento(ano, mesIdx0)` diz se o mês teve receita
 * ou gasto — quem chama sabe ler as chaves (e o que acabou de arquivar).
 */
export const viradaDeFixos = (
  fixos: unknown,
  carimboAtual: unknown,
  hoje: Date,
  teveMovimento: (ano: number, mes: number) => boolean,
): ViradaDeFixos | null => {
  const agora = mesLocal(hoje);
  if (carimboAtual === agora) return null;
  // carimbo à frente do relógio (outro aparelho num fuso adiantado): não anda pra trás
  if (ehMes(carimboAtual) && carimboAtual > agora) return null;
  const lista = Array.isArray(fixos) ? fixos : [];
  // Sem fixo não há retrato; o carimbo só avança se já existia (convidado
  // vazio não ganha chave nenhuma — ela migraria pra conta no cadastro).
  if (lista.length === 0) return ehMes(carimboAtual) ? { arquivo: null, carimbo: agora } : null;
  const alvo = ehMes(carimboAtual) ? carimboAtual : mesAntesDe(agora);
  const [ano, mes] = alvo.split("-").map(Number);
  const arquivo = teveMovimento(ano, mes - 1) ? { chave: chaveArquivada(ano, mes - 1, "fixed"), fixos: lista } : null;
  return { arquivo, carimbo: agora };
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
