/**
 * PARCELAS QUE ATRAVESSAM OS MESES SOZINHAS (07/09).
 *
 * Avaliações da Play (set/2026) que motivam:
 *  - 3★: "Quando registro uma compra parcelada ela não é inserida no gasto
 *    do cartão nem repetida para os próximos meses até finalizar"
 *  - 4★: "quando coloco uma compra parcelada, ela não atualiza para o
 *    próximo mês, tendo que adicionar novamente"
 *  - 3★: "muitas áreas não clicáveis... nem alterar parcelas no cartão"
 *
 * O QUE HAVIA: uma compra parcelada é UM registro `Installment`, gravado na
 * chave do mês em que nasceu (`finance-installments` = balde do mês
 * corrente; `finance-{ano}-{mes}-installments` = outros meses). Nada levava
 * o registro adiante: a cópia do mês (MonthTurnover) e a virada
 * (use-virada-do-mes) ignoravam parcelas, e "k de N" só andava se a pessoa
 * lembrasse de tocar num checkbox que, por sinal, nascia `checked={false}`
 * fixo — nunca refletia nada.
 *
 * ── DESENHO ESCOLHIDO ────────────────────────────────────────────────────
 * Cada registro ganha DOIS campos opcionais:
 *   `startMonth`   "YYYY-MM" — mês da chave em que o registro vive;
 *   `parcelaDoMes` nº (1-based) da parcela que vence NESSE mês.
 * `paidInstallments` continua sendo "quantas já foram pagas". A parcela do
 * mês está paga quando `paid >= parcelaDoMes`. É isso que o checkbox mostra.
 *
 * O balde do mês corrente (`finance-installments`) continua sendo o LAR de
 * toda parcela viva — é ele que o Dashboard, as conquistas e o "Pergunte ao
 * CORE" leem, e ninguém nunca o arquivou. O que muda: na primeira abertura
 * de um mês novo, cada registro carimbado com `startMonth` anterior é
 * AVANÇADO NO PRÓPRIO BALDE (parcelaDoMes += meses passados; paid assume as
 * anteriores como pagas — fatura de cartão de mês passado foi cobrada de
 * qualquer jeito) e um RETRATO de como ele estava vai pra chave do mês que
 * acabou, pra planilha daquele mês continuar contando a história certa.
 *
 * Por que avançar no lugar em vez de "projetar ao ler" em todas as telas: a
 * tela de Finanças guarda cada chave num `usePersistedState`, que hidrata UMA
 * vez — editar um registro que mora em OUTRA chave (a de origem) por trás
 * daquele estado é o bug documentado no MonthTurnover (o toque seguinte
 * salva o velho por cima). Com o registro morando na chave do mês aberto, o
 * checkbox, a edição e a lixeira continuam locais. As OUTRAS planilhas
 * (mês futuro, mês passado sem retrato) recebem só uma PROJEÇÃO de leitura,
 * marcada "previsto", sem botão — nada a gravar, nada a conflitar.
 *
 * LEGADO (registro sem `startMonth`): vale "mês da chave em que está" e
 * `parcelaDoMes = paid + 1`, que é exatamente a conta de sempre. Nada é
 * reescrito em massa: o carimbo entra na primeira gravação feita pela
 * pessoa (pagar, editar, criar outro) — escrita de boot dispararia ativação
 * e degrau do teste grátis sem ninguém ter feito nada (review de 16/08).
 */

import { getMonthIndex, getMonthKey } from "@/components/finance/storage-keys";

