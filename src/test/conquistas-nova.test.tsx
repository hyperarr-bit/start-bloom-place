/**
 * CONQUISTAS 2 (protótipo 16/10): a mecânica pura (próximo prêmio, formato do
 * aviso, adesivos novos da sequência) e a tela nas 3 direções com dados em
 * memória — nada vai pro servidor.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: unknown) => { eventos.push([nome, dados]); },
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { ConquistasNova } from "@/components/conquistas/nova/ConquistasNova";
import { ADESIVOS_SEQUENCIA_NOVOS, EVENTOS2, adesivosDaSequenciaNovos, formatoDoAviso, fraseDaColecao, podeCompartilhar, proximoPremio } from "@/components/conquistas/nova/recompensas";
import { buildBadgesSequencia } from "@/lib/conquistas-registro";
import { IDS_COM_ARTE } from "@/components/conquistas/adesivos-arte";
import { somarDias } from "@/lib/sequencia";
import type { Badge } from "@/components/gamification/types";

const HOJE = "2026-10-16"; // sexta
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
  eventos.length = 0;
});
afterEach(() => { vi.useRealTimers(); });

const todos = (recorde: number): Badge[] => [...buildBadgesSequencia(recorde), ...adesivosDaSequenciaNovos(recorde)];

describe("os adesivos novos da sequência", () => {
  it("2, 3 e 14 dias existem, com arte, e abrem pelo recorde", () => {
    const lista = adesivosDaSequenciaNovos(0);
    expect(lista.map((b) => b.id)).toEqual(["sequencia-2", "sequencia-3", "sequencia-14"]);
    expect(lista.every((b) => IDS_COM_ARTE.includes(b.id))).toBe(true);
    expect(lista.every((b) => !b.unlocked)).toBe(true);
    expect(adesivosDaSequenciaNovos(3).filter((b) => b.unlocked).map((b) => b.id)).toEqual(["sequencia-2", "sequencia-3"]);
    expect(ADESIVOS_SEQUENCIA_NOVOS[3].raridade).toBe("raro");
  });

  it("comum e raro viram toast; marcos de 7/30/100 e épicos/lendários, tela cheia; compartilhar só nos marcos", () => {
    const lista = todos(100);
    const de = (id: string) => lista.find((b) => b.id === id)!;
    expect(formatoDoAviso(de("sequencia-2"))).toBe("toast");
    expect(formatoDoAviso(de("sequencia-3"))).toBe("toast");
    expect(formatoDoAviso(de("sequencia-14"))).toBe("toast");
    expect(formatoDoAviso(de("sequencia-7"))).toBe("tela_cheia");
    expect(formatoDoAviso(de("sequencia-30"))).toBe("tela_cheia");
    expect(formatoDoAviso(de("ano-365"))).toBe("tela_cheia");
    expect(formatoDoAviso({ id: "rotina-21", xp: 200 })).toBe("tela_cheia");
    expect(formatoDoAviso({ id: "first-expense", xp: 50 })).toBe("toast");
    expect(podeCompartilhar(de("sequencia-7"))).toBe(true);
    expect(podeCompartilhar(de("sequencia-3"))).toBe(false);
  });
});

describe("o próximo prêmio (amanhã você ganha)", () => {
  it("dia 1 do teste, já anotou hoje: amanhã vem o Voltei", () => {
    const p = proximoPremio(1, true, todos(1));
    expect(p.marco).toBe(2);
    expect(p.quando).toBe("amanha");
    expect(p.adesivo?.id).toBe("sequencia-2");
    expect(p.titulo).toBe("Amanhã você ganha");
  });
  it("dia 2 do teste, ainda sem anotar: HOJE ganha o Voltei", () => {
    const p = proximoPremio(1, false, todos(1));
    expect(p.marco).toBe(2);
    expect(p.quando).toBe("hoje");
    expect(p.faltam).toBe(1);
  });
  it("dia 2 anotado: amanhã vem o raro de 3 dias", () => {
    const p = proximoPremio(2, true, todos(2));
    expect(p.marco).toBe(3);
    expect(p.quando).toBe("amanha");
    expect(p.adesivo?.name).toBe("3 Dias Seguidos");
  });
  it("12 dias até ontem: em 2 dias vem Duas Semanas + protetor", () => {
    const p = proximoPremio(12, false, todos(12));
    expect(p.marco).toBe(14);
    expect(p.faltam).toBe(2);
    expect(p.quando).toBe("dias");
    expect(p.daProtetor).toBe(true);
    expect(p.titulo).toBe("Em 2 dias você ganha");
  });
  it("recorde antigo já colou o 3 e o 7: pula o 3, mas o 7 fica (dá protetor) sem adesivo", () => {
    const p = proximoPremio(2, true, todos(10));
    expect(p.marco).toBe(7);
    expect(p.adesivo).toBeNull();
    expect(p.daProtetor).toBe(true);
    expect(p.faltam).toBe(5);
  });
  it("sem marco à frente (recorde 100, sequência 100): o próximo múltiplo de 7", () => {
    const p = proximoPremio(100, true, todos(100));
    expect(p.marco).toBe(105);
    expect(p.adesivo).toBeNull();
  });
  it("a frase da coleção", () => {
    expect(fraseDaColecao(5, 24)).toBe("5 de 24");
    expect(fraseDaColecao(4, 7)).toBe("faltam 3 pra fechar");
    expect(fraseDaColecao(7, 7)).toBe("coleção completa");
  });
});

/* ------------------------------------------------------------------ a tela */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const cenario = (extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
  "conquistas-desbloqueadas": { "sequencia-7": "2026-10-10", "sequencia-3": "2026-10-06", "sequencia-2": "2026-10-05", "first-expense": "2026-09-01" },
  "conquistas-album-visto": ["sequencia-7", "sequencia-3", "sequencia-2"],
  "finance-expenses": [{ id: 1, value: 10, date: "2026-10-10" }],
  ...extra,
});
const montar = (direcao: "a" | "b" | "c", props: Partial<Parameters<typeof ConquistasNova>[0]> = {}, extra = {}) => {
  const store = montarStore(cenario(extra));
  const r = render(
    <MemoryRouter>
      <Provedor store={store}><ConquistasNova direcao={direcao} {...props} /></Provedor>
    </MemoryRouter>,
  );
  return { store, ...r };
};

