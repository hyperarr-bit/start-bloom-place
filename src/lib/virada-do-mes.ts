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

/* ═══ O MÊS PRÉ-PREENCHIDO QUE "SUMIA" NA VIRADA (02/10, chamado de cliente) ═══
 *
 * RELATO (web, 02/10): "deixo Receitas, Custos Fixos e Variáveis
 * pré-preenchidos para o próximo mês… sempre que vira, ele copia e cola
 * sozinho e perco tudo o que eu havia inserido. Respondo NÃO na pergunta de
 * copiar, mas acontece mesmo assim."
 *
 * CAUSA: as chaves do módulo mudam de NOME quando o mês vira. Em setembro, a
 * planilha de "Outubro" grava em `finance-2026-outubro-incomes/expenses/
 * fixed/dueDays/notes` (getFinanceStorageKeys, mês ≠ corrente). No dia 1º,
 * "Outubro" passa a ser o mês corrente e a MESMA planilha passa a ler
 * `finance-incomes`, `finance-expenses`, `finance-fixed-expenses`… — o balde
 * sem prefixo, que ainda carrega os fixos e as contas de setembro (eles
 * atravessam o mês por natureza). Ninguém nunca leu as chaves datadas do
 * próprio mês corrente: o que a pessoa planejou ficava gravado, intacto e
 * INVISÍVEL, e na tela aparecia o que veio de setembro — pra ela, "copiou
 * sozinho e apagou o meu". O diálogo de copiar não tem culpa: o NÃO era
 * respeitado; o estrago já estava feito antes da pergunta. As parcelas
 * "funcionam bem nos próximos meses" exatamente porque `viradaDeParcelas`
 * já olha a chave datada do mês corrente (diff 0) — era o único balde que
 * olhava.
 *
 * O CONSERTO é ADOTAR: na primeira passada do mês novo (depois de arquivar
 * o mês que acabou e zerar os ✓), o conteúdo das chaves datadas do mês
 * corrente entra no balde sem prefixo e a chave datada é esvaziada (o dado
 * mudou de endereço; ele não some). Regras, em ordem de quem manda:
 *   - nada do balde é apagado — o que veio do mês passado (fixo, conta) e o
 *     que a pessoa já lançou no dia 1º continuam;
 *   - nada duplica: id igual não entra; receita/gasto igual por
 *     perfil+descrição+valor (contando repetidos, como a cópia do mês) não
 *     entra; fixo igual por perfil+descrição não entra — mas o VALOR
 *     pré-preenchido vence (ela planejou "Luz 180" pra outubro; o 150 de
 *     setembro é o padrão), mantendo o id do balde pra conta `fx-<id>` e o
 *     ✓ dela sobreviverem; conta igual por dia+nome não entra; conta ligada
 *     a fixo só entra se o fixo existir (o finance-sync regenera as outras);
 *   - gasto/receita pré-preenchido com data de OUTRO mês (o formulário põe
 *     "hoje" quando a pessoa não escolhe, e "hoje" era setembro) ganha o
 *     mesmo dia no mês adotado — senão `separarPorMes` o arquivaria em
 *     setembro na passada seguinte e ele sumiria de novo;
 *   - esvaziar a origem é o que torna a passada idempotente sem carimbo
 *     novo: rodar de novo (ou num segundo aparelho com a chave ainda cheia)
 *     acha id já no balde e não duplica. E, com a origem vazia, o arquivo
 *     do mês no fim dele nasce só do balde — sem fantasma de item que a
 *     pessoa apagou durante o mês.
 */
const SUFIXOS_ADOTAVEIS = ["incomes", "expenses", "fixed", "dueDays", "notes"] as const;
type SufixoAdotavel = (typeof SUFIXOS_ADOTAVEIS)[number];

/** Chave sem prefixo (balde corrente) de cada sufixo adotável. */
export const BALDE_CORRENTE: Record<SufixoAdotavel, string> = {
  incomes: "finance-incomes",
  expenses: "finance-expenses",
  fixed: CHAVE_FIXOS,
  dueDays: "finance-dueDays",
  notes: "finance-notes",
};

