import { describe, it, expect, vi, beforeEach } from "vitest";

/* Compartilhar (26/09): no app usa o nativo; web usa Web Share; PC baixa; no
 * app sem nenhum dos dois devolve "failed" (não finge que salvou). */
const nativo = { v: false };
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => nativo.v }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const escrito: unknown[] = [];
const compartilhado: unknown[] = [];
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: async (o: unknown) => { escrito.push(o); return { uri: "file:///cache/x.png" }; } },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: async (o: unknown) => { compartilhado.push(o); } } }));

import { compartilharImagem } from "@/lib/compartilhar";

const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

describe("compartilharImagem", () => {
  beforeEach(() => { escrito.length = 0; compartilhado.length = 0; nativo.v = false; });

  it("no app: grava no cache e abre o compartilhar nativo com o arquivo", async () => {
    nativo.v = true;
    expect(await compartilharImagem(png(), "core-meu-perfil.png", "Meu perfil", "perfil")).toBe("shared");
    expect(escrito[0]).toMatchObject({ path: "core-meu-perfil.png", directory: "CACHE" });
    expect(compartilhado[0]).toMatchObject({ files: ["file:///cache/x.png"] });
  });

  it("no PC sem Web Share: baixa o PNG", async () => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    expect(await compartilharImagem(png(), "a.png", "t", "perfil")).toBe("downloaded");
  });
});
