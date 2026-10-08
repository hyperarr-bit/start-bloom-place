/**
 * CHAMADOS DE 08/10 — os três defeitos.
 *
 *  2) Android (S23 / Android 14): "não está chegando notificação". Todo
 *     agendamento vai com allowWhileIdle (acorda o aparelho) e a central mostra
 *     o atalho do alarme exato quando o Android o nega.
 *  3) Site: "Failed to fetch dynamically imported module" depois do deploy —
 *     recarrega UMA vez por sessão, nunca sem rede, e qualquer um dos três
 *     caminhos (preloadError, boundary, erro solto) obedece à mesma trava.
 *
 * (O 1 — cabeçalho de Finanças tremendo no iPhone — está em
 * spotlight-rolagem.test.tsx: a parte que dá pra provar em jsdom.)
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  exato: "denied" as "granted" | "denied",
  aberturas: 0,
  agendados: [] as Array<{ id: number; schedule: { at: Date; allowWhileIdle?: boolean } }>,
  rejeitar: null as string | null,
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => ({ display: ln.permissao }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.agendados }),
    cancel: async () => {},
    schedule: async (x: { notifications: typeof ln.agendados }) => {
      if (ln.rejeitar) throw new Error(ln.rejeitar);
      ln.agendados.push(...x.notifications);
      return {};
    },
    checkExactNotificationSetting: async () => ({ exact_alarm: ln.exato }),
    changeExactNotificationSetting: async () => { ln.aberturas++; ln.exato = "granted"; return { exact_alarm: ln.exato }; },
    getDeliveredNotifications: async () => ({ notifications: [] }),
  },
}));
const plataforma = vi.hoisted(() => ({ nativo: true, android: true }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isAndroid: () => plataforma.android,
  isIOS: () => plataforma.nativo && !plataforma.android,
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
import { agendarContas, agendarRetrospectiva, agendarRotina, estadoAlarmeExato } from "@/lib/notificacoes";
import { ehErroDeChunk, esquecerRecargaPorChunk, recarregarPorChunkNovo, ultimaRecargaPorChunk } from "@/lib/chunk-novo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import Notificacoes from "@/pages/Notificacoes";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}

beforeEach(() => {
  ln.permissao = "granted"; ln.exato = "denied"; ln.aberturas = 0; ln.agendados = []; ln.rejeitar = null;
  plataforma.nativo = true; plataforma.android = true;
  eventos.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 8, 10, 0));
});
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); esquecerRecargaPorChunk(); });

describe("2) Android — lembretes que não chegam", () => {
  it("TODO agendamento de módulo vai com allowWhileIdle (acorda o aparelho em Doze)", async () => {
    const n1 = await agendarRotina({ marcados: new Set(), sequencia: 0 }, { hora: 21, ligado: true });
    const n2 = await agendarContas([{ day: 15, bills: [{ id: "b1", name: "Luz", paid: false }] }], { hora: 9, ligado: true });
    const n3 = await agendarRetrospectiva(true);
    expect(n1).toBeGreaterThan(0);
    expect(n2).toBeGreaterThan(0);
    expect(n3).toBeGreaterThan(0);
    expect(ln.agendados.length).toBe(n1 + n2 + n3);
    const semIdle = ln.agendados.filter((a) => a.schedule.allowWhileIdle !== true);
    expect(semIdle).toEqual([]);
  });

  it("schedule rejeitado (canal desligado) vira UM evento com o motivo, e devolve 0 sem quebrar", async () => {
    ln.rejeitar = "Notifications not enabled on this device";
    const a = await agendarRotina({ marcados: new Set(), sequencia: 0 }, { hora: 21, ligado: true });
    const b = await agendarRotina({ marcados: new Set(), sequencia: 0 }, { hora: 21, ligado: true });
    expect(a).toBe(0);
    expect(b).toBe(0);
    const falhas = eventos.filter(([n]) => n === "notif_agendar_falhou");
    expect(falhas).toHaveLength(1);
    expect(String(falhas[0][1]?.motivo)).toMatch(/not enabled/);
  });

  it("estadoAlarmeExato: lê do plugin no Android; 'indisponivel' no iPhone", async () => {
    expect(await estadoAlarmeExato()).toBe("denied");
    ln.exato = "granted";
    expect(await estadoAlarmeExato()).toBe("granted");
    plataforma.android = false;
    expect(await estadoAlarmeExato()).toBe("indisponivel");
  });

  it("central: alarme exato negado mostra 'Lembretes podem atrasar' com o atalho; tocar abre a tela do sistema e a caixa some", async () => {
    const store = criarStore({});
    render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
    const caixa = await screen.findByTestId("alarme-exato-negado");
    expect(caixa.textContent).toMatch(/Lembretes podem atrasar/);
    expect(caixa.textContent).toMatch(/Alarmes e lembretes/);
    fireEvent.click(screen.getByRole("button", { name: /Liberar na hora certa/ }));
    await waitFor(() => expect(ln.aberturas).toBe(1));
    await waitFor(() => expect(screen.queryByTestId("alarme-exato-negado")).toBeNull());
    expect(eventos.some(([n]) => n === "notif_alarme_exato_abrir")).toBe(true);
  });

  it("central: sem permissão de aviso a caixa do alarme exato NÃO aparece (o bloqueio é o problema maior); no iPhone nunca", async () => {
    ln.permissao = "denied";
    const store = criarStore({});
    const { unmount } = render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
    expect(await screen.findByText(/Notificações bloqueadas/)).toBeTruthy();
    expect(screen.queryByTestId("alarme-exato-negado")).toBeNull();
    unmount();

    ln.permissao = "granted"; plataforma.android = false;
    render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
    await screen.findByText(/Conta a vencer/);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("alarme-exato-negado")).toBeNull();
  });

  it("central: ao voltar das configurações (visibilitychange) relê o estado", async () => {
    ln.permissao = "denied";
    const store = criarStore({});
    render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
    expect(await screen.findByText(/Notificações bloqueadas/)).toBeTruthy();
    ln.permissao = "granted";
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(screen.queryByText(/Notificações bloqueadas/)).toBeNull());
  });
});

describe("3) Site — chunk que sumiu depois do deploy", () => {
  const mensagens = [
    "Failed to fetch dynamically imported module: https://x/assets/Index-abc.js", // Chrome
    "Importing a module script failed.", // Safari
    "'text/html' is not a valid JavaScript MIME type.", // index.html no lugar do JS
    "Unable to preload CSS for /assets/Index-abc.css",
    "Cannot read properties of undefined (reading 'default')",
  ];
  it.each(mensagens)("reconhece: %s", (m) => { expect(ehErroDeChunk(m)).toBe(true); });
  it("não confunde crash comum com chunk", () => {
    expect(ehErroDeChunk("Cannot read properties of null (reading 'value')")).toBe(false);
    expect(ehErroDeChunk("Network request failed")).toBe(false);
  });

  const prepararNavegacao = () => {
    const replace = vi.fn(); const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "https://core.app/financas?x=1", replace, reload, pathname: "/financas", search: "?x=1" },
    });
    return { replace, reload };
  };

  it("recarrega UMA vez por sessão, com cache-buster; a 2ª vez se cala", () => {
    const { replace } = prepararNavegacao();
    expect(ultimaRecargaPorChunk()).toBe(0);
    expect(recarregarPorChunkNovo()).toBe("recarregando");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(String(replace.mock.calls[0][0])).toMatch(/\/financas\?x=1&core-cb=\d+/);
    expect(ultimaRecargaPorChunk()).toBeGreaterThan(0);
    // segunda falha na MESMA sessão (ex.: o build novo também falhou): nada — sem loop
    expect(recarregarPorChunkNovo()).toBe("ja-recarregou");
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("sem rede não recarrega (a mesma mensagem sai quando a conexão caiu)", () => {
    const { replace, reload } = prepararNavegacao();
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(recarregarPorChunkNovo()).toBe("sem-rede");
    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(ultimaRecargaPorChunk()).toBe(0); // e não gasta a vez
    onLine.mockRestore();
  });

  it("RouteErrorBoundary: erro de chunk → 'Atualizando o app…' e a recarga única; na 2ª vez mostra 'Nova versão' com o botão", async () => {
    const { replace } = prepararNavegacao();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Quebra = (): never => { throw new Error("Failed to fetch dynamically imported module: /assets/Casa-1.js"); };
    const { unmount } = render(<RouteErrorBoundary routeName="casa"><Quebra /></RouteErrorBoundary>);
    expect(await screen.findByText(/Atualizando o app/)).toBeTruthy();
    expect(replace).toHaveBeenCalledTimes(1);
    const evento = eventos.find(([n]) => n === "route_error");
    expect(evento?.[1]?.chunk).toBe(true);
    unmount();

    render(<RouteErrorBoundary routeName="casa"><Quebra /></RouteErrorBoundary>);
    expect(await screen.findByText(/Nova versão do app disponível/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Recarregar agora/ })).toBeTruthy();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
