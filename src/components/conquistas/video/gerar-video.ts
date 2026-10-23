import type { ArteComVideo, DadosArtes } from "../artes-dados";
import { FPS, LARGURA } from "./animacao";
import { prepararRoteiro, type Roteiro } from "./camadas";
import { codificarComWebCodecs, gravarComMediaRecorder } from "./codificar";
import { bitrateDe, suporteVideo, temGravadorMp4, type FormatoVideo } from "./suporte";

/**
 * O VÍDEO DOS STORIES, no aparelho (27/09): detecta o que dá pra usar,
 * fotografa as camadas, anima no canvas e codifica — WebCodecs primeiro; se
 * falhar no meio, tenta o MediaRecorder (720p); sem os dois, devolve null e
 * quem chama manda a imagem. Progresso: 0–0,3 camadas, 0,3–0,98 quadros.
 * A duração é a do roteiro da arte (5 s álbum · 5,5 s conquista · 11,3 s as
 * três conquistas num arquivo só).
 *
 * 29/09: a parte que CODIFICA um roteiro virou `codificarRoteiro` — os cards
 * de compartilhar (src/components/compartilhar) montam o roteiro deles e
 * passam por aqui: o mesmo WebCodecs, o mesmo vigia de travamento
 * (`CodificadorParado`, o vídeo que parava em 32% no iPhone) e o mesmo plano
 * B (MediaRecorder → imagem).
 */

export interface VideoGerado {
  blob: Blob;
  formato: FormatoVideo;
  largura: number;
  altura: number;
  /** Quanto demorou (camadas + quadros + arquivo). */
  ms: number;
  duracao: number;
}

export type EtapaVideo = "camadas" | "quadros" | "arquivo";

/**
 * Codifica um roteiro pronto (duração + a função que pinta o instante t, no
 * espaço 1080 de largura). `t0` = quando o trabalho começou (pra `ms` contar
 * também as camadas). null = não deu (quem chama manda a imagem).
 */
export async function codificarRoteiro(roteiro: Roteiro, onProgresso?: (fracao: number, etapa: EtapaVideo) => void, t0 = performance.now(), alturaBase = 1920): Promise<VideoGerado | null> {
  const sup = await suporteVideo();
  if (!sup) return null;
  // o suporte vem pensado em 9:16; num roteiro 4:5 a altura acompanha a proporção
  const proporcao = alturaBase / LARGURA;
  const tentar = async (formato: FormatoVideo, largura: number, altura: number): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    const escala = largura / LARGURA;
    const desenhar = (t: number) => roteiro.desenhar(ctx, t, escala);
    const prog = (f: number) => onProgresso?.(0.3 + 0.68 * f, "quadros");
    return formato === "webcodecs"
      ? codificarComWebCodecs(canvas, desenhar, { codec: sup.codec!, largura, altura, fps: FPS, duracao: roteiro.duracao, bitrate: bitrateDe(altura), onProgresso: prog })
      : gravarComMediaRecorder(canvas, desenhar, { largura, altura, fps: FPS, duracao: roteiro.duracao, bitrate: bitrateDe(altura), onProgresso: prog });
  };
  const alturaDe = (largura: number) => Math.round((largura * proporcao) / 2) * 2;

  let blob: Blob | null = null;
  let formato = sup.formato;
  let largura = sup.largura, altura = alturaDe(sup.largura);
  try {
    blob = await tentar(sup.formato, largura, altura);
  } catch (e) {
    console.error(`[compartilhar] vídeo (${sup.formato}) falhou:`, e);
    blob = null;
  }
  if (!blob && sup.formato === "webcodecs" && temGravadorMp4()) {
    try {
      formato = "mediarecorder";
      largura = 720;
      altura = alturaDe(720);
      blob = await tentar("mediarecorder", largura, altura);
    } catch (e) {
      console.error("[compartilhar] vídeo (mediarecorder) falhou:", e);
      blob = null;
    }
  }
  if (!blob || !blob.size) return null;
  onProgresso?.(1, "arquivo");
  return { blob, formato, largura, altura, ms: Math.round(performance.now() - t0), duracao: roteiro.duracao };
}

export async function gerarVideoDaArte(arte: ArteComVideo, dados: DadosArtes, onProgresso?: (fracao: number, etapa: EtapaVideo) => void): Promise<VideoGerado | null> {
  const t0 = performance.now();
  const sup = await suporteVideo();
  if (!sup) return null;
  const roteiro = await prepararRoteiro(arte, dados, (feita, de) => onProgresso?.(0.04 + (0.26 * feita) / de, "camadas"));
  if (!roteiro) return null;
  return codificarRoteiro(roteiro, onProgresso, t0);
}
