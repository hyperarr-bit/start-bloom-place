/**
 * POSTAR UM CARD (29/09): a imagem sai no TAMANHO do formato (a foto é do
 * próprio componente, 1:1); sem vídeo, vai a imagem; e o R$ só entra no
 * arquivo com a escolha da pessoa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const gerarPng = vi.fn(async (_el: ReactElement, _m: { largura: number; altura: number }) => new Blob(["png"], { type: "image/png" }));
vi.mock("@/components/conquistas/gerar-imagem", () => ({ gerarPng: (el: ReactElement, m: { largura: number; altura: number }) => gerarPng(el, m) }));
const compartilharImagem = vi.fn(async () => "shared" as const);
const compartilharVideo = vi.fn(async () => "shared" as const);
vi.mock("@/lib/compartilhar", () => ({ compartilharImagem: (...a: unknown[]) => compartilharImagem(...(a as [])), compartilharVideo: (...a: unknown[]) => compartilharVideo(...(a as [])) }));
const eventos: [string, Record<string, unknown>][] = [];
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown>) => eventos.push([n, d]) }));
const gerarVideoDoCard = vi.fn();
vi.mock("@/components/compartilhar/video-card", () => ({ gerarVideoDoCard: (...a: unknown[]) => gerarVideoDoCard(...a) }));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {}, message: () => {} } }));

import { gerarImagemDoCard, postarCardImagem, postarCardVideo, prepararCapas } from "@/components/compartilhar/postar";
import { AZUL_1, LIVROS_MES, TREINOS_MES } from "@/pages/dev/compartilhar-exemplos";

beforeEach(() => { gerarPng.mockClear(); compartilharImagem.mockClear(); compartilharVideo.mockClear(); gerarVideoDoCard.mockReset(); eventos.length = 0; });

describe("a imagem do card", () => {
  it("sai em 1080×1920 (Stories/Status), 1080×1350 (feed) e 1080×1080 (adesivo)", async () => {
    await gerarImagemDoCard(TREINOS_MES, "stories");
    await gerarImagemDoCard(TREINOS_MES, "feed");
    await gerarImagemDoCard(TREINOS_MES, "adesivo");
    expect(gerarPng.mock.calls.map((c) => c[1])).toEqual([
      { largura: 1080, altura: 1920 },
      { largura: 1080, altura: 1350 },
      { largura: 1080, altura: 1080 },
    ]);
  });

  it("o arquivo do mês no azul NÃO leva R$ sem a escolha; com ela, leva", async () => {
    await gerarImagemDoCard(AZUL_1, "stories");
    expect(renderToStaticMarkup(gerarPng.mock.calls[0][0])).not.toMatch(/R\$/);
    await gerarImagemDoCard({ ...AZUL_1, valoresLigados: true }, "stories");
    expect(renderToStaticMarkup(gerarPng.mock.calls[1][0])).toMatch(/R\$ 612/);
  });

  it("postar: gera, abre o compartilhar com o PNG e conta o evento", async () => {
    const r = await postarCardImagem(TREINOS_MES, "stories", "teste");
    expect(r).toBe("shared");
    expect(compartilharImagem).toHaveBeenCalledWith(expect.any(Blob), "core-treinos-stories.png", "Meus treinos no CORE", "card-treinos");
    expect(eventos[0]).toEqual(["card_share", { tipo: "treinos", formato: "stories", midia: "imagem", origem: "teste", valores: false }]);
  });
});

describe("o vídeo do card", () => {
  it("saiu: compartilha o MP4", async () => {
    gerarVideoDoCard.mockResolvedValue({ blob: new Blob(["mp4"], { type: "video/mp4" }), formato: "webcodecs", largura: 1080, altura: 1920, ms: 900, duracao: 5.5 });
    const r = await postarCardVideo(TREINOS_MES, "stories", "teste");
    expect(r).toBe("shared");
    expect(compartilharVideo).toHaveBeenCalledWith(expect.any(Blob), "core-treinos-stories.mp4", "Meus treinos no CORE", "card-treinos");
    expect(compartilharImagem).not.toHaveBeenCalled();
    expect(eventos.find(([n]) => n === "card_video")?.[1]).toMatchObject({ ok: true, formato_video: "webcodecs" });
  });

  it("não saiu (aparelho sem codificador, travou): vai a IMAGEM, e o evento diz", async () => {
    gerarVideoDoCard.mockResolvedValue(null);
    const r = await postarCardVideo(TREINOS_MES, "stories", "teste");
    expect(r).toBe("shared");
    expect(compartilharVideo).not.toHaveBeenCalled();
    expect(compartilharImagem).toHaveBeenCalledTimes(1);
    expect(eventos.find(([n]) => n === "card_video")?.[1]).toMatchObject({ ok: false, fallback: "imagem" });
  });

  it("o compartilhar recusou o vídeo: vai a imagem", async () => {
    gerarVideoDoCard.mockResolvedValue({ blob: new Blob(["mp4"]), formato: "mediarecorder", largura: 720, altura: 1280, ms: 5000, duracao: 5.5 });
    compartilharVideo.mockResolvedValueOnce("failed" as never);
    await postarCardVideo(TREINOS_MES, "stories", "teste");
    expect(compartilharImagem).toHaveBeenCalledTimes(1);
  });
});

describe("as capas dos livros", () => {
  it("capa que não carrega (sem CORS, fora do ar) vira capa tipográfica, nunca um buraco", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("CORS"));
    const d = await prepararCapas({ ...LIVROS_MES, livros: [{ titulo: "X", capa: "https://exemplo.invalid/capa.jpg" }] });
    expect(d.tipo === "livros" && d.livros[0].capa).toBeUndefined();
    f.mockRestore();
  });
});
