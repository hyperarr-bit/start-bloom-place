/**
 * 1.0.17 (parte 1) — consertos do vídeo do dono (19/10):
 *  · o tour da Home não decide antes de a missão existir (a piscada "Home + PASSO 1 DE 5" antes do "Tá dentro!");
 *  · a saudação usa o nome digitado no cadastro, não o começo do e-mail (migração de "user-name");
 *  · a intro da Mente não promete "ou escreve o seu" (não há campo).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const nativo = vi.hoisted(() => ({ v: true }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => nativo.v,
  plataformaApp: () => (nativo.v ? "ios" : "web"),
}));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn() }));

import { deveMostrarTourHome, CHAVE_TOUR_FEITO, _novaAberturaDoTour } from "@/lib/tour-home";
import { CHAVE_ESTADO_MISSAO_DOSES, gravarMissao, iniciarMissao } from "@/lib/missao-doses";
import { nomeDaHome, nomeParaMigrar } from "@/lib/nome-da-pessoa";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { INTROS } from "@/lib/intro-modulo";
import { localDayKey } from "@/lib/utils";

describe("tour da Home espera a missão nascer (1.0.17)", () => {
  const agora = Date.now();
  const novo = new Date(agora - 600e3).toISOString();
  const antigo = new Date(agora - 5 * 86400e3).toISOString();
  beforeEach(() => {
    localStorage.clear();
    nativo.v = true;
    _novaAberturaDoTour();
    vi.stubEnv("VITE_V14_LOJA", "1"); // o binário de loja: tour ligado
  });
  afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); });

  it("conta nova no app, missão ainda NÃO nasceu → não mostra (nem o tour longo)", () => {
    expect(localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)).toBeNull();
    expect(deveMostrarTourHome(novo, agora)).toBe(false);
  });

  it("a missão nasce com dose por fazer → segue esperando; cumprida e vista → mostra", () => {
    const m = iniciarMissao(["financas", "rotina", "saude"]);
    expect(deveMostrarTourHome(novo, agora)).toBe(false);
    const hoje = localDayKey();
    const feitos = { 1: { dia: hoje, rotulo: "a" }, 2: { dia: hoje, rotulo: "b" }, 3: { dia: hoje, rotulo: "c" } };
    gravarMissao({ ...m, boasVindas: true, feitos, fimVisto: true });
    expect(deveMostrarTourHome(novo, agora)).toBe(true);
  });

  it("quem tem a Missão antiga (1.0.9) não vai ganhar a nova: o tour não fica esperando por ela", () => {
    localStorage.setItem("core-missao", JSON.stringify({ inicio: agora - 3600e3 }));
    // a régua da missão antiga (trialCartaoAtivo) não se aplica com a missão em doses ligada: decide normalmente
    expect(deveMostrarTourHome(novo, agora)).toBe(true);
  });

  it("conta antiga: não (como sempre); tour já feito: não", () => {
    expect(deveMostrarTourHome(antigo, agora)).toBe(false);
    localStorage.setItem(CHAVE_TOUR_FEITO, "x");
    expect(deveMostrarTourHome(novo, agora)).toBe(false);
  });

  it("na web nada muda (a missão não nasce no app)", () => {
    nativo.v = false;
    localStorage.setItem("tour-home-force", "on");
    // sem missão na web a régua é a de sempre (não espera nada)
    expect(() => deveMostrarTourHome(novo, agora)).not.toThrow();
  });
});

/* ---------------------------------------------------------------- nome */
function provedor(inicial: Record<string, unknown>) {
  const store = { ...inicial };
  const escritas: Array<[string, unknown, unknown]> = [];
  function Prov({ children }: { children: ReactNode }) {
    const [, tick] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in store ? (store[k] as T) : f), []);
    const set = useCallback((k: string, v: unknown, o?: unknown) => { store[k] = v; escritas.push([k, v, o]); tick(); }, []);
    const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false }) as unknown as UserDataContextType, [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  }
  return { Prov, store, escritas };
}

describe("saudação com o nome digitado (1.0.17)", () => {
  it("nomeDaHome: core-user-name, senão user-name (o do cadastro)", () => {
    const g = (d: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in d ? (d[k] as T) : f);
    expect(nomeDaHome(g({ "core-user-name": "Ana", "user-name": "Lucas" }))).toBe("Ana");
    expect(nomeDaHome(g({ "user-name": " Lucas " }))).toBe("Lucas");
    expect(nomeDaHome(g({}))).toBe("");
    expect(nomeParaMigrar(g({ "user-name": "Lucas" }))).toBe("Lucas");
    expect(nomeParaMigrar(g({ "core-user-name": "Ana", "user-name": "Lucas" }))).toBeNull();
    expect(nomeParaMigrar(g({ "user-name": "   " }))).toBeNull();
    expect(nomeParaMigrar(g({}), { full_name: "Maria Clara" })).toBe("Maria Clara");
  });

  it("a Home copia UMA vez user-name → core-user-name (escrita de sistema) e a saudação lê o nome", () => {
    const { Prov, store, escritas } = provedor({ "user-name": "Lucas Souza" });
    const { result, rerender } = renderHook(() => useLifeHubData(), { wrapper: Prov });
    expect(store["core-user-name"]).toBe("Lucas Souza");
    expect(result.current.userName).toBe("Lucas Souza");
    const n = escritas.filter(([k]) => k === "core-user-name");
    expect(n).toHaveLength(1);
    expect(n[0][2]).toEqual({ system: true });
    rerender();
    expect(escritas.filter(([k]) => k === "core-user-name")).toHaveLength(1); // não regrava
  });

  it("quem já tem nome na Home (editou) não é sobrescrito pelo do cadastro", () => {
    const { Prov, store, escritas } = provedor({ "user-name": "Lucas", "core-user-name": "Luke" });
    const { result } = renderHook(() => useLifeHubData(), { wrapper: Prov });
    expect(result.current.userName).toBe("Luke");
    expect(store["core-user-name"]).toBe("Luke");
    expect(escritas.some(([k]) => k === "core-user-name")).toBe(false);
  });
});

describe("intro da Mente (1.0.17)", () => {
  it("não promete 'escreve o seu' — a intro de um toque não tem campo", () => {
    const textos = JSON.stringify(INTROS.hiperfoco, (_k, v) => (typeof v === "function" ? undefined : v));
    expect(textos).not.toMatch(/escreve o seu|escreva o seu/i);
  });
});
