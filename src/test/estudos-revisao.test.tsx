/**
 * Flashcards de Estudos (11/09): cada "o que aprendi" vira um cartão;
 * revisão espaçada com degraus 1, 3, 7, 14, 30, 60, 120 dias.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { paraRevisarHoje, responder, vencimento, frenteDoCartao, contarVencendoEm, INTERVALOS_DIAS, MAXIMO_POR_DIA } from "@/components/estudos/revisao";
import { RevisaoDoDia } from "@/components/estudos/RevisaoDoDia";
import type { AprendizadoComCurso, AprendizadosPorCurso } from "@/components/estudos/aprendizados";

const cartao = (id: string, data: string, extra: Partial<AprendizadoComCurso> = {}): AprendizadoComCurso =>
  ({ id, data, aprendi: `aprendi ${id}`, cursoId: "c1", cursoNome: "Cálculo I", ...extra });

describe("agenda dos cartões", () => {
  it("cartão novo vence no dia seguinte ao registro; respondido, vence no dia agendado", () => {
    expect(vencimento(cartao("1", "2026-09-10"), {})).toBe("2026-09-11");
    expect(vencimento(cartao("1", "2026-09-10"), { "1": { proxima: "2026-09-20", degrau: 2, vezes: 2 } })).toBe("2026-09-20");
  });

  it("lembrou sobe um degrau (1→3→7…); não lembrou volta pro 1; o topo é 120", () => {
    let e = responder(undefined, true, "2026-09-11");
    expect(e).toEqual({ proxima: "2026-09-12", degrau: 0, vezes: 1 });
    e = responder(e, true, "2026-09-12");
    expect(e.proxima).toBe("2026-09-15"); expect(e.degrau).toBe(1);
    e = responder(e, true, "2026-09-15");
    expect(e.proxima).toBe("2026-09-22"); expect(e.degrau).toBe(2);
    e = responder(e, false, "2026-09-22");
    expect(e).toEqual({ proxima: "2026-09-23", degrau: 0, vezes: 4 });
    let topo = responder(undefined, true, "2026-01-01");
    for (let i = 0; i < 20; i++) topo = responder(topo, true, topo.proxima);
    expect(topo.degrau).toBe(INTERVALOS_DIAS.length - 1);
  });

  it("hoje: só os vencidos, mais atrasados primeiro, no máximo 15; virada de mês certa", () => {
    const lista = [
      cartao("a", "2026-09-10"),                 // vence 11 → hoje
      cartao("b", "2026-09-11"),                 // vence 12 → amanhã, fora
      cartao("c", "2026-08-31"),                 // vence 01/09 (virada de mês) → atrasado, primeiro
      ...Array.from({ length: 20 }, (_, i) => cartao(`m${i}`, "2026-09-01")), // 20 vencidos em 02/09
    ];
    const hoje = paraRevisarHoje(lista, {}, "2026-09-11");
    expect(hoje).toHaveLength(MAXIMO_POR_DIA);
    expect(hoje[0].id).toBe("c");
    expect(hoje.map((x) => x.id)).not.toContain("b");
    expect(contarVencendoEm(lista, {}, "2026-09-12")).toBe(1);
  });

  it("frente: a pergunta da pessoa; sem ela, a referência com a pergunta padrão", () => {
    expect(frenteDoCartao(cartao("1", "2026-09-10", { pergunta: "O que é limite?", referencia: "Aula 2" })))
      .toEqual({ deixa: "Cálculo I · Aula 2", pergunta: "O que é limite?" });
    expect(frenteDoCartao(cartao("1", "2026-09-10", { referencia: "Aula 2" })).pergunta).toBe("O que você aprendeu aqui?");
  });
});

describe("RevisaoDoDia", () => {
  const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const mapa: AprendizadosPorCurso = { c1: [
    { id: "1", data: ontem, aprendi: "Derivada é taxa de variação", porque: "Aparece em tudo", pergunta: "O que é derivada?" },
    { id: "2", data: ontem, aprendi: "Integral acumula", referencia: "Aula 3" },
  ] };
  const cursos = [{ id: "c1", name: "Cálculo I" }];

  it("frente → mostrar resposta → verso com o aprendizado → Lembrei chama onResponder e passa pro próximo; no fim, resumo", () => {
    const respostas: [string, boolean][] = [];
    const { rerender } = render(<RevisaoDoDia mapa={mapa} cursos={cursos} revisoes={{}} onResponder={(id, ok) => respostas.push([id, ok])} />);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText("O que é derivada?")).toBeInTheDocument();
    expect(screen.queryByText("Derivada é taxa de variação")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar resposta" }));
    expect(screen.getByText("Derivada é taxa de variação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Lembrei/ }));
    expect(respostas).toEqual([["1", true]]);
    // o pai grava a agenda; o cartão 1 sai da fila
    const revisoes = { "1": responder(undefined, true) };
    rerender(<RevisaoDoDia mapa={mapa} cursos={cursos} revisoes={revisoes} onResponder={(id, ok) => respostas.push([id, ok])} />);
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    expect(screen.getByText("O que você aprendeu aqui?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar resposta" }));
    fireEvent.click(screen.getByRole("button", { name: /Não lembrei/ }));
    expect(respostas[1]).toEqual(["2", false]);
    rerender(<RevisaoDoDia mapa={mapa} cursos={cursos} revisoes={{ ...revisoes, "2": responder(undefined, false) }} onResponder={() => {}} />);
    expect(screen.getByTestId("revisao-vazia").textContent).toContain("Revisão de hoje feita: 1 de 2 lembrados");
    expect(screen.getByTestId("revisao-vazia").textContent).toContain("Amanhã voltam 2 cartões"); // os dois no degrau 1
  });

  it("sem nenhum aprendizado o bloco não aparece", () => {
    render(<RevisaoDoDia mapa={{}} cursos={cursos} revisoes={{}} onResponder={() => {}} />);
    expect(screen.queryByTestId("revisao-do-dia")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revisao-vazia")).not.toBeInTheDocument();
  });
});
