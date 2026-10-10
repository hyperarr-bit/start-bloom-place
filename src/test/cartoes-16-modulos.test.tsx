/**
 * CARTÕES DE BOAS-VINDAS EM POPUP, NOS 16 MÓDULOS (1.0.14) — o que este arquivo trava:
 *   · os 16 módulos têm os 3 cartões no mesmo molde (1 "faz isso agora" com ação de 1 toque e
 *     seletor real; 2 "onde fica o essencial" com 2–3 abas e miniatura; 3 "o que não precisa hoje"
 *     com 3 itens), cada um na SUA classe de paleta (cartoes.css), em linguagem de ação (sem "clique em ⚙️");
 *   · as 14 páginas que mostravam o ModuleTip "Dicas para começar" (e o Pet, que não mostrava nada)
 *     passam pela porta única BoasVindasDoModulo: chave off = ModuleTip de sempre (ou nada, no Pet);
 *     chave on = a folha (popup) dos cartões, 72% da tela, módulo escurecido atrás, "Já sei" no topo;
 *   · "Fazer agora" fecha a folha e acende o campo real; arrastar a folha pra baixo = "Já sei".
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", created_at: new Date().toISOString() }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) } },
}));

import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { CartoesDoModulo } from "@/components/cartoes-modulo/CartoesDoModulo";
import { MODULOS_COM_CARTOES, abrirAba, carregarCartoes } from "@/components/cartoes-modulo/registro";
import { CHAVE_FORCA_CARTOES, chaveCartoesVistos } from "@/lib/tour-home";
import { MODULOS } from "@/lib/modulos";
import Saude from "@/pages/Saude";
import { criarNuvem, prepararJsdom } from "./compat-comum";

const RAIZ = join(__dirname, "..", "..");
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
/** Página de cada módulo (os 14 que trocaram o ModuleTip + o Pet). Finanças e Beleza montam os cartões direto. */
const PAGINA: Record<string, string> = {
  rotina: "Rotina", treino: "Treino", saude: "Saude", dieta: "Dieta", desenvolvimento: "DesenvolvimentoPessoal", casa: "Casa", estudos: "Estudos",
  biblioteca: "Biblioteca", hiperfoco: "Hiperfoco", carreira: "Carreira", relacionamentos: "Relacionamentos", detox: "Detox", pet: "Pet", viagens: "Viagens",
};
/** Espera a config do módulo (import dinâmico) chegar e a folha montar. */
const esperarFolha = async () => {
  for (let i = 0; i < 60 && !screen.queryByTestId("cartoes-modulo"); i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
  return screen.getByTestId("cartoes-modulo");
};
const respirar = async (n = 8) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setImmediate(r)); }); };

beforeAll(prepararJsdom);
beforeEach(() => { localStorage.clear(); eventos.length = 0; });
afterEach(() => { cleanup(); });

describe("os 16 módulos têm os 3 cartões no mesmo molde", () => {
  it("o registro cobre exatamente os 16 módulos da grade", () => {
    expect([...MODULOS_COM_CARTOES].sort()).toEqual(MODULOS.map((m) => m.id).sort());
  });

  for (const id of MODULOS.map((m) => m.id)) {
    it(`${id}: 1 ação de 1 toque com seletor real, 2–3 abas vivas + miniatura, 3 coisas que ficam pra depois, na paleta ct-${id}, em linguagem de ação`, async () => {
      const fabrica = await carregarCartoes(id);
      expect(fabrica).not.toBeNull();
      const c = fabrica!();
      expect(c.moduleId).toBe(id);
      expect(c.classe).toBe(`ct-${id}`);
      expect(c.nome.length).toBeGreaterThan(1);
      expect(c.agora.titulo).toBe("Faz isso agora");
      expect(c.agora.texto.length).toBeGreaterThan(8);
      expect(c.agora.botao).toBe("Fazer agora");
      expect(c.agora.seletor.length).toBeGreaterThan(3);
      expect(c.essencial.titulo).toBe("Onde fica o essencial");
      expect(c.essencial.abas.length).toBeGreaterThanOrEqual(2);
      expect(c.essencial.abas.length).toBeLessThanOrEqual(3);
      expect(c.essencial.miniatura).toBeTruthy();
      expect(c.depois.titulo).toBe("O que não precisa hoje");
      expect(c.depois.itens).toHaveLength(3);
      const textos = [c.agora.texto, c.agora.apoio ?? "", ...c.depois.itens].join(" ");
      expect(textos).not.toMatch(/clique|⚙️|clicar/i);
    });
  }

  it("cada módulo tem a própria paleta no cartoes.css (claro e escuro)", () => {
    const css = ler("src/components/cartoes-modulo/cartoes.css");
    for (const m of MODULOS) {
      expect(css, m.id).toContain(`.ct-${m.id} {`);
      if (m.id !== "beleza") expect(css, m.id).toContain(`.dark .ct-${m.id} {`); // a Beleza herda os tokens --bz-* (o escuro já mora lá)
    }
  });

  it("as 14 páginas passam pela porta única (BoasVindasDoModulo) e nenhuma renderiza o ModuleTip direto", () => {
    for (const [id, arquivo] of Object.entries(PAGINA)) {
      const src = ler(`src/pages/${arquivo}.tsx`);
      expect(src, arquivo).toContain(`<BoasVindasDoModulo`);
      expect(src, arquivo).toMatch(new RegExp(`<BoasVindasDoModulo[^>]*moduleId="${id}"`));
      expect(src, arquivo).not.toContain("<ModuleTip");
    }
    // o ModuleTip continua existindo — é a reserva com a chave desligada
    expect(ler("src/components/cartoes-modulo/BoasVindasDoModulo.tsx")).toContain("<ModuleTip");
  });
});

