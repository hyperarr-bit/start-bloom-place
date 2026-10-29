/**
 * "Dicas para começar" pelo uso real (28/10): a lista (lib/dicas-do-modulo), as duas apresentações ("toque" e "texto"),
 * o toque que abre a aba certa (mesmo oculta) e a folha "Organizar abas", a volta no modo 1.0.12 da loja, nunca nas
 * demos, e fechar → reabrir.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const estado: { loaded: boolean; store: Record<string, unknown> } = { loaded: true, store: {} };
const set = vi.fn((k: string, v: unknown) => { estado.store[k] = v; });
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({ loaded: estado.loaded, set, get: <T,>(k: string, f: T): T => (estado.loaded && k in estado.store ? (estado.store[k] as T) : f) }),
}));
vi.mock("@/lib/demo-do-funil", () => ({ useDemoDoFunil: () => false }));
const eventos: [string, Record<string, unknown>][] = [];
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, p: Record<string, unknown>) => { eventos.push([n, p]); } }));

import { ModuleTip } from "@/components/ModuleTip";
import { DicasDaBeleza } from "@/components/beleza/kit";
import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import type { AbasOcultas } from "@/hooks/use-abas-ocultas";
import { ABAS_POUCO_USO, ABAS_QUE_NUNCA_SAEM } from "@/lib/abas-enxutas";
import {
  CHAVE_FORCA_DICAS, DICAS_DO_MODULO, DICAS_MODO, EVENTO_ABRIR_ABA, EVENTO_ORGANIZAR_ABAS, _zerarForcaDasDicas, acharAlvo,
  guardarForcaDasDicas, irParaDica, modoDasDicas, type DetalheAbrirAba,
} from "@/lib/dicas-do-modulo";

/** As abas que uma dica PODE citar: as vivas (uso real ≥ 5% de quem abre, 00-VISAO-GERAL 28/10) + a aba de entrada. */
const ABAS_VIVAS: Record<string, string[]> = {
  financas: ["financeiro", "dashboard"], rotina: ["semana", "mes", "foco"], saude: ["hoje", "log"], treino: ["plano", "hoje"],
  dieta: ["cardapio", "diario"], beleza: ["routine", "hair", "care"], casa: ["comodos", "mercado"], biblioteca: ["lendo", "estante"],
  desenvolvimento: ["sobre"], estudos: ["estudos"], relacionamentos: ["pessoas"], detox: ["rastreador"], hiperfoco: ["dia"],
  carreira: ["dia"], pet: ["hoje"], viagens: ["destinos"],
};
const EMOJI = /\p{Extended_Pictographic}/u;

const navegar = (path: string) => window.history.replaceState(null, "", path);

beforeEach(() => {
  estado.loaded = true; estado.store = {}; set.mockClear(); eventos.length = 0;
  localStorage.clear(); _zerarForcaDasDicas(); navegar("/");
  delete (globalThis as { __MODO_1012__?: unknown }).__MODO_1012__;
});
afterEach(() => { cleanup(); delete (globalThis as { __MODO_1012__?: unknown }).__MODO_1012__; });

describe("a lista", () => {
  it("os 16 módulos com abas têm dicas (Finanças e Pet inclusive), no máximo 3, e a última abre o Organizar abas", () => {
    expect(Object.keys(DICAS_DO_MODULO).sort()).toEqual(Object.keys(ABAS_QUE_NUNCA_SAEM).sort());
    for (const [m, dicas] of Object.entries(DICAS_DO_MODULO)) {
      expect(dicas.length, m).toBeGreaterThanOrEqual(2);
      expect(dicas.length, m).toBeLessThanOrEqual(3);
      expect(dicas[dicas.length - 1].organizarAbas, m).toBe(true);
      expect(dicas.filter((d) => d.organizarAbas), m).toHaveLength(1);
    }
  });
  it("nenhuma dica aponta pra aba da lista enxuta da conta nova, nem pra aba fraca/morta", () => {
    for (const [m, dicas] of Object.entries(DICAS_DO_MODULO)) for (const d of dicas) {
      if (!d.aba) continue;
      expect(ABAS_POUCO_USO[m] ?? [], `${m}: ${d.texto}`).not.toContain(d.aba);
      expect(ABAS_VIVAS[m], `${m}: ${d.texto}`).toContain(d.aba);
    }
  });
  it("texto curto, 1 linha, sem exclamação, sem emoji, sem repetir (Estudos 4 e 5 diziam o mesmo)", () => {
    for (const [m, dicas] of Object.entries(DICAS_DO_MODULO)) {
      const textos = dicas.map((d) => d.texto);
      expect(new Set(textos).size, m).toBe(textos.length);
      for (const d of dicas) for (const t of [d.texto, d.textoSemToque].filter(Boolean) as string[]) {
        expect(t.length, `${m}: ${t}`).toBeLessThanOrEqual(70);
        expect(t, m).not.toMatch(/[!⚙]/);
        expect(EMOJI.test(t), `${m}: ${t}`).toBe(false);
      }
    }
    // Dieta: o botão de configurar as refeições não é citado como "⚙️"
    expect(DICAS_DO_MODULO.dieta.some((d) => d.texto.includes("⚙"))).toBe(false);
  });
  it("toda dica (menos a de ocultar abas) tem destino: uma aba e/ou um alvo", () => {
    for (const [m, dicas] of Object.entries(DICAS_DO_MODULO)) for (const d of dicas) {
      if (d.organizarAbas) continue;
      expect(!!d.aba, `${m}: ${d.texto}`).toBe(true);
    }
  });
});

