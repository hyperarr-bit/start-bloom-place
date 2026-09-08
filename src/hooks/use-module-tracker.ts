import { useEffect, useRef, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CHAVE_ULTIMO_MODULO } from "@/lib/diagnostico-suporte";

// Context for child components to report active tab
type TabReporter = (tabId: string) => void;
export const TabTrackContext = createContext<TabReporter | null>(null);

export const useSetTrackedTab = (tabId: string) => {
  const report = useContext(TabTrackContext);
  useEffect(() => {
    if (report) report(tabId);
  }, [tabId, report]);
};

export const useTabReporter = () => useContext(TabTrackContext);

/**
 * Teto por visita (30/07). `visibilitychange` não dispara em todo caso — aba
 * esquecida aberta virava "uso": medido em 26.759 visitas, a mediana é 11s e
 * a MAIOR tem 81,5 horas; as 5% acima de 30min respondiam por 90% de todo o
 * tempo somado, e o ranking de "quem mais usa" listava quem esqueceu a aba.
 * 1800s é generoso (o p99 real, já inflado, é ~75min). O relatório do admin
 * aplica o mesmo teto no histórico via LEAST().
 */
const TETO_VISITA_S = 1800;

export const useModuleTracker = (moduleId: string) => {
  const { user } = useAuth();
  const enteredAt = useRef<Date>(new Date());
  const currentTab = useRef<string | null>(null);

  const flush = useCallback(async () => {
    if (!user) return;
    const seconds = Math.round((Date.now() - enteredAt.current.getTime()) / 1000);
    if (seconds < 2) return;

    await (supabase as any)
      .from("module_analytics")
      .insert({
        user_id: user.id,
        module_id: moduleId,
        entered_at: enteredAt.current.toISOString(),
        duration_seconds: Math.min(seconds, TETO_VISITA_S),
        tab_id: currentTab.current,
      });
  }, [user, moduleId]);

  const reportTab: TabReporter = useCallback((tabId: string) => {
    if (tabId === currentTab.current) return;
    // flush previous tab
    if (user && currentTab.current !== null) {
      const seconds = Math.round((Date.now() - enteredAt.current.getTime()) / 1000);
      if (seconds >= 2) {
        (supabase as any)
          .from("module_analytics")
          .insert({
            user_id: user.id,
            module_id: moduleId,
            entered_at: enteredAt.current.toISOString(),
            duration_seconds: Math.min(seconds, TETO_VISITA_S),
            tab_id: currentTab.current,
          });
      }
    }
    currentTab.current = tabId;
    enteredAt.current = new Date();
  }, [user, moduleId]);

  /*
   * ONDE A PESSOA ESTAVA (07/09, pedido de cliente por DM: "coloca um
   * formulário pra gente por o bug e anexar o print").
   *
   * Chamado de suporte sem a tela do erro é adivinhação: "não está salvando"
   * pode ser Finanças, Dieta ou Diário. Este hook é o ÚNICO lugar do app que
   * já sabe o módulo aberto sem ninguém ter que contar — então ele deixa o
   * bilhete, e o formulário de suporte lê. Fora do `if (!user)` de propósito:
   * o convidado do teste grátis também abre chamado, e ele não tem conta.
   * sessionStorage porque só vale pra ESTA sessão do app.
   */
  useEffect(() => {
    try { sessionStorage.setItem(CHAVE_ULTIMO_MODULO, moduleId); } catch { /* storage bloqueado */ }
  }, [moduleId]);

  useEffect(() => {
    if (!user) return;
    enteredAt.current = new Date();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else enteredAt.current = new Date();
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      flush();
    };
  }, [user, moduleId, flush]);

  return reportTab;
};
