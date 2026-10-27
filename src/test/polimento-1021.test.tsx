import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/* 1.0.21 — sobras do QA do v1020: o relógio nas telas de fundo escuro e a figurinha comum por cima das folhas. */

const barra = vi.hoisted(() => ({ chamadas: [] as string[] }));
vi.mock("@/lib/status-bar", () => ({
  aplicarBarraDeStatus: async (modo: string) => { barra.chamadas.push(modo); },
}));

import { FaixaDoRelogioSobFundoEscuro } from "@/components/app/faixaDoRelogio";

const raiz = () => document.documentElement;
const ler = (caminho: string) => readFileSync(join(process.cwd(), caminho), "utf8");

describe("FaixaDoRelogioSobFundoEscuro (tela cheia escura: '3 dias seguidos!', menu da conta)", () => {
  afterEach(() => {
    raiz().style.removeProperty("--safe-top-cor");
    raiz().classList.remove("faixa-relogio-transparente", "dark");
    barra.chamadas = [];
  });

  it("montada: faixa transparente + relógio branco; desmontada: a cor e o relógio do tema claro voltam", () => {
    raiz().style.setProperty("--safe-top-cor", "#f4f4f3");
    const f = render(<FaixaDoRelogioSobFundoEscuro />);
    expect(raiz().style.getPropertyValue("--safe-top-cor")).toBe("transparent");
    expect(raiz().classList.contains("faixa-relogio-transparente")).toBe(true);
    expect(barra.chamadas).toEqual(["dark"]);
    f.unmount();
    expect(raiz().style.getPropertyValue("--safe-top-cor")).toBe("#f4f4f3");
    expect(raiz().classList.contains("faixa-relogio-transparente")).toBe(false);
    expect(barra.chamadas).toEqual(["dark", "light"]);
  });

  it("no tema escuro a barra continua clara ao sair", () => {
    raiz().classList.add("dark");
    const f = render(<FaixaDoRelogioSobFundoEscuro />);
    f.unmount();
    expect(barra.chamadas).toEqual(["dark", "dark"]);
  });

  it("trava: a festa em tela cheia do '3 dias seguidos!' e o menu da conta montam a versão de fundo escuro", () => {
    const passo = ler("src/components/missao-doses/PassoDoDia.tsx");
    const telaCheia = passo.slice(passo.indexOf("A ÚNICA festa em tela cheia do teste"), passo.indexOf("3 dias seguidos!</p>"));
    expect(telaCheia).toContain("<FaixaDoRelogioSobFundoEscuro />");
    expect(ler("src/components/home/AccountDrawer.tsx")).toContain("<FaixaDoRelogioSobFundoEscuro />");
  });
});

describe("figurinha comum com camada escura na tela", () => {
  it("trava: o aviso de baixo some enquanto uma folha/tela escura liga a faixa transparente (nunca por cima da folha do score)", () => {
    const css = ler("src/index.css").replace(/\s+/g, " ");
    expect(css).toContain('html.faixa-relogio-transparente .cf-chegada[data-tipo="comum"] { visibility: hidden; }');
  });
});
