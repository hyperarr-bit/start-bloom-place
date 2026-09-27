import { muxarMp4, type AmostraH264 } from "./mp4";
import { mimeDoGravador } from "./suporte";

/**
 * CODIFICAR O VÍDEO (27/09) — dois caminhos, os dois entregam MP4 H.264:
 *
 * WebCodecs: desenha cada quadro no canvas, embrulha num `VideoFrame` com o
 * tempo certo e manda pro `VideoEncoder` — mais rápido que o tempo real (o
 * codificador de hardware do celular faz 150 quadros em ~2–3 s), e
 * determinístico (não depende do rAF nem da tela). As amostras saem em
 * "avc" (comprimento + NAL) com a `avcC` no 1º quadro-chave; o mp4.ts junta.
 * Quadro-chave a cada segundo; contrapressão pela fila do codificador; a cada
 * 5 quadros devolve o fio pro navegador (a barra de progresso anda).
 *
 * MediaRecorder: grava o canvas em tempo real (5 s) com `video/mp4` quando
 * o navegador tem — Safari, e Chrome desde o 126.
 */

export interface OpcoesCodificar {
  codec: string;
  largura: number;
  altura: number;
  fps: number;
  duracao: number;
  bitrate: number;
  onProgresso?: (fracao: number) => void;
  /** Quanto o codificador pode ficar sem andar (fila parada, flush sem voltar) antes de a gente desistir. */
  paradoMaxMs?: number;
}

/**
 * VIGIA (27/09, simulador do iPhone): o `VideoEncoder` aceitou a config, fez 10
 * quadros e PAROU — a fila ficou acima de 6 pra sempre, sem `error`. O laço de
 * contrapressão esperava calado, a barra ficava em "Preparando o vídeo… 32%" e
 * o plano B (MediaRecorder → imagem) nunca entrava, porque ninguém falhou.
 * Agora: fila sem andar por `paradoMaxMs` (ou flush que não volta) = erro, e o
 * gerar-video.ts segue pro próximo caminho.
 */
export const PARADO_MAX_MS = 5000;

export class CodificadorParado extends Error {
  constructor(onde: string) {
    super(`codificador parado (${onde})`);
    this.name = "CodificadorParado";
  }
}

const respiro = () => new Promise<void>((ok) => setTimeout(ok, 0));

const comLimite = <T,>(p: Promise<T>, ms: number, onde: string): Promise<T> =>
  new Promise<T>((ok, falha) => {
    const t = setTimeout(() => falha(new CodificadorParado(onde)), ms);
    p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); falha(e); });
  });

const esperarFila = (enc: VideoEncoder) =>
  new Promise<void>((ok) => {
    const t = setTimeout(ok, 40);
    try {
      enc.addEventListener("dequeue", () => { clearTimeout(t); ok(); }, { once: true });
    } catch {
      /* sem evento dequeue: o timeout resolve */
    }
  });

const paraBytes = (d: AllowSharedBufferSource): Uint8Array =>
  ArrayBuffer.isView(d)
    ? new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength))
    : new Uint8Array((d as ArrayBuffer).slice(0));

export async function codificarComWebCodecs(canvas: HTMLCanvasElement, desenhar: (t: number) => void, o: OpcoesCodificar): Promise<Blob> {
  const amostras: AmostraH264[] = [];
  let avcC: Uint8Array | null = null;
  let erro: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const d = meta?.decoderConfig?.description;
      if (d && !avcC) avcC = paraBytes(d);
      const b = new Uint8Array(chunk.byteLength);
      chunk.copyTo(b);
      amostras.push({ dados: b, chave: chunk.type === "key" });
    },
    error: (e) => { erro = e; },
  });
  try {
    enc.configure({ codec: o.codec, width: o.largura, height: o.altura, bitrate: o.bitrate, framerate: o.fps, avc: { format: "avc" }, latencyMode: "quality" });
    const n = Math.round(o.duracao * o.fps);
    const dur = Math.round(1e6 / o.fps);
    const paradoMax = o.paradoMaxMs ?? PARADO_MAX_MS;
    for (let i = 0; i < n; i++) {
      if (erro) throw erro;
      desenhar(i / o.fps);
      const frame = new VideoFrame(canvas, { timestamp: i * dur, duration: dur });
      try {
        enc.encode(frame, { keyFrame: i % o.fps === 0 });
      } finally {
        frame.close();
      }
      let fila = enc.encodeQueueSize;
      let andou = performance.now();
      while (enc.encodeQueueSize > 6 && !erro) {
        await esperarFila(enc);
        if (enc.encodeQueueSize < fila) { fila = enc.encodeQueueSize; andou = performance.now(); }
        else if (performance.now() - andou > paradoMax) throw new CodificadorParado(`fila em ${enc.encodeQueueSize} no quadro ${i + 1}/${n}`);
      }
      if (i % 5 === 4) {
        o.onProgresso?.((i + 1) / n);
        await respiro();
      }
    }
    await comLimite(enc.flush(), paradoMax * 2, "flush");
    if (erro) throw erro;
    if (!avcC) throw new Error("o codificador não entregou a avcC");
    if (amostras.length !== n) throw new Error(`codificação incompleta: ${amostras.length}/${n} quadros`);
    o.onProgresso?.(1);
    return muxarMp4({ largura: o.largura, altura: o.altura, fps: o.fps, avcC, amostras });
  } finally {
    try {
      if (enc.state !== "closed") enc.close();
    } catch {
      /* já fechado */
    }
  }
}

export async function gravarComMediaRecorder(canvas: HTMLCanvasElement, desenhar: (t: number) => void, o: Omit<OpcoesCodificar, "codec">): Promise<Blob> {
  const mime = mimeDoGravador();
  if (!mime) throw new Error("sem MediaRecorder com video/mp4");
  desenhar(0);
  const stream = canvas.captureStream(o.fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: o.bitrate });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
  const fim = new Promise<void>((ok, falha) => {
    rec.onstop = () => ok();
    rec.onerror = () => falha(new Error("MediaRecorder falhou"));
  });
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((ok) => {
    const passo = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= o.duracao) { desenhar(o.duracao - 1 / o.fps); ok(); return; }
      desenhar(t);
      o.onProgresso?.(t / o.duracao);
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
  rec.stop();
  await comLimite(fim, PARADO_MAX_MS, "gravador");
  stream.getTracks().forEach((tr) => tr.stop());
  o.onProgresso?.(1);
  return new Blob(partes, { type: "video/mp4" });
}
