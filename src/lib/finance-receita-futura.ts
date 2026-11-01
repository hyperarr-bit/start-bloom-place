/**
 * RECEITA DE MÊS QUE AINDA NÃO CHEGOU (01/11, chamados): a data da receita era só registro —
 * receita de dezembro somava em novembro ("por que já conta no mês atual?"; 4 pessoas pediram
 * receita prevista). Agora ela vai pra planilha do mês dela (a mesma que o ORÇAMENTO MENSAL
 * abre), e a virada adota essa planilha no dia 1º (virada-do-mes, "ADOTAR").
 */
import { getFinanceStorageKeys, monthNames } from "@/components/finance/storage-keys";
import { mesclarPerfil, doPerfil, type ItemComPerfil } from "@/lib/finance-perfil";

/** Guarda a receita no mês da data dela se esse mês é futuro; devolve o nome do mês ou null. */
export const guardarReceitaNoMes = <T extends ItemComPerfil & { date?: string }>(
  receita: T,
  hoje: Date,
  get: <V>(chave: string, padrao: V) => V,
  set: (chave: string, valor: unknown) => void,
  perfil: string,
): string | null => {
  const m = /^(\d{4})-(\d{2})/.exec(receita?.date ?? "");
  if (!m) return null;
  const ano = Number(m[1]), mes = Number(m[2]) - 1;
  if (mes < 0 || mes > 11) return null;
  if (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= hoje.getMonth())) return null;
  const chave = getFinanceStorageKeys(monthNames[mes], ano).incomes;
  const lista = get<T[]>(chave, []) || [];
  set(chave, mesclarPerfil(lista, [...doPerfil(lista, perfil), receita], perfil));
  return ano === hoje.getFullYear() ? monthNames[mes] : `${monthNames[mes]} de ${ano}`;
};
