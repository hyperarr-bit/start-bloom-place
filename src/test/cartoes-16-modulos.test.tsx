/**
 * CARTÕES DE BOAS-VINDAS EM POPUP, NOS 16 MÓDULOS (1.0.14; v2 em 10/10) — o que este arquivo trava:
 *   · os 16 módulos têm 4 a 6 cartões no mesmo molde (1 "faz isso agora" com ação de 1 toque, seletor
 *     real e a miniatura animada; 2..N-1 uma coisa do módulo por cartão, cada um com a sua imagem viva;
 *     N "o que não precisa hoje"), cada um na SUA classe de paleta (cartoes.css), em linguagem de ação;
 *   · CONTA VAZIA: os cartões montam sem nenhuma chave na conta e nenhum cartão mostra tela vazia —
 *     as miniaturas vivem do store de exemplo em memória, nunca do dado da pessoa;
 *   · FUNDO (bug da Beleza): a folha tem fundo sólido e overlay escuro em todo módulo — a classe da
 *     Beleza carrega o escopo dos tokens (tema-beleza) e o cartoes.css tem reserva literal pra todos;
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
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) } },
}));

import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { CartoesDoModulo } from "@/components/cartoes-modulo/CartoesDoModulo";
import { totalDeCartoes } from "@/components/cartoes-modulo/CartoesDoModulo";
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

describe("os 16 módulos têm 4 a 6 cartões no mesmo molde", () => {
  it("o registro cobre exatamente os 16 módulos da grade", () => {
    expect([...MODULOS_COM_CARTOES].sort()).toEqual(MODULOS.map((m) => m.id).sort());
  });

  for (const id of MODULOS.map((m) => m.id)) {
    it(`${id}: 1 ação de 1 toque com seletor real + miniatura animada, 2–4 cartões com imagem viva, 2–3 coisas pra depois, na paleta ct-${id}, em linguagem de ação`, async () => {
      const fabrica = await carregarCartoes(id);
      expect(fabrica).not.toBeNull();
      const c = fabrica!();
      expect(c.moduleId).toBe(id);
      expect(c.classe.split(" ")).toContain(`ct-${id}`);
      if (id === "beleza") expect(c.classe.split(" ")).toContain("tema-beleza"); // o escopo dos tokens --bz-* viaja com a folha (portal)
      expect(c.nome.length).toBeGreaterThan(1);
      expect(c.agora.texto.length).toBeGreaterThan(8);
      expect(c.agora.botao).toBe("Fazer agora");
      expect(c.agora.seletor.length).toBeGreaterThan(3);
      expect(c.agora.miniatura).toBeTruthy();
      expect(c.cartoes.length).toBeGreaterThanOrEqual(2);
      expect(c.cartoes.length).toBeLessThanOrEqual(4);
      for (const k of c.cartoes) { expect(k.titulo.length).toBeGreaterThan(3); expect(k.texto.length).toBeGreaterThan(8); expect(k.miniatura).toBeTruthy(); }
      expect(totalDeCartoes(c)).toBeGreaterThanOrEqual(4);
      expect(totalDeCartoes(c)).toBeLessThanOrEqual(6);
      expect(c.depois.itens.length).toBeGreaterThanOrEqual(2);
      expect(c.depois.itens.length).toBeLessThanOrEqual(3);
      const textos = [c.agora.texto, c.agora.apoio ?? "", ...c.cartoes.map((k) => `${k.titulo} ${k.texto}`), ...c.depois.itens].join(" ");
      expect(textos).not.toMatch(/clique|⚙️|clicar/i);
    });

    it(`${id}: CONTA VAZIA — a folha monta sem nenhuma chave na conta, com fundo sólido, e nenhum cartão mostra tela vazia`, async () => {
      localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
      const n = criarNuvem({});
      n.montar(<CartoesDoModulo moduleId={id} />, `/${id}`);
      const folha = await esperarFolha();
      await respirar(4);
      const total = Number(folha.getAttribute("data-total"));
      expect(total).toBeGreaterThanOrEqual(4);
      expect(total).toBeLessThanOrEqual(6);
      const artigos = folha.querySelectorAll("article");
      expect(artigos).toHaveLength(total);
      expect(screen.getByTestId("cartoes-contador").textContent).toBe(`1 de ${total}`);
      // fundo: a folha é pintada pela classe .ct-folha (cartoes.css: background: var(--ct-cartao), que cada
      // .ct-{modulo} define em cor literal) — e o overlay escuro está por trás
      expect(folha.className).toContain("ct-folha");
      expect(folha.className.split(" ")).toContain(`ct-${id}`);
      expect(document.querySelector("[class*='bg-black/55']")).not.toBeNull();
      // cada cartão (menos o "relaxa") tem a sua imagem viva com conteúdo de exemplo — nunca "Nenhum…"
      artigos.forEach((art, i) => {
        if (i === total - 1) return;
        const mini = art.querySelector('[data-testid="miniatura"]');
        expect(mini, `${id} cartão ${i + 1}`).not.toBeNull();
        const texto = (mini!.textContent ?? "").replace(/\s+/g, " ").trim();
        expect(texto.length, `${id} cartão ${i + 1}: ${texto}`).toBeGreaterThan(15);
        // os "estados vazios" das telas ("Nenhum gasto cadastrado", "Comece adicionando…") — "Nenhum conflito de ativos ✅" é status, não vazio
        expect(texto, `${id} cartão ${i + 1}`).not.toMatch(/nenhum[a]?\s+\w+\s+(cadastrad|registrad|adicionad|salv)|vazi[oa]\b|ainda não tem|comece adicionando|adicione (seu|sua|o|a) primeir/i);
      });
      // o dado da conta continua vazio: a única escrita possível é o carimbo do "Já sei"
      expect(n.escritasDeDado()).toEqual([]);
      fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
      expect(n.escritasDeDado()).toEqual([`core-tip-seen-${id}`]);
    });
  }

  it("cada módulo tem a própria paleta no cartoes.css (claro e escuro), com as 8 variáveis em cor LITERAL — nunca só var() de outro escopo", () => {
    const css = ler("src/components/cartoes-modulo/cartoes.css");
    const VARS = ["--ct-papel", "--ct-cartao", "--ct-faixa", "--ct-tinta", "--ct-suave", "--ct-linha", "--ct-acento", "--ct-acento-tinta"];
    const bloco = (seletor: string) => {
      const i = css.indexOf(`${seletor} {`);
      expect(i, seletor).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf("}", i));
    };
    for (const m of MODULOS) {
      for (const sel of [`.ct-${m.id}`, `.dark .ct-${m.id}`]) {
        const b = bloco(sel);
        for (const v of VARS) {
          const valor = (b.match(new RegExp(`${v}:\\s*([^;]+);`)) ?? [])[1] ?? "";
          expect(valor, `${sel} ${v}`).toMatch(/^#[0-9a-f]{6}$/i); // literal: a folha nunca fica transparente por var() sem escopo
        }
      }
    }
    // a Beleza ainda usa os tokens do módulo quando o escopo está presente (classe tema-beleza na folha)
    expect(css).toContain(".tema-beleza.ct-beleza");
    expect(css).toContain("--ct-cartao: hsl(var(--bz-cartao))");
    expect(css).toContain(".ct-folha { background: var(--ct-cartao, hsl(var(--card)))");
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

  it("off: o 'Dicas para começar' (a lista do uso real vence o `tips`; o Pet ganhou dicas em 28/10), nenhuma folha, nenhum evento", () => {
    const n = criarNuvem({});
    n.montar(<><BoasVindasDoModulo moduleId="rotina" tips={DICAS} /><BoasVindasDoModulo moduleId="pet" /></>, "/rotina");
    expect(screen.getAllByText("Dicas para começar")).toHaveLength(2);
    expect(screen.queryByText("Dica um")).toBeNull();
    expect(screen.getByText("Crie seus hábitos e marque cada um quando fizer")).toBeInTheDocument();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos).toEqual([]);
    expect(document.querySelectorAll("[data-camada-guia]")).toHaveLength(0);
  });

  it("on: a folha sobe por cima (portal, overlay escuro, 72% da tela, camada de guia), 5 cartões, 'Já sei' no topo; o Dicas não aparece", async () => {
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
    expect(folha.querySelectorAll("article")).toHaveLength(5);
    expect(screen.getByText(/Cria 1 hábito/)).toBeInTheDocument();
    expect(screen.getByTestId("cartoes-ja-sei")).toBeInTheDocument();
    expect(screen.getByTestId("cartoes-contador").textContent).toBe("1 de 5");
    expect(screen.getAllByTestId("miniatura")).toHaveLength(4); // 1 por cartão, menos o "relaxa"
    expect(eventos.map(([e]) => e)).toEqual(["modulo_cartoes_vistos", "modulo_cartao"]);
    fireEvent.click(screen.getByTestId("cartoes-bolinha-4"));
    expect(screen.getByTestId("cartoes-contador").textContent).toBe("5 de 5");
    fireEvent.click(screen.getByTestId("cartoes-comecar"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(localStorage.getItem(chaveCartoesVistos("rotina"))).toBeTruthy();
    expect(n.ler("core-tip-seen-rotina")).toBe("true");
    expect(eventos.at(-1)).toEqual(["modulo_cartoes_fechados", { moduleId: "rotina", indice: 4 }]);
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
    // 28/10: nem o "Dicas para começar" (demo de venda não mostra dicas — lib/dicas-do-modulo)
    expect(screen.queryByText("Dicas para começar")).toBeNull();
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

describe("v3: espiada do próximo, setas e a dica 'Deslize →' (dono no Simulador: 'tem que ficar mais óbvio que rola pro lado')", () => {
  beforeEach(() => localStorage.setItem(CHAVE_FORCA_CARTOES, "on"));

  it("a seta → avança pelo mesmo snap (evento cartoes_modulo_seta {modulo, de, para}); ← aparece a partir do 2º e volta; no último a → vira o ✓ do Já sei", async () => {
    const n = criarNuvem({});
    n.montar(<CartoesDoModulo moduleId="rotina" />, "/rotina");
    const folha = await esperarFolha();
    const total = Number(folha.getAttribute("data-total"));
    expect(screen.queryByTestId("cartoes-seta-anterior")).toBeNull(); // no 1º não há "←"
    fireEvent.click(screen.getByTestId("cartoes-seta-proximo"));
    expect(screen.getByTestId("cartoes-contador").textContent).toBe(`2 de ${total}`);
    expect(eventos).toContainEqual(["cartoes_modulo_seta", { modulo: "rotina", de: 0, para: 1 }]);
    expect(eventos).toContainEqual(["modulo_cartao", { moduleId: "rotina", indice: 1 }]);
    expect(screen.getByTestId("cartoes-seta-anterior")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cartoes-seta-anterior"));
    expect(screen.getByTestId("cartoes-contador").textContent).toBe(`1 de ${total}`);
    expect(eventos).toContainEqual(["cartoes_modulo_seta", { modulo: "rotina", de: 1, para: 0 }]);
    // até o último: a "→" some e no lugar fica o "✓" (Já sei), que fecha
    for (let i = 0; i < total - 1; i++) fireEvent.click(screen.getByTestId("cartoes-seta-proximo"));
    expect(screen.getByTestId("cartoes-contador").textContent).toBe(`${total} de ${total}`);
    expect(screen.queryByTestId("cartoes-seta-proximo")).toBeNull();
    expect(folha.querySelector("article[data-ultimo]")).not.toBeNull(); // o último não tem espiada (CSS: 100%)
    fireEvent.click(screen.getByTestId("cartoes-seta-fechar"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos).toContainEqual(["cartoes_modulo_seta", { modulo: "rotina", de: total - 1, para: "fechar" }]);
    expect(eventos.at(-1)).toEqual(["modulo_cartoes_fechados", { moduleId: "rotina", indice: total - 1 }]);
  });

  it("a dica 'Deslize →' só no 1º cartão, some ao 1º toque na seta e não volta neste aparelho (nem em outro módulo)", async () => {
    const n = criarNuvem({});
    n.montar(<CartoesDoModulo moduleId="casa" />, "/casa");
    await esperarFolha();
    expect(screen.getByTestId("cartoes-dica-deslizar")).toBeInTheDocument();
    expect(localStorage.getItem("core-cartoes-dica-deslizar")).toBeNull();
    fireEvent.click(screen.getByTestId("cartoes-seta-proximo"));
    expect(screen.queryByTestId("cartoes-dica-deslizar")).toBeNull();
    expect(localStorage.getItem("core-cartoes-dica-deslizar")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cartoes-seta-anterior"));
    expect(screen.queryByTestId("cartoes-dica-deslizar")).toBeNull(); // voltar pro 1º não traz a dica de volta
    cleanup();
    const n2 = criarNuvem({});
    n2.montar(<CartoesDoModulo moduleId="pet" />, "/pet");
    await esperarFolha();
    expect(screen.queryByTestId("cartoes-dica-deslizar")).toBeNull();
  });

  it("a dica some pelo swipe (bolinha) também; fechar a folha com a dica na tela já conta como vista", async () => {
    const n = criarNuvem({});
    n.montar(<CartoesDoModulo moduleId="detox" />, "/detox");
    await esperarFolha();
    fireEvent.click(screen.getByTestId("cartoes-bolinha-2"));
    expect(screen.queryByTestId("cartoes-dica-deslizar")).toBeNull();
    expect(localStorage.getItem("core-cartoes-dica-deslizar")).toBeTruthy();
    localStorage.removeItem("core-cartoes-dica-deslizar");
    cleanup();
    const n2 = criarNuvem({});
    n2.montar(<CartoesDoModulo moduleId="viagens" />, "/viagens");
    await esperarFolha();
    expect(screen.getByTestId("cartoes-dica-deslizar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
    expect(localStorage.getItem("core-cartoes-dica-deslizar")).toBeTruthy();
  });

  it("CSS: espiada (cartão 88%, o último 100%), setas de 38 px na cor do módulo, dica com 3 ciclos e parada no reduced-motion", () => {
    const css = ler("src/components/cartoes-modulo/cartoes.css");
    expect(css).toContain(".ct-folha .ct-pagina { width: 88%; }");
    expect(css).toContain(".ct-folha .ct-pagina[data-ultimo] { width: 100%; }");
    expect(css).toMatch(/\.ct-seta \{[^}]*width: 38px; height: 38px;[^}]*background: var\(--ct-acento\)/);
    expect(css).toMatch(/\.ct-dica-seta \{[^}]*animation: ct-deslize \.7s ease-in-out 3/);
    const reduzido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduzido).toMatch(/\.ct-dica-seta \{ animation: none; \}|, \.ct-dica-seta \{ animation: none; \}/);
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
    expect(screen.getAllByTestId("miniatura")[1].textContent).toMatch(/água|copo/i); // o 2º cartão: o HydrationTracker de verdade
    fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
  });
});
