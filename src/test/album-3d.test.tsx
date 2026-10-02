/**
 * ÁLBUM 3D (02/10; dono: "quero algo 3D mesmo — e hoje está dando uns
 * engasgos ao trocar de página"):
 *   · as páginas são FOLHAS pré-montadas (vizinhas na hora, as outras aos
 *     poucos): virar troca o PAPEL da folha (fundo / sobre / espera), nunca
 *     monta nada no meio da animação; a página nunca fica em branco;
 *   · toques rápidos: uma folha girando por vez, termina na página certa;
 *   · "reduzir movimento": sem capa girando, sem folha, sem foil, sem peel;
 *   · o FOIL das épicas/lendárias só acende enquanto o dedo está nelas (e
 *     solta quando o arrasto da página assume o dedo); nada em loop;
 *   · a capa do álbum herda a capa premium do planner;
 *   · ao colar uma nova, o "peel"; abas com ícone + nome; capítulo por página.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown>) => { eventos.push([nome, dados]); },
}));
const movimento = vi.hoisted(() => ({ reduzido: false }));
vi.mock("framer-motion", async (importOriginal) => {
  const real = await importOriginal<typeof import("framer-motion")>();
  return { ...real, useReducedMotion: () => movimento.reduzido };
});

import { AlbumTela, CAPA_SAI_MS, DURACAO_VIRADA_MS, CAPITULO, OPACIDADE_ESCONDIDA, pintarFolha, partesDaFolha } from "@/components/conquistas/AlbumTela";
import { CardAlbum } from "@/components/conquistas/CardAlbum";
import { CapaAlbum } from "@/components/conquistas/CapaAlbum";
import { montarAlbum } from "@/components/conquistas/album-paginas";
import type { Badge, Raridade } from "@/components/gamification/types";

const figurinha = (id: string, raridade: Raridade, unlocked: boolean, progresso?: { atual: number; alvo: number }): Badge =>
  ({ id, name: id, description: id, icon: "⭐", color: "#000", category: "finance", raridade, unlocked, xp: 50, progresso: unlocked ? undefined : progresso ?? { atual: 1, alvo: 3 } } as Badge);

/** 3 lendárias + 2 épicas + 3 raras + 20 comuns → 1 + 1 + 1 + 1 + 2 páginas (comuns 10 + 10). */
const ADESIVOS: Badge[] = [
  figurinha("ano-365", "lendario", true), figurinha("lend-2", "lendario", false, { atual: 2, alvo: 10 }), figurinha("lend-3", "lendario", false, { atual: 0, alvo: 10 }),
  figurinha("rotina-21", "epico", true), figurinha("epi-2", "epico", false),
  figurinha("rotina-7", "raro", true), figurinha("raro-2", "raro", true), figurinha("raro-3", "raro", false),
  ...Array.from({ length: 20 }, (_, i) => figurinha(`com-${i + 1}`, "comum", i < 3)),
];
const DESBLOQUEADAS: Record<string, string> = Object.fromEntries(ADESIVOS.filter((b) => b.unlocked).map((b) => [b.id, "2026-09-20"]));
const POR_RARIDADE = { lendario: { abertos: 1, total: 3 }, epico: { abertos: 1, total: 2 }, raro: { abertos: 2, total: 3 }, comum: { abertos: 3, total: 20 } };

const montar = (extra: Partial<Parameters<typeof AlbumTela>[0]> = {}) => {
  const paginas = montarAlbum(ADESIVOS, DESBLOQUEADAS);
  const r = render(
    <MemoryRouter>
      <AlbumTela
        aberto paginas={paginas} adesivos={ADESIVOS} desbloqueadas={DESBLOQUEADAS} novas={[]} maisRaros={paginas[0].vagas}
        abertos={7} total={ADESIVOS.length} porRaridade={POR_RARIDADE} nome="Ana" nivel="Ouro" ano={2026} diasDeSequencia={3}
        onFechar={() => undefined} onCompartilhar={() => undefined} onCompartilharFigurinha={() => undefined}
        {...extra}
      />
    </MemoryRouter>,
  );
  return { paginas, ...r };
};
const tela = () => screen.getByTestId("album-tela");
const folhas = () => Array.from(tela().querySelectorAll<HTMLElement>(".alb-folha > .alb-sheet"));
const papeis = () => Object.fromEntries(folhas().map((f) => [f.dataset.pagina, f.dataset.papel]));
const fundo = () => tela().querySelector<HTMLElement>('[data-papel="fundo"] .alb-pag')!;
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

