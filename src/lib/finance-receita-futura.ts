/**
 * RECEITA DE MÊS QUE AINDA NÃO CHEGOU (01/11, chamados): a data da receita era só registro —
 * receita de dezembro somava em novembro ("por que já conta no mês atual?"; 4 pessoas pediram
 * receita prevista). Agora ela vai pra planilha do mês dela (a mesma que o ORÇAMENTO MENSAL
 * abre), e a virada adota essa planilha no dia 1º (virada-do-mes, "ADOTAR").
 *
 * GASTO TAMBÉM (07/11, bug "gasto-futuro"): "Dentista · R$ 800" com data 10/12, lançado em 07/11,
 * ia pro balde de novembro e somava lá (novembro 900); no dia 1º a virada deixava o gasto em
 * dezembro (data futura FICA no balde — `separarPorMes`) e novembro virava 100. Mesma regra da
 * receita, mesma chave datada (`finance-2026-dezembro-expenses`), mesma adoção no dia 1º. Só o
 * lançamento NOVO (e a edição que troca a data) passa por aqui: gasto com data futura que já
 * está no balde continua onde está. Parcelado e recorrente não passam (são dívida e custo fixo).
 */
import { getFinanceStorageKeys, monthNames } from "@/components/finance/storage-keys";
import { mesclarPerfil, doPerfil, type ItemComPerfil } from "@/lib/finance-perfil";

type Leitor = <V>(chave: string, padrao: V) => V;
type Gravador = (chave: string, valor: unknown) => void;

/** Guarda o lançamento na chave `sufixo` do mês da data dele se esse mês é futuro; devolve o nome do mês ou null. */
const guardarNoMes = <T extends ItemComPerfil & { date?: string }>(
  item: T,
  hoje: Date,
  get: Leitor,
  set: Gravador,
  perfil: string,
  sufixo: "incomes" | "expenses",
): string | null => {
  const m = /^(\d{4})-(\d{2})/.exec(item?.date ?? "");
  if (!m) return null;
  const ano = Number(m[1]), mes = Number(m[2]) - 1;
  if (mes < 0 || mes > 11) return null;
  if (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= hoje.getMonth())) return null;
  const chave = getFinanceStorageKeys(monthNames[mes], ano)[sufixo];
  const lista = get<T[]>(chave, []) || [];
  set(chave, mesclarPerfil(lista, [...doPerfil(lista, perfil), item], perfil));
  return ano === hoje.getFullYear() ? monthNames[mes] : `${monthNames[mes]} de ${ano}`;
};

/** Guarda a receita no mês da data dela se esse mês é futuro; devolve o nome do mês ou null. */
export const guardarReceitaNoMes = <T extends ItemComPerfil & { date?: string }>(
  receita: T,
  hoje: Date,
  get: Leitor,
  set: Gravador,
  perfil: string,
): string | null => guardarNoMes(receita, hoje, get, set, perfil, "incomes");

/** O mesmo pro gasto variável (07/11): chave `finance-{ano}-{mês}-expenses` do mês da data. */
export const guardarGastoNoMes = <T extends ItemComPerfil & { date?: string }>(
  gasto: T,
  hoje: Date,
  get: Leitor,
  set: Gravador,
  perfil: string,
): string | null => guardarNoMes(gasto, hoje, get, set, perfil, "expenses");
