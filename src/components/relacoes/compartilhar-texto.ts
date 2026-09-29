import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

export type ResultadoTexto = "shared" | "cancelled" | "failed" | "link";

/**
 * Mandar um texto (parabéns, "oi, lembrei de você") pelo app que a pessoa
 * escolher — no Brasil, quase sempre o WhatsApp. Não guardamos telefone de
 * ninguém: quem escolhe o contato é a própria pessoa, na folha do sistema.
 *  - app da loja: a folha nativa (@capacitor/share, instalado em 26/09);
 *  - navegador do celular: Web Share;
 *  - sem nenhum dos dois (PC, app antigo sem o plugin): o link do WhatsApp
 *    com o texto pronto (wa.me/?text=), que abre o WhatsApp Web ou o app.
 * "shared" só quando o sistema confirma — é o que deixa registrar a conversa
 * sozinho sem mentir.
 */
export async function compartilharTexto(texto: string, origem: string): Promise<ResultadoTexto> {
  const fim = (resultado: ResultadoTexto, via: string) => {
    trackEvent("relacoes_mensagem", { origem, resultado, via });
    return resultado;
  };
  if (isNativeShell()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ text: texto });
      return fim("shared", "nativo");
    } catch (e) {
      if (/cancel/i.test(String((e as Error)?.message ?? e))) return fim("cancelled", "nativo");
      // plugin ausente (app antigo): segue pro Web Share / link
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texto });
      return fim("shared", "web");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return fim("cancelled", "web");
    }
  }
  try {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    return fim("link", "whatsapp");
  } catch {
    return fim("failed", "nenhum");
  }
}
