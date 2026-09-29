/**
 * Relações, Onda 1 (29/09) — a TELA, com o ciclo da casa: abrir → usar → sair
 * → REABRIR (a remontagem é onde os bugs moram, regra de 19/07). Inclui as
 * travas que vieram das avaliações da Play de 07/09 (aniversário um dia antes;
 * não dava pra editar a pessoa) e o formato do app ANTIGO abrindo sem gravar
 * nada. Nada sai daqui: analytics mockado e rede bloqueada no setup.
 */
process.env.TZ = "America/Sao_Paulo";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Relacionamentos from "@/pages/Relacionamentos";
import { RelacoesWidget } from "@/components/home/widgets/RelacoesWidget";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

// terça, 29/09/2026 10:00 — o "hoje" de todos os testes
const AGORA = new Date(2026, 8, 29, 10, 0);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AGORA); });
afterEach(() => { vi.useRealTimers(); });

type Dados = Record<string, unknown>;

// Os testes de ciclo inteiro (duas folhas + toast) levam 3–7 s sozinhos e passaram de 15 s com a máquina
// carregada (13 agentes na noite de 29/09): esses três ganham 40 s, como o comentário do vitest.config prevê.

/** Store reativo como o de verdade: `set` re-renderiza e muda a identidade do `get`. */
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados, escritas: [] as string[] };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; estado.escritas.push(k); subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}

const BASE: Dados = { "spotlight-done-relacionamentos": "true", "core-tip-seen-relacionamentos": "true" };

const abrir = (store: ReturnType<typeof criarStore>, caminho = "/relacionamentos") =>
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <store.Provedor>
        <Relacionamentos />
        <Toaster />
      </store.Provedor>
    </MemoryRouter>,
  );

const lista = <T,>(store: ReturnType<typeof criarStore>, k: string) => (store.estado.dados[k] ?? []) as T[];

/* ------------------------------------------------------------------ app antigo */

