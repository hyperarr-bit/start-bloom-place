/**
 * 11/11 (velocidade 1.0.26): a porta leve da missão em doses. O App importa só a MissaoDosesPortao; a missão em si é
 * pedida sob demanda quando está ligada, e nunca baixa com ela desligada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const ligada = { v: false };
const carregou = vi.fn();
vi.mock("@/lib/missao-doses", () => ({
  definirDonoDaMissao: vi.fn(),
  guardarForcaDaUrl: vi.fn(),
  missaoDosesLigada: () => ligada.v,
}));
vi.mock("@/lib/dia1-cheio", () => ({ guardarForcaDia1Cheio: vi.fn() }));
vi.mock("@/lib/dias23", () => ({ guardarForcaDias23: vi.fn() }));
vi.mock("@/lib/construiu-ab", () => ({ guardarForcaConstruiu: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuthOpcional: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/missao-doses/MissaoDosesNaWeb", () => {
  carregou();
  return { MissaoDosesLigada: () => <div>missão na tela</div> };
});

import { MissaoDosesNaWeb, DonoDaMissaoNaSessao } from "@/components/missao-doses/MissaoDosesPortao";
import { definirDonoDaMissao, guardarForcaDaUrl } from "@/lib/missao-doses";

describe("MissaoDosesPortao", () => {
  beforeEach(() => { ligada.v = false; });

  it("missão desligada: não pede o pedaço da missão, mas as forças de QA do link continuam rodando", async () => {
    render(<MemoryRouter initialEntries={["/home?missao-doses=on"]}><MissaoDosesNaWeb /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 20));
    expect(carregou).not.toHaveBeenCalled();
    expect(guardarForcaDaUrl).toHaveBeenCalledWith("?missao-doses=on");
  });

  it("missão ligada: pede o pedaço e mostra o que a MissaoDosesNaWeb mostrava", async () => {
    ligada.v = true;
    render(<MemoryRouter><MissaoDosesNaWeb /></MemoryRouter>);
    expect(await screen.findByText("missão na tela")).toBeTruthy();
    expect(carregou).toHaveBeenCalledTimes(1);
  });

  it("o dono da missão é definido na hora (sem esperar pedaço nenhum)", () => {
    render(<DonoDaMissaoNaSessao />);
    expect(definirDonoDaMissao).toHaveBeenCalledWith("u1");
  });
});
