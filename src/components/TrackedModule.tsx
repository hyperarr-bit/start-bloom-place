import { ReactNode, useCallback, useEffect, useRef } from "react";
import { useModuleTracker, TabTrackContext } from "@/hooks/use-module-tracker";
import { instalarMedicaoDeCards } from "@/lib/medicao-cards";

export const TrackedModule = ({ moduleId, children }: { moduleId: string; children: ReactNode }) => {
  const reportTab = useModuleTracker(moduleId);
  // A aba atual fica num ref pra medição de cards (12/09) etiquetar cada
  // card_view/card_interact com módulo E aba, sem re-render.
  const abaRef = useRef<string | null>(null);
  const reportar = useCallback((tab: string) => { abaRef.current = tab; reportTab(tab); }, [reportTab]);
  useEffect(() => instalarMedicaoDeCards(moduleId, () => abaRef.current), [moduleId]);
  return <TabTrackContext.Provider value={reportar}>{children}</TabTrackContext.Provider>;
};
