/**
 * Críticas da subida 17/11 (persona): "Postar no story" no navegador do Instagram (iOS) — o compartilhar com arquivo e o download
 * costumam não fazer nada, e o botão não dizia nada. Agora: no navegador do Instagram (ou sem compartilhar, ou com erro) a arte abre
 * NA PÁGINA com "Toque e segure a imagem pra salvar". Cancelar o compartilhar não abre nada.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compartilharStory, navegadorDeApp } from "@/lib/indique-story";

const UA_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 356.0.0.0.0";
const UA_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
type Nav = Navigator & { canShare?: unknown; share?: unknown };

describe("story: nunca um botão que não faz nada", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback) { cb(new Blob(["x"], { type: "image/png" })); });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById("igt-story")?.remove();
    delete (navigator as Nav).canShare; delete (navigator as Nav).share;
  });

  it("reconhece o navegador do Instagram/Facebook", () => {
    expect(navegadorDeApp(UA_INSTAGRAM)).toBe(true);
    expect(navegadorDeApp("... FBAN/FBIOS ...")).toBe(true);
    expect(navegadorDeApp(UA_SAFARI)).toBe(false);
  });

  it("no navegador do Instagram: nem tenta o compartilhar — abre a arte na página com 'Toque e segure'", async () => {
    const share = vi.fn();
    Object.assign(navigator as Nav, { canShare: () => true, share });
    expect(await compartilharStory("https://www.coreaplicativo.com.br/oferta?ref=ANA7K2", UA_INSTAGRAM)).toBe("mostrou");
    expect(share).not.toHaveBeenCalled();
    const arte = document.querySelector('[data-testid="indique-story-arte"]')!;
    expect(arte.textContent).toContain("Toque e segure a imagem pra salvar");
    expect(arte.querySelector("img")!.getAttribute("src")).toMatch(/^data:image\/png/);
    (arte.querySelector('[data-testid="indique-story-fechar"]') as HTMLButtonElement).click();
    expect(document.querySelector('[data-testid="indique-story-arte"]')).toBeNull();
  });

  it("Safari com compartilhar: compartilha; cancelou: nada abre; erro: a arte abre", async () => {
    Object.assign(navigator as Nav, { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) });
    expect(await compartilharStory("https://x/oferta?ref=A", UA_SAFARI)).toBe("compartilhou");
    Object.assign(navigator as Nav, { share: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" })) });
    expect(await compartilharStory("https://x/oferta?ref=A", UA_SAFARI)).toBe("cancelou");
    expect(document.querySelector('[data-testid="indique-story-arte"]')).toBeNull();
    Object.assign(navigator as Nav, { share: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" })) });
    expect(await compartilharStory("https://x/oferta?ref=A", UA_SAFARI)).toBe("mostrou");
  });

  it("sem compartilhar (PC, navegador antigo): a arte abre na página", async () => {
    expect(await compartilharStory("https://x/oferta?ref=A", UA_SAFARI)).toBe("mostrou");
    expect(document.querySelector('[data-testid="indique-story-arte"]')).not.toBeNull();
  });
});