describe("a chave DICAS_MODO (+ ?dicas=)", () => {
  it("padrão = toque; ?dicas=texto grava neste aparelho; ?dicas=auto desfaz", () => {
    expect(DICAS_MODO).toBe("toque");
    expect(modoDasDicas()).toBe("toque");
    guardarForcaDasDicas("?dicas=texto");
    expect(localStorage.getItem(CHAVE_FORCA_DICAS)).toBe("texto");
    expect(modoDasDicas()).toBe("texto");
    guardarForcaDasDicas("?dicas=lixo");
    expect(modoDasDicas()).toBe("texto");
    guardarForcaDasDicas("?dicas=auto");
    expect(modoDasDicas()).toBe("toque");
  });
  it("a força da URL vale na 1ª leitura da abertura", () => {
    navegar("/rotina?dicas=texto");
    expect(modoDasDicas()).toBe("texto");
  });
});

describe("o cartão nas duas apresentações", () => {
  it("toque: cada dica é um botão; o toque manda abrir a aba do módulo", () => {
    render(<ModuleTip moduleId="rotina" />);
    const abertas: DetalheAbrirAba[] = [];
    const ouvir = (e: Event) => abertas.push((e as CustomEvent<DetalheAbrirAba>).detail);
    window.addEventListener(EVENTO_ABRIR_ABA, ouvir);
    expect(screen.getByTestId("dicas-modulo").getAttribute("data-modo")).toBe("toque");
    const botoes = screen.getAllByRole("button").filter((b) => b.getAttribute("data-testid")?.startsWith("dica-"));
    expect(botoes).toHaveLength(3);
    fireEvent.click(screen.getByTestId("dica-2"));
    expect(abertas).toEqual([{ modulo: "rotina", aba: "mes" }]);
    expect(eventos.find(([n]) => n === "dica_toque")?.[1]).toMatchObject({ modulo: "rotina", dica: 2 });
    window.removeEventListener(EVENTO_ABRIR_ABA, ouvir);
  });
  it("toque: a dica 3 abre a folha Organizar abas", () => {
    render(<ModuleTip moduleId="treino" />);
    const pedidos: unknown[] = [];
    const ouvir = (e: Event) => pedidos.push((e as CustomEvent).detail);
    window.addEventListener(EVENTO_ORGANIZAR_ABAS, ouvir);
    fireEvent.click(screen.getByTestId("dica-3"));
    expect(pedidos).toEqual([{ modulo: "treino" }]);
    window.removeEventListener(EVENTO_ORGANIZAR_ABAS, ouvir);
  });
  it("texto: as MESMAS dicas, sem botão nem seta; a de ocultar abas diz onde fica", () => {
    localStorage.setItem(CHAVE_FORCA_DICAS, "texto");
    const { container } = render(<ModuleTip moduleId="rotina" />);
    expect(screen.getByTestId("dicas-modulo").getAttribute("data-modo")).toBe("texto");
    const botoes = screen.getAllByRole("button");
    expect(botoes.map((b) => b.getAttribute("aria-label"))).toEqual(["Fechar dicas"]); // só o X
    expect(container.querySelector("svg.lucide-chevron-right")).toBeNull();
    expect(screen.getByTestId("dica-1").textContent).toBe(DICAS_DO_MODULO.rotina[0].texto);
    expect(screen.getByTestId("dica-3").textContent).toMatch(/ícone ao fim da fileira/);
  });
  it("Beleza usa o mesmo cartão (na paleta dela), nas duas apresentações", () => {
    render(<DicasDaBeleza />);
    expect(screen.getByTestId("dicas-beleza").getAttribute("data-modo")).toBe("toque");
    expect(screen.getByTestId("dica-1").textContent).toContain("3 perguntas");
    cleanup();
    localStorage.setItem(CHAVE_FORCA_DICAS, "texto");
    render(<DicasDaBeleza />);
    expect(screen.getByTestId("dicas-beleza").getAttribute("data-modo")).toBe("texto");
  });
  it("fechar grava a marca na conta e some; reabrir (montar de novo, conta com a marca) não traz de volta — nas duas", () => {
    for (const modo of ["toque", "texto"]) {
      localStorage.setItem(CHAVE_FORCA_DICAS, modo);
      estado.store = {};
      render(<ModuleTip moduleId="casa" />);
      fireEvent.click(screen.getByLabelText("Fechar dicas"));
      expect(set).toHaveBeenCalledWith("core-tip-seen-casa", "true");
      cleanup();
      estado.loaded = false;
      const { rerender } = render(<ModuleTip moduleId="casa" />);
      expect(screen.queryByTestId("dicas-modulo")).toBeNull();
      estado.loaded = true;
      rerender(<ModuleTip moduleId="casa" />);
      expect(screen.queryByTestId("dicas-modulo"), modo).toBeNull();
      cleanup();
    }
  });
});

