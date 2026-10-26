/**
 * 1.0.19 — O 100 NA HOME NOVA (dono 26/10, olhando o iPhone com 100 pontos):
 *  1) o card do score NÃO troca a estrela por ✓ ("o Cal AI não muda o símbolo"): a estrela fica e, ao bater 100,
 *     estrela + anel + número viram ÂMBAR com uma festinha curta — UMA vez por dia (chave do aparelho
 *     `core-home-nova-score-100`); reabrir com 100 mostra o âmbar parado; reduzir movimento = âmbar direto; enquanto
 *     a comemoração de tela cheia vai abrir/está aberta, a festa espera;
 *  2) a comemoração "Dia completo" refeita no estilo da Home nova (sem "Fecha o app em paz", sem ✓, sem emoji, sem
 *     pílula), faixa do relógio transparente enquanto aberta; a antiga (Home antiga) fica igual;
 *  3) a folha do score no 100: número âmbar + estrela âmbar, sem ✓ no lugar dela.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const reduz = vi.hoisted(() => ({ v: false }));
vi.mock("framer-motion", async (orig) => ({ ...(await orig<typeof import("framer-motion")>()), useReducedMotion: () => reduz.v }));
vi.mock("@/components/fogo/FogoSequencia", () => ({ FogoSequencia: ({ testid }: { testid?: string }) => <span data-testid={testid ?? "fg-seq"} /> }));

import { CardScoreE } from "@/components/home-nova/e/PaginaSeuDia";
import { FolhaScore } from "@/components/home-nova/e/FolhaScore";
import { CelebracaoDia100E, celebracaoPendente } from "@/components/home-nova/e/CelebracaoDia100E";
import { CelebracaoDia100 } from "@/components/home/CelebracaoDia100";
import { CHAVE_DIA_100_VISTO } from "@/components/home/DayScoreRing";
import { CHAVE_SCORE_100_HOME_NOVA } from "@/lib/home-nova";
import { ehChaveDoAparelho } from "@/lib/chaves-do-aparelho";
import { localDayKey } from "@/lib/utils";
import type { LifeHubData } from "@/hooks/use-life-hub-data";

const hoje = localDayKey();
const fase = () => screen.getByTestId("he-score").getAttribute("data-fase-100");
const andar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { localStorage.clear(); reduz.v = false; vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); document.documentElement.style.removeProperty("--safe-top-cor"); });

describe("card do score no 100: a estrela fica e vira âmbar", () => {
  it("abaixo de 100: estrela preta (TINTA), número sem âmbar, nada de festa", () => {
    render(<CardScoreE score={99} onAbrir={() => {}} />);
    andar(3000);
    expect(fase()).toBe("preto");
    const estrela = screen.getByTestId("hn-anel").querySelector(".lucide-star") as SVGElement;
    expect(estrela.getAttribute("style")).toContain("fill: var(--hn-mais)");
    expect(screen.getByTestId("he-score-numero").className).not.toContain("he-ouro");
    expect(localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA)).toBeNull();
  });

  it("1ª vez no 100 hoje: preto → festa (pulo + brilho + eco) → âmbar parado; grava o dia; nunca ✓", () => {
    render(<CardScoreE score={100} onAbrir={() => {}} />);
    expect(fase()).toBe("preto");
    andar(1150);
    expect(fase()).toBe("festa");
    expect(localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA)).toBe(hoje);
    expect(screen.getByTestId("he-anel-eco")).toBeTruthy();
    expect(screen.getByTestId("he-estrela").querySelector(".he-estrela-brilho")).toBeTruthy();
    expect(screen.getByTestId("he-score-numero").className).toContain("text-[color:var(--he-ouro-texto)]");
    andar(1000);
    expect(fase()).toBe("ouro");
    expect(screen.queryByTestId("he-anel-eco")).toBeNull();
    const anel = screen.getByTestId("hn-anel");
    expect(anel.querySelector(".lucide-check")).toBeNull();
    expect(anel.querySelector(".lucide-star")!.getAttribute("style")).toContain("fill: var(--he-ouro)");
  });

  it("reabrir com o 100 já festejado hoje: âmbar parado desde o 1º quadro, sem festa", () => {
    localStorage.setItem(CHAVE_SCORE_100_HOME_NOVA, hoje);
    render(<CardScoreE score={100} onAbrir={() => {}} />);
    expect(fase()).toBe("ouro");
    andar(3000);
    expect(fase()).toBe("ouro");
    expect(screen.queryByTestId("he-anel-eco")).toBeNull();
  });

  it("festa de ONTEM não conta: hoje toca de novo", () => {
    localStorage.setItem(CHAVE_SCORE_100_HOME_NOVA, "2000-01-01");
    render(<CardScoreE score={100} onAbrir={() => {}} />);
    andar(1150);
    expect(fase()).toBe("festa");
  });

  it("cruzar 99 → 100 com a Home na tela: festa logo depois (250 ms passada a montagem)", () => {
    const r = render(<CardScoreE score={99} onAbrir={() => {}} />);
    andar(5000);
    r.rerender(<CardScoreE score={100} onAbrir={() => {}} />);
    expect(fase()).toBe("preto");
    andar(300);
    expect(fase()).toBe("festa");
  });

  it("pausada (a comemoração vai abrir/está aberta): espera; ao soltar, a festa toca", () => {
    const r = render(<CardScoreE score={100} onAbrir={() => {}} festaPausada />);
    andar(5000);
    expect(fase()).toBe("preto");
    expect(localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA)).toBeNull();
    r.rerender(<CardScoreE score={100} onAbrir={() => {}} festaPausada={false} />);
    andar(300);
    expect(fase()).toBe("festa");
  });

  it("desmontar antes da festa (troca de aba) não grava o dia: a festa fica pra próxima vez", () => {
    const r = render(<CardScoreE score={100} onAbrir={() => {}} />);
    andar(500);
    r.unmount();
    expect(localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA)).toBeNull();
  });

  it("reduzir movimento: âmbar direto, sem festa, e grava o dia", () => {
    reduz.v = true;
    render(<CardScoreE score={100} onAbrir={() => {}} />);
    expect(fase()).toBe("ouro");
    expect(screen.queryByTestId("he-anel-eco")).toBeNull();
    expect(localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA)).toBe(hoje);
  });

  it("forcarFesta (rota de dev) toca sem gravar", () => {
    render(<CardScoreE score={100} onAbrir={() => {}} forcarFesta />);
    andar(1150);
    expect(fase()).toBe("festa");
    expect(localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA)).toBeNull();
  });

  it("a chave é do APARELHO (as vassouras do cache não levam)", () => {
    expect(CHAVE_SCORE_100_HOME_NOVA).toBe("core-home-nova-score-100");
    expect(ehChaveDoAparelho(CHAVE_SCORE_100_HOME_NOVA)).toBe(true);
  });
});

describe("a comemoração do dia completo na Home nova", () => {
  it("abre 1x por dia no 100 (mesma chave da antiga), sem a frase, sem ✓, sem emoji; estrela que vira âmbar", () => {
    const onAbrir = vi.fn(); const onFechar = vi.fn();
    expect(celebracaoPendente(100)).toBe(true);
    expect(celebracaoPendente(99)).toBe(false);
    render(<CelebracaoDia100E score={100} streak={29} onAbrir={onAbrir} onFechar={onFechar} />);
    const tela = screen.getByTestId("celebracao-100");
    expect(tela.getAttribute("data-variante")).toBe("estrela"); // a escolhida: estrela grande + "100" + "Dia completo"
    expect(screen.getByTestId("dia100-pontos").textContent).toBe("100");
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHAVE_DIA_100_VISTO)).toBe(hoje);
    expect(celebracaoPendente(100)).toBe(false);
    const texto = tela.textContent ?? "";
    expect(texto).toContain("Dia completo");
    expect(texto).toContain("29 dias seguidos");
    expect(texto).not.toMatch(/Fecha o app|Dia 100%|🌟|⭐|Bom descanso/);
    expect(tela.querySelector(".lucide-check")).toBeNull();
    expect(screen.getByTestId("dia100-estrela").getAttribute("data-fase")).toBe("preto");
    andar(450); // só a estrela: pula logo (com o anel, espera ~1 s ele encher)
    expect(screen.getByTestId("dia100-estrela").getAttribute("data-fase")).toBe("festa");
    andar(1000);
    expect(screen.getByTestId("dia100-estrela").getAttribute("data-fase")).toBe("ouro");
    // sem caixa/contorno na sequência
    expect(screen.getByTestId("dia100-sequencia").className).not.toMatch(/border|rounded-full|bg-/);
    fireEvent.click(screen.getByTestId("dia100-continuar"));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("faixa do relógio transparente enquanto aberta (sem a faixa cinza no topo); volta ao fechar", () => {
    render(<CelebracaoDia100E score={100} streak={3} />);
    expect(document.documentElement.style.getPropertyValue("--safe-top-cor")).toBe("transparent");
    fireEvent.click(screen.getByTestId("dia100-continuar"));
    andar(500);
    expect(document.documentElement.style.getPropertyValue("--safe-top-cor")).toBe("");
  });

  it("já vista hoje: não abre; abaixo de 100: não abre", () => {
    localStorage.setItem(CHAVE_DIA_100_VISTO, hoje);
    render(<CelebracaoDia100E score={100} streak={3} />);
    expect(screen.queryByTestId("celebracao-100")).toBeNull();
    cleanup();
    localStorage.clear();
    render(<CelebracaoDia100E score={80} streak={3} />);
    expect(screen.queryByTestId("celebracao-100")).toBeNull();
  });

  it("variante anel (a outra, só na rota de dev): anel + estrela + '100 de 100 pontos', também sem ✓; sem sequência some a linha", () => {
    render(<CelebracaoDia100E score={100} streak={0} variante="anel" />);
    expect(screen.getByTestId("dia100-pontos").textContent).toBe("100 de 100 pontos");
    expect(screen.getByTestId("dia100-anel").querySelector(".lucide-star")).toBeTruthy();
    expect(screen.getByTestId("celebracao-100").querySelector(".lucide-check")).toBeNull();
    expect(screen.queryByTestId("dia100-sequencia")).toBeNull();
  });

  it("a ANTIGA (Home antiga, chave desligada) continua igual: a frase e o selo ✓", () => {
    vi.useRealTimers();
    render(<CelebracaoDia100 score={100} streak={3} />);
    const tela = screen.getByTestId("celebracao-100");
    expect(tela.textContent).toContain("Fecha o app em paz");
    expect(tela.textContent).toContain("Bom descanso");
    expect(tela.querySelector(".lucide-check")).toBeTruthy();
  });
});

describe("a folha do score no 100", () => {
  const dados = (dayScore: number) => ({
    dayScore, habits: [{ id: 1, name: "Ler", done: true }], waterGlasses: 8, waterGoal: 8, mealsLogged: 3, mealsTotal: 3,
    supplementsTaken: 0, supplementsTotal: 0, workoutDone: true, todayWorkoutGroup: "Peito", workoutStatus: "treino",
    registrosHoje: { humor: true, gasto: true, peso: true, sono: true, gratidao: true, ideia: true }, currentBook: null,
  }) as unknown as LifeHubData;
  const Folha = ({ score }: { score: number }): ReactNode => (
    <MemoryRouter><FolhaScore aberta onFechar={() => {}} data={dados(score)} onAcao={() => {}} onPersonalizar={() => {}} /></MemoryRouter>
  );

  it("100: número âmbar + estrela âmbar ao lado de 'pontos' (sem ✓ no lugar dela)", () => {
    render(<Folha score={100} />);
    expect(screen.getByTestId("he-folha-numero").className).toContain("text-[color:var(--he-ouro-texto)]");
    const estrela = screen.getByTestId("he-folha-estrela") as unknown as SVGElement;
    expect(estrela.getAttribute("style")).toContain("fill: var(--he-ouro)");
  });

  it("abaixo de 100: sem estrela, número sem âmbar", () => {
    render(<Folha score={70} />);
    expect(screen.queryByTestId("he-folha-estrela")).toBeNull();
    expect(screen.getByTestId("he-folha-numero").className).not.toContain("he-ouro");
  });
});
