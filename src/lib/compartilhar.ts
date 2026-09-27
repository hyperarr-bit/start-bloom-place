import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

export type ResultadoCompartilhar = "shared" | "downloaded" | "failed" | "cancelled";

const blobParaBase64 = (blob: Blob) =>
  new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Compartilhar uma imagem (26/09). No app Android o WebView não tem Web Share
 * (navigator.share/canShare não existem) e o "baixar" por link não faz nada —
 * os três compartilhares (perfil, conquista, retrospectiva) caíam nele e o
 * toast "Imagem salva!" mentia: 14 de 16 toques em compartilhar eram da web.
 * No app: grava o PNG no cache e abre a folha nativa (Stories, WhatsApp…),
 * pelos plugins oficiais do Capacitor. Na web: Web Share com arquivo; sem
 * ele (PC), baixa o PNG. App antigo sem o plugin cai no Web Share e, sem ele,
 * devolve "failed" — nunca finge que salvou.
 */
export async function compartilharImagem(blob: Blob, nome: string, titulo: string, origem: string): Promise<ResultadoCompartilhar> {
  const fim = (resultado: ResultadoCompartilhar, via: string) => {
    trackEvent("compartilhar_resultado", { origem, resultado, via });
    return resultado;
  };
  if (isNativeShell()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
      const { uri } = await Filesystem.writeFile({ path: nome, data: await blobParaBase64(blob), directory: Directory.Cache });
      await Share.share({ title: titulo, files: [uri] });
      return fim("shared", "nativo");
    } catch (e) {
      if (/cancel/i.test(String((e as Error)?.message ?? e))) return fim("cancelled", "nativo");
      // plugin ausente (app de antes desta versão): tenta o Web Share abaixo
    }
  }
  const file = new File([blob], nome, { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return fim("shared", "web");
    } catch (e) {
      return fim((e as Error)?.name === "AbortError" ? "cancelled" : "failed", "web");
    }
  }
  if (isNativeShell()) return fim("failed", "sem-share");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return fim("downloaded", "download");
}
