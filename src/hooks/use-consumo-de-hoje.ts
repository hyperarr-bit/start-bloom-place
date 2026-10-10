import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { CHAVE_KCAL, CHAVE_META_KCAL_ANTIGA, CHAVE_META_KCAL_MODO, META_KCAL_PADRAO, consumoDoDia, nomeDoDiaDieta, type ConsumoDoDia } from "@/lib/dieta-consumo";
import { CHAVE_MACROS, type EntradaLog, type MacrosPlano } from "@/lib/dieta-macros";

/**
 * O consumo de HOJE (kcal, macros, refeições e meta) lido das chaves da Dieta —
 * a mesma conta do useLifeHubData, pros widgets Calorias e Macros do Dia
 * mostrarem o mesmo número (09/10, chamado do "0/2000").
 */
export function useConsumoDeHoje(): ConsumoDoDia {
  const { get } = useUserData();
  const agora = new Date();
  const hoje = localDayKey(agora);
  const dia = nomeDoDiaDieta(agora);
  return consumoDoDia({
    log: get<Record<string, Record<string, EntradaLog>>>("core-dieta-log", {})[hoje],
    diario: get<Record<string, { meals?: Record<string, { followed?: boolean }> }>>("dieta-diary-v2", {})[hoje],
    kcalPlano: get<Record<string, Record<string, unknown>>>(CHAVE_KCAL, {})[dia],
    macrosPlano: get<MacrosPlano>(CHAVE_MACROS, {})[dia],
    metaAntiga: get<number>(CHAVE_META_KCAL_ANTIGA, META_KCAL_PADRAO),
    modoMeta: get<string>(CHAVE_META_KCAL_MODO, "auto"),
  });
}
