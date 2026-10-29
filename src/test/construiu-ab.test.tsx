/**
 * 29/10 — A/B DO RESUMO DOS 3 DIAS (lib/construiu-ab + ConstruiuEm3Dias): A "página do planner" × B "colagem".
 *   · o braço: 50/50 pelo hash da conta, estável, gravado (não troca); forçável por QA (?construiu=a|b|auto); a chave
 *     remota `construiu_ab` (ab|a|b) manda todo mundo pra um braço sem build;
 *   · as duas telas nos 3 casos (ativa, pouca, aoAbrir): sem score, sem "0", título pelos números, o que fez em cada
 *     módulo, próximo passo; no dia 3 com dose por fazer o botão É a dose;
 *   · eventos com `braco_construiu`.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { ConstruiuEm3Dias, tituloDoResumo } from "@/components/missao-doses/ConstruiuEm3Dias";
import { iniciarMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import {
  CHAVE_BRACO_CONSTRUIU, CHAVE_CONSTRUIU_APARELHO, _zerarConstruiuRemoto, bracoConstruiu, guardarForcaConstruiu, lerConstruiuRemoto,
  modoConstruiu, registrarConstruiuRemoto, sortearBracoConstruiu,
} from "@/lib/construiu-ab";
import { CHAVE_DIAS_ANOTADOS } from "@/lib/sequencia";
import { CHAVE_DESBLOQUEADAS } from "@/lib/conquistas-registro";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  return <UserDataContext.Provider value={{ ...store.valor() } as never}>{children}</UserDataContext.Provider>;
};
const offerings = (meta: Record<string, unknown>) => { const current = { identifier: "default", metadata: meta }; return { current, all: { default: current } }; };

/* ------------------------------------------------------------ as 3 pessoas (hoje = quinta 29/10/2026) */
const HOJE = new Date(2026, 9, 29, 9, 0);
const missao = (inicio: string, feitos: EstadoMissaoDoses["feitos"]): EstadoMissaoDoses =>
  ({ ...iniciarMissao(["financas", "rotina", "saude"], inicio), boasVindas: true, feitos });