describe("dado do app antigo abre igual e abrir não grava nada", () => {
  const antigo: Dados = {
    ...BASE,
    "rel-people": [
      { id: "1", name: "Mãe", relation: "Família", birthday: "1965-10-12", notes: "Gosta de orquídea" },
      { id: "2", name: "Ana", relation: "Namorada", birthday: "1998-03-04", notes: "Ama café coado" },
      { id: "5", name: "Dona Lúcia", relation: "Cliente", birthday: "", notes: "Sempre pergunta dos filhos" },
    ],
    "rel-dates": [
      { id: "1", title: "Aniversário da mãe", person: "Mãe", date: "2025-10-12", type: "birthday" },
      { id: "2", title: "1 ano de namoro", person: "Ana", date: "2025-10-20", type: "anniversary" },
    ],
    "rel-moments": [{ id: "1", date: "2026-09-27", person: "Ana", description: "Jantar surpresa em casa" }],
    "rel-gifts": [{ id: "1", person: "Ana", idea: "Moka italiana", link: "", status: "idea" }],
    "rel-events": [{ id: "1", name: "Churrasco do Pedro", date: "2026-10-04", location: "Casa do Pedro", rsvp: "confirmed", tasks: [{ id: "1", text: "Levar carvão", done: false }] }],
  };

  it("todas as abas abrem, a data repetida some e o '1 ano de namoro' vira a conta certa", () => {
    const store = criarStore(antigo);
    abrir(store);
    const tabela = screen.getByTestId("lista-pessoas");
    expect(within(tabela).getByText("Mãe")).toBeInTheDocument();
    expect(within(tabela).getByText("Dona Lúcia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /DATAS/ }));
    const datas = screen.getByTestId("lista-datas");
    expect(within(datas).getAllByText(/Mãe/)).toHaveLength(1); // "Aniversário da mãe" (repetido) não aparece
    expect(within(datas).getByText(/1 ano juntos/i)).toBeInTheDocument(); // namoro de 2025 → em 20/10/2026 completa 1
    expect(screen.getByText("Churrasco do Pedro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /PRESENTES/ }));
    expect(screen.getByText("Moka italiana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /MOMENTOS/ }));
    expect(screen.getByText("Jantar surpresa em casa")).toBeInTheDocument();
    expect(store.estado.escritas).toEqual([]);
  });

  it("?aba=eventos (link antigo) abre a aba de datas", () => {
    abrir(criarStore(antigo), "/relacionamentos?aba=eventos");
    expect(screen.getByRole("tab", { name: /DATAS/ })).toHaveAttribute("aria-selected", "true");
  });
});

/* ------------------------------------------------------------------ avaliações de 07/09 */

describe("aniversário no dia certo e pessoa editável (avaliação da Play, 07/09)", () => {
  it("10/05 aparece como 10/05 — não 09/05 (o bug do UTC)", () => {
    abrir(criarStore({ ...BASE, "rel-people": [{ id: "1", name: "Ana", relation: "irmã", birthday: "2000-05-10", notes: "" }] }));
    const tabela = screen.getByTestId("lista-pessoas");
    expect(within(tabela).getByText("10/05")).toBeInTheDocument();
    expect(within(tabela).queryByText("09/05")).not.toBeInTheDocument();
  });

  it("aniversário de HOJE acende o selo 'Hoje' e o 'Mandar parabéns'", () => {
    abrir(criarStore({ ...BASE, "rel-people": [{ id: "1", name: "Bia", relation: "amiga", birthday: "1990-09-29" }] }));
    expect(within(screen.getByTestId("selos")).getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText(/Bia faz aniversário hoje — 36 anos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mandar parabéns" })).toBeInTheDocument();
  });

  it("edita nome, data e notas; o id e o campo desconhecido ficam; sai; reabre e está lá", { timeout: 40_000 }, () => {
    const store = criarStore({ ...BASE, "rel-people": [{ id: "abc", name: "Ana", relation: "irmã", birthday: "2000-05-10", campoDoFuturo: "fica" }] });
    const tela = abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Ana" }));
    fireEvent.click(within(screen.getByTestId("ficha-pessoa")).getByRole("button", { name: /Editar/ }));
    const folha = screen.getByTestId("folha-pessoa");
    fireEvent.change(within(folha).getByLabelText("Nome"), { target: { value: "Ana Paula" } });
    fireEvent.change(within(folha).getByLabelText("Dia do aniversário"), { target: { value: "11" } });
    fireEvent.change(within(folha).getByLabelText("Notas"), { target: { value: "alérgica a camarão" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar alterações" }));

    const [salvo] = lista<Record<string, unknown>>(store, "rel-people");
    expect(salvo).toMatchObject({ id: "abc", name: "Ana Paula", birthday: "2000-05-11", notes: "alérgica a camarão", campoDoFuturo: "fica" });

    tela.unmount();
    abrir(store);
    const tabela = screen.getByTestId("lista-pessoas");
    expect(within(tabela).getByText("Ana Paula")).toBeInTheDocument();
    expect(within(tabela).getByText("11/05")).toBeInTheDocument();
  });

  it("apagar pede confirmação, some da lista e o Desfazer traz de volta", { timeout: 40_000 }, async () => {
    const store = criarStore({ ...BASE, "rel-people": [{ id: "1", name: "Ana", relation: "irmã", birthday: "2000-05-10" }, { id: "2", name: "Bia", relation: "", birthday: "" }] });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Ana" }));
    fireEvent.click(within(screen.getByTestId("ficha-pessoa")).getByRole("button", { name: /Editar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar pessoa" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar Ana" }));
    expect(lista<{ id: string }>(store, "rel-people").map((p) => p.id)).toEqual(["2"]);
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(lista<{ id: string }>(store, "rel-people").map((p) => p.id).sort()).toEqual(["1", "2"]);
  });
});

/* ------------------------------------------------------------------ começo pronto */

describe("começo pronto: 3 pessoas em menos de um minuto", () => {
  it("Mãe (sem ano) → Melhor amiga (com ano) → Pai (sem data) → 'Pronto'; fechar; reabrir sem o começo", { timeout: 40_000 }, () => {
    const store = criarStore({ ...BASE });
    const tela = abrir(store);
    const comeco = () => screen.getByTestId("comeco-pronto");
    expect(within(comeco()).getByText("Quem você não pode esquecer?")).toBeInTheDocument();

    fireEvent.click(within(comeco()).getByRole("button", { name: "Mãe" }));
    fireEvent.change(within(comeco()).getByLabelText("Dia do aniversário"), { target: { value: "12" } });
    fireEvent.change(within(comeco()).getByLabelText("Mês do aniversário"), { target: { value: "8" } });
    fireEvent.click(within(comeco()).getByRole("button", { name: "Guardar" }));
    expect(lista(store, "rel-people")[0]).toMatchObject({ name: "Mãe", relation: "Mãe", birthday: "2000-08-12", semAno: true, circulo: "familia" });
    expect(screen.getByText("1 de 3")).toBeInTheDocument(); // o contador mora no título da seção
    expect(within(comeco()).getByRole("button", { name: "Mãe: já guardada" })).toBeDisabled();

    fireEvent.click(within(comeco()).getByRole("button", { name: "Melhor amiga" }));
    fireEvent.change(within(comeco()).getByLabelText("Nome"), { target: { value: "Ju" } });
    fireEvent.change(within(comeco()).getByLabelText("Dia do aniversário"), { target: { value: "2" } });
    fireEvent.change(within(comeco()).getByLabelText("Mês do aniversário"), { target: { value: "10" } });
    fireEvent.change(within(comeco()).getByLabelText("Ano do aniversário (opcional)"), { target: { value: "1997" } });
    fireEvent.click(within(comeco()).getByRole("button", { name: "Guardar" }));
    expect(lista(store, "rel-people")[1]).toMatchObject({ name: "Ju", birthday: "1997-10-02", circulo: "amigos" });
    expect(lista<Record<string, unknown>>(store, "rel-people")[1].semAno).toBeUndefined();
    // a Ju faz 29 daqui a 3 dias: já vira selo
    expect(within(screen.getByTestId("selos")).getByText("faz 29")).toBeInTheDocument();

    fireEvent.click(within(comeco()).getByRole("button", { name: "Pai" }));
    fireEvent.click(within(comeco()).getByRole("button", { name: "Guardar" }));
    expect(lista(store, "rel-people")[2]).toMatchObject({ name: "Pai", birthday: "" });
    expect(within(comeco()).getByText("Pronto, suas pessoas estão guardadas.")).toBeInTheDocument();
    fireEvent.click(within(comeco()).getByRole("button", { name: "Fechar" }));
    expect(store.estado.dados["rel-comeco-visto"]).toBe(true);

    tela.unmount();
    abrir(store);
    expect(screen.queryByTestId("comeco-pronto")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("lista-pessoas")).getAllByRole("button")).toHaveLength(3);
  });

  it("data que não existe não grava (31 de abril)", () => {
    const store = criarStore({ ...BASE });
    abrir(store);
    const comeco = screen.getByTestId("comeco-pronto");
    fireEvent.click(within(comeco).getByRole("button", { name: "Pai" }));
    fireEvent.change(within(comeco).getByLabelText("Mês do aniversário"), { target: { value: "4" } });
    // o seletor de dia só oferece até 30 em abril
    expect(within(comeco).queryByRole("option", { name: "31" })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ manter contato */

describe("faz tempo que… → Falei hoje → Desfazer", () => {
  const dados: Dados = {
    ...BASE,
    "rel-people": [{ id: "carol", name: "Carol", relation: "Amiga da faculdade", birthday: "", cadencia: 14, cadenciaDesde: "2026-06-01" }],
    "rel-moments": [{ id: "m1", date: "2026-08-24", person: "Carol", pessoaId: "carol", description: "Ela ia começar no emprego novo", tipo: "conversa" }],
  };

  it("registra a conversa de hoje (a pessoa sai da lista) e o Desfazer devolve", async () => {
    const store = criarStore(dados);
    abrir(store);
    const cartao = screen.getByTestId("faz-tempo");
    expect(within(cartao).getByText(/há 5 semanas/)).toBeInTheDocument();
    expect(within(cartao).getByText(/Ela ia começar no emprego novo/)).toBeInTheDocument();
    fireEvent.click(within(cartao).getByRole("button", { name: /Falei hoje/ }));
    const momentos = lista<Record<string, unknown>>(store, "rel-moments");
    expect(momentos[0]).toMatchObject({ date: "2026-09-29", person: "Carol", pessoaId: "carol", tipo: "conversa" });
    expect(screen.queryByTestId("faz-tempo")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(lista(store, "rel-moments")).toHaveLength(1);
    expect(screen.getByTestId("faz-tempo")).toBeInTheDocument();
  });

  it("na ficha: escolher 'Todo mês' grava a frequência; 'Não lembrar' tira", () => {
    const store = criarStore({ ...BASE, "rel-people": [{ id: "p", name: "Bia", relation: "", birthday: "" }] });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Bia" }));
    const ficha = screen.getByTestId("ficha-pessoa");
    fireEvent.click(within(ficha).getByRole("button", { name: "Todo mês" }));
    expect(lista(store, "rel-people")[0]).toMatchObject({ cadencia: 30, cadenciaDesde: "2026-09-29" });
    expect(within(ficha).getByTestId("proxima-conversa")).toHaveTextContent("Próximo lembrete em 30 dias.");
    fireEvent.click(within(ficha).getByRole("button", { name: "Não lembrar" }));
    expect(lista<Record<string, unknown>>(store, "rel-people")[0].cadencia).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ avisos */

describe("avisos ligados de dentro do módulo (nascem desligados)", () => {
  it("'no dia' grava só a chave nova; 'véspera' liga o mesmo interruptor da central sem apagar campo nenhum", () => {
    const store = criarStore({
      ...BASE,
      "rel-comeco-visto": true, // sem o começo pronto na tela, o convite pros avisos mora na seção de datas
      "rel-people": [{ id: "1", name: "Ju", relation: "amiga", birthday: "1997-10-02" }],
      "notif-prefs": { contas: false, campoDeOutroApp: 1 },
    });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: /Me avisa antes dos aniversários/ }));
    const folha = screen.getByTestId("folha-avisos");
    const noDia = within(folha).getByRole("switch", { name: "No dia, pra mandar os parabéns" });
    expect(noDia).toHaveAttribute("aria-checked", "false");
    fireEvent.click(noDia);
    expect(store.estado.dados["rel-lembrete-prefs"]).toMatchObject({ noDia: { ligado: true, hora: "09:00" }, contato: { ligado: false } });
    expect(store.estado.dados["notif-prefs"]).toEqual({ contas: false, campoDeOutroApp: 1 });

    fireEvent.click(within(folha).getByRole("switch", { name: "Na véspera do aniversário" }));
    expect(store.estado.dados["notif-prefs"]).toMatchObject({ contas: false, campoDeOutroApp: 1, aniversario: true, horaAniversario: 10 });
    // a prévia mostra o que o celular vai receber: a véspera (01/10) e o dia (02/10)
    const previa = within(folha).getByTestId("previa-avisos");
    expect(within(previa).getByText("🎂 Amanhã é aniversário de Ju")).toBeInTheDocument();
    expect(within(previa).getByText("🎂 Ju faz 29 anos hoje")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ presentes, datas, momentos */

describe("presentes, datas e momentos gravam no formato que o app antigo lê", () => {
  const dados: Dados = { ...BASE, "rel-people": [{ id: "ju", name: "Ju", relation: "Melhor amiga", birthday: "1997-10-02" }] };

  it("ideia de presente com preço → comprado → entregue", () => {
    const store = criarStore(dados);
    abrir(store, "/relacionamentos?aba=presentes");
    const form = screen.getByTestId("form-presente");
    fireEvent.change(within(form).getByLabelText("Pra quem"), { target: { value: "ju" } });
    fireEvent.change(within(form).getByLabelText("Preço"), { target: { value: "59,90" } });
    fireEvent.change(within(form).getByLabelText("Ideia de presente"), { target: { value: "A hora da estrela" } });
    fireEvent.click(within(form).getByRole("button", { name: /Guardar ideia/ }));
    expect(lista(store, "rel-gifts")[0]).toMatchObject({ person: "Ju", pessoaId: "ju", idea: "A hora da estrela", link: "", status: "idea", preco: 59.9 });
    const item = screen.getByRole("button", { name: /A hora da estrela: Ideia/ });
    fireEvent.click(item);
    expect(lista<Record<string, unknown>>(store, "rel-gifts")[0].status).toBe("bought");
    fireEvent.click(screen.getByRole("button", { name: /A hora da estrela: Comprado/ }));
    expect(lista<Record<string, unknown>>(store, "rel-gifts")[0].status).toBe("delivered");
  });

  it("data de casal e evento com tarefa", () => {
    const store = criarStore(dados);
    abrir(store, "/relacionamentos?aba=agenda");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar data especial/ }));
    const form = screen.getByTestId("form-data");
    fireEvent.change(within(form).getByLabelText("Nome da data"), { target: { value: "Namoro" } });
    fireEvent.change(within(form).getByLabelText("Data"), { target: { value: "2023-10-20" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar data" }));
    expect(lista(store, "rel-dates")[0]).toMatchObject({ title: "Namoro", date: "2023-10-20", type: "anniversary", person: "" });
    expect(within(screen.getByTestId("lista-datas")).getByText(/3 anos juntos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar evento/ }));
    const ev = screen.getByTestId("form-evento");
    fireEvent.change(within(ev).getByLabelText("Evento"), { target: { value: "Chá da Lu" } });
    fireEvent.change(within(ev).getByLabelText("Data do evento"), { target: { value: "2026-10-10" } });
    fireEvent.click(within(ev).getByRole("button", { name: "Guardar evento" }));
    expect(lista(store, "rel-events")[0]).toMatchObject({ name: "Chá da Lu", date: "2026-10-10", location: "", rsvp: "maybe", tasks: [] });
    fireEvent.change(screen.getByLabelText("Nova tarefa de Chá da Lu"), { target: { value: "Comprar fralda" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: /Comprar fralda/ }));
    expect((lista<{ tasks: { text: string; done: boolean }[] }>(store, "rel-events")[0].tasks)[0]).toMatchObject({ text: "Comprar fralda", done: true });
  });

  it("momento do tipo conversa conta como contato", () => {
    const store = criarStore(dados);
    abrir(store, "/relacionamentos?aba=momentos");
    const form = screen.getByTestId("form-momento");
    fireEvent.click(within(form).getByRole("button", { name: /Conversa/ }));
    fireEvent.change(within(form).getByLabelText("Com quem"), { target: { value: "ju" } });
    fireEvent.change(within(form).getByLabelText("O que aconteceu"), { target: { value: "Falamos da viagem" } });
    fireEvent.click(within(form).getByRole("button", { name: /Guardar/ }));
    expect(lista(store, "rel-moments")[0]).toMatchObject({ date: "2026-09-29", person: "Ju", pessoaId: "ju", description: "Falamos da viagem", tipo: "conversa" });
  });
});

/* ------------------------------------------------------------------ mensagens prontas e "o que lembrar" */

describe("mensagem pronta pelo WhatsApp e campos-sugestão", () => {
  const dados: Dados = {
    ...BASE,
    "rel-comeco-visto": true,
    "rel-people": [{ id: "carol", name: "Carol Souza", relation: "Amiga", birthday: "", cadencia: 14, cadenciaDesde: "2026-06-01" }],
  };
  afterEach(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(navigator, "share"); });

  it("sem Web Share (PC): abre o wa.me com o texto e NÃO anota conversa (não dá pra saber se mandou)", () => {
    const abrirJanela = vi.fn();
    vi.stubGlobal("open", abrirJanela);
    const store = criarStore(dados);
    abrir(store);
    fireEvent.click(within(screen.getByTestId("faz-tempo")).getByRole("button", { name: /Mandar um oi/ }));
    const folha = screen.getByTestId("folha-mensagem");
    expect(within(folha).getAllByRole("button", { name: /^Mandar:/ })).toHaveLength(3);
    fireEvent.click(within(folha).getByRole("button", { name: "Mandar: Bora marcar" }));
    return vi.waitFor(() => {
      expect(abrirJanela).toHaveBeenCalledTimes(1);
      const url = String(abrirJanela.mock.calls[0][0]);
      expect(url.startsWith("https://wa.me/?text=")).toBe(true);
      expect(decodeURIComponent(url.split("text=")[1])).toMatch(/^Oi, Carol! Faz um tempinho/);
      expect(lista(store, "rel-moments")).toHaveLength(0);
    });
  });

  it("com Web Share confirmado: anota a conversa de hoje sozinho e a pessoa sai do 'pra mandar um oi'", async () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => {}), configurable: true });
    const store = criarStore(dados);
    abrir(store);
    fireEvent.click(within(screen.getByTestId("faz-tempo")).getByRole("button", { name: /Mandar um oi/ }));
    fireEvent.click(within(screen.getByTestId("folha-mensagem")).getByRole("button", { name: "Mandar: Lembrei de você" }));
    await vi.waitFor(() => expect(lista(store, "rel-moments")[0]).toMatchObject({ pessoaId: "carol", tipo: "conversa", date: "2026-09-29", description: "Mandei um oi 💬" }));
    expect(screen.queryByTestId("faz-tempo")).not.toBeInTheDocument();
  });

  it("'+ Gosta de' começa uma linha na nota e salva ao sair do campo", () => {
    const store = criarStore({ ...dados, "rel-people": [{ id: "p", name: "Bia", relation: "", birthday: "", notes: "Tamanho: M" }] });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Bia" }));
    const ficha = screen.getByTestId("ficha-pessoa");
    expect(within(ficha).queryByRole("button", { name: "+ Tamanho" })).not.toBeInTheDocument(); // a linha já existe
    fireEvent.click(within(ficha).getByRole("button", { name: "+ Gosta de" }));
    const nota = within(ficha).getByLabelText("O que lembrar sobre Bia") as HTMLTextAreaElement;
    expect(nota.value).toBe("Tamanho: M\nGosta de: ");
    fireEvent.change(nota, { target: { value: "Tamanho: M\nGosta de: girassol" } });
    fireEvent.blur(nota);
    expect(lista(store, "rel-people")[0]).toMatchObject({ notes: "Tamanho: M\nGosta de: girassol" });
  });
});

/* ------------------------------------------------------------------ widget da Home */

describe("widget de Relações na Home (opcional)", () => {
  it("mostra as próximas datas e quem está esperando um oi; não grava nada", () => {
    const store = criarStore({
      "rel-people": [
        { id: "ju", name: "Ju", relation: "Amiga", birthday: "1997-10-02" },
        { id: "c", name: "Carol", relation: "Amiga", birthday: "", cadencia: 14, cadenciaDesde: "2026-06-01" },
      ],
    });
    render(<MemoryRouter><store.Provedor><RelacoesWidget size="large" /></store.Provedor></MemoryRouter>);
    const w = screen.getByTestId("widget-relacoes");
    expect(within(w).getByText("Ju")).toBeInTheDocument();
    expect(within(w).getByText("em 3 dias")).toBeInTheDocument();
    expect(within(w).getByText("Carol")).toBeInTheDocument();
    expect(store.estado.escritas).toEqual([]);
  });

  it("vazio: convida a guardar os aniversários", () => {
    const store = criarStore({});
    render(<MemoryRouter><store.Provedor><RelacoesWidget size="small" /></store.Provedor></MemoryRouter>);
    expect(screen.getByText("Guarde os aniversários de quem você ama")).toBeInTheDocument();
  });
});

// o act do React fica quieto: os toasts e os portais do Radix atualizam fora do evento
void act;
