/**
 * O vídeo dos Stories (27/09): `compartilharVideo` anda pelos mesmos caminhos
 * da imagem (nativo, Web Share, download no PC) com o arquivo como video/mp4;
 * e `compartilharVideoDaArte` cai pra IMAGEM quando o vídeo não sai (sem
 * suporte, gerador explodiu, ou o compartilhar recusou o arquivo), contando
 * tudo em `stories_video`. O codificador de verdade não existe no jsdom: o
 * gerador é simulado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const nativo = { v: false };
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => nativo.v }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); } }));
const escrito: unknown[] = [];
const compartilhado: unknown[] = [];
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: async (o: unknown) => { escrito.push(o); return { uri: "file:///cache/v.mp4" }; } },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: async (o: unknown) => { compartilhado.push(o); } } }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));
const gerador = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/components/conquistas/video/gerar-video", () => ({ gerarVideoDaArte: (...a: unknown[]) => gerador.fn(...a) }));
vi.mock("@/components/conquistas/gerar-imagem", () => ({
  gerarPng: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
  gerarCanvas: async () => null,
}));

import { compartilharVideo } from "@/lib/compartilhar";
import { compartilharVideoDaArte } from "@/components/conquistas/compartilhar-conquistas";
import { CATALOGO, montarInsignia } from "@/components/conquistas/insignias";
import type { DadosArtes } from "@/components/conquistas/artes-dados";

const mp4 = () => new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], { type: "video/mp4" });
const heroi = montarInsignia(CATALOGO.find((d) => d.id === "tre-mes")!, { valor: 19 });
const dados: DadosArtes = {
  nome: "Ana Beatriz", membroDesde: "julho de 2026", dias: 12, nivel: "Ouro", xp: 1200, adesivos: 15, total: 65, ano: 2026, mesIdx: 8,
  maisRaros: [], proximos: [], figurinhas: [], mes: "SETEMBRO · 2026",
  porRaridade: { comum: { abertos: 6, total: 23 }, raro: { abertos: 5, total: 21 }, epico: { abertos: 3, total: 14 }, lendario: { abertos: 1, total: 7 } },
  heroi, tres: [heroi], candidatas: [heroi], valoresLigados: false,
};
const semWebShare = () => {
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
};
const comWebShare = (share: (o: { files: File[] }) => Promise<void>) => {
  Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
};

beforeEach(() => {
  escrito.length = 0; compartilhado.length = 0; eventos.length = 0; nativo.v = false;
  gerador.fn.mockReset(); toasts.success.mockReset(); toasts.error.mockReset(); toasts.message.mockReset();
  semWebShare();
});

describe("compartilharVideo", () => {
  it("no app: grava o MP4 no cache e abre o compartilhar nativo, contando tipo=video", async () => {
    nativo.v = true;
    expect(await compartilharVideo(mp4(), "core-meu-album.mp4", "Meu álbum", "album")).toBe("shared");
    expect(escrito[0]).toMatchObject({ path: "core-meu-album.mp4", directory: "CACHE" });
    expect(compartilhado[0]).toMatchObject({ title: "Meu álbum", files: ["file:///cache/v.mp4"] });
    expect(eventos).toContainEqual(["compartilhar_resultado", { origem: "album", resultado: "shared", via: "nativo", tipo: "video" }]);
  });

  it("na web com Web Share: o arquivo vai como video/mp4", async () => {
    const share = vi.fn(async () => undefined);
    comWebShare(share);
    expect(await compartilharVideo(mp4(), "core-meu-planner.mp4", "Meu planner", "capa")).toBe("shared");
    const arquivo = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0];
    expect(arquivo.type).toBe("video/mp4");
    expect(arquivo.name).toBe("core-meu-planner.mp4");
  });

  it("no PC sem Web Share: baixa o MP4", async () => {
    expect(await compartilharVideo(mp4(), "core-meu-album.mp4", "t", "album")).toBe("downloaded");
    expect(eventos).toContainEqual(["compartilhar_resultado", { origem: "album", resultado: "downloaded", via: "download", tipo: "video" }]);
  });
});

describe("compartilharVideoDaArte: vídeo → imagem", () => {
  it("com o vídeo gerado, manda o MP4 e conta stories_video ok (com formato, resolução e tempo)", async () => {
    gerador.fn.mockResolvedValue({ blob: mp4(), formato: "webcodecs", largura: 1080, altura: 1920, ms: 1234 });
    const progresso: number[] = [];
    expect(await compartilharVideoDaArte("album", dados, (f) => progresso.push(f))).toBe("downloaded");
    expect(gerador.fn).toHaveBeenCalledWith("album", dados, expect.any(Function));
    const ev = eventos.find(([n]) => n === "stories_video")!;
    expect(ev[1]).toMatchObject({ arte: "album", ok: true, formato: "webcodecs", resolucao: "1080x1920", geracao_ms: 1234, resultado: "downloaded", fallback: null });
    expect(typeof ev[1].ms).toBe("number");
    expect(toasts.success).toHaveBeenCalledWith(expect.stringMatching(/Vídeo salvo/));
    expect(eventos.some(([n]) => n === "album_share")).toBe(false);
  });

  it("sem como gerar (null): cai pra imagem do álbum e conta o fallback", async () => {
    gerador.fn.mockResolvedValue(null);
    expect(await compartilharVideoDaArte("album", dados)).toBe("downloaded");
    expect(eventos).toContainEqual(["stories_video", expect.objectContaining({ arte: "album", ok: false, formato: "nenhum", fallback: "imagem" })]);
    expect(eventos.some(([n]) => n === "album_share")).toBe(true);
    expect(toasts.message).toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith(expect.stringMatching(/Imagem salva/));
  });

  it("o gerador explode: também cai pra imagem (da conquista, quando a arte é a conquista do mês)", async () => {
    gerador.fn.mockRejectedValue(new Error("boom"));
    expect(await compartilharVideoDaArte("conquista", dados)).toBe("downloaded");
    expect(eventos).toContainEqual(["stories_video", expect.objectContaining({ arte: "conquista", ok: false, fallback: "imagem" })]);
    expect(eventos.some(([n]) => n === "conquista_share")).toBe(true);
    expect(eventos.find(([n]) => n === "conquista_share")![1]).toMatchObject({ id: "tre-mes", faixa: "ouro", valor: 19 });
  });

  it("'Minhas 3 conquistas' é UM arquivo (11 s): com o vídeo ok manda o MP4; sem 3 candidatas a imagem não sai", async () => {
    gerador.fn.mockResolvedValue({ blob: mp4(), formato: "webcodecs", largura: 1080, altura: 1920, ms: 2100, duracao: 11.3 });
    expect(await compartilharVideoDaArte("tres", dados)).toBe("downloaded");
    expect(eventos).toContainEqual(["stories_video", expect.objectContaining({ arte: "tres", ok: true, duracao: 11.3 })]);
    gerador.fn.mockResolvedValue(null);
    expect(await compartilharVideoDaArte("tres", dados)).toBe("failed");
    expect(toasts.error).toHaveBeenCalled();
  });

  it("o compartilhar recusa o vídeo (failed): manda a imagem pelo mesmo canal", async () => {
    gerador.fn.mockResolvedValue({ blob: mp4(), formato: "mediarecorder", largura: 720, altura: 1280, ms: 5100 });
    const share = vi.fn(async ({ files }: { files: File[] }) => { if (files[0].type === "video/mp4") throw new Error("NotAllowedError"); });
    comWebShare(share);
    expect(await compartilharVideoDaArte("album", dados)).toBe("shared");
    expect(share).toHaveBeenCalledTimes(2);
    expect(eventos).toContainEqual(["stories_video", expect.objectContaining({ arte: "album", ok: false, formato: "mediarecorder", resolucao: "720x1280", fallback: "imagem" })]);
    expect(eventos.some(([n]) => n === "album_share")).toBe(true);
  });

  it("cancelou a folha do celular: não é falha, não cai pra imagem", async () => {
    gerador.fn.mockResolvedValue({ blob: mp4(), formato: "webcodecs", largura: 1080, altura: 1920, ms: 900 });
    comWebShare(async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; });
    expect(await compartilharVideoDaArte("album", dados)).toBe("cancelled");
    expect(eventos.some(([n]) => n === "album_share")).toBe(false);
    expect(eventos).toContainEqual(["stories_video", expect.objectContaining({ ok: true, resultado: "cancelled" })]);
  });
});
