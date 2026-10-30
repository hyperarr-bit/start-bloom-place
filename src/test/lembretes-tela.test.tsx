/**
 * A TELA DE LEMBRETES NOVA (29/10, direção A6 aprovada pelo dono): só a ARRUMAÇÃO mudou.
 *  · nenhum dos 24 interruptores de antes sumiu (a lista de títulos antiga, um por um);
 *  · Essenciais pelo uso real, nessa ordem; o resto por módulo, sanfona onde há mais de 1;
 *  · Aniversários em Relações = as 3 chaves que já existiam (notif-prefs.aniversario e rel-lembrete-prefs.semana/noDia);
 *  · o 1º toque sem permissão PEDE a permissão (e negar não grava);
 *  · as chaves gravadas e os eventos notif_pref são os de sempre; o horário muda na folha.
 */
process.env.TZ = "America/Sao_Paulo";

import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  resposta: "granted" as "granted" | "denied",
  pedidos: 0,
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => { ln.pedidos++; ln.permissao = ln.resposta; return { display: ln.resposta }; },
    createChannel: async () => {},
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    schedule: async () => ({}),
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getDeliveredNotifications: async () => ({ notifications: [] }),
  },
}));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => true,
  isAndroid: () => false,
  isIOS: () => true,
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown> | undefined]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d?: Record<string, unknown>) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, subLoaded: true, loading: false }) }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_PREFS, PREFS_PADRAO } from "@/lib/prefs-notificacoes";
import { CHAVE_REMEDIOS_LIGADO } from "@/lib/reagendar";
import { CHAVE_AVISO_CONSULTAS } from "@/lib/consulta-avisos";
import { CHAVE_LEMBRETE_SKINCARE } from "@/lib/beleza-lembrete";
import { CHAVE_LEMBRETE_CABELO } from "@/lib/beleza-cabelo";
import { CHAVE_CUIDADOS } from "@/lib/beleza-cuidados";
import { CHAVE_LEMBRETE_VALIDADE } from "@/lib/beleza-produtos";
import { CHAVE_LEMBRETE_ROTINA_MANHA } from "@/lib/rotina-manha";
import { CHAVE_LEMBRETE as CHAVE_LEMBRETE_PET } from "@/lib/pet";
import { CHAVE_LEMBRETE_RELACOES } from "@/lib/relacoes-lembrete";
import { ESSENCIAIS, GRUPOS, IDS_LEMBRETES, itensDoGrupo, ordemNaTela } from "@/lib/lembretes-tela";
import Notificacoes from "@/pages/Notificacoes";

/** Os 24 títulos (aria-label dos interruptores) da central ANTES da A6 — nenhum pode sumir. */
const TITULOS_ANTIGOS = [
  "Conta a vencer", "Retrospectiva do mês", "Primeira semana", "Remédios e vitaminas", "Consultas médicas",
  "Aniversário chegando", "Parabéns no dia", "Aniversário daqui a uma semana", "Pra mandar um oi", "Compromissos",
  "Tarefas com horário", "Cuidados do pet", "Manutenção da casa", "Limite do dia", "Sequência", "Skincare", "Cabelo",
  "Cuidados", "Validade dos produtos", "Rotina de manhã", "Fechamento do dia", "Dia de treino", "Hora de ler", "Diário da dieta",
];

function criarStore(inicial: Record<string, unknown>) {
  const estado = { dados: { ...inicial } as Record<string, unknown> };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}
const abrir = (dados: Record<string, unknown> = {}) => {
  const store = criarStore(dados);
  render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
  return store;
};
const abrirGrupo = async (id: string) => {
  const g = await screen.findByTestId(`grupo-${id}`);
  if (!g.dataset.aberto) fireEvent.click(within(g).getByRole("button", { expanded: false }));
  return screen.getByTestId(`grupo-${id}`);
};
const abrirTodos = async () => {
  for (const g of GRUPOS) if (itensDoGrupo(g).length > 1) await abrirGrupo(g.id);
};
const chave = (nome: string) => screen.getByRole("switch", { name: nome });
const notifPrefs = () => (eventos.filter(([n]) => n === "notif_pref").map(([, d]) => d));

beforeEach(() => { ln.permissao = "granted"; ln.resposta = "granted"; ln.pedidos = 0; eventos.length = 0; });
afterEach(() => cleanup());

