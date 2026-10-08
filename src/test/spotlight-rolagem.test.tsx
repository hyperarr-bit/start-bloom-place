/**
 * "QUANDO DESLIZO, O CABEÇALHO TREME" (08/10, iPhone 1.0.10, Finanças).
 *
 * O que tremia era o anel do tutorial (SpotlightOverlay) em volta de uma aba do
 * cabeçalho sticky: re-medido em TODO evento de scroll com a medida atrasada do
 * WebKit, e com um scrollIntoView suave reiniciado a cada evento. O jsdom não
 * tem rolagem de verdade, mas dá pra provar o contrato:
 *  - alvo dentro de `header.sticky`: a rolagem NÃO re-mede nem move o anel; só
 *    quando a rolagem assenta (150 ms);
 *  - scrollIntoView roda UMA vez por passo (ao entrar), nunca a partir de scroll;
 *  - alvo comum: no máximo uma medição por quadro (rAF), por mais eventos que cheguem.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { SpotlightOverlay, type SpotlightStep } from "@/components/onboarding/SpotlightOverlay";

function criarStore(inicial: Record<string, unknown>) {
  const estado = { dados: { ...inicial } };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { Provedor };
}

const PASSOS: SpotlightStep[] = [
  { selector: '[data-spotlight="aba-investimentos"]', label: "Investimentos", advanceOnClick: false },
];

/** Monta um "cabeçalho sticky" com a aba-alvo e, ao lado, um alvo comum na página. */
function Tela({ alvoNoHeader }: { alvoNoHeader: boolean }) {
  return (
    <div>
      {alvoNoHeader ? (
        <header className="border-b bg-card sticky top-0 z-50">
          <button type="button" data-spotlight="aba-investimentos">INVESTIMENTOS</button>
        </header>
      ) : (
        <main><button type="button" data-spotlight="aba-investimentos">Lançar</button></main>
      )}
      <SpotlightOverlay moduleKey="financas" steps={PASSOS} />
    </div>
  );
}

const anel = () => document.querySelector<HTMLElement>('[data-camada-guia="spotlight"] .absolute.rounded-xl');

let medidas: ReturnType<typeof vi.spyOn>;
let scrollIntoView: ReturnType<typeof vi.fn>;
let rect = { top: 60, left: 1100, width: 120, height: 44 }; // começa FORA da tela à direita (jsdom: innerWidth 1024)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "Date"] });
  rect = { top: 60, left: 1100, width: 120, height: 44 };
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  medidas = vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const montar = (alvoNoHeader: boolean) => {
  const store = criarStore({ "tutorial-replay-modules": ["financas"] });
  render(<MemoryRouter><store.Provedor><Tela alvoNoHeader={alvoNoHeader} /></store.Provedor></MemoryRouter>);
};

const rolar = (vezes: number) => {
  for (let i = 0; i < vezes; i++) {
    rect = { ...rect, top: rect.top + 7 }; // a medida "atrasada" do WebKit: muda a cada evento
    window.dispatchEvent(new Event("scroll"));
  }
};

describe("anel do tutorial × cabeçalho sticky", () => {
  it("alvo no cabeçalho: 30 eventos de scroll não re-medem nem movem o anel; mede 1x quando a rolagem assenta", async () => {
    montar(true);
    await act(async () => { await Promise.resolve(); });
    const a = anel();
    expect(a).toBeTruthy();
    const topoAntes = a!.style.top;
    expect(topoAntes).toBe(`${60 - 8}px`);
    const medicoesAntes = medidas.mock.calls.length;

    act(() => { rolar(30); vi.advanceTimersByTime(16); });
    expect(medidas.mock.calls.length).toBe(medicoesAntes); // nada medido pela rolagem
    expect(anel()!.style.top).toBe(topoAntes); // e o anel não saiu do lugar

    act(() => { vi.advanceTimersByTime(160); }); // a rolagem assentou
    expect(medidas.mock.calls.length).toBe(medicoesAntes + 1);
    expect(anel()!.style.top).toBe(`${60 + 7 * 30 - 8}px`);
  });

  it("scrollIntoView roda UMA vez por passo (ao entrar) e nunca a partir de um scroll — mesmo com a aba ainda na borda", async () => {
    montar(true);
    await act(async () => { await Promise.resolve(); });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ inline: "center", behavior: "smooth" });
    act(() => { rolar(20); vi.advanceTimersByTime(200); });
    act(() => { vi.advanceTimersByTime(1000); }); // vários tiques do relógio de 250 ms
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("relógio de 250 ms espera a rolagem acabar (sem pulo a cada tique com medida atrasada)", async () => {
    montar(true);
    await act(async () => { await Promise.resolve(); });
    const antes = medidas.mock.calls.length;
    // rolagem contínua: um evento a cada 50 ms por 1 s — o relógio bate 4x nesse meio e deve ficar quieto
    for (let i = 0; i < 20; i++) act(() => { rolar(1); vi.advanceTimersByTime(50); });
    expect(medidas.mock.calls.length).toBe(antes); // o "assentar" foi sempre adiado; o relógio pulou
    act(() => { vi.advanceTimersByTime(400); });
    expect(medidas.mock.calls.length).toBeGreaterThanOrEqual(antes + 1);
    expect(medidas.mock.calls.length).toBeLessThanOrEqual(antes + 2); // assentou (1) + no máximo um tique do relógio
  });

  it("alvo comum na página: 30 eventos de scroll viram UMA medição por quadro (rAF) e o anel acompanha", async () => {
    montar(false);
    await act(async () => { await Promise.resolve(); });
    const antes = medidas.mock.calls.length;
    act(() => { rolar(30); });
    expect(medidas.mock.calls.length).toBe(antes); // ainda no rAF
    act(() => { vi.advanceTimersByTime(16); });
    expect(medidas.mock.calls.length).toBe(antes + 1);
    expect(anel()!.style.top).toBe(`${60 + 7 * 30 - 8}px`);
  });
});
