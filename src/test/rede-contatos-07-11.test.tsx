/**
 * REDE DE CONTATOS (Carreira › Rede) — dono 07/11: "registro de contatos
 * profissionais" sem módulo nem aba nova. "Onde conheceu", "Data" e "Assunto /
 * próximo passo" opcionais na chave de sempre (`career-contacts`, array);
 * telefone e tudo isso na linha; busca simples; lixeira à vista com Desfazer;
 * e "Marcar reunião", que vira um compromisso da Rotina (`rotina-compromissos`,
 * o mesmo registro que o app antigo das lojas lê).
 * Tudo em conta VAZIA, e o ciclo abrir → usar → fechar → reabrir.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

type Acao = { label: string; onClick: () => void };
const toasts = vi.hoisted(() => [] as { tipo: string; msg: string; acao?: Acao }[]);
vi.mock("sonner", () => ({
  toast: Object.assign(
    (msg: string, opts?: { action?: Acao }) => { toasts.push({ tipo: "aviso", msg, acao: opts?.action }); },
    {
      success: (msg: string, opts?: { action?: Acao }) => { toasts.push({ tipo: "ok", msg, acao: opts?.action }); },
      error: (msg: string) => { toasts.push({ tipo: "erro", msg }); },
    },
  ),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
const eventos = vi.hoisted(() => [] as { nome: string; dados?: Record<string, unknown> }[]);
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: (nome: string, dados?: Record<string, unknown>) => { eventos.push({ nome, dados }); }, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, isIOS: () => false }));
vi.mock("@/lib/avaliacao", () => ({ pedirAvaliacaoSePuder: async () => false }));
vi.mock("@/hooks/use-life-hub-data", () => ({ useLifeHubData: () => ({ tasksCompleted: 0, tasksTotal: 1 }) }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Carreira, { contatoCasaBusca, reuniaoDoContato } from "@/pages/Carreira";
import { VoltaDaDemoProvider } from "@/lib/volta-da-demo";
import { CHAVE_COMPROMISSOS, compromissosValidos, ocorrencias, type Compromisso } from "@/lib/compromissos";
import { compromissosValidos as compromissosValidosAntigo } from "./app-antigo/home/compromissos-antigo";

type Contato = { id: string; name: string; company: string; role: string; linkedin: string; email: string; phone: string; notes: string; lastContact: string; category: string; onde?: string; conheceuEm?: string; assunto?: string };
const contato = (extra: Partial<Contato> = {}): Contato =>
  ({ id: "c1", name: "João", company: "CORE", role: "", linkedin: "", email: "", phone: "", notes: "", lastContact: "2026-11-07", category: "profissional", ...extra });

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { "core-tip-seen-carreira": "true", ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
type Store = ReturnType<typeof criarStore>;

/** Mostra onde a navegação parou (o "Ver na Rotina" do toast). */
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname + l.search}</p>; };
const montar = (store: Store, rota = "/carreira") => {
  const paginas = (
    <Routes>
      <Route path={rota} element={<Carreira />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  );
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <UserDataContext.Provider value={store.valor}>
        {rota.startsWith("/preview/")
          ? <VoltaDaDemoProvider value={{ destino: "/inicio", modulo: "carreira" }}>{paginas}</VoltaDaDemoProvider>
          : paginas}
      </UserDataContext.Provider>
    </MemoryRouter>,
  );
};