describe("a arrumação (lib/lembretes-tela)", () => {
  it("cada um dos 24 ids aparece UMA vez na tela (essenciais + grupos)", () => {
    const ordem = ordemNaTela();
    expect(IDS_LEMBRETES).toHaveLength(24);
    expect(ordem).toHaveLength(24);
    expect(new Set(ordem)).toEqual(new Set(IDS_LEMBRETES));
  });
  it("Essenciais pelo uso real, nessa ordem; Aniversários (3) num bloco em Relações", () => {
    expect(ESSENCIAIS).toEqual(["remedios", "contas", "rotina", "compromissos"]);
    const rel = GRUPOS.find((g) => g.id === "relacionamentos")!;
    expect(rel.blocos[0]).toEqual({ titulo: "Aniversários", itens: ["rel_semana", "aniversario", "rel_noDia"] });
  });
});

describe("na tela", () => {
  it("nenhum lembrete de antes sumiu: os 24 interruptores com os mesmos nomes", async () => {
    abrir();
    await screen.findByTestId("lembretes-essenciais");
    await abrirTodos();
    for (const t of TITULOS_ANTIGOS) expect(chave(t)).toBeTruthy();
    expect(screen.getAllByRole("switch")).toHaveLength(24);
  });

  it("os padrões de sempre: 7 ligados numa conta vazia; essenciais na ordem", async () => {
    abrir();
    expect((await screen.findByTestId("lembretes-ligados")).textContent).toBe("7 ligados");
    const ess = screen.getByTestId("lembretes-essenciais");
    expect(within(ess).getAllByRole("switch").map((s) => s.getAttribute("aria-label"))).toEqual(["Remédios e vitaminas", "Conta a vencer", "Fechamento do dia", "Compromissos"]);
    expect(within(ess).getAllByRole("switch").map((s) => s.getAttribute("aria-checked"))).toEqual(["true", "true", "false", "true"]);
  });

  it("grupo fechado mostra a contagem; módulo de 1 lembrete tem o interruptor direto", async () => {
    abrir();
    expect((await screen.findByTestId("grupo-core-conta")).textContent).toBe("2 de 3");
    expect(screen.getByTestId("grupo-beleza-conta").textContent).toBe("desligados");
    expect(screen.queryByRole("switch", { name: "Skincare" })).toBeNull(); // fechado
    expect(chave("Dia de treino")).toBeTruthy(); // Treino: 1 lembrete, sem sanfona
  });

  it("Aniversários: as 3 opções gravam nas 3 chaves de sempre, com os mesmos eventos", async () => {
    const store = abrir();
    const g = await abrirGrupo("relacionamentos");
    expect(within(g).getByText("Aniversários")).toBeTruthy();
    expect(within(g).getByText("1 semana antes")).toBeTruthy();
    expect(within(g).getByText("Na véspera")).toBeTruthy();
    expect(within(g).getByText("No dia")).toBeTruthy();

    fireEvent.click(chave("Aniversário chegando"));
    await waitFor(() => expect((store.estado.dados[CHAVE_PREFS] as { aniversario: boolean })?.aniversario).toBe(true));
    fireEvent.click(chave("Parabéns no dia"));
    await waitFor(() => expect((store.estado.dados[CHAVE_LEMBRETE_RELACOES] as { noDia: { ligado: boolean } })?.noDia.ligado).toBe(true));
    fireEvent.click(chave("Aniversário daqui a uma semana"));
    await waitFor(() => expect((store.estado.dados[CHAVE_LEMBRETE_RELACOES] as { semana: { ligado: boolean } })?.semana.ligado).toBe(true));
    expect(notifPrefs()).toEqual([{ campo: "aniversario", valor: true }, { campo: "rel_noDia", valor: true }, { campo: "rel_semana", valor: true }]);
    await waitFor(() => expect(screen.getByTestId("grupo-relacionamentos-conta").textContent).toBe("3 de 4"));
  });

  it("1º toque sem permissão PEDE; aceitar grava, negar não grava", async () => {
    ln.permissao = "prompt"; ln.resposta = "denied";
    const store = abrir();
    await screen.findByTestId("lembretes-essenciais");
    await waitFor(() => expect(chave("Fechamento do dia")).toBeTruthy());
    fireEvent.click(chave("Fechamento do dia"));
    await waitFor(() => expect(ln.pedidos).toBe(1));
    await new Promise((r) => setTimeout(r, 30));
    expect((store.estado.dados[CHAVE_PREFS] as { rotina?: boolean } | undefined)?.rotina).not.toBe(true);
    cleanup();

    ln.permissao = "prompt"; ln.resposta = "granted"; ln.pedidos = 0;
    const store2 = abrir();
    await screen.findByTestId("lembretes-essenciais");
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(chave("Fechamento do dia"));
    await waitFor(() => expect(ln.pedidos).toBe(1));
    await waitFor(() => expect((store2.estado.dados[CHAVE_PREFS] as { rotina: boolean }).rotina).toBe(true));
  });

  it("o horário muda na folha (mesma chave horaRotina) e a folha traz o texto completo de antes", async () => {
    const store = abrir();
    fireEvent.click(await screen.findByRole("button", { name: /Horário: Fechamento do dia, 21:00/ }));
    const folha = await screen.findByTestId("folha-lembrete");
    expect(within(folha).getByText(/Se você já marcou, o aviso do dia não vem/)).toBeTruthy();
    fireEvent.click(within(folha).getByRole("radio", { name: "18:00" }));
    await waitFor(() => expect((store.estado.dados[CHAVE_PREFS] as { horaRotina: number }).horaRotina).toBe(18));
    fireEvent.click(within(folha).getByRole("button", { name: "Pronto" }));
    await waitFor(() => expect(screen.queryByTestId("folha-lembrete")).toBeNull());
  });

  it("horário escolhido no módulo (Relações) só aparece, sem seletor", async () => {
    abrir();
    await abrirGrupo("relacionamentos");
    fireEvent.click(screen.getByRole("button", { name: /Horário: Parabéns no dia, 09:00/ }));
    const folha = await screen.findByTestId("folha-lembrete");
    expect(within(folha).queryAllByRole("radio")).toHaveLength(0);
    expect(within(folha).getByText(/O horário muda em Relações → Avisos/)).toBeTruthy();
  });
});

