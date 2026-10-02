/**
 * ÁLBUM DE FIGURINHAS — os 2 bugs do vídeo do dono (02/10, iPhone):
 *   (a) "1 figurinha nova · toque pra abrir o pacotinho" não respondia: agora o
 *       pacotinho tem caminho próprio — abre o álbum DIRETO na página da
 *       figurinha nova (que cola com o pop) e marca tudo como visto;
 *   (b) a virada passava por uma PÁGINA EM BRANCO: a página de destino agora
 *       está montada e inteira por baixo desde o 1º quadro da virada (pra
 *       frente), ou a de destino desdobra por cima da atual (pra trás); a
 *       capa deita de verdade (duas faces) e as figurinhas colam no instante em que
 *       ela revela a página; toques rápidos em sequência terminam na página
 *       certa, com UMA folha virando por vez.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown>) => { eventos.push([nome, dados]); },
}));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));
vi.mock("@/components/conquistas/video/AnimacaoAoVivo", () => ({ default: () => <canvas /> }));
// "reduzir movimento" do aparelho, ligado por teste
const movimento = vi.hoisted(() => ({ reduzido: false }));
vi.mock("framer-motion", async (importOriginal) => {
  const real = await importOriginal<typeof import("framer-motion")>();
  return { ...real, useReducedMotion: () => movimento.reduzido };
});

import { UserDataContext } from "@/hooks/use-user-data";
import { TelaConquistas, CHAVE_ALBUM_VISTO } from "@/components/conquistas/TelaConquistas";
import { AlbumTela, CAPA_REVELA_MS, CAPA_SAI_MS, DURACAO_VIRADA_MS } from "@/components/conquistas/AlbumTela";
import { montarAlbum } from "@/components/conquistas/album-paginas";
import { CHAVE_DICA_PLANNER } from "@/components/conquistas/DicaDoPlanner";
import { CHAVE_NIVEL_PISO, type Badge, type Raridade } from "@/components/gamification/types";

/* ------------------------------------------------------------ um álbum de mentira pra AlbumTela */

const figurinha = (id: string, raridade: Raridade, unlocked: boolean): Badge =>
  ({ id, name: id, description: id, icon: "⭐", color: "#000", category: "finance", raridade, unlocked, xp: 50, progresso: unlocked ? undefined : { atual: 1, alvo: 3 } } as Badge);

const ADESIVOS: Badge[] = [
  figurinha("lend-1", "lendario", true), figurinha("lend-2", "lendario", false),
  figurinha("epi-1", "epico", true), figurinha("epi-2", "epico", false),
  figurinha("raro-1", "raro", true), figurinha("raro-2", "raro", true), figurinha("raro-3", "raro", false),
  figurinha("com-1", "comum", true), figurinha("com-2", "comum", true), figurinha("com-3", "comum", false),
];
const DESBLOQUEADAS: Record<string, string> = Object.fromEntries(ADESIVOS.filter((b) => b.unlocked).map((b) => [b.id, "2026-09-20"]));
const POR_RARIDADE = { lendario: { abertos: 1, total: 2 }, epico: { abertos: 1, total: 2 }, raro: { abertos: 2, total: 3 }, comum: { abertos: 2, total: 3 } };

const montarAlbumTela = (extra: Partial<Parameters<typeof AlbumTela>[0]> = {}) => {
  const paginas = montarAlbum(ADESIVOS, DESBLOQUEADAS);
  const r = render(
    <MemoryRouter>
      <AlbumTela
        aberto paginas={paginas} adesivos={ADESIVOS} desbloqueadas={DESBLOQUEADAS} novas={[]} maisRaros={paginas[0].vagas}
        abertos={6} total={10} porRaridade={POR_RARIDADE} nome="Ana" nivel="Bronze" ano={2026} diasDeSequencia={3}
        onFechar={() => undefined} onCompartilhar={() => undefined} onCompartilharFigurinha={() => undefined}
        {...extra}
      />
    </MemoryRouter>,
  );
  return { paginas, ...r };
};

