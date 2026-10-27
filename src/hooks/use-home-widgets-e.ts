import { useCallback } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_WIDGETS_E, alternarWidgetE, widgetsE, type IdDoWidgetE } from "@/lib/home-widgets-e";
import { CHAVE_WIDGETS_HOME } from "@/hooks/use-home-widgets";
import { trackEvent } from "@/lib/analytics";

/**
 * Os widgets da Home nova (lib/home-widgets-e): lê a conta a cada render (nada de estado paralelo — a gravação só
 * acontece quando a pessoa toca, nunca na montagem, então um boot frio nunca grava o vazio por cima do servidor).
 */
export function useHomeWidgetsE(padrao?: IdDoWidgetE[]) {
  const { get, set, loaded } = useUserData();
  // 1.0.19: `padrao` = o da conta nova que nunca escolheu (lib/home-widgets-e widgetsDoNovato); a 1ª escolha grava a
  // lista que ela VÊ, com a mudança — nunca volta pro padrão antigo por baixo
  const chavePadrao = padrao?.join(",") ?? "";
  const ativos = widgetsE(get<unknown>(CHAVE_WIDGETS_E, undefined), get<unknown>(CHAVE_WIDGETS_HOME, undefined), padrao);
  const alternar = useCallback((id: IdDoWidgetE) => {
    const base = chavePadrao ? (chavePadrao.split(",") as IdDoWidgetE[]) : undefined;
    const atual = widgetsE(get<unknown>(CHAVE_WIDGETS_E, undefined), get<unknown>(CHAVE_WIDGETS_HOME, undefined), base);
    const nova = alternarWidgetE(atual, id);
    if (nova === atual) return;
    trackEvent("home_widgets", { widgets: nova.join(","), id, ligado: nova.includes(id) });
    set(CHAVE_WIDGETS_E, nova);
  }, [get, set, chavePadrao]);
  return { ativos, alternar, ativo: (id: IdDoWidgetE) => ativos.includes(id), loaded };
}
