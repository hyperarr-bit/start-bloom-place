/** Varredura 26/10 (item 17): álbum aberto no tema claro = barra de status com texto claro; fechar devolve o tema. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("barra de status no álbum", () => {
  it("o AlbumTela pede a barra clara enquanto aberto e devolve a do tema no cleanup", () => {
    const fonte = readFileSync(resolve(__dirname, "../components/conquistas/AlbumTela.tsx"), "utf8");
    expect(fonte).toMatch(/if \(!aberto\) return;\s*void aplicarBarraDeStatus\("dark"\);\s*return \(\) => \{ void aplicarBarraDeStatus\(document\.documentElement\.classList\.contains\("dark"\) \? "dark" : "light"\); \};/);
  });
});
