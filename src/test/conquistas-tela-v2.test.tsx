/**
 * Conquistas v2 (27/09) na tela: o planner que abre na página das insígnias,
 * o "Postar nos Stories" com 4 artes, o "Reativar desafios" que saiu (o
 * Desafiante trancado oferece ligar), e o CICLO COMPLETO — abrir → adesivo
 * abre → sair → REABRIR sem o dado: continua colado, e o nível não cai.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: unknown) => { eventos.push([nome, dados]); },
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { TelaConquistas } from "@/components/conquistas/TelaConquistas";
import { CHAVE_NIVEL_PISO } from "@/components/gamification/types";
import { somarDias } from "@/lib/sequencia";

const HOJE = "2026-09-26";
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));

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
const abrir = (store: ReturnType<typeof montarStore>) =>
  render(
    <MemoryRouter initialEntries={["/conquistas"]}>
      <Provedor store={store}>
        <Routes>
          <Route path="/conquistas" element={<TelaConquistas />} />
          <Route path="*" element={<p>outra tela</p>} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );

const cenario = (extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
  "conquistas-desbloqueadas": { "sequencia-7": "2026-09-20", "leitura-1": "2026-09-21" },
  "conquistas-vistas": { adesivos: ["sequencia-7", "leitura-1"], marcos: [7] },
  [CHAVE_NIVEL_PISO]: "Bronze",
  "lib-books": [{ status: "lido" }],
  ...extra,
});

beforeEach(() => {
  eventos.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("planner que abre", () => {
  it("toque na capa abre a página das insígnias com os números de verdade e o CTA; 'Fechar o planner' fecha", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("capa-3d"));
    const pagina = await screen.findByTestId("pagina-insignias");
    expect(pagina).toHaveTextContent("Minhas insígnias");
    expect(pagina).toHaveTextContent("SETEMBRO · 2026");
    // 12 dias seguidos e 1 livro lido têm dado; as outras 4 ficam "a conquistar", sem número inventado
    expect(pagina.querySelector('[data-patch="sequencia"] svg')).toHaveAttribute("aria-label", "DIAS SEGUIDOS: 12");
    expect(pagina.querySelector('[data-patch="livros"] svg')).toHaveAttribute("aria-label", "LIVROS LIDOS: 1");
    expect(pagina.querySelectorAll("[data-apagada]").length).toBe(4);
    expect(pagina).toHaveTextContent(/Nível Bronze/);
    expect(eventos).toContainEqual(["planner_abrir", { insignias: 2 }]);
    expect(screen.getByRole("button", { name: /Compartilhar insígnias/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar o planner" }));
    await waitFor(() => expect(screen.queryByTestId("pagina-insignias")).toBeNull(), { timeout: 3000 });
  });
});

describe("Postar nos Stories", () => {
  it("abre o seletor com as 4 artes (Capa, Carteirinha, Roseta, Insígnias) e a escolha abre a prévia", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    const artes = Array.from(folha.querySelectorAll("[data-arte]")).map((el) => el.getAttribute("data-arte"));
    expect(artes).toEqual(["capa", "carteirinha", "roseta", "insignias"]);
    expect(within(folha).getByText("NOVA")).toBeInTheDocument();
    fireEvent.click(folha.querySelector('[data-arte="roseta"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Roseta");
    expect(within(previa).getByRole("button", { name: /Postar nos Stories/ })).toBeInTheDocument();
    expect(within(previa).getByRole("button", { name: /Fundo transparente/ })).toBeInTheDocument();
    expect(eventos).toContainEqual(["arte_escolhida", { arte: "roseta", origem: "seletor" }]);
  });

  it("'Compartilhar insígnias' do planner aberto vai direto pra prévia das Insígnias", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("capa-3d"));
    fireEvent.click(await screen.findByRole("button", { name: /Compartilhar insígnias/ }));
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Insígnias");
    expect(previa.querySelector('[data-stories="insignias"]')).not.toBeNull();
  });
});

describe("saídas e atalhos (dono 27/09)", () => {
  it("a prévia tem como sair: o X lá em cima e o 'Voltar' embaixo voltam pro seletor", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    fireEvent.click(folha.querySelector('[data-arte="capa"]')!);
    fireEvent.click(within(await screen.findByTestId("previa-arte")).getByTestId("previa-voltar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
    expect(await screen.findByTestId("seletor-de-arte")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("seletor-de-arte").querySelector('[data-arte="roseta"]')!);
    fireEvent.click(within(await screen.findByTestId("previa-arte")).getByTestId("previa-fechar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
  });

  it("vindo direto do planner, o 'Voltar' da prévia fecha tudo (não cai na folha)", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("capa-3d"));
    fireEvent.click(await screen.findByRole("button", { name: /Compartilhar insígnias/ }));
    fireEvent.click(within(await screen.findByTestId("previa-arte")).getByTestId("previa-voltar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
    expect(screen.queryByTestId("seletor-de-arte")).toBeNull();
  });

  it("'Abrir meu planner' abre a página das insígnias sem tocar na capa, e some com o planner aberto", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("abrir-planner"));
    expect(await screen.findByTestId("pagina-insignias")).toHaveTextContent("Minhas insígnias");
    expect(screen.queryByTestId("abrir-planner")).toBeNull();
    expect(eventos.some(([n]) => n === "planner_abrir")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Fechar o planner/ }));
    expect(await screen.findByTestId("abrir-planner")).toBeInTheDocument();
  });
});

describe("desafios semanais", () => {
  it("o botão 'Reativar desafios semanais' saiu da tela; o Desafiante trancado oferece 'Ligar os desafios'", async () => {
    const store = montarStore(cenario({ "finance-challenges-hidden": true }));
    abrir(store);
    expect(screen.queryByText(/Reativar desafios/)).toBeNull();
    fireEvent.click(screen.getByText("Ver todos", { exact: false }));
    fireEvent.click(document.querySelector('[data-adesivo-celula="challenger"]')!);
    const ligar = await screen.findByRole("button", { name: /Ligar os desafios/ });
    fireEvent.click(ligar);
    expect(store.dados["finance-challenges-hidden"]).toBe(false);
  });
});

describe("ciclo completo: abrir → conquistar → sair → reabrir", () => {
  it("o adesivo que abriu fica gravado e continua colado sem o dado; o piso de nível fica", async () => {
    const store = montarStore(cenario({ "finance-incomes": [{ id: 1, value: 3000 }] }));
    const tela = abrir(store);
    // 1ª receita → "Primeiro Salário" abre e é gravado
    await waitFor(() => expect((store.dados["conquistas-desbloqueadas"] as Record<string, string>)["first-income"]).toBe(HOJE));
    expect(document.querySelector('[data-adesivo-celula="first-income"]')).toHaveAttribute("data-aberto", "true");
    expect(eventos).toContainEqual(["adesivo_desbloqueado", { id: "first-income" }]);
    tela.unmount();

    // sai da tela, a receita some (apagada), reabre: continua colado — e o nível não cai
    store.dados["finance-incomes"] = [];
    store.dados[CHAVE_NIVEL_PISO] = "Ouro";
    abrir(store);
    expect(document.querySelector('[data-adesivo-celula="first-income"]')).toHaveAttribute("data-aberto", "true");
    expect(document.querySelector('[data-nome-capa]')).toHaveTextContent("Ana Beatriz");
    fireEvent.click(screen.getByRole("button", { name: /Nível Ouro — ver progresso/ }));
    expect(await screen.findByTestId("aviso-piso")).toHaveTextContent(/nível nunca volta atrás/);
    // nenhuma festa atrasada: o momento não é montado nesta tela, e o registro não duplica
    expect(Object.keys(store.dados["conquistas-desbloqueadas"] as object).filter((k) => k === "first-income")).toHaveLength(1);
  });
});

describe("momentos: no máximo 3 festas de uma vez", () => {
  it("quando muitos adesivos abrem juntos, celebra os 3 mais raros e marca o resto como visto (colados na folha do mesmo jeito)", async () => {
    const { MomentosConquistas } = await import("@/components/conquistas/Momentos");
    // 5 adesivos novos de uma vez: 1º Salário (comum), Múltiplas Rendas (raro), Patrimônio 100k (lendário), Contas em Dia (comum), Lista de Desejos (comum)
    const store = montarStore(cenario({
      "conquistas-vistas": { adesivos: ["sequencia-7", "leitura-1"], marcos: [7] },
      "finance-incomes": [{ id: 1, name: "A", value: 3000 }, { id: 2, name: "B", value: 100 }, { id: 3, name: "C", value: 100 }],
      "finance-investments": [{ id: "i", name: "x", value: 100000 }],
      "finance-dueDays": [{ day: 5, bills: [{ id: "b1", name: "Luz", paid: true }] }],
      "finance-wishlist": [{ id: "w1", name: "Fone" }],
    }));
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Provedor store={store}><MomentosConquistas /></Provedor>
      </MemoryRouter>,
    );
    await waitFor(() => {
      const v = store.dados["conquistas-vistas"] as { adesivos: string[] };
      // os comuns extras entram como vistos; os mais raros ficam FORA de vistas (ganham festa, até o Continuar)
      expect(v.adesivos).toEqual(expect.arrayContaining(["bills-ok", "wishlist"]));
      expect(v.adesivos).not.toContain("investor-100k");
      expect(v.adesivos).not.toContain("multi-income");
    });
    // tudo continua gravado como conquistado
    const gravadas = store.dados["conquistas-desbloqueadas"] as Record<string, string>;
    for (const id of ["first-income", "multi-income", "investor-100k", "investor-1k", "investor-10k", "investor-50k", "bills-ok", "wishlist"]) expect(gravadas[id]).toBe(HOJE);
  });
});