/** As chaves DATADAS de um "YYYY-MM" — as mesmas que getFinanceStorageKeys
 *  devolve quando o mês não é o corrente. */
export const chavesDatadasDoMes = (mesId: string): Record<SufixoAdotavel, string> => {
  const ano = Number(mesId.slice(0, 4));
  const mes = Number(mesId.slice(5, 7)) - 1;
  return {
    incomes: chaveArquivada(ano, mes, "incomes"),
    expenses: chaveArquivada(ano, mes, "expenses"),
    fixed: chaveArquivada(ano, mes, "fixed"),
    dueDays: chaveArquivada(ano, mes, "dueDays"),
    notes: chaveArquivada(ano, mes, "notes"),
  };
};

export interface ConteudoDoMes {
  incomes: unknown;
  expenses: unknown;
  fixed: unknown;
  dueDays: unknown;
  notes: unknown;
}

export interface Adocao {
  /** chave → valor a gravar (baldes mesclados + chaves datadas esvaziadas). */
  gravar: Record<string, unknown>;
  /** Quantos itens entraram em cada balde (pra medição). */
  adotados: Record<SufixoAdotavel, number>;
}

const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const perfilDe = (i: any) => norm(i?.perfil) || "pessoal";
const idDe = (i: any) => String(i?.id ?? "");
const temContasEm = (dias: unknown) => lista(dias).some((d) => lista(d?.bills).length > 0);

/** Tira de `fonte` o que `destino` já tem pela chave, contando repetidos. */
const oQueFalta = (fonte: any[], destino: any[], chave: (i: any) => string, idsDoDestino: Set<string>): any[] => {
  const tem = new Map<string, number>();
  for (const i of destino) tem.set(chave(i), (tem.get(chave(i)) ?? 0) + 1);
  const falta: any[] = [];
  for (const i of fonte) {
    const id = idDe(i);
    if (id && idsDoDestino.has(id)) continue;
    const k = chave(i);
    const n = tem.get(k) ?? 0;
    if (n > 0) { tem.set(k, n - 1); continue; }
    falta.push(i);
  }
  return falta;
};

/** Mesmo dia, no mês adotado (limitado ao último dia dele). Data ilegível fica. */
const noMes = (item: any, mesId: string): any => {
  const m = typeof item?.date === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(item.date.trim()) : null;
  if (!m || `${m[1]}-${m[2]}` === mesId) return item;
  const ano = Number(mesId.slice(0, 4));
  const mes = Number(mesId.slice(5, 7));
  const ultimo = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Math.max(1, Number(m[3])), ultimo);
  return { ...item, date: `${mesId}-${String(dia).padStart(2, "0")}` };
};

/**
 * Decide a adoção do mês pré-preenchido pro balde corrente. `null` quando as
 * chaves datadas de `mesId` não têm nada — o caminho de toda abertura normal.
 * Pura: quem chama lê as chaves e grava o que vier em `gravar`.
 */
