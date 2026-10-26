/**
 * Varredura 26/10 (item 5 + grandes D): no iPhone SE com o teclado aberto, "+" → Gasto/Ganho deixava o botão principal
 * atrás do teclado. Nos formulários com campo o botão fica PRESO no pé da folha (sticky, fundo do cartão); com o teclado
 * aberto, o fundo do cartão vai até a borda de baixo (sem a Home escurecida no vão). jsdom não faz layout: confere a
 * montagem (quem é preso, quem não é) e o código da folha.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const acao = readFileSync(resolve(__dirname, "../components/home-nova/e/FolhaAcaoE.tsx"), "utf8");
const mais = readFileSync(resolve(__dirname, "../components/home-nova/e/FolhaMaisE.tsx"), "utf8");
const tarefas = readFileSync(resolve(__dirname, "../components/tarefas/tarefas-do-dia.tsx"), "utf8");

describe("o botão principal preso no pé dos formulários do '+'", () => {
  it("todo formulário com CAMPO (teclado) tem o Principal preso; os sem campo (água, treino) não", () => {
    for (const rotulo of ["Registrar gasto", "Registrar ganho", "Registrar peso", "Registrar sono", "Guardar ideia", "Registrar gratidão", "Registrar refeição"]) {
      expect(acao).toMatch(new RegExp(`<Principal preso[^>]*>${rotulo}</Principal>`));
    }
    expect(acao).not.toMatch(/<Principal preso testid="hn-agua-mais"/);
  });
  it("o pé é sticky no fundo do cartão e cobre o respiro de baixo com sombra (sem mudar a rolagem)", () => {
    expect(acao).toMatch(/className="sticky bottom-0 z-\[2\] -mx-5 px-5 pt-5 bg-card"/);
    expect(acao).toMatch(/boxShadow: "0 calc\(var\(--app-safe-bottom, 0px\) \+ 20px\) 0 0 hsl\(var\(--card\)\)"/);
  });
  it("com o teclado aberto, o fundo do cartão vai da folha até a borda da tela", () => {
    expect(mais).toMatch(/comTeclado && !escondida && <div aria-hidden data-testid="hn-folha-mais-pe"/);
    expect(mais).toMatch(/height: Math\.max\(0, area\.coberto\) \+ 40/);
  });
  it("a Tarefa do '+' (a folha da Rotina) também tem o 'Salvar' preso — só pelo '+' da Home nova (Rotina e Home antiga como estão)", () => {
    expect(mais).toMatch(/<FolhaNovaTarefa [^\n]*salvarPreso \/>/);
    expect(tarefas).toMatch(/salvarPreso = false,/);
    expect(tarefas).toMatch(/data-testid="form-tarefa-pe"/);
  });
});
