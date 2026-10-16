/**
 * INTRO DO MÓDULO (protótipo 16/10, lib/intro-modulo) — o que este arquivo trava:
 *   · chave DESLIGADA (sem força) = o app de hoje: a porta do módulo (BoasVindasDoModulo) segue pro
 *     "Dicas para começar"/cartões, a IntroDoModulo não monta nada, nenhum evento, nada no storage;
 *   · a força `?intro-modulo=on` só vale no navegador (no app das lojas quem manda é a chave/metadata);
 *   · o estado vazio da Casa: 1 toque grava os 3 itens na lista real e marca "vista" no aparelho E na conta;
 *   · a intro guiada: faixa + evento de vista; o chip grava o gasto na conta pelo formato do módulo;
 *   · 1x: já vista no aparelho OU na conta ⇒ não monta; módulo da missão ⇒ não monta.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import { CHAVE_FORCA_INTRO, CHAVE_INTRO_VISTAS_CONTA, INTRO_MODULO, INTROS, MODULOS_COM_INTRO, _zerarIntroRemota, chaveIntroVista, guardarForcaDaIntro, introLigada, registrarIntroRemota } from "@/lib/intro-modulo";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CATEGORIAS_PADRAO_MERCADO } from "@/lib/mercado";
import { CHAVE_FORCA_MISSAO_DOSES, gravarMissao, iniciarMissao } from "@/lib/missao-doses";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados, escritas: [] as string[] };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; estado.escritas.push(k); subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}
const montar = (ui: ReactNode, inicial: Dados = {}) => {
  const s = criarStore(inicial);
  const r = render(<MemoryRouter initialEntries={["/casa"]}><s.Provedor>{ui}</s.Provedor></MemoryRouter>);
  return { ...r, ...s };
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; nativo.v = false; _zerarIntroRemota(); });
afterEach(() => { cleanup(); document.body.innerHTML = ""; document.documentElement.removeAttribute("data-intro-modulo-faixa"); });

describe("chave desligada = o app de hoje", () => {
  it("a constante nasce off e a porta do módulo segue pro Dicas para começar", () => {
    expect(INTRO_MODULO).toBe("off");
    expect(introLigada()).toBe(false);
    montar(<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} />);
    expect(screen.getByText("Dica antiga")).toBeTruthy();
    expect(screen.queryByTestId("intro-modulo-vazio")).toBeNull();
    expect(eventos.filter(([n]) => n.startsWith("modulo_intro"))).toHaveLength(0);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("core-intro"))).toHaveLength(0);
  });
  it("IntroDoModulo não monta nada com a chave off", () => {
    const { container } = montar(<IntroDoModulo moduleId="financas" />);
    expect(container.innerHTML).toBe("");
    expect(document.querySelector("[data-testid^=intro-modulo]")).toBeNull();
  });
  it("a força do link vale no navegador e é ignorada no app das lojas; a metadata do RC manda sem build", () => {
    guardarForcaDaIntro("?intro-modulo=on");
    expect(localStorage.getItem(CHAVE_FORCA_INTRO)).toBe("on");
    expect(introLigada()).toBe(true);
    nativo.v = true;
    expect(introLigada()).toBe(false);
    registrarIntroRemota({ current: { identifier: "default", metadata: { intro_modulo: "on" } }, all: {} });
    expect(introLigada()).toBe(true);
    registrarIntroRemota({ current: { identifier: "default", metadata: { intro_modulo: "off" } }, all: {} });
    expect(introLigada()).toBe(false);
  });
  it("as chaves novas estão classificadas: a do aparelho sobrevive à vassoura, a da conta é da conta", () => {
    expect(ehChaveDoAparelho(chaveIntroVista("financas"))).toBe(true);
    expect(vassouraLeva(chaveIntroVista("casa"))).toBe(false);
    expect(CHAVE_INTRO_VISTAS_CONTA.startsWith("core-")).toBe(true);
    expect(MODULOS_COM_INTRO).toEqual(["financas", "rotina", "saude", "casa"]);
    for (const m of ["financas", "rotina", "saude"]) expect(INTROS[m].formato).toBe("guiada");
    expect(INTROS.casa.formato).toBe("vazio");
  });
});

describe("ligada (força no navegador)", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_FORCA_INTRO, "on"); });

  it("Casa: o estado vazio ocupa o lugar do Dicas; 1 toque grava os 3 itens na lista real e marca vista no aparelho e na conta", async () => {
    const { estado } = montar(<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} />);
    expect(screen.queryByText("Dica antiga")).toBeNull();
    expect(screen.getByTestId("intro-modulo-vazio")).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.modulo === "casa" && d.formato === "vazio")).toBeTruthy();
    fireEvent.click(screen.getByTestId("intro-modulo-acao"));
    const cats = estado.dados["casa-grocery-categories"] as typeof CATEGORIAS_PADRAO_MERCADO;
    const textos = cats.flatMap((c) => c.items.map((i) => i.text));
    expect(textos).toEqual(expect.arrayContaining(["Leite", "Pão", "Café"]));
    expect(cats).toHaveLength(CATEGORIAS_PADRAO_MERCADO.length);
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    expect(eventos.find(([n]) => n === "modulo_intro_concluida")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-vazio")).toBeNull());
  });

  it("Casa: 'Ver tudo' fecha, marca vista e conta como pulada", () => {
    const { estado } = montar(<IntroDoModulo moduleId="casa" />);
    fireEvent.click(screen.getByTestId("intro-modulo-ver-tudo"));
    expect(screen.queryByTestId("intro-modulo-vazio")).toBeNull();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    expect(eventos.find(([n, d]) => n === "modulo_intro_pulou" && d.fase === "vazio")).toBeTruthy();
  });

  it("1x: já vista neste aparelho OU nesta conta ⇒ não monta; módulo da missão ⇒ não monta", () => {
    localStorage.setItem(chaveIntroVista("casa"), "2026-10-16");
    const a = montar(<IntroDoModulo moduleId="casa" />);
    expect(a.container.innerHTML).toBe("");
    a.unmount(); localStorage.removeItem(chaveIntroVista("casa"));
    const b = montar(<IntroDoModulo moduleId="casa" />, { [CHAVE_INTRO_VISTAS_CONTA]: ["casa"] });
    expect(b.container.innerHTML).toBe("");
    b.unmount();
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true; // a missão na web só liga por QA
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    gravarMissao(iniciarMissao(["financas", "rotina", "saude"]));
    const c = montar(<IntroDoModulo moduleId="financas" />);
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    expect(c.container.innerHTML).toBe("");
  });

  it("Finanças: a faixa sobe, o post-it acha o controle real e o chip grava o gasto na conta no formato do módulo", async () => {
    // o módulo de mentira: só o controle que a intro procura, com tamanho (jsdom não mede)
    const Modulo = () => (
      <div>
        <div data-cartao-alvo="novo-gasto"><input placeholder="+ Novo gasto" /><button data-spotlight="add-expense">+</button></div>
        <IntroDoModulo moduleId="financas" />
      </div>
    );
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const { estado } = montar(<Modulo />);
    expect(document.documentElement.getAttribute("data-intro-modulo-faixa")).toBe("1");
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("toca em 1 gasto");
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.formato === "guiada")).toBeTruthy();
    const chip = await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 4000 });
    fireEvent.click(chip[0]);
    const gastos = estado.dados["finance-expenses"] as Array<{ description: string; value: number }>;
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ description: "Café", value: 12 });
    expect(eventos.find(([n, d]) => n === "modulo_intro_chip" && d.nome === "Café")).toBeTruthy();
    await waitFor(() => expect(eventos.find(([n, d]) => n === "modulo_intro_registrou" && d.via === "chip")).toBeTruthy(), { timeout: 3000 });
    // sem o card MEU MÊS na tela, vai direto pro "pronto" (fail-open) e marca vista
    await waitFor(() => expect(screen.getByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
    expect(localStorage.getItem(chaveIntroVista("financas"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["financas"]);
    expect(document.documentElement.getAttribute("data-intro-modulo-faixa")).toBeNull();
    medir.mockRestore();
  });
});