const abrirRede = () => fireEvent.click(screen.getByRole("button", { name: /Rede/ }));
const lista = (store: Store) => (store.dados["career-contacts"] ?? []) as Contato[];
const compromissosDe = (store: Store) => (store.dados[CHAVE_COMPROMISSOS] ?? []) as Compromisso[];
/** O exemplo do dono, pelo "Detalhado". */
const cadastrarJoao = () => {
  fireEvent.click(screen.getByRole("button", { name: /Detalhado/ }));
  fireEvent.change(screen.getByPlaceholderText("Nome"), { target: { value: "João" } });
  fireEvent.change(screen.getByPlaceholderText("Empresa"), { target: { value: "CORE" } });
  fireEvent.change(screen.getByPlaceholderText(/Onde conheceu/), { target: { value: "evento em São Paulo" } });
  fireEvent.change(screen.getByLabelText("Data em que conheceu"), { target: { value: "2026-10-05" } });
  fireEvent.change(screen.getByPlaceholderText(/Assunto/), { target: { value: "IA nas empresas, marcar reunião" } });
  fireEvent.change(screen.getByPlaceholderText("Telefone"), { target: { value: "(11) 99999-0000" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
};
/** Relógio só do Date (os timers do React seguem reais). */
const fixarData = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };
beforeEach(() => { toasts.length = 0; eventos.length = 0; });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe("Rede de contatos — busca e reunião (puro)", () => {
  it("busca sem acento e sem caixa: nome, empresa, onde, assunto, telefone; vazio acha tudo", () => {
    const joao = contato({ phone: "(11) 99999-0000", onde: "evento em São Paulo", assunto: "IA nas empresas" });
    expect(contatoCasaBusca(joao, "")).toBe(true);
    expect(contatoCasaBusca(joao, "   ")).toBe(true);
    expect(contatoCasaBusca(joao, "joao")).toBe(true);
    expect(contatoCasaBusca(joao, "CORE")).toBe(true);
    expect(contatoCasaBusca(joao, "sao paulo")).toBe(true);
    expect(contatoCasaBusca(joao, "ia nas")).toBe(true);
    expect(contatoCasaBusca(joao, "99999")).toBe(true);
    expect(contatoCasaBusca(joao, "marina")).toBe(false);
    // contato antigo, sem os campos novos
    expect(contatoCasaBusca(contato(), "evento")).toBe(false);
    expect(contatoCasaBusca(contato(), "core")).toBe(true);
  });

  it("a reunião é um compromisso que a Rotina E o app antigo das lojas leem; com ref do contato, sem origem", () => {
    const c = reuniaoDoContato({ id: "c1", name: "João" }, { titulo: "", data: "2026-11-10", hora: "10:30", aviso: 60, local: "  ", notas: "IA nas empresas\nTel: (11) 99999-0000" }, "r1");
    expect(c).toEqual({ id: "r1", titulo: "Reunião com João", data: "2026-11-10", hora: "10:30", aviso: 60, notas: "IA nas empresas\nTel: (11) 99999-0000", ref: "c1" });
    expect(c).not.toHaveProperty("origem");
    expect(c).not.toHaveProperty("local");
    expect(compromissosValidos([c])).toHaveLength(1);
    expect(compromissosValidosAntigo([c])).toHaveLength(1);
    const o = ocorrencias([c], new Date(2026, 10, 9), 3);
    expect(o).toHaveLength(1);
    expect(o[0].dia).toBe("2026-11-10");
    expect(o[0].quando.getHours()).toBe(10);
    expect(o[0].quando.getMinutes()).toBe(30);
    const comLocal = reuniaoDoContato({ id: "c1", name: "João" }, { titulo: " Café com João ", data: "2026-11-10", hora: "10:30", aviso: -1, local: " Centro ", notas: "" }, "r2");
    expect(comLocal).toMatchObject({ titulo: "Café com João", local: "Centro", aviso: -1 });
    expect(comLocal).not.toHaveProperty("notas");
  });
});

describe("Rede de contatos — a tela, em conta vazia", () => {
  it("o exemplo do dono entra pelo Detalhado; a linha mostra onde, data, assunto e telefone; lixeira à vista", () => {
    fixarData(new Date(2026, 10, 7, 10, 0));
    const store = criarStore();
    montar(store);
    abrirRede();
    expect(screen.getByText("Nenhum contato ainda")).toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar contato")).toBeNull(); // sem contato, sem busca
    cadastrarJoao();
    expect(lista(store)).toHaveLength(1);
    expect(lista(store)[0]).toMatchObject({ name: "João", company: "CORE", phone: "(11) 99999-0000", onde: "evento em São Paulo", conheceuEm: "2026-10-05", assunto: "IA nas empresas, marcar reunião", lastContact: "2026-11-07" });
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText("CORE")).toBeInTheDocument();
    expect(screen.getByText("📍 evento em São Paulo · 05/10")).toBeInTheDocument();
    expect(screen.getByText("→ IA nas empresas, marcar reunião")).toBeInTheDocument();
    const tel = screen.getByText("📞 (11) 99999-0000");
    expect(tel.closest("a")).toHaveAttribute("href", "tel:11999990000");
    // abaixo de 380 px só a data fica à vista (07/11, 4ª rodada: a 360 px a lixeira passava da linha);
    // "último contato" continua no title e pro leitor de tela
    const ultimo = screen.getByTestId("rede-ultimo-contato");
    expect(ultimo.textContent).toBe("último contato 07/11");
    expect(ultimo).toHaveAttribute("title", "último contato 07/11");
    expect(within(ultimo).getByText("último contato").className).toContain("sr-only min-[380px]:not-sr-only");
    expect(ultimo.className).not.toContain("whitespace-nowrap"); // a data sozinha não estoura; o texto todo pode quebrar se precisar
    // a lixeira está à vista (antes: opacity-0 até o hover — que não existe no celular)
    const lixeira = screen.getByRole("button", { name: "Apagar João" });
    expect(lixeira.className).not.toContain("opacity-0");
    expect(screen.getByLabelText("Buscar contato")).toBeInTheDocument();
    expect(screen.getByText("Nenhum follow-up pendente 🎉")).toBeInTheDocument();
  });

  it("contato antigo (sem os campos novos) continua igual; editar pra vazio tira o campo em vez de gravar ''", () => {
    fixarData(new Date(2026, 10, 7, 10, 0));
    const antigo: Contato = { id: "a1", name: "Marina S.", company: "Studio Norte", role: "Gerente", linkedin: "", email: "", phone: "", notes: "Indicou a vaga", lastContact: "2026-11-05", category: "profissional" };
    const store = criarStore({ "career-contacts": [antigo] });
    montar(store);
    abrirRede();
    expect(screen.getByText("Marina S.")).toBeInTheDocument();
    expect(screen.getByText("Gerente @ Studio Norte")).toBeInTheDocument();
    expect(screen.queryByText(/📍/)).toBeNull();
    expect(screen.queryByText(/^→/)).toBeNull();
    expect(screen.queryByText(/📞/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar Marina S." }));
    expect(screen.getByPlaceholderText(/Onde conheceu/)).toHaveValue("");
    expect(screen.getByPlaceholderText(/Assunto/)).toHaveValue("");
    fireEvent.change(screen.getByPlaceholderText(/Assunto/), { target: { value: "Mandar o portfolio" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(lista(store)).toHaveLength(1);
    expect(lista(store)[0]).toEqual({ ...antigo, assunto: "Mandar o portfolio" });
    expect(screen.getByText("→ Mandar o portfolio")).toBeInTheDocument();
    // apagou o assunto: o campo sai do objeto (o app antigo não conhece "")
    fireEvent.click(screen.getByRole("button", { name: "Editar Marina S." }));
    fireEvent.change(screen.getByPlaceholderText(/Assunto/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(lista(store)[0]).toEqual(antigo);
    expect(lista(store)[0]).not.toHaveProperty("assunto");
  });

  it("busca filtra a lista e avisa quando não acha", () => {
    const store = criarStore({ "career-contacts": [
      contato({ id: "1", assunto: "IA nas empresas" }),
      contato({ id: "2", name: "Marina S.", company: "Studio Norte", role: "Gerente", category: "recrutador" }),
    ] });
    montar(store);
    abrirRede();
    const busca = screen.getByLabelText("Buscar contato");
    fireEvent.change(busca, { target: { value: "core" } });
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.queryByText("Marina S.")).toBeNull();
    fireEvent.change(busca, { target: { value: "ia nas" } });
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.queryByText("Marina S.")).toBeNull();
    fireEvent.change(busca, { target: { value: "zzz" } });
    expect(screen.getByText('Nenhum contato com "zzz"')).toBeInTheDocument();
    expect(screen.queryByText("João")).toBeNull();
    fireEvent.change(busca, { target: { value: "" } });
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText("Marina S.")).toBeInTheDocument();
    expect(lista(store)).toHaveLength(2); // buscar não grava nada
  });

  it("lixeira apaga na hora e o Desfazer traz de volta", () => {
    const store = criarStore({ "career-contacts": [contato()] });
    montar(store);
    abrirRede();
    fireEvent.click(screen.getByRole("button", { name: "Apagar João" }));
    expect(lista(store)).toHaveLength(0);
    expect(screen.getByText("Nenhum contato ainda")).toBeInTheDocument();
    const aviso = toasts.find(t => t.msg === "João apagado");
    expect(aviso?.acao?.label).toBe("Desfazer");
    act(() => aviso!.acao!.onClick());
    expect(lista(store)).toHaveLength(1);
    expect(screen.getByText("João")).toBeInTheDocument();
  });

  it("Marcar reunião: vira compromisso da Rotina (sem perder os de antes), o contato sai do follow-up, o toast leva pra Rotina", () => {
    fixarData(new Date(2026, 10, 7, 10, 0));
    const jiu: Compromisso = { id: "b", titulo: "Jiu-jitsu", data: "2026-09-21", hora: "19:30", repete: [0, 2, 4], aviso: 30 };
    const store = criarStore({
      "career-contacts": [contato({ phone: "(11) 99999-0000", lastContact: "2026-09-20", assunto: "IA nas empresas" })],
      [CHAVE_COMPROMISSOS]: [jiu],
    });
    montar(store);
    abrirRede();
    // 48 dias sem contato: está no follow-up (com o assunto embaixo do nome)
    const followUp = screen.getByText("⏰ FOLLOW-UP PENDENTE").closest("div")!.parentElement!;
    expect(within(followUp).getByText("→ IA nas empresas")).toBeInTheDocument();
    // o botão tem a palavra à vista, não só o ícone (07/11, retomada)
    expect(screen.getByRole("button", { name: "Marcar reunião com João" }).textContent).toBe("Reunião");
    fireEvent.click(screen.getByRole("button", { name: "Marcar reunião com João" }));
    const form = screen.getByTestId("form-reuniao");
    expect(within(form).getByLabelText("Nome da reunião")).toHaveValue("Reunião com João");
    expect(within(form).getByLabelText("Notas da reunião")).toHaveValue("IA nas empresas\nTel: (11) 99999-0000");
    // sábado 10:00: abre no próximo dia útil às 09:00 (hoje 09:00 já passou)
    expect(within(form).getByLabelText("Data da reunião")).toHaveValue("2026-11-09");
    expect(within(form).getByLabelText("Hora da reunião")).toHaveValue("09:00");
    // horário que já passou não grava: avisa antes, sem toast de sucesso
    fireEvent.change(within(form).getByLabelText("Data da reunião"), { target: { value: "2026-11-07" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar na Rotina" }));
    expect(toasts.some(t => t.tipo === "erro" && t.msg === "Esse horário já passou")).toBe(true);
    expect(toasts.some(t => t.tipo === "ok")).toBe(false);
    expect(compromissosDe(store)).toHaveLength(1);
    fireEvent.change(within(form).getByLabelText("Data da reunião"), { target: { value: "2026-11-10" } });
    fireEvent.change(within(form).getByLabelText("Hora da reunião"), { target: { value: "10:30" } });
    fireEvent.change(within(form).getByLabelText("Antecedência do aviso"), { target: { value: "1440" } });
    fireEvent.change(within(form).getByLabelText("Local da reunião"), { target: { value: "Escritório da CORE" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar na Rotina" }));
    const comps = compromissosDe(store);
    expect(comps).toHaveLength(2);
    expect(comps[0]).toEqual(jiu);
    expect(comps[1]).toMatchObject({ titulo: "Reunião com João", data: "2026-11-10", hora: "10:30", aviso: 1440, local: "Escritório da CORE", notas: "IA nas empresas\nTel: (11) 99999-0000", ref: "c1" });
    expect(comps[1]).not.toHaveProperty("origem");
    expect(compromissosValidosAntigo(comps)).toHaveLength(2);
    expect(lista(store)[0].lastContact).toBe("2026-11-07");
    expect(screen.getByText("Nenhum follow-up pendente 🎉")).toBeInTheDocument();
    expect(screen.queryByTestId("form-reuniao")).toBeNull();
    const ok = toasts.find(t => t.tipo === "ok");
    expect(ok?.msg).toBe("Reunião com João: 10/11 às 10:30");
    expect(ok?.acao?.label).toBe("Ver na Rotina");
    act(() => ok!.acao!.onClick());
    expect(screen.getByTestId("onde")).toHaveTextContent("/rotina?aba=mes");
    expect(eventos.find(e => e.nome === "carreira_reuniao_marcada")?.dados).toEqual({ aviso: 1440, com_assunto: true });
  });

  it("sem dia não marca; Cancelar fecha; o botão da reunião some com o editor aberto", () => {
    const store = criarStore({ "career-contacts": [contato()] });
    montar(store);
    abrirRede();
    fireEvent.click(screen.getByRole("button", { name: "Marcar reunião com João" }));
    fireEvent.change(screen.getByLabelText("Data da reunião"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar na Rotina" }));
    expect(compromissosDe(store)).toHaveLength(0);
    expect(toasts.some(t => t.tipo === "erro" && t.msg === "Escolhe o dia da reunião")).toBe(true);
    expect(screen.getByTestId("form-reuniao")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("form-reuniao")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByTestId("form-reuniao")).toBeNull();
    // abrir de novo e ir pro lápis: o formulário da reunião fecha
    fireEvent.click(screen.getByRole("button", { name: "Marcar reunião com João" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar João" }));
    expect(screen.queryByTestId("form-reuniao")).toBeNull();
    expect(screen.getByPlaceholderText("Nome")).toHaveValue("João");
  });

  it("na demo (/preview) a reunião também é marcada, mas o toast não oferece 'Ver na Rotina'", () => {
    const store = criarStore();
    montar(store, "/preview/carreira");
    abrirRede();
    fireEvent.change(screen.getByPlaceholderText("Nome..."), { target: { value: "João" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar reunião com João" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar na Rotina" }));
    expect(compromissosDe(store)).toHaveLength(1);
    expect(compromissosDe(store)[0].titulo).toBe("Reunião com João");
    const ok = toasts.find(t => t.tipo === "ok");
    expect(ok).toBeDefined();
    expect(ok?.acao).toBeUndefined();
  });

  it("fechar e reabrir: contato, campos novos e a reunião continuam; a busca volta limpa", () => {
    fixarData(new Date(2026, 10, 7, 10, 0));
    const store = criarStore();
    const { unmount } = montar(store);
    abrirRede();
    cadastrarJoao();
    fireEvent.click(screen.getByRole("button", { name: "Marcar reunião com João" }));
    fireEvent.change(screen.getByLabelText("Data da reunião"), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar na Rotina" }));
    fireEvent.change(screen.getByLabelText("Buscar contato"), { target: { value: "core" } });
    unmount();
    montar(store);
    abrirRede();
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText("📍 evento em São Paulo · 05/10")).toBeInTheDocument();
    expect(screen.getByText("→ IA nas empresas, marcar reunião")).toBeInTheDocument();
    expect(screen.getByText("📞 (11) 99999-0000")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar contato")).toHaveValue("");
    expect(screen.queryByTestId("form-reuniao")).toBeNull();
    expect(compromissosDe(store)).toHaveLength(1);
    expect(compromissosDe(store)[0]).toMatchObject({ titulo: "Reunião com João", data: "2026-11-10", hora: "09:00", ref: lista(store)[0].id });
  });
});