describe("a porta única: chave off = ModuleTip de sempre; on = a folha dos cartões", () => {
  const DICAS = ["Dica um", "Dica dois"];

  it("off: o 'Dicas para começar' com as mesmas dicas, nenhuma folha, nenhum evento; Pet sem dicas = nada", () => {
    const n = criarNuvem({});
    n.montar(<><BoasVindasDoModulo moduleId="rotina" tips={DICAS} /><BoasVindasDoModulo moduleId="pet" /></>, "/rotina");
    expect(screen.getByText("Dicas para começar")).toBeInTheDocument();
    expect(screen.getByText("Dica um")).toBeInTheDocument();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos).toEqual([]);
    expect(document.querySelectorAll("[data-camada-guia]")).toHaveLength(0);
  });

  it("on: a folha sobe por cima (portal, overlay escuro, 72% da tela, camada de guia), 3 cartões, 'Já sei' no topo; o Dicas não aparece", async () => {
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    const n = criarNuvem({});
    n.montar(<BoasVindasDoModulo moduleId="rotina" tips={DICAS} />, "/rotina");
    const folha = await esperarFolha();
    expect(screen.queryByText("Dicas para começar")).toBeNull();
    expect(folha.className).toContain("ct-rotina");
    expect(folha.className).toContain("h-[72dvh]");
    expect(folha.getAttribute("data-camada-guia")).toBe("cartoes-modulo");
    expect(folha.getAttribute("data-modulo")).toBe("rotina");
    expect(folha.getAttribute("role")).toBe("dialog");
    expect(folha.querySelectorAll("article")).toHaveLength(3);
    expect(screen.getByText(/Cria 1 hábito/)).toBeInTheDocument();
    expect(screen.getByTestId("cartoes-ja-sei")).toBeInTheDocument();
    expect(screen.getByTestId("cartoes-contador").textContent).toBe("1 de 3");
    expect(screen.getByTestId("miniatura")).toBeInTheDocument();
    expect(eventos.map(([e]) => e)).toEqual(["modulo_cartoes_vistos", "modulo_cartao"]);
    fireEvent.click(screen.getByTestId("cartoes-bolinha-2"));
    expect(screen.getByTestId("cartoes-contador").textContent).toBe("3 de 3");
    fireEvent.click(screen.getByTestId("cartoes-comecar"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(localStorage.getItem(chaveCartoesVistos("rotina"))).toBeTruthy();
    expect(n.ler("core-tip-seen-rotina")).toBe("true");
    expect(eventos.at(-1)).toEqual(["modulo_cartoes_fechados", { moduleId: "rotina", indice: 2 }]);
    // o Dicas antigo também não volta
    cleanup();
    n.montar(<BoasVindasDoModulo moduleId="rotina" tips={DICAS} />, "/rotina");
    await respirar();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.queryByText("Dicas para começar")).toBeNull();
  });

  it("on: Pet (que não tinha dica) ganha a folha; 'Fazer agora' fecha a folha e acende o campo real", async () => {
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    const n = criarNuvem({});
    n.montar(<><div data-spotlight="pet-especie">espécie</div><BoasVindasDoModulo moduleId="pet" /></>, "/pet");
    const folha = await esperarFolha();
    expect(folha.className).toContain("ct-pet");
    fireEvent.click(screen.getByTestId("cartoes-fazer-agora"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos.map(([e]) => e)).toContain("modulo_cartao_fazer_agora");
    expect(await screen.findByTestId("cartoes-anel")).toBeInTheDocument();
  });

  it("arrastar a folha pra baixo / tocar fora = 'Já sei'", async () => {
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    const n = criarNuvem({});
    n.montar(<CartoesDoModulo moduleId="detox" />, "/detox");
    await esperarFolha();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await respirar(2);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos.at(-1)?.[0]).toBe("modulo_cartoes_fechados");
    expect(localStorage.getItem(chaveCartoesVistos("detox"))).toBeTruthy();
  });

  it("na demo (/preview) nunca: nem folha, nem evento", async () => {
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    const n = criarNuvem({});
    n.montar(<BoasVindasDoModulo moduleId="rotina" tips={DICAS} />, "/preview/rotina");
    await respirar();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.getByText("Dicas para começar")).toBeInTheDocument();
    expect(eventos).toEqual([]);
  });

  it("abrirAba toca no botão de aba pelo rótulo (o 'antes' do Fazer agora), e ignora rótulo que não existe", () => {
    const clicou = vi.fn();
    render(<header><button type="button" onClick={() => clicou("hoje")}>🏋️ HOJE</button><button type="button" className="notion-tab" onClick={() => clicou("plano")}>📋 PLANO</button></header>);
    abrirAba("PLANO");
    expect(clicou).toHaveBeenCalledWith("plano");
    abrirAba("NÃO EXISTE");
    expect(clicou).toHaveBeenCalledTimes(1);
  });
});

describe("numa página real (Saúde)", () => {
  it("off: o 'Dicas para começar' de sempre; on: a folha na paleta da Saúde com o HydrationTracker de verdade na miniatura", async () => {
    const n = criarNuvem({ "spotlight-done-saude": "true" });
    n.montar(<Saude />, "/saude");
    expect(screen.getByText("Dicas para começar")).toBeInTheDocument();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    cleanup();
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    const n2 = criarNuvem({ "spotlight-done-saude": "true" });
    n2.montar(<Saude />, "/saude");
    const folha = await esperarFolha();
    expect(folha.className).toContain("ct-saude");
    expect(screen.queryByText("Dicas para começar")).toBeNull();
    expect(screen.getByText(/Registra 1 copo d'água/)).toBeInTheDocument();
    expect(screen.getByTestId("miniatura").textContent).toMatch(/água|copo/i);
    fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
  });
});
