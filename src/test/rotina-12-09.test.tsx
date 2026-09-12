/**
 * Rotina, 12/09 (vídeo e print do dono):
 *  1. o menu "⋯" das abas vivia DENTRO da faixa que rola pro lado — era
 *     cortado e virava rolagem vertical ("uma aba ⋯ que dá pra arrastar");
 *  2. o card de humor perdeu as barras coloridas de antes quando ganhou o
 *     histórico — agora tem os dois;
 *  3. o bloco de fases só aparece pra quem já usa.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { SerieHistorico } from "@/components/historico/SerieHistorico";
import { fasesEmUso } from "@/pages/Rotina";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";

const ctx: UserDataContextType = { get: <T,>(_k: string, fb: T) => fb, set: () => {}, loaded: true, isGuest: true, fetchKey: async () => null };

describe("menu ⋯ das abas fora da faixa que rola", () => {
  it("o menu é irmão da faixa overflow-x-auto, não filho — nada o corta", () => {
    const abas = { visiveis: [{ id: "a", label: "A" }, { id: "b", label: "B" }], ocultas: [], ocultar: () => {}, mostrar: () => {}, mostrarTodas: () => {} } as unknown as Parameters<typeof AbasOcultaveis>[0]["abas"];
    render(<AbasOcultaveis abas={abas} ativa="a" onTrocar={() => {}} className="px-4" />);
    fireEvent.click(screen.getByRole("button", { name: "Opções das abas" }));
    const menu = screen.getByRole("menu");
    const faixa = screen.getByRole("button", { name: "Opções das abas" }).parentElement as HTMLElement;
    expect(faixa.className).toContain("overflow-x-auto");
    expect(faixa.contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(faixa.parentElement);
    expect(menu.parentElement?.className).not.toContain("overflow");
  });
});

describe("humor: cor e emoji pelo valor", () => {
  it("cada barra sai com a cor do humor e o emoji em cima, sem esmaecer", () => {
    const hoje = new Date(); const chave = (d: number) => { const x = new Date(hoje); x.setDate(hoje.getDate() - d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
    const emojis: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
    render(<UserDataContext.Provider value={ctx}><SerieHistorico registros={{ [chave(0)]: 5, [chave(1)]: 1 }} cor="purple" id="teste-humor"
      corPorValor={(v) => (v >= 4 ? "rgb(60, 221, 60)" : "rgb(221, 60, 60)")} rotuloPorValor={(v) => emojis[Math.round(v)]} /></UserDataContext.Provider>);
    expect(screen.getByText("😄")).toBeInTheDocument();
    expect(screen.getByText("😞")).toBeInTheDocument();
    const barras = [...document.querySelectorAll("button div.w-full")] as HTMLElement[];
    const cores = barras.map((b) => b.style.background).filter((c) => c && !c.includes("--muted"));
    // (o jsdom converte hsl mal em alguns matizes; a cor do app é decidida no navegador)
    expect(cores).toContain("rgb(60, 221, 60)");
    expect(cores).toContain("rgb(221, 60, 60)");
    expect(barras.every((b) => b.style.opacity === "1")).toBe(true);
  });
});

describe("bloco de fases só pra quem usa", () => {
  const padrao = [{ id: "r1", nome: "Copos de água", memo: "", counts: {} }];
  it("nunca tocado (ou só os padrões sem contagem) → some; contou, criou, tarefa ou nota → fica", () => {
    expect(fasesEmUso(null, null, null, padrao)).toBe(false);
    expect(fasesEmUso(padrao, [], {}, padrao)).toBe(false);
    expect(fasesEmUso([{ ...padrao[0], counts: { "2026-09-12": 2 } }], [], {}, padrao)).toBe(true);
    expect(fasesEmUso([...padrao, { id: "x9", nome: "Caminhada", memo: "", counts: {} }], [], {}, padrao)).toBe(true);
    expect(fasesEmUso(padrao, [{ id: "t1", texto: "Ligar pro banco", feito: false }], {}, padrao)).toBe(true);
    expect(fasesEmUso(padrao, [], { "2026-09": "Mês corrido" }, padrao)).toBe(true);
    expect(fasesEmUso("lixo", "lixo", "lixo", padrao)).toBe(false);
  });
});