const tela = () => screen.getByTestId("album-tela");
/** A página de baixo (filha direta da folha — a que gira fica dentro de .alb-folha-3d). */
const paginaDeBaixo = () => tela().querySelector(".alb-folha > .alb-pag") as HTMLElement;
const folhaVirando = () => screen.queryByTestId("album-virando");
/** As vagas coladas de uma página: colam com atraso (`data-cola` + --d) ou já estão inteiras (null)? */
const atrasos = (el: HTMLElement) => Array.from(el.querySelectorAll('.vaga[data-aberta="true"] .vaga-fig')).map((v) => (v.hasAttribute("data-cola") ? parseInt((v as HTMLElement).style.getPropertyValue("--d"), 10) : null));
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe("(b) a virada nunca mostra uma página em branco", () => {
  beforeEach(() => {
    eventos.length = 0;
    movimento.reduzido = false;
    // o framer-motion anda no requestAnimationFrame + performance.now: os dois no relógio de mentira
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("o álbum de mentira tem 5 páginas: os mais raros + 1 por raridade", () => {
    const { paginas } = montarAlbumTela();
    expect(paginas.map((p) => p.id)).toEqual(["mais-raros", "lendario-1", "epico-1", "raro-1", "comum-1"]);
  });

  it("pra frente: a página de DESTINO está por baixo, inteira, desde o 1º quadro; a folha que gira é a que SAI (com o conteúdo dela); ao terminar sobra só o destino", () => {
    const { paginas } = montarAlbumTela();
    avancar(CAPA_SAI_MS + 400); // a capa já saiu
    expect(screen.queryByTestId("album-capa-3d")).toBeNull();
    expect(tela()).toHaveAttribute("data-atual", "0");

    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    // ainda no mesmo tique: a mesa já tem a página 2 por baixo e a página 1 virando por cima
    expect(tela()).toHaveAttribute("data-atual", "1");
    const baixo = paginaDeBaixo();
    expect(baixo).toHaveAttribute("data-pagina", "lendario-1");
    expect(baixo).toHaveTextContent("LENDÁRIOS");
    // as figurinhas do destino já estão inteiras (nenhuma esperando pra colar)
    expect(atrasos(baixo)).toEqual([null]);
    const folha = folhaVirando()!;
    expect(folha).toHaveAttribute("data-dir", "frente");
    expect(folha).toHaveAttribute("data-pagina", "mais-raros");
    expect(folha).toHaveTextContent("OS MAIS RAROS");
    // a folha que gira vai com o conteúdo dela (não é uma folha bege vazia)
    expect(folha.querySelectorAll(".vaga")).toHaveLength(6);

    // no meio da virada: tudo igual (destino por baixo, folha por cima)
    avancar(DURACAO_VIRADA_MS / 2);
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "lendario-1");
    expect(folhaVirando()).toHaveAttribute("data-pagina", "mais-raros");

    // o fim da animação tira a folha; o destino fica
    avancar(DURACAO_VIRADA_MS + 400);
    expect(folhaVirando()).toBeNull();
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "lendario-1");
    expect(eventos).toContainEqual(["album_pagina", { indice: 1, secao: paginas[1].id }]);
  });

  it("pra trás: a página de destino DESDOBRA por cima da atual (a atual fica por baixo até a folha assentar)", () => {
    montarAlbumTela();
    avancar(CAPA_SAI_MS + 400);
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    avancar(DURACAO_VIRADA_MS + 400);
    expect(tela()).toHaveAttribute("data-atual", "1");
    expect(folhaVirando()).toBeNull();

    fireEvent.click(screen.getByTestId("album-tela-anterior"));
    expect(tela()).toHaveAttribute("data-atual", "0");
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "lendario-1"); // a que sai, por baixo
    const folha = folhaVirando()!;
    expect(folha).toHaveAttribute("data-dir", "tras");
    expect(folha).toHaveAttribute("data-pagina", "mais-raros"); // a que entra, por cima
    expect(folha).toHaveTextContent("OS MAIS RAROS");
    avancar(DURACAO_VIRADA_MS + 400);
    expect(folhaVirando()).toBeNull();
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "mais-raros");
  });

  it("toques rápidos em sequência: termina na página certa, com UMA folha virando por vez (a anterior sai na hora)", () => {
    montarAlbumTela();
    avancar(CAPA_SAI_MS + 400);
    const proxima = screen.getByTestId("album-tela-proxima");
    fireEvent.click(proxima);
    avancar(60);
    fireEvent.click(proxima);
    avancar(60);
    fireEvent.click(proxima);
    expect(tela()).toHaveAttribute("data-atual", "3");
    // só a folha da vez existe: a página 3 saindo por cima da 4 (as anteriores foram trocadas na hora)
    expect(screen.getAllByTestId("album-virando")).toHaveLength(1);
    expect(folhaVirando()).toHaveAttribute("data-pagina", "epico-1");
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "raro-1");
    avancar(DURACAO_VIRADA_MS + 400);
    expect(folhaVirando()).toBeNull();
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "raro-1");
    expect(paginaDeBaixo().querySelector(".alb-pag-num")).toHaveTextContent("4 / 5");
  });

  it("as abas também viram com a folha e param na seção certa", () => {
    montarAlbumTela();
    avancar(CAPA_SAI_MS + 400);
    fireEvent.click(screen.getByTestId("album-aba-comum"));
    expect(tela()).toHaveAttribute("data-atual", "4");
    expect(folhaVirando()).toHaveAttribute("data-dir", "frente");
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "comum-1");
    avancar(DURACAO_VIRADA_MS + 400);
    expect(folhaVirando()).toBeNull();
  });

  it("ao abrir: a capa fica na frente (z 6) e deita até −180° (frente e verso); a 1ª página está montada por baixo com a faixa, e as figurinhas começam a colar NO INSTANTE em que a capa revela a página", () => {
    montarAlbumTela();
    const capa = screen.getByTestId("album-capa-3d");
    expect(capa.style.zIndex).toBe("6");
    expect(capa).not.toHaveAttribute("data-girada");
    // por baixo da capa a página 1 já existe, com a faixa — nunca uma folha bege sem nada
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "mais-raros");
    expect(paginaDeBaixo()).toHaveTextContent("OS MAIS RAROS");
    // as figurinhas colam com atraso = o instante da revelação (+ a cadência de 90 ms entre elas)
    const d = atrasos(paginaDeBaixo());
    expect(d).toHaveLength(6);
    expect(d[0]).toBe(CAPA_REVELA_MS);
    expect(d[1]).toBe(CAPA_REVELA_MS + 90);
    avancar(600);
    expect(screen.getByTestId("album-capa-3d")).toHaveAttribute("data-girada");
    expect(screen.getByTestId("album-capa-3d").style.zIndex).toBe("6"); // continua na frente enquanto gira
    avancar(CAPA_SAI_MS);
    expect(screen.queryByTestId("album-capa-3d")).toBeNull();
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 6, novas: 0, via: "card", pagina: 0 }]);
  });

  it("abrir direto numa página (o pacotinho): a capa vira e revela ESSA página, com as figurinhas novas colando", () => {
    montarAlbumTela({ paginaInicial: 4, via: "pacotinho", novas: ["com-2"] });
    expect(tela()).toHaveAttribute("data-atual", "4");
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "comum-1");
    expect(paginaDeBaixo().querySelector('[data-vaga="com-2"] .vaga-fig')).toHaveAttribute("data-cola");
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 6, novas: 1, via: "pacotinho", pagina: 4 }]);
  });

  it("com 'reduzir movimento' não há capa nem folha girando: a página troca na hora", () => {
    movimento.reduzido = true;
    montarAlbumTela();
    expect(screen.queryByTestId("album-capa-3d")).toBeNull();
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    expect(folhaVirando()).toBeNull();
    expect(paginaDeBaixo()).toHaveAttribute("data-pagina", "lendario-1");
  });
});