describe("a tela nas 3 direções", () => {
  it.each(["a", "b", "c"] as const)("direção %s: sequência, prêmio de amanhã, coleção e os eventos conquistas2_*", (d) => {
    montar(d);
    expect(screen.getByTestId("conquistas-nova").getAttribute("data-direcao")).toBe(d);
    expect(screen.getByTestId("cn-hero")).toBeTruthy();
    expect(screen.getByTestId("cn-amanha").textContent).toMatch(/Em 2 dias você ganha/i);
    expect(screen.getByTestId("cn-amanha").textContent).toContain("Duas Semanas");
    expect(screen.getByTestId("cn-colecao")).toBeTruthy();
    // nada da tela antiga: capa, insígnias, nível, roseta
    expect(screen.queryByTestId("seletor-capa")).toBeNull();
    expect(document.body.textContent).not.toMatch(/INSÍGNIAS|Nível |XP/);
    expect(eventos.map(([n]) => n)).toContain(EVENTOS2.abrir);
    expect(eventos.map(([n]) => n)).toContain(EVENTOS2.amanhaVisto);
  });

  it("o adesivo colado desde a última visita conta como novo (first-expense não estava no visto)", () => {
    montar("a");
    // a coleção de Finanças mostra o adesivo colado
    expect(screen.getByTestId("cn-colecao-finance")).toBeTruthy();
  });

  it("abre o detalhe da sequência (calendário de 4 semanas) e a coleção inteira", () => {
    montar("a");
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    expect(screen.getByTestId("cn-detalhe-sequencia")).toBeTruthy();
    expect(screen.getByTestId("cn-calendario").querySelectorAll('[data-estado="feito"]').length).toBe(12);
    expect(eventos.map(([n]) => n)).toContain(EVENTOS2.sequenciaAbrir);
    fireEvent.click(screen.getByTestId("cn-colecao-rotina"));
    expect(screen.getByTestId("cn-colecao-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.colecaoAbrir)?.[1]).toEqual({ colecao: "rotina" });
  });

  it("no teste grátis (dia 2, sem anotar hoje): a missão e 'Hoje você ganha Voltei'", () => {
    montar("c", { testeDia: 2 }, { "core-dias-anotados": [somarDias(HOJE, -1)], "conquistas-desbloqueadas": { "first-expense": somarDias(HOJE, -1) }, "conquistas-album-visto": ["first-expense"] });
    expect(screen.getByTestId("cn-missao").textContent).toMatch(/dia 2 de 3/);
    expect(screen.getByTestId("cn-amanha").textContent).toMatch(/Hoje você ganha/i);
    expect(screen.getByTestId("cn-amanha").textContent).toContain("Voltei");
  });

  it("o toast do adesivo comum e a festa do marco (com Stories) montam e medem", () => {
    montar("b", { camada: "toast" });
    expect(screen.getByTestId("cn-toast").textContent).toContain("Adesivo novo colado");
    expect(eventos.map(([n]) => n)).toContain(EVENTOS2.toastView);
    montar("b", { camada: "marco" });
    const festa = screen.getByTestId("cn-festa");
    expect(festa.textContent).toContain("7 dias seguidos!");
    expect(festa.textContent).toContain("Postar nos Stories");
    expect(festa.textContent).toContain("+1 protetor");
    expect(eventos.find(([n]) => n === EVENTOS2.marcoView)?.[1]).toEqual({ dias: 7 });
  });
});
