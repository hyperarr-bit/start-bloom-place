/**
 * O aparelho consegue fazer o vídeo dos Stories? (27/09)
 *
 * 1. WebCodecs (`VideoEncoder` com H.264): Chrome/Android 94+, WebView do
 *    Android, Safari/WKWebView 16.4+ — codifica mais rápido que o tempo real,
 *    quadro a quadro, e o MP4 sai do nosso muxer (mp4.ts).
 * 2. MediaRecorder com `video/mp4` (Safari; Chrome 126+): grava o canvas em
 *    tempo real (5 s). Só vale se o MP4 for H.264 — o Instagram não aceita
 *    WebM de forma confiável, então WebM nem entra na lista.
 * 3. Nada dos dois → quem chama manda a IMAGEM.
 *
 * Só VideoEncoder existir não basta: `isConfigSupported` confirma o codec no
 * tamanho (o 42001f, nível 3.1, só vai até 720p). 1080p só com ≥ 6 núcleos
 * (iPhone A-series e Android de meio pra cima); o resto faz 720p.
 */

export type FormatoVideo = "webcodecs" | "mediarecorder";

export interface SuporteVideo {
  formato: FormatoVideo;
  codec?: string;
  largura: number;
  altura: number;
}

/** Main/Baseline/High nível 4.0 (1080p30) e nível 3.1 (720p30). */
export const CODECS = {
  hd: ["avc1.4D0028", "avc1.42E028", "avc1.640028"],
  sd: ["avc1.42E01F", "avc1.4D401F", "avc1.42001F"],
};
const MIMES_MP4 = ['video/mp4;codecs="avc1.42E01E"', 'video/mp4;codecs="avc1"', "video/mp4"];

export const bitrateDe = (altura: number) => (altura >= 1920 ? 8_000_000 : 4_500_000);

export const mimeDoGravador = (): string | null => {
  try {
    if (typeof MediaRecorder === "undefined") return null;
    return MIMES_MP4.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
  } catch {
    return null;
  }
};

export const temGravadorMp4 = (): boolean =>
  !!mimeDoGravador() && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";

async function detectar(): Promise<SuporteVideo | null> {
  try {
    if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
      const hd = (navigator.hardwareConcurrency ?? 4) >= 6;
      const tentativas: [number, number, string[]][] = hd ? [[1080, 1920, CODECS.hd], [720, 1280, CODECS.sd]] : [[720, 1280, CODECS.sd]];
      for (const [largura, altura, codecs] of tentativas) {
        for (const codec of codecs) {
          try {
            const s = await VideoEncoder.isConfigSupported({ codec, width: largura, height: altura, bitrate: bitrateDe(altura), framerate: 30, avc: { format: "avc" } });
            if (s.supported) return { formato: "webcodecs", codec, largura, altura };
          } catch {
            /* próximo codec */
          }
        }
      }
    }
  } catch {
    /* sem WebCodecs */
  }
  if (temGravadorMp4()) return { formato: "mediarecorder", largura: 720, altura: 1280 };
  return null;
}

let cache: Promise<SuporteVideo | null> | null = null;

/** Detecta uma vez por sessão (rápido: só `isConfigSupported`). */
export const suporteVideo = (): Promise<SuporteVideo | null> => (cache ??= detectar());

/** Só pra testes. */
export const limparCacheDeSuporte = () => { cache = null; };