/** ativa: 4 dias seguidos (hoje feito), 3 doses, 11 figurinhas (o dono no evento missao_doses_fim) */
const ATIVA = {
  m: missao("2026-10-26", { 1: { dia: "2026-10-26", rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: "2026-10-27", rotulo: "Beber água ao acordar" }, 3: { dia: "2026-10-29", rotulo: "1 copo d'água · meta 8" } }),
  dados: {
    [CHAVE_DIAS_ANOTADOS]: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"],
    [CHAVE_DESBLOQUEADAS]: { "sequencia-1": "2026-10-26", "first-expense": "2026-10-26", "first-income": "2026-10-26", "sequencia-2": "2026-10-27", "rotina-1": "2026-10-27", "habito-criado": "2026-10-27", "sequencia-3": "2026-10-28", "agua-1": "2026-10-29" },
    "core-user-name": "joão victor",
  },
  aoAbrir: false,
};
/** pouca: só a dose 1, nada anotado depois, nenhuma figurinha, aberta no dia 3 */
const POUCA = { m: missao("2026-10-27", { 1: { dia: "2026-10-27", rotulo: "Pode gastar R$ 61 por dia" } }), dados: {} as Record<string, unknown>, aoAbrir: true };
/** ao abrir no dia 3: 2 dias seguidos até ontem, hoje nada; doses 1 e 2 feitas */
const ABRIR = {
  m: missao("2026-10-27", { 1: { dia: "2026-10-27", rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: "2026-10-28", rotulo: "Beber água ao acordar" } }),
  dados: { [CHAVE_DIAS_ANOTADOS]: ["2026-10-27", "2026-10-28"], [CHAVE_DESBLOQUEADAS]: { "sequencia-1": "2026-10-27", "sequencia-2": "2026-10-28" } },
  aoAbrir: true,
};
const CASOS = { ativa: ATIVA, pouca: POUCA, abrir: ABRIR };

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  _zerarConstruiuRemoto();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("o braço (lib/construiu-ab)", () => {
  it("sorteio 50/50 estável pelo id da conta (mesmo id = mesmo braço; ~metade de cada)", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `user-${i}-${(i * 7919).toString(36)}`);
    const a = ids.filter((id) => sortearBracoConstruiu(id) === "a").length;
    expect(a / ids.length).toBeGreaterThan(0.45);
    expect(a / ids.length).toBeLessThan(0.55);
    for (const id of ids.slice(0, 50)) expect(sortearBracoConstruiu(id)).toBe(sortearBracoConstruiu(id));
  });

  it("gravado por conta na 1ª vez: não troca de braço, nem com o sorteio mudando; contas diferentes no mesmo aparelho, braços próprios", () => {
    const b1 = bracoConstruiu("conta-1");
    expect(bracoConstruiu("conta-1")).toBe(b1);
    const gravado = JSON.parse(localStorage.getItem(CHAVE_BRACO_CONSTRUIU)!) as Record<string, string>;
    expect(Object.values(gravado)).toEqual([b1]);
    // mexe no gravado: vale o gravado, não o sorteio (o braço nunca troca depois de visto)
    const outro = b1 === "a" ? "b" : "a";
    localStorage.setItem(CHAVE_BRACO_CONSTRUIU, JSON.stringify(Object.fromEntries(Object.keys(gravado).map((k) => [k, outro]))));
    expect(bracoConstruiu("conta-1")).toBe(outro);
    // outra conta: o sorteio dela
    expect(bracoConstruiu("conta-2")).toBe(sortearBracoConstruiu("conta-2"));
    // as duas chaves são do aparelho (as vassouras não levam)
    expect(vassouraLeva(CHAVE_BRACO_CONSTRUIU)).toBe(false);
    expect(vassouraLeva(CHAVE_CONSTRUIU_APARELHO)).toBe(false);
  });

  it("forçar por QA: ?construiu=a|b manda neste aparelho; ?construiu=auto desfaz", () => {
    const natural = sortearBracoConstruiu("conta-x");
    const contrario = natural === "a" ? "b" : "a";
    guardarForcaConstruiu(`?construiu=${contrario}`);
    expect(modoConstruiu()).toBe(contrario);
    expect(bracoConstruiu("conta-x")).toBe(contrario);
    guardarForcaConstruiu("?outra=1"); // sem o parâmetro: nada muda
    expect(bracoConstruiu("conta-x")).toBe(contrario);
    guardarForcaConstruiu("?construiu=auto");
    expect(modoConstruiu()).toBe("ab");
    expect(bracoConstruiu("conta-x")).toBe(natural);
  });

  it("chave remota `construiu_ab`: ausente = ab (o teste); 'a'/'b' manda todo mundo pra um braço (a current vence); a resposta fica no aparelho", () => {
    expect(lerConstruiuRemoto(offerings({}))).toBeNull();
    expect(lerConstruiuRemoto({ current: { metadata: { construiu_ab: "B" } }, all: { x: { metadata: { construiu_ab: "a" } } } })).toBe("b");
    expect(modoConstruiu()).toBe("ab");
    registrarConstruiuRemoto(offerings({ construiu_ab: "a" }));
    expect(["conta-1", "conta-2", "conta-3", "conta-4"].map((id) => bracoConstruiu(id))).toEqual(["a", "a", "a", "a"]);
    expect(localStorage.getItem(CHAVE_CONSTRUIU_APARELHO)).toBe("a");
    _zerarConstruiuRemoto(); // nova abertura sem resposta: vale a do aparelho
    expect(modoConstruiu()).toBe("a");
    registrarConstruiuRemoto(offerings({ construiu_ab: "talvez" })); // estranha: fica como estava
    expect(modoConstruiu()).toBe("a");
    registrarConstruiuRemoto(offerings({ construiu_ab: "ab" }));
    expect(modoConstruiu()).toBe("ab");
  });
});

