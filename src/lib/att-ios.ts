/**
 * ATT no iPhONE (19/09) — pedido de rastreamento, do jeito que a Apple aceita.
 *
 * Contexto: 0% dos usuários de iPhone têm rastreamento ligado (Gerenciador de
 * Eventos da Meta), porque a build 13 nasceu SEM o pedido — decisão de 07/09
 * depois de duas recusas 2.1 "unable to locate the ATT permission request",
 * que vieram do framework de ATT embarcado SEM diálogo. O caminho compatível
 * é o oposto: pedir de verdade, com texto em português, depois da welcome.
 *
 * O que muda quando a pessoa aceita: o `idPublicidade()` do plugin passa a
 * devolver o IDFA, a ficha do aparelho é regravada com ele, e o Purchase que o
 * servidor manda pra Meta vai com `madid` — atribuição por aparelho, com o
 * valor exato, em vez do modelo estatístico. No Brasil ~50% aceitam.
 *
 * Nunca trava o funil: sem plugin (web, Android, build antiga) devolve na
 * hora; no iPhone o sistema só mostra o diálogo UMA vez por instalação, e a
 * chave local evita chamar o plugin de novo à toa.
 */
import { capturarDispositivoApp, trackEvent } from "@/lib/analytics";

const CHAVE = "core-att-status";

export type StatusATT = "authorized" | "denied" | "restricted" | "notDetermined" | "nao_ios" | "ja_pedido" | "sem_plugin";

export async function pedirRastreamentoIos(origem: string): Promise<StatusATT> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "ios") return "nao_ios";
    try { if (localStorage.getItem(CHAVE)) return "ja_pedido"; } catch { /* modo privado */ }
    const MetaAds = registerPlugin<{ pedirRastreamento(): Promise<{ status: string }> }>("MetaAds");
    // 20 s de teto: se o diálogo não vier (build sem o método), o funil segue.
    const r = await Promise.race([
      MetaAds.pedirRastreamento(),
      new Promise<{ status: string }>((res) => setTimeout(() => res({ status: "sem_plugin" }), 20000)),
    ]);
    const status = (r?.status || "sem_plugin") as StatusATT;
    if (status !== "sem_plugin") {
      try { localStorage.setItem(CHAVE, status); } catch { /* noop */ }
      trackEvent("att_resposta", { status, origem });
      // Aceitou: regrava a ficha do aparelho, agora com o IDFA dentro.
      if (status === "authorized") void capturarDispositivoApp();
    }
    return status;
  } catch {
    return "sem_plugin";
  }
}
