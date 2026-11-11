import { ReactNode, useCallback, useEffect, useRef } from "react";
import { useModuleTracker, TabTrackContext } from "@/hooks/use-module-tracker";
import { instalarMedicaoDeCards } from "@/lib/medicao-cards";
import { anotarAba } from "@/lib/medicao-total";
import { useUserData } from "@/hooks/use-user-data";

export const TrackedModule = ({ moduleId, children }: { moduleId: string; children: ReactNode }) => {
  const reportTab = useModuleTracker(moduleId);
  // A aba atual fica num ref pra medição de cards (12/09) etiquetar cada
  // card_view/card_interact com módulo E aba, sem re-render.
  const abaRef = useRef<string | null>(null);
  // 1.0.16: a aba também vai pro resumo de uso da sessão (medição total: entradas e tempo por aba)
  const reportar = useCallback((tab: string) => { abaRef.current = tab; reportTab(tab); anotarAba(moduleId, tab); }, [reportTab, moduleId]);
  useEffect(() => instalarMedicaoDeCards(moduleId, () => abaRef.current), [moduleId]);
  // 10/11 (crítica r2): abrir DIRETO num módulo (lembrete, link, atalho) pintava a tela de conta VAZIA (R$ 0,00,
  // "Nenhuma receita cadastrada") por 0,5–0,9 s até a conta chegar, e depois pulava pros dados de verdade. Como a
  // Home faz: enquanto a conta não chegou, uma capa lisa; o módulo monta já com a conta (igual a quem vem da Home).
  const { loaded } = useUserData();
  return <TabTrackContext.Provider value={reportar}>{loaded ? children : <div className="fixed inset-0 z-[100] bg-background" aria-hidden="true" />}</TabTrackContext.Provider>;
};
