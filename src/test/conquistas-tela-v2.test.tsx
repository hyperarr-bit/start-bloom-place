/**
 * Conquistas v2 (27/09) na tela: o planner que abre no ÁLBUM DE ADESIVOS (os
 * mais raros, páginas por raridade com as vagas do que falta, pouco adesivo),
 * o "Postar nos Stories" com 4 artes (Capa e Álbum também em vídeo onde dá),
 * o "Reativar desafios" que saiu (o Desafiante trancado oferece ligar), e o
 * CICLO COMPLETO — abrir → adesivo abre → sair → REABRIR sem o dado: continua
 * colado, e o nível não cai.
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
// o aparelho gera vídeo? (o jsdom não tem WebCodecs nem MediaRecorder; o teste liga e desliga)
const suporte = vi.hoisted(() => ({ v: null as null | { formato: string; largura: number; altura: number } }));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => suporte.v }));
const videoDaArte = vi.hoisted(() => ({ fn: vi.fn(async (_arte: string, _d: unknown, p?: (f: number) => void) => { p?.(0.5); return "shared"; }) }));
vi.mock("@/components/conquistas/compartilhar-conquistas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/conquistas/compartilhar-conquistas")>()),
  compartilharVideoDaArte: (...a: unknown[]) => videoDaArte.fn(...(a as [string, unknown, ((f: number) => void)?])),
}));
// a prévia ao vivo fotografa com html-to-image (não existe no jsdom): um canvas de mentira
vi.mock("@/components/conquistas/video/AnimacaoAoVivo", () => ({ default: () => <canvas data-aovivo="tocando" /> }));

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
  suporte.v = null;
  videoDaArte.fn.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("planner que abre no álbum", () => {
  it("toque na capa abre o álbum: os mais raros (o colado mais recente antes), os 3 próximos como silhueta quando tem pouco, o resumo e o CTA; 'Fechar o planner' fecha", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("capa-3d"));
    const pagina = await screen.findByTestId("pagina-album");
    expect(pagina).toHaveTextContent("Meu álbum");
    expect(pagina).toHaveTextContent("SETEMBRO · 2026");
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("OS MAIS RAROS");
    // 2 raros colados (1º Livro Lido em 21/09 vem antes de 7 Dias Seguidos em 20/09) + os 3 mais perto como silhueta
    const vagas = Array.from(screen.getByTestId("album-pagina-0").querySelectorAll("[data-vaga]")).map((el) => [el.getAttribute("data-vaga"), el.getAttribute("data-aberto")]);
    expect(vagas.slice(0, 2)).toEqual([["leitura-1", "true"], ["sequencia-7", "true"]]);
    expect(vagas).toHaveLength(5);
    expect(vagas.slice(2).every(([, aberto]) => aberto === "false")).toBe(true);
    expect(screen.getByTestId("album-pagina-0").querySelectorAll('[data-testid="pilula-progresso"]')).toHaveLength(3);
    expect(screen.getByTestId("album-incentivo")).toHaveTextContent(/O mais perto:/);
    // os contadores contam de zero até o número de verdade
    await waitFor(() => expect(screen.getByTestId("album-contagem")).toHaveTextContent("2 de 65"), { timeout: 3000 });
    const resumo = screen.getByTestId("album-resumo");
    expect(resumo).toHaveTextContent(/Nível Bronze/);
    expect(resumo).toHaveTextContent("2 raros");
    await waitFor(() => expect(resumo).toHaveTextContent("2 de 65"), { timeout: 3000 });
    expect(eventos).toContainEqual(["planner_abrir", { adesivos: 2, paginas: 8 }]);
    expect(screen.getByRole("button", { name: /Compartilhar meu álbum/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar o planner" }));
    await waitFor(() => expect(screen.queryByTestId("pagina-album")).toBeNull(), { timeout: 3000 });
  });

  it("as páginas viram pelos botões ‹ › e pelo teclado: LENDÁRIOS (7 vagas, todas silhueta com progresso), ÉPICOS · 1/2… até COMUNS · 2/2; toque numa vaga abre o detalhe", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("abrir-planner"));
    await screen.findByTestId("pagina-album");
    expect(screen.getByTestId("album-anterior")).toBeDisabled();
    fireEvent.click(screen.getByTestId("album-proxima"));
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("LENDÁRIOS");
    expect(screen.getByTestId("album-contagem")).toHaveTextContent("0 de 7 · faltam 7");
    const lendarios = screen.getByTestId("album-pagina-1");
    expect(lendarios.querySelectorAll("[data-vaga]")).toHaveLength(7);
    expect(lendarios.querySelectorAll('[data-vaga][data-aberto="false"] [data-testid="pilula-progresso"]')).toHaveLength(7);
    expect(lendarios.querySelectorAll('[data-vazia][data-rar="lendario"]')).toHaveLength(7);
    expect(eventos).toContainEqual(["album_pagina", { indice: 1, secao: "lendario-1" }]);
    fireEvent.click(screen.getByTestId("album-proxima"));
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("ÉPICOS · 1/2");
    const trilho = screen.getByRole("region", { name: "Páginas do álbum" });
    fireEvent.keyDown(trilho, { key: "ArrowRight" });
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("ÉPICOS · 2/2");
    fireEvent.keyDown(trilho, { key: "End" });
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("COMUNS · 2/2");
    expect(screen.getByTestId("album-proxima")).toBeDisabled();
    fireEvent.keyDown(trilho, { key: "ArrowLeft" });
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("COMUNS · 1/2");
    // as bolinhas também viram
    fireEvent.click(screen.getByRole("tab", { name: "RAROS · 1/2" }));
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("RAROS · 1/2");
    expect(screen.getByTestId("album-contagem")).toHaveTextContent("2 de 21 · faltam 19");
    const raros = screen.getByTestId("album-pagina-4");
    expect(raros.querySelector('[data-vaga="sequencia-7"]')).toHaveAttribute("data-aberto", "true");
    fireEvent.click(raros.querySelector('[data-vaga="sequencia-7"]')!);
    expect(await screen.findByTestId("detalhe-adesivo")).toHaveTextContent("7 Dias Seguidos");
  });

  it("sem nenhum adesivo: 'COMEÇANDO O ÁLBUM' com os 3 mais perto e a frase pra começar — nunca uma página vazia", async () => {
    abrir(montarStore({ "core-user-name": "Ana", "conquistas-desbloqueadas": {}, [CHAVE_NIVEL_PISO]: "Bronze" }));
    fireEvent.click(screen.getByTestId("abrir-planner"));
    await screen.findByTestId("pagina-album");
    expect(screen.getByTestId("album-titulo")).toHaveTextContent("COMEÇANDO O ÁLBUM");
    const vagas = screen.getByTestId("album-pagina-0").querySelectorAll("[data-vaga]");
    expect(vagas).toHaveLength(3);
    expect(Array.from(vagas).every((v) => v.getAttribute("data-aberto") === "false")).toBe(true);
    expect(screen.getByTestId("album-incentivo")).toHaveTextContent(/Cada coisa anotada cola um adesivo aqui/);
    expect(screen.getByTestId("album-resumo")).toHaveTextContent("nenhum adesivo colado ainda");
  });
});

describe("Postar nos Stories", () => {
  it("abre o seletor com as 4 artes (Capa, Carteirinha, Roseta, Álbum) e a escolha abre a prévia", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    const artes = Array.from(folha.querySelectorAll("[data-arte]")).map((el) => el.getAttribute("data-arte"));
    expect(artes).toEqual(["capa", "carteirinha", "roseta", "album"]);
    expect(within(folha).getByText("NOVA")).toBeInTheDocument();
    expect(within(folha).queryByTestId("selo-video")).toBeNull();
    fireEvent.click(folha.querySelector('[data-arte="roseta"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Roseta");
    expect(within(previa).getByRole("button", { name: /Postar nos Stories/ })).toBeInTheDocument();
    expect(within(previa).getByRole("button", { name: /Fundo transparente/ })).toBeInTheDocument();
    expect(eventos).toContainEqual(["arte_escolhida", { arte: "roseta", origem: "seletor" }]);
  });

  it("a arte do Álbum mostra os mais raros; sem como gerar vídeo, a prévia só oferece a imagem", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    fireEvent.click(folha.querySelector('[data-arte="album"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Álbum");
    const arte = previa.querySelector('[data-stories="album"]')!;
    expect(arte).not.toBeNull();
    expect(arte).toHaveTextContent("OS MAIS RAROS");
    expect(arte.querySelectorAll('[data-celula][data-aberto="true"]')).toHaveLength(2);
    expect(arte.querySelectorAll('[data-celula][data-aberto="false"]')).toHaveLength(3);
    expect(within(previa).getByRole("button", { name: /Postar nos Stories/ })).toBeInTheDocument();
    expect(within(previa).queryByTestId("postar-video")).toBeNull();
    expect(previa.querySelector('[data-testid="previa-ao-vivo"]')).toBeNull();
  });

  it("com vídeo no aparelho: o selo VÍDEO nas artes que têm, a prévia toca ao vivo e 'Postar vídeo nos Stories' é o principal (com 'Postar imagem' embaixo)", async () => {
    suporte.v = { formato: "webcodecs", largura: 1080, altura: 1920 };
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    await waitFor(() => expect(within(folha).getAllByTestId("selo-video")).toHaveLength(2));
    expect(folha.querySelector('[data-arte="capa"] [data-testid="selo-video"]')).not.toBeNull();
    expect(folha.querySelector('[data-arte="roseta"] [data-testid="selo-video"]')).toBeNull();
    fireEvent.click(folha.querySelector('[data-arte="album"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveAttribute("data-video");
    expect(previa).toHaveTextContent("vídeo 5 s");
    expect(await within(previa).findByTestId("previa-ao-vivo")).toBeInTheDocument();
    await waitFor(() => expect(previa.querySelector('canvas[data-aovivo="tocando"]')).not.toBeNull());
    expect(within(previa).getByTestId("postar-imagem")).toHaveTextContent("Postar imagem");
    fireEvent.click(within(previa).getByTestId("postar-video"));
    await waitFor(() => expect(videoDaArte.fn).toHaveBeenCalled());
    expect(videoDaArte.fn.mock.calls[0][0]).toBe("album");
    expect((videoDaArte.fn.mock.calls[0][1] as { maisRaros: { id: string }[] }).maisRaros.map((b) => b.id)).toEqual(["leitura-1", "sequencia-7"]);
  });

  it("'Compartilhar meu álbum' do planner aberto vai direto pra prévia do Álbum", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("capa-3d"));
    fireEvent.click(await screen.findByRole("button", { name: /Compartilhar meu álbum/ }));
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Álbum");
    expect(previa.querySelector('[data-stories="album"]')).not.toBeNull();
    expect(eventos).toContainEqual(["arte_escolhida", { arte: "album", origem: "direto" }]);
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
    fireEvent.click(await screen.findByRole("button", { name: /Compartilhar meu álbum/ }));
    fireEvent.click(within(await screen.findByTestId("previa-arte")).getByTestId("previa-voltar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
    expect(screen.queryByTestId("seletor-de-arte")).toBeNull();
  });

  it("'Abrir meu álbum de adesivos' abre o álbum sem tocar na capa, e some com o planner aberto", async () => {
    abrir(montarStore(cenario()));
    expect(screen.getByTestId("abrir-planner")).toHaveTextContent("Abrir meu álbum de adesivos");
    fireEvent.click(screen.getByTestId("abrir-planner"));
    expect(await screen.findByTestId("pagina-album")).toHaveTextContent("Meu álbum");
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
    // e no álbum ele está na 1ª página (o mais recente) e na vaga dele em COMUNS
    fireEvent.click(screen.getByTestId("abrir-planner"));
    await screen.findByTestId("pagina-album");
    expect(screen.getByTestId("album-pagina-0").querySelector('[data-vaga="first-income"]')).toHaveAttribute("data-aberto", "true");
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
