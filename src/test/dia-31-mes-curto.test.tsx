/**
 * CONTA DO DIA 31 EM MÊS DE 30 DIAS (bug "dia-31", 07/11).
 *
 * "Condomínio dia 31" aparece no dia 30 de novembro — o grid do MEU MÊS encosta
 * o 31 no último dia do mês (decisão de 16/10, a mesma do alerta do topo). Mas o
 * ✓, a lixeira e o lápis mandavam o DIA DA TELA (30) pro `setBillsForDay`, que
 * procura o card do dia 30 em `finance-dueDays` — e a conta mora no card do 31:
 *   · ✓ não marcava (e ainda criava um dia 30 vazio no dado);
 *   · lixeira não apagava;
 *   · lápis + Salvar sem mudar nada movia a conta pro dia 30 DE VEZ: o campo
 *     "Dia" nascia com 30 e o Salvar ainda encostava o 31 em daysInMonth.
 * Vale igual pra linha da fatura do cartão (injetarFaturas) com vencimento 31.
 *
 * Agora cada conta no grid carrega o dia DELA (`diaReal`); o campo "Dia" da
 * edição mostra 31 e aceita 1–31, que é o que o dado sempre aceitou.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/dia-31-mes-curto.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-dia31" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
// o ✓ agenda o pedido de avaliação 1,2 s depois — fora do escopo daqui
vi.mock("@/lib/avaliacao", () => ({ pedirAvaliacaoSePuder: vi.fn(async () => false) }));

import { MonthCalendar } from "@/components/finance/MonthCalendar";
import { injetarFaturas } from "@/lib/finance-faturas";

type Bill = { id: string; name: string; paid: boolean; value?: number; fixedId?: string };
type DueDay = { day: number; color: string; bills: Bill[] };

const NOVEMBRO_15 = new Date(2026, 10, 15, 10); // novembro tem 30 dias
const DEZEMBRO_15 = new Date(2026, 11, 15, 10); // dezembro tem 31

const contas = (): DueDay[] => [
  { day: 10, color: "yellow", bills: [
    { id: "fx-net", name: "Internet", paid: true, value: 150, fixedId: "net" },
    { id: "acad", name: "Academia", paid: false, value: 90 },
  ] },
  { day: 31, color: "slate", bills: [{ id: "c31", name: "Condomínio", paid: false, value: 600 }] },
];

/** O que o Index faz: guarda a lista e devolve pro calendário. `ultimo` = o que seria gravado. */
let ultimo: DueDay[] = [];
let gravacoes = 0;
const Tela = ({ inicial }: { inicial: DueDay[] }) => {
  const [dueDays, setDueDays] = useState<DueDay[]>(inicial);
  ultimo = dueDays;
  return (
    <MonthCalendar
      incomes={[]} expenses={[]} fixedExpenses={[]} installments={[]}
      dueDays={dueDays}
      setDueDays={(d) => { gravacoes += 1; setDueDays(d as DueDay[]); }}
      totalIncome={3000} monthlyOutflow={750}
    />
  );
};

