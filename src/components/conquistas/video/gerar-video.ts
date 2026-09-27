import type { ArteComVideo, DadosArtes } from "../artes-dados";
import { DURACAO, FPS, LARGURA, desenharQuadro } from "./animacao";
import { prepararCamadas } from "./camadas";
import { codificarComWebCodecs, gravarComMediaRecorder } from "./codificar";
import { bitrateDe, suporteVideo, temGravadorMp4, type FormatoVideo } from "./suporte";

/**
 * O VÍDEO DOS STORIES, no aparelho (27/09): detecta o que dá pra usar,
 * fotografa as camadas, anima no canvas e codifica — WebCodecs primeiro; se
 * falhar no meio, tenta o MediaRecorder (720p); sem os dois, devolve null e
 * quem chama manda a imagem. Progresso: 0–0,3 camadas, 0,3–0,98 quadros.
 */

export interface VideoGerado {
  blob: Blob;
  formato: FormatoVideo;
  largura: number;
  altura: number;
  /** Quanto demorou (camadas + quadros + arquivo). */
  ms: number;
}

export type EtapaVideo = "camadas" | "quadros" | "arquivo";

export async function gerarVideoDaArte(arte: ArteComVideo, dados: DadosArtes, onProgresso?: (fracao: number, etapa: EtapaVideo) => void): Promise<VideoGerado | null> {
  const t0 = performance.now();
  const sup = await suporteVideo();
  if (!sup) return null;
  const camadas = await prepararCamadas(arte, dados, (feita, de) => onProgresso?.(0.04 + (0.26 * feita) / de, "camadas"));
  if (!camadas) return null;

  const tentar = async (formato: FormatoVideo, largura: number, altura: number): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    const escala = largura / LARGURA;
    const desenhar = (t: number) => desenharQuadro(ctx, camadas, t, escala);
    const prog = (f: number) => onProgresso?.(0.3 + 0.68 * f, "quadros");
    return formato === "webcodecs"
      ? codificarComWebCodecs(canvas, desenhar, { codec: sup.codec!, largura, altura, fps: FPS, duracao: DURACAO, bitrate: bitrateDe(altura), onProgresso: prog })
      : gravarComMediaRecorder(canvas, desenhar, { largura, altura, fps: FPS, duracao: DURACAO, bitrate: bitrateDe(altura), onProgresso: prog });
  };

  let blob: Blob | null = null;
  let formato = sup.formato;
  let largura = sup.largura, altura = sup.altura;
  try {
    blob = await tentar(sup.formato, largura, altura);
  } catch (e) {
    console.error(`[conquistas] vídeo (${sup.formato}) falhou:`, e);
    blob = null;
  }
  if (!blob && sup.formato === "webcodecs" && temGravadorMp4()) {
    try {
      formato = "mediarecorder";
      largura = 720;
      altura = 1280;
      blob = await tentar("mediarecorder", largura, altura);
    } catch (e) {
      console.error("[conquistas] vídeo (mediarecorder) falhou:", e);
      blob = null;
    }
  }
  if (!blob || !blob.size) return null;
  onProgresso?.(1, "arquivo");
  return { blob, formato, largura, altura, ms: Math.round(performance.now() - t0) };
}