describe("as duas telas nos 3 casos", () => {
  const abrir = (caso: keyof typeof CASOS, braco: "a" | "b", aoFazerDose?: () => void) => {
    const c = CASOS[caso];
    const aoContinuar = vi.fn();
    render(<MemoryRouter><Provedor store={montarStore(c.dados)}><ConstruiuEm3Dias missao={c.m} aoAbrir={c.aoAbrir} braco={braco} aoContinuar={aoContinuar} aoFazerDose={aoFazerDose ?? (c.aoAbrir ? vi.fn() : undefined)} /></Provedor></MemoryRouter>);
    return { tela: screen.getByTestId("missao-doses-fim"), aoContinuar };
  };

  for (const braco of ["a", "b"] as const) {
    it(`braço ${braco.toUpperCase()}: ativa — "4 dias seguidos", as 3 doses com o que fez, figurinhas, o próximo passo de amanhã, sem score; Continuar`, () => {
      const { tela, aoContinuar } = abrir("ativa", braco);
      expect(tela).toHaveAttribute("data-braco", braco);
      expect(screen.getByTestId("missao-doses-fim-titulo").textContent).toMatch(/^4 dias seguidos/);
      if (braco === "b") expect(screen.getByTestId("missao-doses-fim-titulo")).toHaveTextContent("João!");
      expect(screen.getByTestId("missao-doses-fim-modulo-financas")).toHaveTextContent("R$ 61 por dia");
      expect(screen.getByTestId("missao-doses-fim-modulo-rotina")).toHaveTextContent("Beber água ao acordar");
      expect(screen.getByTestId("missao-doses-fim-modulo-saude")).toHaveTextContent("1 copo d'água · meta 8");
      expect(screen.getByTestId("missao-doses-fim-figurinhas").querySelectorAll("[data-adesivo]").length).toBeGreaterThan(0);
      expect(screen.getByTestId("missao-doses-fim-proximo")).toHaveTextContent(/Amanhã, sexta/);
      if (braco === "a") expect(screen.getByTestId("missao-doses-fim-semana")).toHaveTextContent("4 seguidos");
      expect(tela.textContent).not.toMatch(/score|3 dias/i);
      const botao = screen.getByTestId("missao-doses-continuar");
      expect(botao).toHaveTextContent(/^Continuar$/);
      fireEvent.click(botao);
      expect(aoContinuar).toHaveBeenCalledTimes(1);
    });

    it(`braço ${braco.toUpperCase()}: pouca (1 dose, sem sequência, sem figurinha) — "Seu CORE começou.", nada de "0", o botão é a dose 2`, () => {
      const dose = vi.fn();
      const { tela } = abrir("pouca", braco, dose);
      expect(screen.getByTestId("missao-doses-fim-titulo")).toHaveTextContent("Seu CORE começou.");
      expect(screen.queryByTestId("missao-doses-fim-semana")).toBeNull();
      expect(screen.queryByTestId("missao-doses-fim-figurinhas")).toBeNull();
      expect(tela.textContent).not.toMatch(/(^|\D)0 (dias?|figurinhas?|adesivos?|módulos?)/);
      expect(tela.textContent).not.toMatch(/score/i);
      expect(screen.getByTestId("missao-doses-fim-modulo-financas")).toHaveTextContent("R$ 61 por dia");
      expect(screen.getByTestId("missao-doses-fim-hoje-rotina")).toBeInTheDocument();
      const botao = screen.getByTestId("missao-doses-continuar");
      expect(botao).toHaveTextContent("Marcar 1 hábito");
      fireEvent.click(botao);
      expect(dose).toHaveBeenCalledWith({ n: 2, modulo: "rotina" });
    });

    it(`braço ${braco.toUpperCase()}: aoAbrir no dia 3 — "2 dias seguidos. Hoje vira 3.", a dose 3 marcada HOJE e o botão leva pra ela`, () => {
      const dose = vi.fn();
      const { tela } = abrir("abrir", braco, dose);
      expect(screen.getByTestId("missao-doses-fim-titulo")).toHaveTextContent("2 dias seguidos. Hoje vira 3.");
      expect(screen.getByTestId("missao-doses-fim-hoje-saude")).toBeInTheDocument();
      expect(screen.queryByTestId("missao-doses-fim-proximo")).toBeNull(); // o próximo passo É o botão
      expect(tela.textContent).not.toMatch(/score/i);
      const botao = screen.getByTestId("missao-doses-continuar");
      expect(botao).toHaveTextContent("Marcar 1 copo d'água");
      expect(botao).toHaveAttribute("data-botao", "dose");
      fireEvent.click(botao);
      expect(dose).toHaveBeenCalledWith({ n: 3, modulo: "saude" });
    });
  }

  it("aoAbrir sem quem leve pra dose (sem aoFazerDose): o botão é 'Continuar'", () => {
    render(<MemoryRouter><Provedor store={montarStore(ABRIR.dados)}><ConstruiuEm3Dias missao={ABRIR.m} aoAbrir braco="a" aoContinuar={() => {}} /></Provedor></MemoryRouter>);
    expect(screen.getByTestId("missao-doses-continuar")).toHaveTextContent(/^Continuar$/);
  });

  it("eventos: missao_doses_fim e dia3_construiu_view levam o braço", () => {
    abrir("abrir", "b");
    expect(eventos).toContainEqual(["missao_doses_fim", expect.objectContaining({ braco_construiu: "b", ao_abrir: true, botao_dose: true })]);
    expect(eventos).toContainEqual(["dia3_construiu_view", expect.objectContaining({ braco_construiu: "b", doses: 2 })]);
    cleanup();
    eventos.length = 0;
    abrir("ativa", "a");
    expect(eventos).toContainEqual(["missao_doses_fim", expect.objectContaining({ braco_construiu: "a", ao_abrir: false })]);
    expect(eventos.find(([n]) => n === "dia3_construiu_view")).toBeUndefined();
  });

  it("o título pelos números (puro)", () => {
    expect(tituloDoResumo({ dias: 4, hojeFeito: true })).toEqual(["4 dias seguidos", null]);
    expect(tituloDoResumo({ dias: 2, hojeFeito: false })).toEqual(["2 dias seguidos.", "Hoje vira 3."]);
    expect(tituloDoResumo({ dias: 1, hojeFeito: true })).toEqual(["Seu CORE", "começou."]);
    expect(tituloDoResumo({ dias: 0, hojeFeito: false })).toEqual(["Seu CORE", "começou."]);
  });
});