describe("as chaves gravadas não mudaram", () => {
  it("os nomes de sempre", () => {
    expect({
      CHAVE_PREFS, CHAVE_REMEDIOS_LIGADO, CHAVE_AVISO_CONSULTAS, CHAVE_LEMBRETE_SKINCARE, CHAVE_LEMBRETE_CABELO, CHAVE_CUIDADOS,
      CHAVE_LEMBRETE_VALIDADE, CHAVE_LEMBRETE_ROTINA_MANHA, CHAVE_LEMBRETE_PET, CHAVE_LEMBRETE_RELACOES,
    }).toEqual({
      CHAVE_PREFS: "notif-prefs", CHAVE_REMEDIOS_LIGADO: "notif-remedios-ligado", CHAVE_AVISO_CONSULTAS: "notif-consultas-ligado",
      CHAVE_LEMBRETE_SKINCARE: "skincare-lembrete-prefs", CHAVE_LEMBRETE_CABELO: "cabelo-lembrete-prefs", CHAVE_CUIDADOS: "beleza-cuidados",
      CHAVE_LEMBRETE_VALIDADE: "beleza-validade-prefs", CHAVE_LEMBRETE_ROTINA_MANHA: "rotina-lembrete-manha-prefs",
      CHAVE_LEMBRETE_PET: "pet-lembrete-prefs", CHAVE_LEMBRETE_RELACOES: "rel-lembrete-prefs",
    });
  });
  it("os padrões de sempre", () => {
    const { contas, retrospectiva, compromissos, tarefas, primeiraSemana, rotina, treino, leitura, dieta, aniversario, casa, limite, sequencia } = PREFS_PADRAO;
    expect({ contas, retrospectiva, compromissos, tarefas, primeiraSemana }).toEqual({ contas: true, retrospectiva: true, compromissos: true, tarefas: true, primeiraSemana: true });
    expect([rotina, treino, leitura, dieta, aniversario, casa, limite, sequencia].every((x) => x === false)).toBe(true);
  });
  it("ligar um de cada família grava só na chave dele", async () => {
    const store = abrir();
    await abrirTodos();
    fireEvent.click(chave("Skincare"));
    await waitFor(() => expect(store.estado.dados[CHAVE_LEMBRETE_SKINCARE]).toBeTruthy());
    fireEvent.click(chave("Remédios e vitaminas"));
    await waitFor(() => expect(store.estado.dados[CHAVE_REMEDIOS_LIGADO]).toBe(false));
    fireEvent.click(chave("Cuidados do pet"));
    await waitFor(() => expect(store.estado.dados[CHAVE_LEMBRETE_PET]).toMatchObject({ cuidados: true, remedios: true }));
    expect(Object.keys(store.estado.dados).sort()).toEqual([CHAVE_LEMBRETE_PET, CHAVE_REMEDIOS_LIGADO, CHAVE_LEMBRETE_SKINCARE].sort());
    expect(notifPrefs()).toEqual([{ campo: "skincare", valor: true }, { campo: "remedios", valor: false }, { campo: "pet", valor: true }]);
  });
});
