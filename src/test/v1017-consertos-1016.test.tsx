/**
 * 1.0.17 — consertos de bugs vistos nos dados da 1.0.16 (e reproduzidos):
 *   1. o chip do hábito (dose da Rotina e intro guiada) só PREENCHIA o campo; com o campo fechado não fazia nada — agora
 *      `criarHabitoPeloCampo` abre o campo, preenche e toca no "Adicionar" (1 toque); diz `false` se não deu mesmo;
 *   2. "Trocar" os módulos da missão: tirar Finanças/Rotina/Saúde não tirava (a reposição era o mesmo que saiu) e todo
 *      toque novo trocava o 3º — `alternarModulo` deixa a vaga aberta e só troca o último com 3 já escolhidos;
 *      "Pronto" só com 3.
 * (A telemetria — modulo_intro_saiu e o anel na troca criar→marcar — está em intro-modulo.test; a dose da Rotina de
 *  verdade, em v1016-missao-1-por-dia.)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { criarHabitoPeloCampo } from "@/components/demo-guiada/alvos";
import { BoasVindasDoses, alternarModulo } from "@/components/missao-doses/BoasVindasDoses";
import { iniciarMissao } from "@/lib/missao-doses";

beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

/** Uma Rotina de mentira com o "+ Hábito" que ABRE/FECHA o campo (o de antes) e o Adicionar que cria. */
function RotinaDeMentira({ aoCriar }: { aoCriar: (n: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  return (
    <div>
      <button type="button" data-spotlight="add-habit" onClick={() => setAberto((a) => !a)}>+ Hábito</button>
      {aberto && <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={() => { if (nome.trim()) { aoCriar(nome.trim()); setNome(""); } }}>Adicionar</button></div>}
    </div>
  );
}

describe("1. o chip cria o hábito em 1 toque (criarHabitoPeloCampo)", () => {
  it("campo FECHADO: abre pelo '+ Hábito', preenche e toca no Adicionar — o hábito nasce pelo código do módulo", async () => {
    const criados: string[] = [];
    const fim = vi.fn();
    render(<RotinaDeMentira aoCriar={(n) => criados.push(n)} />);
    expect(screen.queryByPlaceholderText("Nome do hábito...")).toBeNull();
    criarHabitoPeloCampo("Beber água ao acordar", fim);
    await waitFor(() => expect(fim).toHaveBeenCalledWith(true));
    expect(criados).toEqual(["Beber água ao acordar"]);
  });
  it("campo ABERTO: não toca no '+ Hábito' (não fecha), só preenche e adiciona", async () => {
    const criados: string[] = [];
    const fim = vi.fn();
    render(<RotinaDeMentira aoCriar={(n) => criados.push(n)} />);
    fireEvent.click(screen.getByText("+ Hábito"));
    criarHabitoPeloCampo("Ler", fim);
    await waitFor(() => expect(fim).toHaveBeenCalledWith(true));
    expect(criados).toEqual(["Ler"]);
    expect(screen.getByPlaceholderText("Nome do hábito...")).toBeInTheDocument();
  });
  it("sem campo nenhum (o módulo não montou): desiste em ~1 s e diz false — quem chama registra ok:false", async () => {
    const fim = vi.fn();
    render(<div />);
    criarHabitoPeloCampo("Ler", fim);
    await waitFor(() => expect(fim).toHaveBeenCalledWith(false), { timeout: 3000 });
  });
});

describe("2. 'Trocar' os módulos da missão", () => {
  it("alternarModulo: tirar deixa a vaga aberta (nada volta sozinho); novo ocupa a vaga; com 3, troca o último", () => {
    expect(alternarModulo(["financas", "rotina", "saude"], "financas")).toEqual(["rotina", "saude"]);
    expect(alternarModulo(["rotina", "saude"], "treino")).toEqual(["rotina", "saude", "treino"]);
    expect(alternarModulo(["rotina", "saude"], "financas")).toEqual(["rotina", "saude", "financas"]); // volta só se ela escolher
    expect(alternarModulo(["rotina", "saude", "treino"], "dieta")).toEqual(["rotina", "saude", "dieta"]);
    expect(alternarModulo(["rotina"], "rotina")).toEqual([]);
  });
  it("na tela (braço B — o A não tem mais 'Trocar' desde 20/10): tirar Finanças TIRA (2 escolhidos, 'Pronto' desligado); escolher Treino ocupa a vaga; 'Pronto' volta e a missão começa com os 3 dela", () => {
    const missao = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: false };
    const comecar = vi.fn();
    render(<BoasVindasDoses missao={missao} nome="Lucas" areaNome={null} hoje="2026-10-03" braco="B" aoComecar={comecar} aoExplorar={() => {}} />);
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    fireEvent.click(screen.getByTestId("missao-doses-trocar"));
    fireEvent.click(screen.getByTestId("missao-doses-tile-financas"));
    expect(screen.getByTestId("missao-doses-tile-financas")).not.toHaveAttribute("data-marcado");
    expect(screen.getAllByRole("button").filter((b) => b.hasAttribute("data-marcado"))).toHaveLength(2);
    expect((screen.getByTestId("missao-doses-pronto") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("missao-doses-escolha-lista").textContent).toContain("Toque num módulo");
    fireEvent.click(screen.getByTestId("missao-doses-tile-treino"));
    expect(screen.getByTestId("missao-doses-tile-treino").querySelector(".md-tile-n")?.textContent).toBe("3");
    expect((screen.getByTestId("missao-doses-pronto") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId("missao-doses-pronto"));
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(comecar).toHaveBeenCalledWith(["rotina", "saude", "treino"]);
  });
  it("1.0.17 (dono 20/10, mockup a1): o Tá dentro do braço A é o PLANO — sem 'Trocar'; os 3 módulos com o que entregam (HOJE · AMANHÃ · dia da semana); 'Começar meu tutorial' começa com os 3 da missão", () => {
    const missao = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-20"), boasVindas: false };
    const comecar = vi.fn();
    render(<BoasVindasDoses missao={missao} nome="Lucas" areaNome={null} hoje="2026-10-20" braco="A" aoComecar={comecar} aoExplorar={() => {}} />);
    expect(screen.queryByTestId("missao-doses-trocar")).toBeNull();
    expect(screen.getByTestId("missao-doses-titulo").textContent).toBe("Tá dentro, Lucas 💛"); // 1.0.17: sem ponto final no título (dono: "sério demais")
    expect(screen.getByTestId("missao-doses-tutorial").textContent).toBe("Pra você tirar o melhor do CORE, preparamos um tutorial especial pra você.");
    expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveTextContent("Seu plano de 3 dias");
    expect(screen.getByTestId("missao-doses-entrega-1").textContent).toBe("Quanto dá pra gastar por dia");
    expect(screen.getByTestId("missao-doses-entrega-2").textContent).toBe("Seu primeiro hábito");
    expect(screen.getByTestId("missao-doses-entrega-3").textContent).toBe("Sua meta de água");
    expect(screen.getByTestId("missao-doses-quando-1").textContent).toBe("Hoje");
    expect(screen.getByTestId("missao-doses-quando-2").textContent).toBe("Amanhã");
    expect(screen.getByTestId("missao-doses-quando-3").textContent).toBe("Quinta"); // 20/10/2026 é terça → dia 3 = quinta
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveAttribute("data-hoje");
    expect(document.querySelector("[data-testid=demo-guia-confete]")).not.toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(screen.getByTestId("missao-doses-comecar").textContent).toBe("Começar meu tutorial");
    expect(comecar).toHaveBeenCalledWith(["financas", "rotina", "saude"]);
  });
});
