import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { PendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { useDoseDeHoje } from "@/components/missao-doses/LinhaDoseDeHoje";
import { metricasDoDia } from "./PaginaSeuDia";
import { CHAVE_ORIGEM_CONTA, contaEhNova, lerMarcadorOrigem } from "@/lib/home-nova";
import { CHAVE_RESUMOS, resumosEscolhidos } from "@/lib/home-resumos";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import type { TipoPendencia } from "@/lib/home-pendencias";
import { enxugarPendencias } from "@/lib/pendencias-novato";
import { widgetsDoNovato, type IdDoWidgetE } from "@/lib/home-widgets-e";

/** A conta é NOVA (o marcador de origem gravado na conta, ou o espelho do aparelho) — a mesma pergunta do score. */
export function useContaNova(): boolean {
  const { user } = useAuth();
  const { get } = useUserData();
  return lerMarcadorOrigem(get<unknown>(CHAVE_ORIGEM_CONTA, null)) === "nova" || contaEhNova(user?.id);
}

/**
 * Os tipos que a lista do novato mostra — a MESMA régua que o score usa (o hub decide: use-life-hub-data,
 * `pendenciasNovato`; lib/pendencias-novato). Conta antiga, fora dos 7 dias ou Home antiga: null (a regra de sempre).
 * A Home (página 2, "Ver todas", Personalizar) e Você › Personalizar início leem daqui.
 */
export function useTiposDoNovato(data: LifeHubData): Set<TipoPendencia> | null {
  const lista = data.pendenciasNovato;
  const chave = lista ? lista.join(",") : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (lista ? new Set(lista) : null), [chave]);
}

/**
 * As pendências que a Home nova MOSTRA: na conta nova nos primeiros dias, só os tipos do novato (a lista já vem
 * filtrada pelo hub; aqui entram as regras de tela: a pendência do módulo da dose de hoje espera a dose, e o aviso do
 * treino só com o treino na lista); nas outras contas, a lista de sempre.
 */
export function usePendenciasNovato(pendencias: PendenciasDeHoje, data: LifeHubData): { novato: boolean; permitidos: Set<TipoPendencia> | null; lista: PendenciasDeHoje } {
  const permitidos = useTiposDoNovato(data);
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
  const naPagina1 = metricasDoDia(data, copo, resumosEscolhidos(get<unknown>(CHAVE_RESUMOS, null))).map((m) => m.id);
  return widgetsDoNovato(data, get, naPagina1);
}
