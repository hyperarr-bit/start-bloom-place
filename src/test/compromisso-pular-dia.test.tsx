/**
 * APAGAR SÓ UM DIA DA SÉRIE (28/09) — chamado: "criei o compromisso trabalho
 * 07:30 de segunda a sexta, vou estar de férias 5 dias e gostaria de excluir
 * só desses dias. Atualmente, se eu excluir, apaga a série inteira".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { CompromissosDoDia, ProximosCompromissos } from "@/components/rotina/Compromissos";
import { apagarCompromisso, ocorrencias, planejarCompromissos, type Compromisso } from "@/lib/compromissos";

const toasts: { msg: string; opts?: { action?: { label: string; onClick: () => void } } }[] = [];
vi.mock("sonner", () => ({ toast: { success: (msg: string, opts?: never) => { toasts.push({ msg, opts }); }, error: () => {} } }));
beforeEach(() => { toasts.length = 0; });

// seg 28/09/2026 em diante, seg a sex às 07:30, aviso 30 min antes
const trabalho: Compromisso = { id: "t", titulo: "Trabalho", data: "2026-09-28", hora: "07:30", repete: [0, 1, 2, 3, 4], aviso: 30 };
const ferias = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];

describe("lib: pula e ate", () => {
  it("dias pulados somem da série e dos avisos; o resto continua", () => {
    const c = { ...trabalho, pula: ferias };
    const dias = ocorrencias([c], new Date(2026, 8, 28), 21).map((o) => o.dia);
    expect(dias).not.toContain("2026-10-05");
    expect(dias.filter((d) => ferias.includes(d))).toEqual([]);
    expect(dias).toContain("2026-10-02");
    expect(dias).toContain("2026-10-12");
    const avisos = planejarCompromissos([c], 900000, new Date(2026, 8, 28, 6, 0));
    expect(avisos.some((a) => a.quando.getMonth() === 9 && a.quando.getDate() >= 5 && a.quando.getDate() <= 9)).toBe(false);
    expect(avisos[0].quando.getHours()).toBe(7);
    expect(avisos[0].quando.getMinutes()).toBe(0);
  });

  it("série com fim (ate) para no último dia, inclusive", () => {
    const dias = ocorrencias([{ ...trabalho, ate: "2026-10-01" }], new Date(2026, 8, 28), 14).map((o) => o.dia);
    expect(dias).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
  });

  it("dado torto em pula/ate não derruba a série", () => {
    const c = { ...trabalho, pula: ["lixo", 3 as unknown as string], ate: "amanhã" };
    expect(ocorrencias([c], new Date(2026, 8, 28), 7)).toHaveLength(5);
  });
});

describe("lib: apagarCompromisso", () => {
  const outro: Compromisso = { id: "m", titulo: "Médico", data: "2026-10-01", hora: "09:00" };
  const lista = [trabalho, outro];

  it("só este dia: vira pula (sem repetir), a série e os outros ficam", () => {
    const um = apagarCompromisso(lista, trabalho, "dia", "2026-10-05");
    const dois = apagarCompromisso(um, um[0], "dia", "2026-10-05");
    expect(dois[0].pula).toEqual(["2026-10-05"]);
    expect(dois[1]).toBe(outro);
  });

  it("daqui pra frente: termina na véspera; na 1ª ocorrência é a série toda", () => {
    expect(apagarCompromisso(lista, trabalho, "proximos", "2026-10-05")[0].ate).toBe("2026-10-04");
    expect(apagarCompromisso(lista, trabalho, "proximos", "2026-09-28")).toEqual([outro]);
  });

  it("a série toda sai; compromisso que não repete sai em qualquer modo", () => {
    expect(apagarCompromisso(lista, trabalho, "serie", "2026-10-05")).toEqual([outro]);
    expect(apagarCompromisso(lista, outro, "dia", "2026-10-01")).toEqual([trabalho]);
  });
});

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
const renderComStore = (ui: React.ReactElement) =>
  render(<MemoryRouter><UserDataContext.Provider value={criarStore().valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

describe("tela: apagar compromisso que repete", () => {
  it("a lixeira abre as 3 opções; 'só seg 05/10' tira só aquele dia e o Desfazer devolve", () => {
    const onChange = vi.fn();
    renderComStore(<CompromissosDoDia dia="2026-10-05" lista={[trabalho]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Apagar Trabalho/i }));
    const soEste = screen.getByTestId("apagar-so-este-dia");
    expect(soEste).toHaveTextContent(/05\/10/);
    expect(screen.getByTestId("apagar-daqui-pra-frente")).toBeInTheDocument();
    expect(screen.getByTestId("apagar-serie")).toBeInTheDocument();
    fireEvent.click(soEste);
    expect(onChange).toHaveBeenLastCalledWith([{ ...trabalho, pula: ["2026-10-05"] }]);
    expect(toasts[0].msg).toMatch(/Trabalho sai só de/);
    toasts[0].opts!.action!.onClick();
    expect(onChange).toHaveBeenLastCalledWith([trabalho]);
  });

  it("daqui pra frente mostra 'até' na linha da série", () => {
    renderComStore(<CompromissosDoDia dia="2026-09-30" lista={[{ ...trabalho, ate: "2026-10-04" }]} onChange={vi.fn()} />);
    expect(screen.getByTestId("compromisso-item")).toHaveTextContent(/seg a sex · até 04\/10/);
  });

  it("nos próximos, escolher uma opção não abre o dia (o toque não vaza pra linha)", () => {
    const onAbrirDia = vi.fn(), onChange = vi.fn();
    vi.useFakeTimers({ now: new Date(2026, 9, 5, 6, 0), toFake: ["Date"] });
    renderComStore(<ProximosCompromissos lista={[trabalho]} onChange={onChange} onAbrirDia={onAbrirDia} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Apagar Trabalho/i })[0]);
    fireEvent.click(screen.getByTestId("apagar-serie"));
    vi.useRealTimers();
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(onAbrirDia).not.toHaveBeenCalled();
  });
});
