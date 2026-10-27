import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { PendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { metricasDoDia } from "./PaginaSeuDia";
import { CHAVE_RESUMOS, normalizarResumos } from "@/lib/home-resumos";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import { widgetsDoNovato, type IdDoWidgetE } from "@/lib/home-widgets-e";
import { useDoseDeHoje } from "@/components/missao-doses/LinhaDoseDeHoje";
import { EVENTO_MISSAO_DOSES, lerMissao } from "@/lib/missao-doses";
import { CHAVE_ORIGEM_CONTA, contaEhNova, lerMarcadorOrigem } from "@/lib/home-nova";
import type { PendenciasPrefs, TipoPendencia } from "@/lib/home-pendencias";
import { enxugarPendencias, pendenciasDeNovato, tiposAdotados, tiposDoNovato } from "@/lib/pendencias-novato";

/** A conta é NOVA (o marcador de origem gravado na conta, ou o espelho do aparelho) — a mesma pergunta do score. */
export function useContaNova(): boolean {
  const { user } = useAuth();
  const { get } = useUserData();
  return lerMarcadorOrigem(get<unknown>(CHAVE_ORIGEM_CONTA, null)) === "nova" || contaEhNova(user?.id);
}

/** Os 3 módulos da missão em doses deste aparelho (relê quando a missão muda — a escolha do dia 2 troca o 2º). Quem
 *  tocou "Explorar por conta própria" não fez a missão: os módulos dela não entram (só o que ela usar). */
const modulosDe = (m: ReturnType<typeof lerMissao>): readonly string[] | null => (m && !m.explorou ? m.modulos : null);
function useModulosDaMissao(): readonly string[] | null {
  const [m, setM] = useState(() => modulosDe(lerMissao()));
  useEffect(() => {
    const reler = () => setM(modulosDe(lerMissao()));
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
  }, []);
  return m;
}

/**
 * Os tipos que a lista do novato mostra (lib/pendencias-novato) — conta nova nos primeiros dias; senão null (a regra de
 * sempre). A Home (página 2, "Ver todas") e Você › Personalizar início usam o MESMO conjunto no interruptor.
 */
export function useTiposDoNovato(prefs: PendenciasPrefs): Set<TipoPendencia> | null {
  const { user } = useAuth();
  const { get } = useUserData();
  const origemNova = useContaNova();
  const novato = pendenciasDeNovato({ origemNova, criadoEm: user?.created_at ?? null });
  const modulos = useModulosDaMissao();
  return useMemo(
    () => (novato ? tiposDoNovato({ adotados: tiposAdotados(get), modulosDaMissao: modulos, prefs }) : null),
    [novato, get, modulos, prefs],
  );
}

/**
 * As pendências que a Home nova MOSTRA: na conta nova nos primeiros dias, só o que ela usa + a missão + o que ligou à
 * mão (a pendência do módulo da dose de hoje espera a dose); nas outras contas, a lista de sempre.
 */
export function usePendenciasNovato(pendencias: PendenciasDeHoje, prefs: PendenciasPrefs): { novato: boolean; permitidos: Set<TipoPendencia> | null; lista: PendenciasDeHoje } {
  const permitidos = useTiposDoNovato(prefs);
  const dose = useDoseDeHoje({ bracoB: true });
  const moduloDaDose = dose && !("escolher" in dose && dose.escolher) ? dose.modulo : null;
  const lista = useMemo(() => (permitidos ? enxugarPendencias(pendencias, permitidos, moduloDaDose) : pendencias), [permitidos, pendencias, moduloDaDose]);
  return { novato: !!permitidos, permitidos, lista };
}

/**
 * O padrão de widgets da CONTA NOVA (lib/home-widgets-e widgetsDoNovato) — undefined nas outras contas (o padrão de
 * sempre). Sem prazo: vale até ela escolher os widgets (core-home-widgets-e manda).
 */
export function usePadraoDeWidgetsDoNovato(data: LifeHubData): IdDoWidgetE[] | undefined {
  const { get } = useUserData();
  const contaNova = useContaNova();
  if (!contaNova) return undefined;
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  const naPagina1 = metricasDoDia(data, copo, normalizarResumos(get<unknown>(CHAVE_RESUMOS, null))).map((m) => m.id);
  return widgetsDoNovato(data, get, naPagina1);
}
