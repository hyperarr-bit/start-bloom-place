import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

export type ResultadoCompartilhar = "shared" | "downloaded" | "failed" | "cancelled";
type TipoArquivo = "image/png" | "video/mp4";

const blobParaBase64 = (blob: Blob) =>
  new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Compartilhar um arquivo (imagem desde 26/09; vídeo desde 27/09). No app
 * Android o WebView não tem Web Share (navigator.share/canShare não existem)
 * e o "baixar" por link não faz nada — os três compartilhares (perfil,
 * conquista, retrospectiva) caíam nele e o toast "Imagem salva!" mentia: 14
 * de 16 toques em compartilhar eram da web. No app: grava o arquivo no cache
 * e abre a folha nativa (Stories, WhatsApp…), pelos plugins oficiais do
 * Capacitor. Na web: Web Share com arquivo; sem ele (PC), baixa. App antigo
 * sem o plugin cai no Web Share e, sem ele, devolve "failed" — nunca finge
 * que salvou.
 */
async function compartilharArquivo(blob: Blob, nome: string, titulo: string, origem: string, tipo: TipoArquivo): Promise<ResultadoCompartilhar> {
  const fim = (resultado: ResultadoCompartilhar, via: string) => {
    trackEvent("compartilhar_resultado", { origem, resultado, via, ...(tipo === "video/mp4" ? { tipo: "video" } : {}) });
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
  const file = new File([blob], nome, { type: tipo });
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

export const compartilharImagem = (blob: Blob, nome: string, titulo: string, origem: string) => compartilharArquivo(blob, nome, titulo, origem, "image/png");

/** O vídeo dos Stories (MP4 H.264): os mesmos caminhos da imagem — nativo, Web Share, download no PC. */
export const compartilharVideo = (blob: Blob, nome: string, titulo: string, origem: string) => compartilharArquivo(blob, nome, titulo, origem, "video/mp4");