export interface Parcela {
  id: string;
  description: string;
  totalValue: number;
  installmentValue: number;
  paidInstallments: number;
  totalInstallments: number;
  cardName: string;
  category: string;
  date: string;
  /** "YYYY-MM" — mês da chave em que o registro vive. Ausente = legado. */
  startMonth?: string;
  /** Nº (1-based) da parcela que vence em `startMonth`. Ausente = paid + 1. */
  parcelaDoMes?: number;
  /** Retrato/registro de mês passado que JÁ foi levado adiante. Nunca se
   *  leva de novo: apagar a cópia do mês corrente tem que ser definitivo. */
  levada?: boolean;
  perfil?: string;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Número seguro: NaN/Infinity/null viram 0 (parcela com total ÷ 0 já sumiu
 *  com dívida inteira do total — ver MonthlySheet, 16/08). */
export const n = (v: unknown): number => (v !== null && Number.isFinite(Number(v)) ? Number(v) : 0);

const ehMesId = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** "YYYY-MM" a partir do nome do mês da UI ("Setembro") e do ano. */
export const mesIdDe = (monthName: string, year: number): string => {
  const idx = getMonthIndex(monthName);
  return `${year}-${String((idx < 0 ? 0 : idx) + 1).padStart(2, "0")}`;
};

/** Nome do mês ("setembro") de um "YYYY-MM"; `curto` = "set". */
export const nomeDoMes = (mesId: string, curto = false): string => {
  if (!ehMesId(mesId)) return mesId;
  const idx = Number(mesId.slice(5, 7)) - 1;
  return curto ? MESES_CURTO[idx] : MESES[idx].toLowerCase();
};

/** Chave lógica ARQUIVADA das parcelas de um mês: `finance-2026-agosto-installments`. */
export const chaveArquivadaDeParcelas = (mesId: string): string => {
  const ano = Number(mesId.slice(0, 4));
  const idx = Number(mesId.slice(5, 7)) - 1;
  return `finance-${ano}-${getMonthKey(MESES[idx])}-installments`;
};

/** Meses de `de` até `ate` (negativo quando `ate` é antes). */
export const mesesEntre = (de: string, ate: string): number => {
  if (!ehMesId(de) || !ehMesId(ate)) return 0;
  return (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + (Number(ate.slice(5, 7)) - Number(de.slice(5, 7)));
};

export const somarMeses = (mesId: string, quantos: number): string => {
  const ano = Number(mesId.slice(0, 4));
  const idx = Number(mesId.slice(5, 7)) - 1 + quantos;
  const anoNovo = ano + Math.floor(idx / 12);
  const idxNovo = ((idx % 12) + 12) % 12;
  return `${anoNovo}-${String(idxNovo + 1).padStart(2, "0")}`;
};

/** Os `quantos` meses anteriores a `mesId`, do mais recente pro mais antigo. */
export const mesesAnteriores = (mesId: string, quantos: number): string[] =>
  Array.from({ length: quantos }, (_, i) => somarMeses(mesId, -(i + 1)));

/** Nº da parcela que vence no mês da chave. Legado = paid + 1. */
export const parcelaDoMes = (p: Parcela): number =>
  Number.isInteger(p.parcelaDoMes) && (p.parcelaDoMes as number) >= 1 ? (p.parcelaDoMes as number) : n(p.paidInstallments) + 1;

/** Existe parcela vencendo neste mês? (não quitou antes dele) */
export const parcelaAtiva = (p: Parcela): boolean => n(p.totalInstallments) >= 1 && parcelaDoMes(p) <= n(p.totalInstallments);

/** A parcela DESTE mês já foi paga? É o estado do checkbox. */
export const parcelaPagaNoMes = (p: Parcela): boolean => n(p.paidInstallments) >= parcelaDoMes(p);

/** Dívida inteira quitada (some dos totais, fica apagada na lista). */
export const parcelaQuitada = (p: Parcela): boolean => n(p.totalInstallments) >= 1 && n(p.paidInstallments) >= n(p.totalInstallments);

/** Quanto esta dívida custa NO MÊS da chave. Pagar a parcela não tira o
 *  valor do mês — o dinheiro saiu de qualquer jeito. */
export const valorDaParcelaNoMes = (p: Parcela): number => (parcelaAtiva(p) ? n(p.installmentValue) : 0);

/** Soma das parcelas do mês — é o terceiro termo de `computeMonthlyOutflow`. */
export const somaParcelasDoMes = (lista: Parcela[] | undefined | null): number =>
  (Array.isArray(lista) ? lista : []).reduce((s, p) => s + valorDaParcelaNoMes(p), 0);

/** Carimba o registro com o mês da chave (legado ganha `parcelaDoMes = paid+1`). */
export const carimbar = (p: Parcela, mes: string): Parcela =>
  ehMesId(p.startMonth) ? p : { ...p, startMonth: mes, parcelaDoMes: parcelaDoMes(p) };

export const carimbarLista = (lista: Parcela[], mes: string): Parcela[] => lista.map((p) => carimbar(p, mes));

/** Marca/desmarca a parcela do mês. Marcar nunca REDUZ o pago (quem pagou
 *  adiantado continua adiantado); desmarcar volta pra parcela anterior. */
export const marcarParcelaDoMes = (p: Parcela, paga: boolean, mes: string): Parcela => {
  const k = parcelaDoMes(p);
  const total = n(p.totalInstallments);
  const paid = n(p.paidInstallments);
  const novo = paga ? Math.max(paid, k) : Math.min(paid, k - 1);
  return { ...carimbar(p, mes), parcelaDoMes: k, paidInstallments: Math.max(0, Math.min(novo, total)) };
};

/**
 * Cópia do registro como ele fica em `mesAlvo`, `diff` meses depois de onde
 * mora. `null` quando o alvo não é depois. Quitada antes do alvo devolve
 * `parcelaDoMes = total + 1` (a chamada decide se quer mostrar quitadas).
 */
export const avancarPara = (p: Parcela, mesDaChave: string, mesAlvo: string): Parcela | null => {
  const origem = ehMesId(p.startMonth) ? (p.startMonth as string) : mesDaChave;
  const diff = mesesEntre(origem, mesAlvo);
  if (diff <= 0) return null;
  const total = n(p.totalInstallments);
  const k = Math.min(parcelaDoMes(p) + diff, total + 1);
  const paid = Math.min(total, Math.max(n(p.paidInstallments), k - 1));
  const { levada: _levada, ...semMarca } = p;
  return { ...semMarca, startMonth: mesAlvo, parcelaDoMes: k, paidInstallments: paid };
};

export interface FonteDeParcelas {
  /** Mês da chave de onde os itens vieram. */
  mes: string;
  itens: Parcela[];
}

/**
 * PROJEÇÃO DE LEITURA pra planilha de `mesAlvo`: o que as outras chaves
 * fariam aparecer ali. Fontes na ordem do mais recente pro mais antigo —
 * a versão mais nova de um mesmo id ganha (o balde corrente já avançado
 * vence o retrato antigo). Ids que já moram em `existentes` ficam de fora
 * (a planilha tem a própria cópia, editável). Quitadas não entram.
 */
export const projetarParcelas = (fontes: FonteDeParcelas[], mesAlvo: string, existentes: Parcela[]): Parcela[] => {
  const vistos = new Set((existentes ?? []).map((p) => String(p?.id ?? "")).filter(Boolean));
  const saida: Parcela[] = [];
  for (const fonte of fontes) {
    for (const p of Array.isArray(fonte.itens) ? fonte.itens : []) {
      const id = String(p?.id ?? "");
      if (!id || vistos.has(id)) continue;
      const cp = avancarPara(p, fonte.mes, mesAlvo);
      if (!cp || !parcelaAtiva(cp)) continue;
      vistos.add(id);
      saida.push(cp);
    }
  }
  return saida;
};

export interface ViradaDeParcelas {
  /** Balde do mês corrente já avançado (com o que veio de chaves passadas). */
  lista: Parcela[];
  /** mesId → retratos a MESCLAR (por id) na chave arquivada daquele mês. */
  arquivos: Record<string, Parcela[]>;
  /** mesId → chave passada regravada inteira com as marcas `levada`. */
  fontesAtualizadas: Record<string, Parcela[]>;
}

/**
 * A virada das parcelas. `null` quando não há nada a fazer — é o caminho de
 * toda abertura normal, então é só comparação de strings.
 *
 *  1. registro do balde carimbado com mês ANTERIOR: retrato vai pra chave
 *     daquele mês (e dos meses pulados, se a pessoa ficou sem abrir o app),
 *     o registro avança no balde. Quitada no caminho continua no balde como
 *     quitada — é assim que ela aparece hoje até a pessoa apagar.
 *  2. registro que mora em chave PASSADA (criado dentro da planilha de um
 *     mês antigo) e ainda não foi `levada`: cópia avançada entra no balde,
 *     a origem ganha a marca. A chave datada do PRÓPRIO mês corrente entra
 *     aqui com diff 0 — é o registro criado no mês seguinte "por
 *     antecipação", que ficava órfão quando o mês chegava (o balde corrente
 *     é outra chave).
 *  Legado (sem carimbo) no balde não se mexe.
 */
export const viradaDeParcelas = (
  balde: Parcela[] | undefined | null,
  mesAgora: string,
  fontes: FonteDeParcelas[] = [],
): ViradaDeParcelas | null => {
  const atuais = Array.isArray(balde) ? balde : [];
  const arquivos: Record<string, Parcela[]> = {};
  const fontesAtualizadas: Record<string, Parcela[]> = {};
  let mudou = false;

  const lista = atuais.map((p) => {
    if (!ehMesId(p.startMonth) || mesesEntre(p.startMonth as string, mesAgora) <= 0) return p;
    const origem = p.startMonth as string;
    (arquivos[origem] ??= []).push({ ...p, levada: true });
    // meses pulados (ficou sem abrir o app): cada um ganha o retrato do que
    // seria a parcela dele, só enquanto ativa
    for (let m = somarMeses(origem, 1); mesesEntre(m, mesAgora) > 0; m = somarMeses(m, 1)) {
      const cp = avancarPara(p, origem, m);
      if (cp && parcelaAtiva(cp)) (arquivos[m] ??= []).push({ ...cp, levada: true });
    }
    mudou = true;
    return avancarPara(p, origem, mesAgora) ?? p;
  });

  const ids = new Set(lista.map((p) => String(p?.id ?? "")));
  for (const fonte of fontes) {
    const itens = Array.isArray(fonte.itens) ? fonte.itens : [];
    let marcou = false;
    const regravada = itens.map((p) => {
      if (p?.levada) return p;
      const id = String(p?.id ?? "");
      const origem = ehMesId(p.startMonth) ? (p.startMonth as string) : fonte.mes;
      const diff = mesesEntre(origem, mesAgora);
      if (diff < 0) return p;
      const cp = diff === 0 ? carimbar(p, mesAgora) : avancarPara(p, origem, mesAgora);
      if (!cp || !parcelaAtiva(cp) || !id || ids.has(id)) return p;
      ids.add(id);
      lista.push(cp);
      marcou = true;
      return { ...p, levada: true };
    });
    if (marcou) { fontesAtualizadas[fonte.mes] = regravada; mudou = true; }
  }

  return mudou ? { lista, arquivos, fontesAtualizadas } : null;
};