const abrirDia = (dia: number) => fireEvent.click(screen.getByRole("button", { name: `Dia ${dia}` }));
const linhaDe = (nome: RegExp | string) => screen.getByText(nome).closest("label")!;
const cardDoDia = (dia: number) => ultimo.find((d) => d.day === dia);
const todasAsContas = () => ultimo.flatMap((d) => d.bills);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOVEMBRO_15);
  localStorage.clear();
  gravacoes = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("conta do dia 31 vista no dia 30 de novembro", () => {
  it("aparece no dia 30 (último do mês), sem dia 31 no grid", () => {
    render(<Tela inicial={contas()} />);
    expect(screen.queryByRole("button", { name: "Dia 31" })).toBeNull();
    abrirDia(30);
    expect(screen.getByText("Condomínio")).toBeInTheDocument();
  });

  it("✓ marca a conta no card do dia 31 — e não cria um dia 30 vazio", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    fireEvent.click(within(linhaDe("Condomínio")).getByRole("checkbox"));
    expect(gravacoes).toBe(1);
    expect(cardDoDia(31)!.bills).toEqual([{ id: "c31", name: "Condomínio", paid: true, value: 600 }]);
    expect(cardDoDia(30)).toBeUndefined();
    expect(within(linhaDe("Condomínio")).getByRole("checkbox")).toBeChecked();
    // desmarcar volta pelo mesmo caminho
    fireEvent.click(within(linhaDe("Condomínio")).getByRole("checkbox"));
    expect(cardDoDia(31)!.bills[0].paid).toBe(false);
    expect(cardDoDia(30)).toBeUndefined();
  });

  it("lixeira apaga a conta do card do dia 31", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    fireEvent.click(screen.getByRole("button", { name: "Remover Condomínio" }));
    expect(gravacoes).toBe(1);
    expect(todasAsContas().map((b) => b.id)).toEqual(["fx-net", "acad"]);
    expect(screen.queryByText("Condomínio")).toBeNull();
    expect(screen.getByText("Nada neste dia ainda.")).toBeInTheDocument();
  });

  it("lápis: o campo Dia mostra 31, e Salvar sem mudar nada deixa a conta no 31", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    fireEvent.click(screen.getByRole("button", { name: "Editar Condomínio" }));
    expect((screen.getByLabelText("Dia do vencimento") as HTMLInputElement).value).toBe("31");
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(gravacoes).toBe(1);
    expect(cardDoDia(31)!.bills).toEqual([{ id: "c31", name: "Condomínio", paid: false, value: 600 }]);
    expect(cardDoDia(30)).toBeUndefined();
    // continua na tela do dia 30
    expect(screen.getByText("Dia 30")).toBeInTheDocument();
    expect(screen.getByText("Condomínio")).toBeInTheDocument();
  });

  it("lápis: corrigir nome e valor também deixa a conta no 31", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    fireEvent.click(screen.getByRole("button", { name: "Editar Condomínio" }));
    fireEvent.change(screen.getByPlaceholderText("Nome da conta"), { target: { value: "Condomínio bloco B" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(cardDoDia(31)!.bills).toEqual([{ id: "c31", name: "Condomínio bloco B", paid: false, value: 650 }]);
    expect(cardDoDia(30)).toBeUndefined();
  });

  it("lápis: mudar o Dia pra 12 move de verdade (controle) e a tela vai pro 12", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    fireEvent.click(screen.getByRole("button", { name: "Editar Condomínio" }));
    fireEvent.change(screen.getByLabelText("Dia do vencimento"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(cardDoDia(12)!.bills.map((b) => b.id)).toEqual(["c31"]);
    expect(cardDoDia(31)!.bills).toEqual([]);
    expect(screen.getByText("Dia 12")).toBeInTheDocument();
    expect(screen.getByText(/Condomínio/)).toBeInTheDocument(); // dia 12 já passou: "· venceu"
  });

  it("lápis: pôr Dia 31 numa conta do dia 10 em novembro grava 31 (não encosta em 30) e a tela mostra o 30", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(10);
    fireEvent.click(screen.getByRole("button", { name: "Editar Academia" }));
    expect((screen.getByLabelText("Dia do vencimento") as HTMLInputElement).value).toBe("10");
    fireEvent.change(screen.getByLabelText("Dia do vencimento"), { target: { value: "31" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(cardDoDia(31)!.bills.map((b) => b.id)).toEqual(["c31", "acad"]);
    expect(cardDoDia(30)).toBeUndefined();
    // o grid não tem dia 31: a tela fica no último dia, onde a conta aparece
    expect(screen.getByText("Dia 30")).toBeInTheDocument();
    expect(screen.getByText("Academia")).toBeInTheDocument();
  });

  it("linha da fatura com vencimento 31: o ✓ chega com a fatura paga no card do 31", () => {
    const comFatura = injetarFaturas(contas() as never[], [
      { card: "Nubank", label: "Nubank", dueDay: 31, total: 450, variaveis: 300, parcelas: 150, fixos: 0, paga: false },
    ]) as DueDay[];
    render(<Tela inicial={comFatura} />);
    abrirDia(30);
    fireEvent.click(within(linhaDe(/Fatura Nubank/)).getByRole("checkbox"));
    expect(gravacoes).toBe(1);
    const dia31 = cardDoDia(31)!;
    expect(dia31.bills.find((b) => b.id === "fatura:Nubank")).toMatchObject({ paid: true });
    expect(dia31.bills.find((b) => b.id === "c31")).toMatchObject({ paid: false });
    expect(cardDoDia(30)).toBeUndefined();
    expect(within(linhaDe(/Fatura Nubank/)).getByRole("checkbox")).toBeChecked();
  });
});

describe("nada muda pros dias que existem no mês", () => {
  it("novembro: conta do dia 10 marca e apaga como sempre", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(10);
    fireEvent.click(within(linhaDe(/Academia/)).getByRole("checkbox")); // dia 10 já passou: "· venceu"
    expect(cardDoDia(10)!.bills.find((b) => b.id === "acad")!.paid).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remover Academia" }));
    expect(cardDoDia(10)!.bills.map((b) => b.id)).toEqual(["fx-net"]);
  });

  it("dezembro (31 dias): a conta do dia 31 fica no 31 e o ✓ marca lá", () => {
    vi.setSystemTime(DEZEMBRO_15);
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    expect(screen.queryByText("Condomínio")).toBeNull();
    abrirDia(31);
    fireEvent.click(within(linhaDe("Condomínio")).getByRole("checkbox"));
    expect(cardDoDia(31)!.bills[0]).toMatchObject({ id: "c31", paid: true });
    fireEvent.click(screen.getByRole("button", { name: "Editar Condomínio" }));
    expect((screen.getByLabelText("Dia do vencimento") as HTMLInputElement).value).toBe("31");
  });

  it("adicionar conta no dia 30 de novembro grava no 30, sem mexer no 31", () => {
    render(<Tela inicial={contas()} />);
    abrirDia(30);
    fireEvent.change(screen.getByPlaceholderText(/Conta que vence dia 30/), { target: { value: "Luz" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar conta" }));
    expect(cardDoDia(30)!.bills.map((b) => b.name)).toEqual(["Luz"]);
    expect(cardDoDia(31)!.bills.map((b) => b.id)).toEqual(["c31"]);
    // as duas aparecem no dia 30 da tela
    expect(screen.getByText("Luz")).toBeInTheDocument();
    expect(screen.getByText("Condomínio")).toBeInTheDocument();
  });
});
