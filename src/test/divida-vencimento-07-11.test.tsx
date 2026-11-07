/**
 * VENCIMENTO OPCIONAL NA DÍVIDA ENTRE PESSOAS — dono 07/11.
 *
 * `vencimento` ("AAAA-MM-DD") é um campo opcional a mais no objeto da chave `finance-dividas-pessoas`
 * (o mesmo array de sempre): dívida antiga não tem e segue igual; só entra quando a pessoa escolhe a
 * data; tirar a data tira o campo (nunca grava ""). Ciclo completo onde é UI: abre → usa → grava na
 * chave → fecha → reabre.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import {
  DividasEntrePessoas, situacaoDoVencimento, totalQueDevoAPessoas, type DividaPessoal,
} from "@/components/finance/DividasEntrePessoas";
import { localDayKey, parseLocalDay } from "@/lib/utils";

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
const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);
const gravadas = (store: ReturnType<typeof criarStore>) => store.dados["finance-dividas-pessoas"] as DividaPessoal[];

/** Hoje ± n dias, no formato da chave. */
const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDayKey(d); };
const curta = (k: string) => parseLocalDay(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const linha = (nome: string) => screen.getByRole("button", { name: new RegExp(`^${nome}`) });

describe("situacaoDoVencimento", () => {
  it("sem prazo (dívida antiga) ou prazo ilegível = null: a linha fica como sempre foi", () => {
    expect(situacaoDoVencimento(undefined, "2026-11-07")).toBeNull();
    expect(situacaoDoVencimento("", "2026-11-07")).toBeNull();
    expect(situacaoDoVencimento("15/12/2026", "2026-11-07")).toBeNull();
    expect(situacaoDoVencimento(20261215, "2026-11-07")).toBeNull();
    expect(situacaoDoVencimento("2026-12-15", "hoje?")).toBeNull();
  });

  it("conta os dias a partir de hoje", () => {
    expect(situacaoDoVencimento("2026-11-07", "2026-11-07")).toEqual({ texto: "vence hoje", tom: "hoje", dias: 0 });
    expect(situacaoDoVencimento("2026-11-08", "2026-11-07")).toEqual({ texto: "vence amanhã", tom: "perto", dias: 1 });
    expect(situacaoDoVencimento("2026-11-10", "2026-11-07")).toEqual({ texto: "vence em 3 dias", tom: "perto", dias: 3 });
    expect(situacaoDoVencimento("2026-11-14", "2026-11-07")).toMatchObject({ texto: "vence em 7 dias", tom: "perto" });
    expect(situacaoDoVencimento("2026-11-15", "2026-11-07")).toEqual({ texto: "vence 15/11/26", tom: "longe", dias: 8 });
    expect(situacaoDoVencimento("2026-12-15", "2026-11-07")).toEqual({ texto: "vence 15/12/26", tom: "longe", dias: 38 });
    expect(situacaoDoVencimento("2026-11-06", "2026-11-07")).toEqual({ texto: "venceu ontem", tom: "atrasada", dias: -1 });
    expect(situacaoDoVencimento("2026-10-31", "2026-11-07")).toEqual({ texto: "venceu há 7 dias", tom: "atrasada", dias: -7 });
    // virada de ano
    expect(situacaoDoVencimento("2027-01-02", "2026-12-31")).toMatchObject({ texto: "vence em 2 dias", dias: 2 });
  });
});

describe("Dívidas entre pessoas: vencimento opcional (07/11)", () => {
  it("registra com 'Pagar até' e grava só o campo a mais; sem data, o objeto fica como sempre foi", () => {
    const store = criarStore();
    renderComStore(<DividasEntrePessoas />, store);

    // sem abrir o combinado: nada de vencimento — o formato antigo, chave por chave
    fireEvent.change(screen.getByPlaceholderText("Devo para quem?"), { target: { value: "Tia Lu" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
    let salvo = gravadas(store);
    expect(salvo).toHaveLength(1);
    // `perfil` é a etiqueta da mesclagem por perfil (09/09) — já era gravada antes desta mudança
    expect(Object.keys(salvo[0]).sort()).toEqual(["criadaEm", "direcao", "id", "lancamentos", "perfil", "pessoa"]);
    expect(linha("Tia Lu")).toHaveTextContent(`desde ${curta(dia(0))}`);
    expect(linha("Tia Lu")).not.toHaveTextContent(/venc/);

    // com prazo (daqui a 5 dias): só o `vencimento` entra — sem parcelas nem juros
    fireEvent.click(screen.getByTestId("divida-combinado"));
    expect(screen.getByTestId("divida-combinado")).toHaveTextContent("Sem parcelas, juros nem prazo");
    fireEvent.change(screen.getByPlaceholderText("Devo para quem?"), { target: { value: "Marcos" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Pagar até"), { target: { value: dia(5) } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
    salvo = gravadas(store);
    expect(salvo).toHaveLength(2);
    expect(salvo[1]).toMatchObject({ pessoa: "Marcos", direcao: "devo", vencimento: dia(5) });
    expect(salvo[1].parcelas).toBeUndefined();
    expect(salvo[1].jurosMes).toBeUndefined();
    expect(linha("Marcos")).toHaveTextContent("vence em 5 dias");
    // o formulário volta limpo e fechado; a dívida antiga continua sem prazo
    expect(screen.queryByTestId("divida-combinado-campos")).toBeNull();
    expect("vencimento" in salvo[0]).toBe(false);
    expect(screen.getByTestId("divida-combinado")).toHaveTextContent("Parcelado? Com juros? Tem prazo?");
  });

  it("combinado aberto mas data em branco: não grava vencimento (nem vazio)", () => {
    const store = criarStore();
    renderComStore(<DividasEntrePessoas />, store);
    fireEvent.click(screen.getByTestId("divida-combinado"));
    fireEvent.change(screen.getByPlaceholderText("Devo para quem?"), { target: { value: "Bia" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
    const [salva] = gravadas(store);
    expect(salva.pessoa).toBe("Bia");
    expect("vencimento" in salva).toBe(false);
  });

  it("linha: dívida antiga fica igual; atrasada ganha o selo; vence hoje ganha o selo; quitada não cobra prazo", () => {
    const base = (p: Partial<DividaPessoal> & { pessoa: string }): DividaPessoal => ({
      id: p.pessoa, direcao: "devo", criadaEm: "2026-10-01",
      lancamentos: [{ id: `l-${p.pessoa}`, data: "2026-10-01", valor: 100 }],
      ...p,
    });
    const lista: DividaPessoal[] = [
      base({ pessoa: "Antiga" }),
      base({ pessoa: "Atrasada", vencimento: dia(-3) }),
      base({ pessoa: "Hoje", direcao: "medevem", vencimento: dia(0) }),
      base({ pessoa: "Perto", vencimento: dia(2) }),
      base({ pessoa: "Longe", vencimento: dia(40) }),
      base({ pessoa: "Quitada", vencimento: dia(-10), lancamentos: [{ id: "q1", data: "2026-10-01", valor: 100 }, { id: "q2", data: "2026-10-02", valor: -100 }] }),
    ];
    const store = criarStore({ "finance-dividas-pessoas": lista });
    renderComStore(<DividasEntrePessoas />, store);

    expect(linha("Antiga")).toHaveTextContent("desde 01/10/26");
    expect(linha("Antiga")).not.toHaveTextContent(/venc/);
    expect(within(linha("Antiga")).queryByTestId("prazo-da-divida")).toBeNull();

    expect(within(linha("Atrasada")).getByTestId("selo-atrasada")).toHaveTextContent("atrasada");
    expect(linha("Atrasada")).toHaveTextContent("venceu há 3 dias");

    expect(within(linha("Hoje")).getByTestId("selo-vence-hoje")).toHaveTextContent("vence hoje");
    expect(within(linha("Hoje")).queryByTestId("prazo-da-divida")).toBeNull(); // o selo já diz

    expect(linha("Perto")).toHaveTextContent("vence em 2 dias");
    expect(linha("Longe")).toHaveTextContent(`vence ${curta(dia(40))}`);

    expect(linha("Quitada")).toHaveTextContent("quitada");
    expect(within(linha("Quitada")).queryByTestId("selo-atrasada")).toBeNull();
    expect(linha("Quitada")).not.toHaveTextContent(/venc/);
    expect(screen.getAllByTestId("selo-atrasada")).toHaveLength(1);

    // o card DÍVIDAS (Home/resumo) não muda com o campo: só o que EU devo, em aberto
    expect(totalQueDevoAPessoas(lista)).toBe(400);
    // nada foi regravado só por renderizar
    expect(gravadas(store)).toBe(lista);
  });

  it("dívida antiga aberta: dá pra pôr o prazo depois, e 'tirar' remove o campo (não grava vazio)", () => {
    const antiga: DividaPessoal = {
      id: "d1", pessoa: "Tia Lu", direcao: "devo", criadaEm: "2026-10-01",
      lancamentos: [{ id: "l1", data: "2026-10-01", valor: 1200, nota: "Valor inicial" }],
    };
    const store = criarStore({ "finance-dividas-pessoas": [antiga] });
    renderComStore(<DividasEntrePessoas />, store);
    fireEvent.click(linha("Tia Lu"));
    const campo = screen.getByLabelText("Prazo: pagar até") as HTMLInputElement;
    expect(campo.value).toBe("");
    expect(screen.queryByRole("button", { name: "Tirar o prazo" })).toBeNull();

    fireEvent.change(campo, { target: { value: dia(20) } });
    // (`perfil: "pessoal"` é a etiqueta da mesclagem por perfil, de 09/09 — vinha antes, continua vindo)
    expect(gravadas(store)[0]).toEqual({ ...antiga, perfil: "pessoal", vencimento: dia(20) });
    expect(linha("Tia Lu")).toHaveTextContent(`vence ${curta(dia(20))}`);
    expect((screen.getByLabelText("Prazo: pagar até") as HTMLInputElement).value).toBe(dia(20));

    fireEvent.click(screen.getByRole("button", { name: "Tirar o prazo" }));
    const depois = gravadas(store)[0];
    expect("vencimento" in depois).toBe(false);
    expect(depois).toEqual({ ...antiga, perfil: "pessoal" });
    expect(linha("Tia Lu")).not.toHaveTextContent(/venc/);
    expect(screen.queryByRole("button", { name: "Tirar o prazo" })).toBeNull();
  });

  it("quem me deve: 'Receber até'; fechar e reabrir traz o prazo de volta na linha e no campo", () => {
    const store = criarStore();
    const { unmount } = renderComStore(<DividasEntrePessoas />, store);
    fireEvent.click(screen.getByRole("button", { name: "Me devem" }));
    fireEvent.click(screen.getByTestId("divida-combinado"));
    expect(screen.queryByLabelText("Pagar até")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Quem me deve?"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Receber até"), { target: { value: dia(-3) } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
    expect(gravadas(store)[0]).toMatchObject({ pessoa: "Ana", direcao: "medevem", vencimento: dia(-3) });

    // fecha e reabre: o componente nasce de novo só com o que está na chave
    unmount();
    renderComStore(<DividasEntrePessoas />, store);
    expect(within(linha("Ana")).getByTestId("selo-atrasada")).toBeInTheDocument();
    expect(linha("Ana")).toHaveTextContent("venceu há 3 dias");
    fireEvent.click(linha("Ana"));
    expect((screen.getByLabelText("Prazo: receber até") as HTMLInputElement).value).toBe(dia(-3));
    // o que me devem nunca entrou no card DÍVIDAS, com ou sem prazo
    expect(totalQueDevoAPessoas(gravadas(store))).toBe(0);
  });

  it("perfil da empresa: o prazo vai junto na mesclagem e a dívida do Pessoal não é tocada", () => {
    const pessoal: DividaPessoal = { id: "p", pessoa: "Primo", direcao: "devo", criadaEm: "2026-10-01", lancamentos: [{ id: "l", data: "2026-10-01", valor: 50 }] };
    const store = criarStore({ "finance-dividas-pessoas": [pessoal] });
    renderComStore(<DividasEntrePessoas perfil="empresa-x" />, store);
    expect(screen.queryByRole("button", { name: /Primo/ })).toBeNull();
    fireEvent.click(screen.getByTestId("divida-combinado"));
    fireEvent.change(screen.getByPlaceholderText("Devo para quem?"), { target: { value: "Fornecedor" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "900" } });
    fireEvent.change(screen.getByLabelText("Pagar até"), { target: { value: dia(10) } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
    const salvo = gravadas(store);
    expect(salvo[0]).toEqual(pessoal);
    expect(salvo[1]).toMatchObject({ pessoa: "Fornecedor", perfil: "empresa-x", vencimento: dia(10) });
  });
});