/* ------------------------------------------------------------ (a) o pacotinho, na tela de verdade */

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
const abrirTela = (store: ReturnType<typeof montarStore>) =>
  render(
    <MemoryRouter initialEntries={["/conquistas"]}>
      <Provedor store={store}>
        <Routes><Route path="/conquistas" element={<TelaConquistas />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
/** 7 raras/épicas coladas (enchem "OS MAIS RAROS") + 1 COMUM colada hoje (Primeira Despesa) que ainda não foi vista no álbum. */
const RARAS = ["sequencia-7", "leitura-1", "rotina-7", "rotina-21", "leitura-10", "treino-12", "treino-50"];
const cenario = () => ({
  "core-user-name": "Ana Beatriz",
  "conquistas-desbloqueadas": { ...Object.fromEntries(RARAS.map((id) => [id, "2026-09-20"])), "first-expense": "2026-10-02" },
  "conquistas-vistas": { adesivos: [...RARAS, "first-expense"], marcos: [7] },
  [CHAVE_ALBUM_VISTO]: RARAS,
  [CHAVE_NIVEL_PISO]: "Bronze",
  [CHAVE_DICA_PLANNER]: { vistas: 3, fim: true },
  "lib-books": [{ status: "lido" }],
});

describe("(a) o pacotinho responde e abre na página da figurinha nova", () => {
  beforeEach(() => {
    eventos.length = 0;
    movimento.reduzido = false;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("toque no pacotinho: abre o álbum DIRETO na página da figurinha nova (comum, longe da 1ª página), ela cola com o pop, tudo vira visto e o evento diz via 'pacotinho'", () => {
    const store = montarStore(cenario());
    abrirTela(store);
    const card = screen.getByTestId("album-card");
    expect(card).toHaveAttribute("data-novas", "1");
    const pacotinho = screen.getByTestId("album-pacotinho");
    expect(pacotinho).toHaveTextContent("1 figurinha nova");
    expect(pacotinho).toHaveAttribute("aria-label", "1 figurinha nova — abrir o pacotinho");

    fireEvent.click(pacotinho);
    const album = screen.getByTestId("album-tela");
    // a comum nova NÃO está na 1ª página (os mais raros): o álbum abre na página dela
    const indice = Number(album.getAttribute("data-atual"));
    expect(indice).toBeGreaterThan(0);
    const pagina = within(album).getByTestId(`album-tela-pagina-${indice}`);
    expect(pagina).toHaveTextContent("COMUNS");
    const vaga = pagina.querySelector('[data-vaga="first-expense"]')!;
    expect(vaga).toHaveAttribute("data-aberta", "true");
    expect(vaga.querySelector(".vaga-fig")).toHaveAttribute("data-cola"); // cola com o pop
    // marcou tudo como visto e mediu de onde veio
    expect((store.dados[CHAVE_ALBUM_VISTO] as string[]).sort()).toEqual([...RARAS, "first-expense"].sort());
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 8, novas: 1, via: "pacotinho", pagina: indice }]);
    // o pacotinho sumiu do card (nada novo pendente)
    expect(screen.queryByTestId("album-pacotinho")).toBeNull();
    expect(card).toHaveAttribute("data-novas", "0");
  });

  it("'Abrir o álbum' continua abrindo na capa e na 1ª página (via 'card')", () => {
    const store = montarStore(cenario());
    abrirTela(store);
    fireEvent.click(screen.getByTestId("album-abrir"));
    const album = screen.getByTestId("album-tela");
    expect(album).toHaveAttribute("data-atual", "0");
    expect(screen.getByTestId("album-capa-3d")).toBeInTheDocument();
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 8, novas: 1, via: "card", pagina: 0 }]);
  });
});
