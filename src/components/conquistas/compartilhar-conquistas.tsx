import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { compartilharImagem, compartilharVideo, type ResultadoCompartilhar } from "@/lib/compartilhar";
import type { Raridade } from "@/components/gamification/types";
import { gerarPng } from "./gerar-imagem";
import { RECORTE_ROSETA, STORIES, StoriesAdesivo, StoriesAlbum, StoriesCapa, StoriesCarteirinha, StoriesRoseta } from "./Stories";
import type { CapaId, DadosCapa } from "./CapaPlanner";
import type { DadosCarteirinha } from "./Carteirinha";
import type { ArteComVideo, DadosArtes } from "./artes-dados";

/**
 * Compartilhar das Conquistas (26/09; carteirinha em 27/09; o álbum e o
 * VÍDEO na mesma tarde) — substitui o profile-share/badge-share de canvas.
 * Os nomes de evento antigos ficam (`profile_share`, `badge_share`) pra
 * série histórica não quebrar; `capa_share`, `carteirinha_share` e
 * `album_share` dizem qual arte saiu; `stories_video` conta o vídeo (e o
 * que caiu pra imagem). O resultado é tratado como nos outros
 * compartilhares do app: "downloaded" avisa que salvou, "failed" diz a
 * verdade.
 */

const avisar = (r: ResultadoCompartilhar | "sem-imagem", tipo: "imagem" | "video" = "imagem") => {
  if (r === "downloaded") toast.success(tipo === "video" ? "Vídeo salvo! Agora é só postar 🎉" : "Imagem salva! Agora é só postar 🎉");
  else if (r === "sem-imagem") toast.error("Não consegui montar a imagem agora. Tenta de novo em instantes?");
  else if (r === "failed") toast.error("Não consegui abrir o compartilhar. Atualize o CORE na loja e tente de novo.");
};

async function enviar(blob: Blob | null, arquivo: string, titulo: string, origem: string): Promise<ResultadoCompartilhar> {
  if (!blob) {
    avisar("sem-imagem");
    return "failed";
  }
  const r = await compartilharImagem(blob, arquivo, titulo, origem);
  avisar(r);
  return r;
}

export async function compartilharCapa(dados: DadosCapa & { capa: CapaId; adesivos: number }) {
  trackEvent("profile_share", { level: dados.nivel, badges: dados.adesivos, capa: dados.capa });
  trackEvent("capa_share", { capa: dados.capa, nivel: dados.nivel, dias: dados.dias });
  const blob = await gerarPng(<StoriesCapa {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-meu-planner.png", "Meu planner no CORE", "capa");
}

export async function compartilharRoseta(dados: { dias: number; nome: string; membroDesde: string; nivel: string; transparente?: boolean }) {
  trackEvent("badge_share", { badge: `sequencia-${dados.dias}`, formato: dados.transparente ? "roseta-transparente" : "roseta" });
  const blob = dados.transparente
    ? await gerarPng(<StoriesRoseta {...dados} transparente />, { largura: RECORTE_ROSETA.w, altura: RECORTE_ROSETA.h })
    : await gerarPng(<StoriesRoseta {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-${dados.dias}-dias${dados.transparente ? "-adesivo" : ""}.png`, `${dados.dias} dias seguidos no CORE`, "conquista");
}

export async function compartilharAdesivo(dados: { id: string; titulo: string; descricao: string; raridade?: Raridade; nome: string; membroDesde: string }) {
  trackEvent("badge_share", { badge: dados.id, formato: "adesivo", raridade: dados.raridade ?? "comum" });
  const blob = await gerarPng(<StoriesAdesivo {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-adesivo-${dados.id}.png`, `Adesivo: ${dados.titulo}`, "conquista");
}

export async function compartilharCarteirinha(dados: DadosCarteirinha) {
  trackEvent("carteirinha_share", { nivel: dados.nivel, dias: dados.dias, adesivos: dados.adesivos });
  const blob = await gerarPng(<StoriesCarteirinha {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-carteirinha.png", "Minha carteirinha do CORE", "carteirinha");
}

export async function compartilharAlbum(dados: DadosArtes) {
  trackEvent("album_share", { nivel: dados.nivel, adesivos: dados.adesivos, raros: dados.maisRaros.map((b) => b.id).join(",") });
  const blob = await gerarPng(<StoriesAlbum {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-meu-album.png", "Meu álbum de adesivos no CORE", "album");
}

/** A imagem parada da arte que também existe em vídeo. */
export const compartilharImagemDaArte = (arte: ArteComVideo, d: DadosArtes) =>
  arte === "capa"
    ? compartilharCapa({ capa: d.capa, nome: d.nome, membroDesde: d.membroDesde, dias: d.dias, nivel: d.nivel, adesivos: d.adesivos })
    : compartilharAlbum(d);

const ARQUIVO_VIDEO: Record<ArteComVideo, [string, string]> = {
  capa: ["core-meu-planner.mp4", "Meu planner no CORE"],
  album: ["core-meu-album.mp4", "Meu álbum de adesivos no CORE"],
};

/**
 * O VÍDEO dos Stories (o planner abrindo e os adesivos pipocando): gera no
 * aparelho (só baixa o código do vídeo neste toque) e compartilha pelos
 * mesmos caminhos da imagem. Sem como gerar, ou se o compartilhar recusar o
 * arquivo, cai pra IMAGEM — e o `stories_video` conta o que aconteceu.
 */
export async function compartilharVideoDaArte(arte: ArteComVideo, d: DadosArtes, onProgresso?: (fracao: number) => void): Promise<ResultadoCompartilhar> {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  let gerado: Awaited<ReturnType<typeof import("./video/gerar-video").gerarVideoDaArte>> = null;
  try {
    const { gerarVideoDaArte } = await import("./video/gerar-video");
    gerado = await gerarVideoDaArte(arte, d, (f) => onProgresso?.(f));
  } catch (e) {
    console.error("[conquistas] o vídeo dos Stories falhou:", e);
    gerado = null;
  }
  if (!gerado) {
    trackEvent("stories_video", { arte, ok: false, ms: ms(), formato: "nenhum", fallback: "imagem" });
    toast.message("O vídeo não saiu desta vez — vai a imagem.");
    return compartilharImagemDaArte(arte, d);
  }
  const [arquivo, titulo] = ARQUIVO_VIDEO[arte];
  const r = await compartilharVideo(gerado.blob, arquivo, titulo, arte);
  if (r === "failed") {
    trackEvent("stories_video", { arte, ok: false, ms: ms(), formato: gerado.formato, resolucao: `${gerado.largura}x${gerado.altura}`, fallback: "imagem" });
    return compartilharImagemDaArte(arte, d);
  }
  trackEvent("stories_video", { arte, ok: true, ms: ms(), geracao_ms: gerado.ms, formato: gerado.formato, resolucao: `${gerado.largura}x${gerado.altura}`, resultado: r, fallback: null });
  avisar(r, "video");
  return r;
}
