/**
 * Vigia do codificador de vídeo (27/09): no simulador do iPhone o VideoEncoder
 * fez 10 quadros e parou — fila presa, nenhum `error` — e a tela ficou em
 * "Preparando o vídeo… 32%" pra sempre. Parado tem que virar ERRO, pro
 * gerar-video.ts seguir pro MediaRecorder e depois pra imagem.
 */
import { describe, it, expect, afterEach } from "vitest";
import { codificarComWebCodecs, CodificadorParado } from "@/components/conquistas/video/codificar";

type Saida = (chunk: unknown, meta?: unknown) => void;

const AVCC = new Uint8Array([1, 0x4d, 0, 0x28, 0xff, 0xe1, 0, 0]);

/** VideoEncoder de mentira: `modo` diz como ele se comporta. */
const instalarCodificador = (modo: "saudavel" | "fila-presa" | "flush-preso") => {
  class FakeEncoder {
    state = "unconfigured";
    encodeQueueSize = 0;
    private saida: Saida;
    private n = 0;
    constructor(o: { output: Saida; error: (e: unknown) => void }) { this.saida = o.output; }
    configure() { this.state = "configured"; }
    addEventListener() { /* nunca avisa: o timeout de 40 ms da espera resolve */ }
    encode() {
      if (modo === "fila-presa" && this.n >= 10) { this.encodeQueueSize++; this.n++; return; }
      const chave = this.n % 30 === 0;
      this.saida(
        { byteLength: 4, type: chave ? "key" : "delta", copyTo: (b: Uint8Array) => b.set([0, 0, 0, 1]) },
        this.n === 0 ? { decoderConfig: { description: AVCC } } : undefined,
      );
      this.n++;
    }
    flush() { return modo === "flush-preso" ? new Promise<void>(() => {}) : Promise.resolve(); }
    close() { this.state = "closed"; }
  }
  class FakeFrame { close() {} }
  Object.assign(globalThis, { VideoEncoder: FakeEncoder, VideoFrame: FakeFrame });
};

afterEach(() => {
  delete (globalThis as Record<string, unknown>).VideoEncoder;
  delete (globalThis as Record<string, unknown>).VideoFrame;
});

const opcoes = { codec: "avc1.4D0028", largura: 16, altura: 16, fps: 30, duracao: 1, bitrate: 1_000_000, paradoMaxMs: 150 };

describe("codificarComWebCodecs: vigia", () => {
  it("codificador saudável: sai um MP4 com todos os quadros", async () => {
    instalarCodificador("saudavel");
    const blob = await codificarComWebCodecs(document.createElement("canvas"), () => {}, opcoes);
    expect(blob.type).toBe("video/mp4");
    expect(blob.size).toBeGreaterThan(100);
  });

  it("fila presa (o caso do simulador): vira CodificadorParado em vez de esperar pra sempre", async () => {
    instalarCodificador("fila-presa");
    const t0 = Date.now();
    await expect(codificarComWebCodecs(document.createElement("canvas"), () => {}, opcoes)).rejects.toBeInstanceOf(CodificadorParado);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("flush que não volta: também desiste", async () => {
    instalarCodificador("flush-preso");
    await expect(codificarComWebCodecs(document.createElement("canvas"), () => {}, opcoes)).rejects.toThrow(/flush/);
  });
});
