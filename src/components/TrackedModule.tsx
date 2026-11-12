import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useModuleTracker, TabTrackContext } from "@/hooks/use-module-tracker";
import { instalarMedicaoDeCards } from "@/lib/medicao-cards";
import { anotarAba } from "@/lib/medicao-total";
import { useUserData } from "@/hooks/use-user-data";

/** Quanto a capa lisa espera a conta antes de mostrar a tela normal do módulo (a conta costuma chegar em 0,5–0,9 s). */
export const CAPA_MS = 1500;

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
  //
  // 11/11 (velocidade 1.0.26): a capa é só pra espera CURTA. Sem internet a conta não chega (`loaded` fica false,
  // regra de 16/10) e a capa deixava a tela BRANCA pra sempre. Agora o módulo monta como antes (tela normal, escritas
  // seguradas até a conta chegar) quando: o aparelho está sem rede, a leitura falhou ou está lenta (`semConexao`), ou
  // passou CAPA_MS sem a conta chegar. Teste: src/test/tracked-module-capa.test.tsx.
  const { loaded, semConexao } = useUserData();
  const [passouDaEspera, setPassouDaEspera] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setPassouDaEspera(true), CAPA_MS);
    return () => clearTimeout(t);
  }, [loaded]);
  const semRede = typeof navigator !== "undefined" && navigator.onLine === false;
  const capa = !loaded && !semConexao && !semRede && !passouDaEspera;
  return <TabTrackContext.Provider value={reportar}>{capa ? <div className="fixed inset-0 z-[100] bg-background" aria-hidden="true" data-capa-modulo="" /> : children}</TabTrackContext.Provider>;
};