// o jsdom não tem PointerEvent: o do teste carrega clientX/pointerType (o React escuta "pointerdown" do mesmo jeito)
class PointerEventDeTeste extends MouseEvent {
  pointerType: string;
  pointerId: number;
  constructor(tipo: string, init: PointerEventInit = {}) {
    super(tipo, init);
    this.pointerType = init.pointerType ?? "touch";
    this.pointerId = init.pointerId ?? 1;
  }
}
(window as unknown as { PointerEvent: typeof PointerEventDeTeste }).PointerEvent = PointerEventDeTeste;

beforeEach(() => {
  eventos.length = 0;
  movimento.reduzido = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("as folhas pré-montadas", () => {
  it("ao abrir: a página de abertura é o FUNDO e a vizinha já está montada em ESPERA; depois da capa, as outras montam uma a uma (nunca no meio de uma virada) até o livro inteiro", () => {
    const { paginas } = montar();
    expect(paginas).toHaveLength(6);
    expect(papeis()).toEqual({ "mais-raros": "fundo", "lendario-1": "espera" });
    // a capa, por cima (a capa clássica do álbum: faixa magenta, 02/10 dono "a capa deixa como tá hoje")
    expect(screen.getByTestId("album-capa-3d").querySelector("[data-capa-album]")).toBeInTheDocument();
    avancar(CAPA_SAI_MS + 400);
    expect(screen.queryByTestId("album-capa-3d")).toBeNull();
    // as extras começam ~0,9 s depois da capa sair, uma a cada 160 ms (um act por relógio: o React agenda o próximo no fim do act)
    avancar(600);
    expect(folhas()).toHaveLength(3);
    for (let i = 0; i < 3; i++) avancar(170);
    expect(folhas()).toHaveLength(6);
    expect(papeis()["mais-raros"]).toBe("fundo");
    expect(Object.values(papeis()).filter((p) => p === "espera")).toHaveLength(5);
  });

  it("virar não monta nada: a folha que gira é a que já estava de fundo, o destino (já montado) vira fundo; ao terminar, a que virou fica em espera (deitada, sem repintar) e a vizinha nova só monta com a folha parada", () => {
    montar();
    avancar(CAPA_SAI_MS + 400);
    const antes = folhas().map((f) => f.dataset.pagina);
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    // no mesmo tique: nenhuma folha nova, só os papéis trocaram
    expect(folhas().map((f) => f.dataset.pagina)).toEqual(antes);
    expect(papeis()).toEqual({ "mais-raros": "sobre", "lendario-1": "fundo" });
    expect(screen.getByTestId("album-virando")).toHaveAttribute("data-pagina", "mais-raros");
    expect(fundo()).toHaveAttribute("data-pagina", "lendario-1");
    expect(fundo().querySelectorAll(".vaga")).toHaveLength(3);
    // a folha que gira recebe o ângulo direto no DOM (sem React)
    const sobre = tela().querySelector<HTMLElement>('[data-papel="sobre"]')!;
    expect(sobre.style.transform).toBe("rotateY(0deg) translateZ(1px)");
    avancar(DURACAO_VIRADA_MS + 400);
    expect(screen.queryByTestId("album-virando")).toBeNull();
    expect(papeis()["mais-raros"]).toBe("espera");
    expect(papeis()["lendario-1"]).toBe("fundo");
    // a que virou "deita": faces apagadas (1,2 %) e de volta a 0° por trás da página de baixo; sem opacidade na folha
    const deitada = folhas().find((f) => f.dataset.pagina === "mais-raros")!;
    expect(deitada.style.transform).toBe("rotateY(0deg) translateZ(-2px)");
    expect(deitada.style.opacity).toBe("");
    expect(Number(deitada.querySelector<HTMLElement>(".alb-face-verso")!.style.opacity)).toBe(OPACIDADE_ESCONDIDA);
    expect(Number(deitada.querySelector<HTMLElement>(".alb-face-frente")!.style.opacity)).toBe(OPACIDADE_ESCONDIDA);
    // a vizinha seguinte monta só agora, com a folha parada
    expect(papeis()["epico-1"]).toBe("espera");
  });

  it("toques rápidos: UMA folha girando por vez, termina na página certa", () => {
    montar();
    avancar(CAPA_SAI_MS + 2000);
    const proxima = screen.getByTestId("album-tela-proxima");
    fireEvent.click(proxima); avancar(50);
    fireEvent.click(proxima); avancar(50);
    fireEvent.click(proxima);
    expect(tela()).toHaveAttribute("data-atual", "3");
    expect(screen.getAllByTestId("album-virando")).toHaveLength(1);
    expect(fundo()).toHaveAttribute("data-pagina", "raro-1");
    avancar(DURACAO_VIRADA_MS + 400);
    expect(screen.queryByTestId("album-virando")).toBeNull();
    expect(fundo()).toHaveAttribute("data-pagina", "raro-1");
  });

  it("uma vaga só responde na página de baixo (o papel é checado no DOM, não por pointer-events herdado)", () => {
    montar();
    avancar(CAPA_SAI_MS + 400);
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    // a folha que gira (sobre) ainda tem as vagas da 1ª página: tocar nela não abre nada
    const naSobre = tela().querySelector<HTMLElement>('[data-papel="sobre"] .vaga')!;
    fireEvent.click(naSobre);
    expect(screen.queryByTestId("detalhe-vaga")).toBeNull();
    avancar(DURACAO_VIRADA_MS + 400);
    fireEvent.click(fundo().querySelector(".vaga")!);
    expect(screen.getByTestId("detalhe-vaga")).toBeInTheDocument();
  });
});

describe("o quadro da folha (pintarFolha)", () => {
  it("escreve transform/opacity direto no DOM: a face que aparece é decidida pelo ângulo (a outra fica a 1,2 %, nunca 0); a −180° a folha esmaece pelas faces; a sombra projetada cresce até o perfil", () => {
    const el = document.createElement("div");
    el.dataset.papel = "sobre";
    el.innerHTML = '<div class="alb-face alb-face-frente"></div><div class="alb-face alb-face-verso"></div><div class="alb-face-sombra"></div><div class="alb-face-dobra"></div><div class="alb-face-luz"></div>';
    const proj = document.createElement("div");
    const partes = partesDaFolha(el, 330, proj);
    pintarFolha(partes, 0);
    // a folha que gira fica 1 px à frente da de baixo (ordem por profundidade, não z-index)
    expect(el.style.transform).toBe("rotateY(0deg) translateZ(1px)");
    expect(Number(partes.frente!.style.opacity)).toBe(1);
    expect(Number(partes.verso!.style.opacity)).toBe(OPACIDADE_ESCONDIDA);
    expect(Number(partes.sombra!.style.opacity)).toBe(0);
    expect(Number(partes.luz!.style.opacity)).toBe(0);
    pintarFolha(partes, -60);
    expect(Number(partes.sombra!.style.opacity)).toBeGreaterThan(0.3);
    expect(Number(proj.style.opacity)).toBeGreaterThan(0.3);
    expect(proj.style.transform).toMatch(/^translateZ\(\.3px\) scaleX\(/);
    pintarFolha(partes, -120);
    // passado o perfil: o verso aparece, a frente fica a 1,2 % (nunca 0: no WebKit voltar de 0 repinta a camada inteira)
    expect(Number(partes.frente!.style.opacity)).toBe(OPACIDADE_ESCONDIDA);
    expect(Number(partes.verso!.style.opacity)).toBe(1);
    expect(Number(partes.sombra!.style.opacity)).toBe(0);
    expect(Number(partes.luz!.style.opacity)).toBeGreaterThan(0);
    pintarFolha(partes, -170);
    expect(Number(partes.verso!.style.opacity)).toBeLessThan(0.5);
    pintarFolha(partes, -180);
    expect(el.style.transform).toBe("rotateY(-180deg) translateZ(1px)");
    // nunca opacidade na folha (achataria o preserve-3d): quem apaga são as faces
    expect(el.style.opacity).toBe("");
    expect(Number(partes.verso!.style.opacity)).toBe(OPACIDADE_ESCONDIDA);
    expect(Number(partes.frente!.style.opacity)).toBe(OPACIDADE_ESCONDIDA);
    expect(Number(proj.style.opacity)).toBe(0);
  });
});

describe("reduzir movimento", () => {
  it("sem capa girando, sem folha, sem peel; a tela marca data-reduzir (o CSS tira foil e 3D) e a página troca na hora", () => {
    movimento.reduzido = true;
    montar();
    expect(tela()).toHaveAttribute("data-reduzir");
    expect(screen.queryByTestId("album-capa-3d")).toBeNull();
    expect(tela().querySelectorAll("[data-cola]")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    expect(screen.queryByTestId("album-virando")).toBeNull();
    expect(fundo()).toHaveAttribute("data-pagina", "lendario-1");
  });
});

describe("o foil das épicas e lendárias", () => {
  it("só acende enquanto o dedo está na figurinha (data-foil-ativo + --fx/--fy), apaga ao soltar; comuns e raras não têm foil; nada em loop", () => {
    montar();
    avancar(CAPA_SAI_MS + 400);
    const pagina = fundo();
    const epica = pagina.querySelector<HTMLElement>('[data-vaga="rotina-21"] .fig')!;
    expect(epica).toHaveAttribute("data-foil-tem");
    expect(epica.querySelector(".fig-foil")).toBeInTheDocument();
    expect(epica.querySelector(".fig-aro")).toBeInTheDocument();
    const rara = pagina.querySelector<HTMLElement>('[data-vaga="rotina-7"] .fig')!;
    expect(rara).not.toHaveAttribute("data-foil-tem");
    expect(rara.querySelector(".fig-foil")).toBeNull();
    // o dedo
    epica.getBoundingClientRect = () => ({ left: 100, top: 100, width: 50, height: 50, right: 150, bottom: 150, x: 100, y: 100, toJSON: () => ({}) });
    expect(epica).not.toHaveAttribute("data-foil-ativo");
    fireEvent.pointerDown(epica, { clientX: 140, clientY: 110 });
    expect(epica).toHaveAttribute("data-foil-ativo");
    expect(Number(epica.style.getPropertyValue("--fx"))).toBeGreaterThan(30);
    expect(Number(epica.style.getPropertyValue("--fy"))).toBeLessThan(0);
    fireEvent.pointerMove(epica, { clientX: 105, clientY: 145 });
    expect(Number(epica.style.getPropertyValue("--fx"))).toBeLessThan(-30);
    fireEvent.pointerUp(epica);
    expect(epica).not.toHaveAttribute("data-foil-ativo");
    // nenhuma animação em loop no álbum (o anel que girava e o brilho que varria saíram)
    expect(tela().querySelector(".ad-anel, .ad-sheen, .ad-faisca")).toBeNull();
  });

  it("quando o arrasto da página assume o dedo, o foil solta", () => {
    montar();
    avancar(CAPA_SAI_MS + 400);
    const folha = tela().querySelector<HTMLElement>("[data-folha]")!;
    const epica = fundo().querySelector<HTMLElement>('[data-vaga="rotina-21"] .fig')!;
    fireEvent.pointerDown(epica, { clientX: 300, clientY: 300, pointerType: "touch" });
    expect(epica).toHaveAttribute("data-foil-ativo");
    // menos de 40 px a partir de uma figurinha com foil: o dedo ainda está "passeando" nela
    fireEvent.pointerMove(folha, { clientX: 280, clientY: 300, pointerType: "touch" });
    expect(screen.queryByTestId("album-virando")).toBeNull();
    expect(epica).toHaveAttribute("data-foil-ativo");
    // passou do limiar: a página vira e o foil apaga
    fireEvent.pointerMove(folha, { clientX: 240, clientY: 300, pointerType: "touch" });
    expect(screen.getByTestId("album-virando")).toBeInTheDocument();
    expect(epica).not.toHaveAttribute("data-foil-ativo");
    fireEvent.pointerUp(folha, { clientX: 240, clientY: 300, pointerType: "touch" });
  });
});

describe("a capa, as páginas e o peel", () => {
  it("a capa do álbum é a clássica de hoje (faixa magenta, título em serif, a mais rara no meio) — na tela cheia, no card e na foto", () => {
    const base = { maisRaros: ADESIVOS.filter((b) => b.unlocked), abertos: 7, total: 28, nome: "Ana", ano: 2026 };
    const { container, unmount } = render(<CapaAlbum largura={200} {...base} />);
    const capa = container.querySelector("[data-capa-album]")!;
    expect(capa.querySelector(".alb-capa-faixa")).toHaveTextContent("ÁLBUM DE FIGURINHAS");
    expect(capa.querySelector(".alb-capa-faixa")).toHaveTextContent("CORE · 2026");
    expect(capa.querySelector(".alb-capa-titulo")).toHaveTextContent("Figurinhas daminha vida.");
    expect(capa).toHaveTextContent("7 de 28");
    expect(capa).toHaveTextContent("de Ana");
    unmount();
    const r2 = render(<CapaAlbum largura={200} {...base} foto />);
    // a foto não leva o foil (o html-to-image não garante a máscara)
    expect(r2.container.querySelector(".fig-foil")).toBeNull();
    r2.unmount();
    render(<CardAlbum {...base} porRaridade={POR_RARIDADE} proximo={null} novas={0} onAbrir={() => undefined} onCompartilhar={() => undefined} />);
    expect(screen.getByTestId("album-card").querySelector("[data-capa-album] .alb-capa-faixa")).toBeInTheDocument();
  });

  it("'Os mais raros' mostra SÓ as mais raras da pessoa — sem 'Próximas a colar' (02/10, dono); com o álbum vazio, as próximas aparecem", () => {
    montar();
    avancar(CAPA_SAI_MS + 400);
    const primeira = screen.getByTestId("album-tela-pagina-0");
    expect(primeira).not.toHaveTextContent("PRÓXIMAS A COLAR");
    expect(primeira.querySelector("[data-raros-no-meio]")).toBeInTheDocument();
    expect(screen.queryByTestId("album-tela-dica")).toBeNull();
  });

  it("cada página é um capítulo: linha 'CAPÍTULO 02 · LENDÁRIOS', título em serif, a frase do material, o número grande na vaga, a barrinha de progresso (sem pílula preta) e o rodapé 'A mais perto'", () => {
    montar();
    avancar(CAPA_SAI_MS + 400);
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    avancar(DURACAO_VIRADA_MS + 400);
    const p = fundo();
    expect(p).toHaveAttribute("data-rar", "lendario");
    expect(p.querySelector(".alb-cap-linha")).toHaveTextContent("Capítulo 02 · LENDÁRIOS");
    expect(p.querySelector(".alb-cap-titulo h3")).toHaveTextContent(CAPITULO.lendario.titulo);
    expect(p.querySelector(".alb-cap-frase")).toHaveTextContent("Foil dourado · As mais difíceis do álbum.");
    expect(p.querySelector('[data-vaga="lend-2"] .vaga-n')).toHaveTextContent("Nº 02");
    expect(p.querySelector('[data-vaga="lend-2"] [data-testid="barra-figurinha"]')).toBeInTheDocument();
    expect(p.querySelector('[data-vaga="lend-3"] [data-testid="barra-figurinha"]')).toBeNull(); // sem progresso, sem barra
    expect(p.querySelector(".vaga-pill")).toBeNull();
    expect(p.querySelector(".alb-pe")).toHaveTextContent("A mais perto: lend-2");
    expect(p.querySelector(".alb-pag-num")).toHaveTextContent("2 / 6");
    // a marca-d'água do capítulo e a silhueta visível da vaga vazia
    expect(p.querySelector('.alb-marca svg[data-adesivo="ano-365"]')).toBeInTheDocument();
    expect(p.querySelector('[data-vaga="lend-3"] .fig-vazia')).toBeInTheDocument();
  });

  it("as abas têm ícone + nome (não 3 letras) e pulam de seção", () => {
    montar();
    avancar(CAPA_SAI_MS + 2000);
    const aba = screen.getByTestId("album-aba-lendario");
    expect(aba).toHaveTextContent("♛");
    expect(aba).toHaveTextContent("LENDÁRIAS");
    expect(aba).toHaveAttribute("aria-label", "LENDÁRIAS");
    expect(screen.getByTestId("album-aba-destaque")).toHaveTextContent("MAIS RAROS");
    fireEvent.click(screen.getByTestId("album-aba-comum"));
    expect(tela()).toHaveAttribute("data-atual", "4");
    expect(fundo()).toHaveAttribute("data-pagina", "comum-1");
  });

  it("a figurinha nova cola com o PEEL (canto do papel-base + a figurinha assentando) — só na página de baixo, uma vez", () => {
    montar({ novas: ["com-2"], paginaInicial: 4, via: "pacotinho" });
    const p = fundo();
    expect(p).toHaveAttribute("data-pagina", "comum-1");
    const fig = p.querySelector('[data-vaga="com-2"] .vaga-fig')!;
    expect(fig).toHaveAttribute("data-cola");
    expect(fig.querySelector(".fig[data-peel]")).toBeInTheDocument();
    expect(fig.querySelector(".fig-canto")).toBeInTheDocument();
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 7, novas: 1, via: "pacotinho", pagina: 4 }]);
  });
});
