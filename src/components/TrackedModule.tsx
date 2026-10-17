import { ReactNode, useCallback, useEffect, useRef } from "react";
import { useModuleTracker, TabTrackContext } from "@/hooks/use-module-tracker";
import { instalarMedicaoDeCards } from "@/lib/medicao-cards";
import { anotarAba } from "@/lib/medicao-total";

export const TrackedModule = ({ moduleId, children }: { moduleId: string; children: ReactNode }) => {
  const reportTab = useModuleTracker(moduleId);
  // A aba atual fica num ref pra medição de cards (12/09) etiquetar cada
  // card_view/card_interact com módulo E aba, sem re-render.
  const abaRef = useRef<string | null>(null);
  // 1.0.16: a aba também vai pro resumo de uso da sessão (medição total: entradas e tempo por aba)
  const reportar = useCallback((tab: string) => { abaRef.current = tab; reportTab(tab); anotarAba(moduleId, tab); }, [reportTab, moduleId]);
  useEffect(() => instalarMedicaoDeCards(moduleId, () => abaRef.current), [moduleId]);
  return <TabTrackContext.Provider value={reportar}>{children}</TabTrackContext.Provider>;
};