export const adotarMesPreenchido = (
  preenchido: ConteudoDoMes,
  baldes: ConteudoDoMes,
  mesId: string,
): Adocao | null => {
  const chaves = chavesDatadasDoMes(mesId);
  const gravar: Record<string, unknown> = {};
  const adotados: Record<SufixoAdotavel, number> = { incomes: 0, expenses: 0, fixed: 0, dueDays: 0, notes: 0 };

  // receitas e gastos: por id, depois por perfil+descrição+valor (contando)
  for (const sufixo of ["incomes", "expenses"] as const) {
    const pre = lista(preenchido[sufixo]);
    if (pre.length === 0) continue;
    const balde = lista(baldes[sufixo]);
    const ids = new Set(balde.map(idDe).filter(Boolean));
    const novos = oQueFalta(pre, balde, (i) => `${perfilDe(i)}|${norm(i?.description)}|${Number(i?.value) || 0}`, ids)
      .map((i) => noMes(i, mesId));
    if (novos.length > 0) gravar[BALDE_CORRENTE[sufixo]] = [...balde, ...novos];
    adotados[sufixo] = novos.length;
    gravar[chaves[sufixo]] = [];
  }

  // fixos: por id, depois por perfil+descrição — o pré-preenchido manda nos
  // campos, o balde manda no id (é ele que a conta `fx-<id>` conhece)
  const preFixos = lista(preenchido.fixed);
  let fixosFinal = lista(baldes.fixed);
  if (preFixos.length > 0) {
    const ids = new Set(fixosFinal.map(idDe).filter(Boolean));
    let mudou = false;
    const usados = new Set<number>();
    for (const p of preFixos) {
      if (idDe(p) && ids.has(idDe(p))) continue;
      const k = `${perfilDe(p)}|${norm(p?.description)}`;
      const idx = fixosFinal.findIndex((b, i) => !usados.has(i) && `${perfilDe(b)}|${norm(b?.description)}` === k);
      if (idx >= 0) {
        usados.add(idx);
        const atual = fixosFinal[idx];
        const novo = { ...atual, ...p, id: atual.id };
        if (JSON.stringify(novo) !== JSON.stringify(atual)) { fixosFinal = fixosFinal.map((b, i) => (i === idx ? novo : b)); mudou = true; }
        continue;
      }
      fixosFinal = [...fixosFinal, p];
      if (idDe(p)) ids.add(idDe(p));
      adotados.fixed++;
      mudou = true;
    }
    if (mudou) gravar[BALDE_CORRENTE.fixed] = fixosFinal;
    gravar[chaves.fixed] = [];
  }

  // contas do mês: por id; ligada a fixo só se o fixo existe; avulsa por dia+nome
  const preDias = lista(preenchido.dueDays);
  if (temContasEm(preDias)) {
    const dias = lista(baldes.dueDays).map((d) => ({ ...d, bills: [...lista(d?.bills)] }));
    const ids = new Set(dias.flatMap((d) => d.bills.map(idDe)).filter(Boolean));
    const fixosVivos = new Set(fixosFinal.map(idDe).filter(Boolean));
    let mudou = false;
    for (const d of preDias) {
      const dia = Number(d?.day);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) continue;
      for (const b of lista(d?.bills)) {
        if (!b || (idDe(b) && ids.has(idDe(b)))) continue;
        if (b.fixedId && !fixosVivos.has(String(b.fixedId))) continue;
        if (b.fixedId && dias.some((x) => x.bills.some((y: any) => String(y?.fixedId ?? "") === String(b.fixedId)))) continue;
        let alvo = dias.find((x) => Number(x?.day) === dia);
        if (!b.fixedId && alvo && alvo.bills.some((y: any) => !y?.fixedId && norm(y?.name) === norm(b.name))) continue;
        if (!alvo) { alvo = { day: dia, color: d?.color ?? "slate", bills: [] }; dias.push(alvo); }
        alvo.bills.push(b);
        if (idDe(b)) ids.add(idDe(b));
        adotados.dueDays++;
        mudou = true;
      }
    }
    if (mudou) gravar[BALDE_CORRENTE.dueDays] = dias.sort((a, b) => Number(a.day) - Number(b.day));
    gravar[chaves.dueDays] = preDias.map((d) => ({ ...d, bills: [] }));
  }

  // anotações: por id, depois pelo texto
  const preNotas = lista(preenchido.notes);
  if (preNotas.length > 0) {
    const notas = lista(baldes.notes);
    const ids = new Set(notas.map(idDe).filter(Boolean));
    const novas = oQueFalta(preNotas, notas, (n) => norm(n?.text ?? n?.content ?? n?.title), ids);
    if (novas.length > 0) gravar[BALDE_CORRENTE.notes] = [...notas, ...novas];
    adotados.notes = novas.length;
    gravar[chaves.notes] = [];
  }

  return Object.keys(gravar).length > 0 ? { gravar, adotados } : null;
};

/** Há algo pré-preenchido pra adotar? (barato: só olha tamanhos) */
export const temMesPreenchido = (preenchido: ConteudoDoMes): boolean =>
  lista(preenchido.incomes).length > 0 || lista(preenchido.expenses).length > 0 ||
  lista(preenchido.fixed).length > 0 || temContasEm(preenchido.dueDays) || lista(preenchido.notes).length > 0;

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
