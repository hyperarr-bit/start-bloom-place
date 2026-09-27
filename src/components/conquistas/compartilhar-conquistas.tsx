import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { compartilharImagem, compartilharVideo, type ResultadoCompartilhar } from "@/lib/compartilhar";
import type { Raridade } from "@/components/gamification/types";
import { gerarPng } from "./gerar-imagem";
import { RECORTE_ROSETA, STORIES, StoriesAdesivo, StoriesAlbum, StoriesConquista, StoriesRoseta, StoriesTres } from "./Stories";
import type { ArteComVideo, DadosArtes } from "./artes-dados";

/**
 * Compartilhar das Conquistas (26/09; o álbum e o VÍDEO em 27/09; as
 * INSÍGNIAS v3 — "minha conquista do mês" e "minhas 3 conquistas" — na noite
 * de 27/09; Capa e Carteirinha saíram do seletor). Os nomes de evento antigos
 * ficam (`badge_share`, `album_share`) pra série histórica não quebrar;
 * `conquista_share` e `tres_share` dizem as artes novas; `stories_video`
 * conta o vídeo (e o que caiu pra imagem). O resultado é tratado como nos
 * outros compartilhares do app: "downloaded" avisa que salvou, "failed" diz
 * a verdade.
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
  return enviar(blob, `core-figurinha-${dados.id}.png`, `Figurinha: ${dados.titulo}`, "conquista");
}

export async function compartilharAlbum(dados: DadosArtes) {
  trackEvent("album_share", { nivel: dados.nivel, adesivos: dados.adesivos, raros: dados.maisRaros.map((b) => b.id).join(",") });
  const blob = await gerarPng(<StoriesAlbum {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-meu-album.png", "Meu álbum de figurinhas no CORE", "album");
}

/** "Minha conquista do mês" — a insígnia enorme (imagem). */
export async function compartilharConquista(dados: DadosArtes) {
  const h = dados.heroi;
  if (!h) {
    avisar("sem-imagem");
    return "failed" as const;
  }
  trackEvent("conquista_share", { id: h.id, faixa: h.faixa, valor: Math.round(h.valor), sensivel: !!h.sensivel });
  const blob = await gerarPng(<StoriesConquista ins={h} nome={dados.nome} membroDesde={dados.membroDesde} nivel={dados.nivel} mesIdx={dados.mesIdx} ano={dados.ano} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-conquista-${h.id}.png`, `${h.nome} no CORE`, "conquista");
}

/** "Minhas 3 conquistas" — o resumo (imagem). */
export async function compartilharTres(dados: DadosArtes) {
  const tres = dados.tres.slice(0, 3);
  if (tres.length < 3) {
    avisar("sem-imagem");
    return "failed" as const;
  }
  trackEvent("tres_share", { ids: tres.map((i) => i.id).join(",") });
  const blob = await gerarPng(<StoriesTres tres={tres} nome={dados.nome} membroDesde={dados.membroDesde} nivel={dados.nivel} mesIdx={dados.mesIdx} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-minhas-3-conquistas.png", "Minhas 3 conquistas no CORE", "tres");
}

/** A imagem parada da arte que também existe em vídeo. */
export const compartilharImagemDaArte = (arte: ArteComVideo, d: DadosArtes) =>
  arte === "conquista" ? compartilharConquista(d) : arte === "tres" ? compartilharTres(d) : compartilharAlbum(d);

const ARQUIVO_VIDEO: Record<ArteComVideo, [string, string]> = {
  conquista: ["core-minha-conquista.mp4", "Minha conquista do mês no CORE"],
  tres: ["core-minhas-3-conquistas.mp4", "Minhas 3 conquistas no CORE"],
  album: ["core-meu-album.mp4", "Meu álbum de figurinhas no CORE"],
};

/**
 * O VÍDEO dos Stories: gera no aparelho (só baixa o código do vídeo neste
 * toque) e compartilha pelos mesmos caminhos da imagem. Sem como gerar, ou
 * se o compartilhar recusar o arquivo, cai pra IMAGEM — e o `stories_video`
 * conta o que aconteceu.
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
  trackEvent("stories_video", { arte, ok: true, ms: ms(), geracao_ms: gerado.ms, formato: gerado.formato, resolucao: `${gerado.largura}x${gerado.altura}`, duracao: gerado.duracao, resultado: r, fallback: null });
  avisar(r, "video");
  return r;
}
