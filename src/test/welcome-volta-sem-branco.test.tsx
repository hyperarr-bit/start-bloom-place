/**
 * 1.0.18 (QA de aparelho 21/10, iPhone 17 Pro e SE): "Já sou cliente · Entrar" → /entrar → "Ainda não tem conta? Monte
 * seu plano" → welcome. A foto do Entrar (lib/troca-de-rota) saía em cima de uma welcome ainda VAZIA (frase, prova e botão
 * com entrada atrasada; o vídeo começa em branco): 1 a 3 quadros de tela branca. Chegando por troca de rota, frase, prova e
 * botão já estão prontos; na abertura a frio a entrada animada continua.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const estado = vi.hoisted(() => ({ foto: false }));
vi.mock("@/lib/troca-de-rota", async (orig) => ({ ...(await orig<typeof import("@/lib/troca-de-rota")>()), rotaComFoto: () => estado.foto }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), instalouVindoDoSite: () => false }));
vi.mock("@/lib/att-ios", () => ({ pedirRastreamentoIos: async () => "nao_ios", segurarReservaNativaDoATT: () => {} }));

import { WelcomeCalai } from "@/pages/funis/w/WelcomeCalai";

afterEach(() => { cleanup(); estado.foto = false; });
const montar = () => render(<MemoryRouter><WelcomeCalai onComecar={() => {}} onEntrar={() => {}} /></MemoryRouter>);
const opacidade = (el: Element | null) => (el as HTMLElement | null)?.style.opacity ?? "";

describe("welcome × volta do /entrar (sem quadro branco)", () => {
  it("abertura a frio: frase e botão entram animados (começam transparentes)", () => {
    montar();
    expect(opacidade(screen.getByRole("heading", { level: 1 }))).toBe("0");
    expect(opacidade(document.querySelector(".wca-rodape"))).toBe("0");
  });

  it("chegando por troca de rota (foto da tela anterior por cima): frase, prova e botão já prontos", () => {
    estado.foto = true;
    montar();
    expect(opacidade(screen.getByRole("heading", { level: 1 }))).not.toBe("0");
    expect(opacidade(document.querySelector(".wca-prova"))).not.toBe("0");
    expect(opacidade(document.querySelector(".wca-rodape"))).not.toBe("0");
    expect(screen.getByTestId("welcome-ja-sou-cliente")).toBeInTheDocument();
  });
});
