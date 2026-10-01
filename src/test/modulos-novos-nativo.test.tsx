/**
 * PET, RELAÇÕES e BELEZA NO APP DA LOJA (01/10, iPhone 1.0.9 / Android 126):
 * os três módulos refeitos entram nesta versão. Aqui o caminho que só existe
 * no app é exercitado de ponta a ponta com o plugin de notificações SIMULADO:
 *  - ligar o aviso dentro do módulo pede a permissão (uma vez) e AGENDA de
 *    verdade, com ids na faixa própria de cada módulo e rota de toque que existe;
 *  - permissão negada: nada agendado e nada quebra;
 *  - o reagendamento geral (boot do app) inclui os três sem invadir faixa alheia.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  pendentes: [] as Array<{ id: number; title?: string; extra?: { rota?: string } }>,
  pedidos: 0,
  schedule: vi.fn(async (x: { notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra?: { rota?: string } }> }) => {
    for (const n of x.notifications) ln.pendentes.push({ id: n.id, title: n.title, extra: n.extra });
    return {};
  }),
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => { ln.pedidos++; if (ln.permissao === "prompt") ln.permissao = "granted"; return { display: ln.permissao }; },
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.pendentes }),
    cancel: async (x: { notifications: Array<{ id: number }> }) => { const ids = new Set(x.notifications.map((n) => n.id)); ln.pendentes = ln.pendentes.filter((n) => !ids.has(n.id)); },
    schedule: (x: Parameters<typeof ln.schedule>[0]) => ln.schedule(x),
  },
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, subLoaded: true, loading: false }) }));
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Pet from "@/pages/Pet";
import Relacionamentos from "@/pages/Relacionamentos";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { BASES_LEMBRETES, FAIXAS_AVULSAS } from "@/lib/notificacoes";
import { reagendarTudo, lerDadosDosLembretes } from "@/lib/reagendar";
import { lerPrefs } from "@/lib/prefs-notificacoes";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados };
  const get = <T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f);
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const getR = useCallback(<T,>(k: string, f: T): T => get(k, f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get: getR, set, loaded: true, isGuest: false, fetchKey: async () => null }), [getR, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, get, Provedor };
}
const abrir = (store: ReturnType<typeof criarStore>, rota: string, ui: ReactNode) =>
  render(<MemoryRouter initialEntries={[rota]}><store.Provedor>{ui}</store.Provedor></MemoryRouter>);

const LARGURA = 10000;
const naFaixa = (id: number, base: number) => id >= base && id < base + LARGURA;
const ROTAS_DO_APP = ["/pet", "/relacionamentos", "/beleza"];
const rotaExiste = (rota?: string) => !!rota && ROTAS_DO_APP.some((r) => rota === r || rota.startsWith(`${r}?`) || rota.startsWith(`${r}/`));

const PET = {
  "spotlight-done-pet": "true", "core-tip-seen-pet": "true",
  "pet-list": [{ id: "p1", name: "Caramelo", species: "Cachorro", breed: "Vira-lata", weight: "18,4", birthday: "2023-07-20", sexo: "macho" }],
  "pet-cuidados": [{ id: "c-pulga", petId: "p1", tipo: "antipulgas", nome: "NexGard", intervaloDias: 30 }],
  "pet-health": [{ id: "r5", petId: "p1", type: "antipulgas", name: "NexGard", date: "2026-09-10", nextDate: "2026-10-10", cuidadoId: "c-pulga" }],
  "core-home-widgets-v2": [{ id: "pet", size: "large" }],
};
const RELACOES = {
  "spotlight-done-relacionamentos": "true", "core-tip-seen-relacionamentos": "true",
  "rel-comeco-visto": true,
  "rel-people": [{ id: "1", name: "Ju", relation: "amiga", birthday: "1997-10-02" }],
};

beforeEach(() => {
  ln.permissao = "granted"; ln.pendentes = []; ln.pedidos = 0; ln.schedule.mockClear(); eventos.length = 0;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 10, 0)); // terça 29/09/2026 10:00
});
afterEach(() => { vi.useRealTimers(); cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("Pet no app", () => {
  it("ligar 'Vacina, vermífugo, antipulgas' agenda no celular: ids na faixa do pet, toque abre /pet", async () => {
    const store = criarStore(PET);
    abrir(store, "/pet", <Pet />);
    fireEvent.click(screen.getByTestId("aba-saude"));
    fireEvent.click(screen.getByRole("switch", { name: "Avisos de vacina, vermífugo e antipulgas" }));
    await waitFor(() => expect(ln.schedule).toHaveBeenCalled());
    // o rearme é geral (reagendarTudo): os do pet ficam na faixa do pet; o resto (retrospectiva etc.) nas suas
    const doPet = ln.pendentes.filter((n) => naFaixa(n.id, BASES_LEMBRETES.pet));
    expect(doPet.length).toBeGreaterThan(0);
    for (const n of doPet) expect(rotaExiste(n.extra?.rota), `rota ${n.extra?.rota}`).toBe(true);
    expect(doPet.some((n) => /NexGard|antipulgas/i.test(n.title ?? ""))).toBe(true);
    const faixasConhecidas = Object.values(BASES_LEMBRETES);
    for (const n of ln.pendentes) expect(faixasConhecidas.some((b) => naFaixa(n.id, b)), `${n.id} ${n.title}`).toBe(true);
    expect(store.estado.dados["pet-lembrete-prefs"]).toMatchObject({ cuidados: true });
  });

  it("permissão nunca pedida: pede no 1º 'ligar' (uma vez) e agenda; negada: nada agendado, nada quebra", async () => {
    ln.permissao = "prompt";
    const store = criarStore(PET);
    abrir(store, "/pet", <Pet />);
    fireEvent.click(screen.getByTestId("aba-saude"));
    fireEvent.click(screen.getByRole("switch", { name: "Avisos de vacina, vermífugo e antipulgas" }));
    await waitFor(() => expect(ln.schedule).toHaveBeenCalled());
    expect(ln.pedidos).toBe(1);
    expect(eventos).toContainEqual(["pet_avisos_permissao", expect.objectContaining({ concedida: true })]);
    cleanup();

    ln.permissao = "denied"; ln.pendentes = []; ln.schedule.mockClear();
    const store2 = criarStore(PET);
    abrir(store2, "/pet", <Pet />);
    fireEvent.click(screen.getByTestId("aba-saude"));
    fireEvent.click(screen.getByRole("switch", { name: "Avisos de vacina, vermífugo e antipulgas" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(store2.estado.dados["pet-lembrete-prefs"]).toMatchObject({ cuidados: true }); // a preferência fica; o sistema é que não deixa
  });
});

describe("Relações no app", () => {
  it("'No dia' agenda o aniversário na faixa de Relações, com toque pro módulo", async () => {
    const store = criarStore(RELACOES);
    abrir(store, "/relacionamentos", <Relacionamentos />);
    fireEvent.click(screen.getByRole("button", { name: /Me avisa antes dos aniversários/ }));
    const folha = screen.getByTestId("folha-avisos");
    fireEvent.click(within(folha).getByRole("switch", { name: "No dia, pra mandar os parabéns" }));
    await waitFor(() => expect(ln.pendentes.some((n) => naFaixa(n.id, BASES_LEMBRETES.relacoes))).toBe(true), { timeout: 4000 });
    const deRelacoes = ln.pendentes.filter((n) => naFaixa(n.id, BASES_LEMBRETES.relacoes));
    expect(deRelacoes.length).toBeGreaterThan(0);
    expect(deRelacoes.some((n) => /Ju/.test(n.title ?? ""))).toBe(true);
    for (const n of deRelacoes) expect(rotaExiste(n.extra?.rota), `rota ${n.extra?.rota}`).toBe(true);
    // nenhum id caiu nas faixas das régua (teste, missão, resgate, lembrete do teste)
    for (const n of ln.pendentes) for (const base of Object.values(FAIXAS_AVULSAS)) expect(naFaixa(n.id, base)).toBe(false);
  });
});

describe("Beleza no app", () => {
  it("rotina pronta em 3 toques + 'Ligar' o lembrete: manhã e noite agendadas na faixa de beleza, toque abre /beleza", async () => {
    vi.setSystemTime(new Date(2026, 8, 28, 9, 40)); // segunda
    const store = criarStore({});
    abrir(store, "/beleza", <SkincareRoutine />);
    fireEvent.click(screen.getByTestId("opcao-mista"));
    fireEvent.click(screen.getByTestId("opcao-manchas"));
    fireEvent.click(screen.getByTestId("opcao-intermediario"));
    fireEvent.click(within(screen.getByTestId("postit-lembrete")).getByRole("button", { name: "Ligar" }));
    await waitFor(() => expect(ln.schedule).toHaveBeenCalled());
    const deBeleza = ln.pendentes.filter((n) => naFaixa(n.id, BASES_LEMBRETES.beleza));
    expect(deBeleza.length).toBeGreaterThanOrEqual(2);
    expect(deBeleza.some((n) => /☀️|manhã/i.test(n.title ?? ""))).toBe(true);
    expect(deBeleza.some((n) => /🌙|noite/i.test(n.title ?? ""))).toBe(true);
    for (const n of deBeleza) expect(rotaExiste(n.extra?.rota), `rota ${n.extra?.rota}`).toBe(true);
    expect(store.estado.dados["skincare-lembrete-prefs"]).toEqual({ manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } });
  });
});

describe("reagendamento geral do app (boot) com os três módulos", () => {
  it("reagendarTudo agenda pet + relações + beleza juntos, cada um na sua faixa, sem invadir as régua", async () => {
    const store = criarStore({
      ...PET, ...RELACOES,
      "pet-lembrete-prefs": { cuidados: true, remedios: true, hora: 10, antes: 1 },
      "rel-lembrete-prefs": { noDia: { ligado: true, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: false, hora: "19:30" } },
      "skincare-am-steps": [{ id: "a1", name: "Limpeza", order: 0 }], "skincare-pm-steps": [{ id: "p1", name: "Hidratante", order: 0 }],
      "skincare-lembrete-prefs": { manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } },
    });
    const dados = lerDadosDosLembretes(store.get);
    expect(dados.pet).toBeTruthy();
    expect(dados.relacoes).toBeTruthy();
    expect(dados.skincare).toBeTruthy();
    const contagem = await reagendarTudo(store.get, lerPrefs(store.get("notif-prefs", undefined)));
    expect(contagem.pet).toBeGreaterThan(0);
    expect(contagem.relacoes).toBeGreaterThan(0);
    expect(contagem.beleza).toBeGreaterThan(0);
    for (const n of ln.pendentes) {
      const faixas = [BASES_LEMBRETES.pet, BASES_LEMBRETES.relacoes, BASES_LEMBRETES.beleza];
      const outras = Object.entries(BASES_LEMBRETES).filter(([k]) => !["pet", "relacoes", "beleza"].includes(k)).map(([, b]) => b);
      expect(faixas.some((b) => naFaixa(n.id, b)) || outras.some((b) => naFaixa(n.id, b)), `${n.id}`).toBe(true);
      for (const base of Object.values(FAIXAS_AVULSAS)) expect(naFaixa(n.id, base), `${n.id} invade régua ${base}`).toBe(false);
    }
  });
});
