import { useCallback, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
  CHAVE_HUMOR_DP, CHAVE_HUMOR_HOME, CHAVE_HUMOR_ROTINA, espelharHumor, historicoDosMapas, humorDoDiaDosMapas,
  type HumorDoDia, type MapasDoHumor,
} from "@/lib/humor-do-dia";

/**
 * O humor do dia unificado (lib/humor-do-dia) pra uma TELA: lê as 3 chaves pelo usePersistedState (reage quando
 * outra tela grava) e grava o mesmo valor nas 3, cada uma no seu formato. Usado pela Rotina (Como você está hoje?),
 * pelo Dev. Pessoal › Humor e pelos formulários do "+" da Home.
 */
export function useHumorDoDia(dia: string): {
  hoje: HumorDoDia | null;
  historico: Record<string, number>;
  registrar: (valor: number, extra?: { emoji?: string }) => void;
  /** o mapa da Rotina, pra quem precisa da nota/emoções do registro */
  mapaRotina: Record<string, { mood?: number; note?: string; emocoes?: string[] }>;
  setMapaRotina: (v: Record<string, { mood: number; note: string; emocoes?: string[] }> | ((prev: Record<string, { mood: number; note: string; emocoes?: string[] }>) => Record<string, { mood: number; note: string; emocoes?: string[] }>)) => void;
} {
  const [rotina, setRotina] = usePersistedState<Record<string, { mood: number; note: string; emocoes?: string[] }>>(CHAVE_HUMOR_ROTINA, {});
  const [home, setHome] = usePersistedState<Record<string, unknown>>(CHAVE_HUMOR_HOME, {});
  const [dp, setDp] = usePersistedState<Record<string, number>>(CHAVE_HUMOR_DP, {});
  const mapas: MapasDoHumor = useMemo(() => ({ [CHAVE_HUMOR_ROTINA]: rotina, [CHAVE_HUMOR_HOME]: home, [CHAVE_HUMOR_DP]: dp }), [rotina, home, dp]);
  const hoje = useMemo(() => humorDoDiaDosMapas(mapas, dia), [mapas, dia]);
  const historico = useMemo(() => historicoDosMapas(mapas), [mapas]);
  const registrar = useCallback((valor: number, extra: { emoji?: string } = {}) => {
    const novos = espelharHumor(mapas, dia, valor, extra);
    setRotina(novos[CHAVE_HUMOR_ROTINA] as never);
    setHome(novos[CHAVE_HUMOR_HOME]);
    setDp(novos[CHAVE_HUMOR_DP] as never);
  }, [mapas, dia, setRotina, setHome, setDp]);
  return { hoje, historico, registrar, mapaRotina: rotina, setMapaRotina: setRotina };
}