describe("onde aparece", () => {
  const porta = (moduleId: string, rota = "/" + moduleId) => {
    navegar(rota);
    return render(<MemoryRouter initialEntries={[rota]}><BoasVindasDoModulo moduleId={moduleId} /></MemoryRouter>);
  };
  it("modo 1.0.12 da loja (fluxo enxuto fixo): o cartão de dicas VOLTA — e só ele (nem intro, nem cartões)", () => {
    (globalThis as { __MODO_1012__?: unknown }).__MODO_1012__ = true;
    for (const m of ["rotina", "treino", "casa", "pet", "relacionamentos"]) {
      porta(m);
      expect(screen.getByTestId("dicas-modulo").getAttribute("data-modulo"), m).toBe(m);
      expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
      expect(document.querySelector("[data-intro-modulo]")).toBeNull();
      cleanup();
    }
  });
  it("nunca nas demos de venda (/preview, /experimente, /liberar, /hoje/demo, /organizar/demo)", () => {
    (globalThis as { __MODO_1012__?: unknown }).__MODO_1012__ = true;
    for (const rota of ["/preview/rotina", "/experimente", "/liberar", "/hoje/demo", "/organizar/demo"]) {
      porta("rotina", rota);
      expect(screen.queryByTestId("dicas-modulo"), rota).toBeNull();
      cleanup();
    }
    navegar("/organizar/demo");
    render(<ModuleTip moduleId="financas" />);
    expect(screen.queryByTestId("dicas-modulo")).toBeNull();
  });
});

describe("o toque leva ao lugar", () => {
  const abasFalsas = (ocultas: string[]): AbasOcultas<{ id: string; label: string }> => {
    const todas = [{ id: "cardapio", label: "CARDÁPIO" }, { id: "diario", label: "DIÁRIO" }, { id: "jejum", label: "JEJUM" }];
    return {
      modulo: "dieta", todas, visiveis: todas.filter((a) => !ocultas.includes(a.id)), ocultas: todas.filter((a) => ocultas.includes(a.id)),
      ocultar: () => true, mostrar: () => {}, mostrarTodas: () => {}, podeOcultar: true,
    };
  };
  it("a fileira troca pra aba da dica (inclusive uma OCULTA, como os links) e ignora outro módulo", () => {
    const trocar = vi.fn();
    render(<AbasOcultaveis abas={abasFalsas(["diario", "jejum"])} ativa="cardapio" onTrocar={trocar} />);
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ABA, { detail: { modulo: "dieta", aba: "diario" } })); });
    expect(trocar).toHaveBeenCalledWith("diario");
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ABA, { detail: { modulo: "rotina", aba: "jejum" } })); });
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ABA, { detail: { modulo: "dieta", aba: "nao-existe" } })); });
    expect(trocar).toHaveBeenCalledTimes(1);
  });
  it("a dica de ocultar abas abre a folha Organizar abas do módulo", () => {
    render(<AbasOcultaveis abas={abasFalsas([])} ativa="cardapio" onTrocar={() => {}} />);
    expect(screen.queryByTestId("abas-organizar-folha")).toBeNull();
    act(() => { irParaDica("dieta", DICAS_DO_MODULO.dieta[2], 2); });
    expect(screen.getByTestId("abas-organizar-folha")).toBeTruthy();
  });
  it("acharAlvo: seletor na ordem, o n-ésimo (Viagens › PRÓXIMO = 3º 'Destino...'), e texto de botão", () => {
    document.body.innerHTML = `<main><input placeholder="Destino..." id="a"><input placeholder="Destino..." id="b"><input placeholder="Destino..." id="c"><button>Concluir treino</button></main>`;
    expect(acharAlvo(DICAS_DO_MODULO.viagens[0])?.id).toBe("a");
    expect(acharAlvo(DICAS_DO_MODULO.viagens[1])?.id).toBe("c");
    expect(acharAlvo(DICAS_DO_MODULO.treino[1])?.textContent).toBe("Concluir treino");
    document.body.innerHTML = "";
  });
  it("focar: depois de abrir a aba, o campo do alvo recebe o cursor e acende", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<main><div data-spotlight="add-income"><input placeholder="+ Nova receita"></div></main>`;
    // jsdom não mede: o alvo conta como visível se tiver caixa
    const el = document.querySelector<HTMLElement>('[data-spotlight="add-income"]')!;
    el.getBoundingClientRect = () => ({ width: 300, height: 40 }) as DOMRect;
    irParaDica("financas", DICAS_DO_MODULO.financas[0], 0);
    await vi.advanceTimersByTimeAsync(200);
    expect((document.activeElement as HTMLInputElement).placeholder).toBe("+ Nova receita");
    expect(el.getAttribute("data-dica-aceso")).toBe("1");
    await vi.advanceTimersByTimeAsync(3000);
    expect(el.getAttribute("data-dica-aceso")).toBeNull();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });
});
