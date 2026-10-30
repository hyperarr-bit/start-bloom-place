import { usePersistedState } from "@/hooks/use-persisted-state";
import { CHAVE_FERIADOS_PREFS, PREFS_FERIADOS_PADRAO, mostrarFeriados, type PrefsFeriados } from "@/lib/feriados";

/**
 * "Mostrar feriados" (28/10): padrão LIGADO. Chave nova na conta (`rotina-feriados-prefs`,
 * objeto `{ mostrar }`) — sincroniza entre aparelhos; desligar esconde os feriados em todos os
 * calendários e listas. Nada é gravado enquanto a pessoa não mexe no interruptor.
 */
export function useMostrarFeriados(): [boolean, (mostrar: boolean) => void] {
  const [prefs, setPrefs] = usePersistedState<PrefsFeriados>(CHAVE_FERIADOS_PREFS, PREFS_FERIADOS_PADRAO);
  const mostrar = mostrarFeriados(prefs);
  const definir = (v: boolean) => setPrefs((prev) => ({ ...(prev && typeof prev === "object" ? prev : {}), mostrar: v }));
  return [mostrar, definir];
}
