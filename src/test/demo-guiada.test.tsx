/**
 * DEMO GUIADA (v105, 05/09) — o coach de 3 passos que substitui a dica
 * genérica da demo no funil do shell, e o CTA que devolve pro plano.
 *
 * Contexto: em 7 dias (2.227 aberturas) 14% saíam do app DENTRO da demo e
 * todo mundo via a mesma dica de 6s. Cada bloco aqui trava uma regra que,
 * quebrada, ou mostra o roteiro errado no módulo errado, ou repete o coach a
 * cada módulo, ou perde a telemetria que mede se ele ajuda.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn(), shell: true }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => mocks.shell }));
vi.mock("@/lib/analytics", () => ({ trackEvent: mocks.trackEvent }));

import {
  passosDoCoach, coachJaVisto, marcarCoachVisto, COACH_SESSION_KEY,
  posicaoDoCard, retanguloDoSpotlight, alvoVisivel,
} from "@/components/demo/coach-passos";
import { DemoCoach } from "@/components/demo/DemoCoach";
import { DemoCta } from "@/components/demo/DemoCta";
import { linkDoModuloDaDemo, abaPadraoDaDemo } from "@/components/demo/rotas";

const ret = (top: number, left: number, width: number, height: number) =>
  ({ top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return {}; } }) as DOMRect;

/** Planta um elemento no body com um retângulo "medido" (jsdom mede tudo como 0). */
const plantar = (html: string, medida?: DOMRect): HTMLElement => {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  const el = wrap.firstElementChild as HTMLElement;
  if (medida) el.getBoundingClientRect = () => medida;
  document.body.appendChild(el);
  return el;
};

const eventos = (nome: string) => mocks.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = "";
  mocks.trackEvent.mockClear();
  mocks.shell = true;
});

/* ============================================================
 * ROTEIRO POR MÓDULO — passosDoCoach
 * ============================================================ */
describe("passosDoCoach", () => {
  it("cada um dos 5 módulos do funil tem 3 passos com o roteiro dele; o 3º é sempre a barra dos módulos", () => {
    const esperado: Record<string, [string, string]> = {
      financas: ["Seu mês fechado sozinho", "Contas que avisam antes do juros"],
      rotina: ["Marca o hábito em um toque", "Sua semana hora a hora"],
      treino: ["Seu treino de hoje, pronto", "Semana, config e progressão"],
      saude: ["Água, sono e humor num lugar", "Evolução e log médico"],
      desenvolvimento: ["Sua meta vira um plano", "Diário, humor e desafio de 30 dias"],
    };
    for (const [modulo, [t1, t2]] of Object.entries(esperado)) {
      const p = passosDoCoach(modulo);
      expect(p, modulo).toHaveLength(3);
      expect(p[0].titulo, modulo).toBe(t1);
      expect(p[1].titulo, modulo).toBe(t2);
      expect(p[2].titulo, modulo).toBe("E os outros 15 módulos a um toque");
      expect(p[2].texto).toBe("Rotina, treino, dieta, casa… tudo no mesmo app, sem pagar à parte.");
    }
    expect(passosDoCoach("financas")[0].texto).toBe("Receitas, despesas e o que sobrou — sem planilha, sem conta de cabeça.");
    expect(passosDoCoach("financas")[1].texto).toBe("Na aba Meu financeiro, cada conta tem data e lembrete na véspera.");
  });

  it("módulo sem roteiro próprio cai no de finanças", () => {
    expect(passosDoCoach("dieta")[0].titulo).toBe("Seu mês fechado sozinho");
    expect(passosDoCoach("")[0].titulo).toBe("Seu mês fechado sozinho");
  });

  it("os alvos resolvem pelos ganchos data-coach, pela linha das abas .notion-tab e pela .demo-tour-nav", () => {
    const resumo = plantar('<div data-coach="resumo"></div>');
    const abas = plantar('<div class="linha"><button class="notion-tab">A</button><button class="notion-tab">B</button></div>');
    const barra = plantar('<div class="demo-tour-nav"></div>');
    const [p1, p2, p3] = passosDoCoach("financas");
    expect(p1.alvo()).toBe(resumo);
    expect(p2.alvo()).toBe(abas);          // a LINHA, não a 1ª aba
    expect(p3.alvo()).toBe(barra);
    // saúde aponta o 1º card da aba Hoje, não o wrapper inteiro
    const hoje = plantar('<div data-coach="saude-hoje"><section id="agua"></section><section id="remedios"></section></div>');
    expect(passosDoCoach("saude")[0].alvo()).toBe(hoje.firstElementChild);
  });

  it("alvo ausente resolve null (card no centro, sem spotlight)", () => {
    expect(passosDoCoach("rotina")[0].alvo()).toBeNull();
    expect(passosDoCoach("rotina")[1].alvo()).toBeNull();
  });
});

/* ============================================================
 * 1× POR SESSÃO
 * ============================================================ */
describe("gating por sessão", () => {
  it("coachJaVisto nasce falso e vira verdadeiro depois de marcar (sessionStorage, morre com o processo)", () => {
    expect(coachJaVisto()).toBe(false);
    marcarCoachVisto();
    expect(coachJaVisto()).toBe(true);
    expect(sessionStorage.getItem(COACH_SESSION_KEY)).toBe("1");
    expect(localStorage.getItem(COACH_SESSION_KEY)).toBeNull();
  });

  it("montar o coach marca a sessão — o 2º módulo da mesma sessão não o vê", () => {
    render(<DemoCoach module="financas" onDone={() => {}} atrasoMs={0} />);
    expect(coachJaVisto()).toBe(true);
  });

  it("com atraso, a marca só entra quando o coach de fato apareceu", () => {
    render(<DemoCoach module="financas" onDone={() => {}} atrasoMs={60_000} />);
    expect(screen.queryByTestId("demo-coach")).toBeNull();
    expect(coachJaVisto()).toBe(false);
    expect(eventos("demo_coach_view")).toHaveLength(0);
  });
});

/* ============================================================
 * O COACH NA TELA
 * ============================================================ */
describe("DemoCoach", () => {
  it("anda pelos 3 passos (Próximo, Próximo, Entendi), fecha e conta cada passo", () => {
    const onDone = vi.fn();
    render(<DemoCoach module="rotina" onDone={onDone} atrasoMs={0} />);
    expect(screen.getByText("Marca o hábito em um toque")).toBeInTheDocument();
    expect(screen.getByText("Água, treino, leitura: a sequência cresce sozinha e te puxa de volta.")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("Sua semana hora a hora")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("E os outros 15 módulos a um toque")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(eventos("demo_coach_view")).toEqual([
      { passo: 1, module: "rotina" }, { passo: 2, module: "rotina" }, { passo: 3, module: "rotina" },
    ]);
    expect(eventos("demo_coach_done")).toEqual([{ module: "rotina", passos: 3 }]);
  });

  it("toque no fundo escuro também avança", () => {
    const onDone = vi.fn();
    const { container } = render(<DemoCoach module="treino" onDone={onDone} atrasoMs={0} />);
    const fundo = container.querySelector('[aria-hidden="true"].absolute') as HTMLElement;
    fireEvent.click(fundo);
    expect(screen.getByText("Semana, config e progressão")).toBeInTheDocument();
    fireEvent.click(fundo);
    fireEvent.click(fundo);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("desmontar no meio (pulou de módulo, Voltar) fecha a conta com os passos vistos, sem chamar onDone", () => {
    const onDone = vi.fn();
    const { unmount } = render(<DemoCoach module="saude" onDone={onDone} atrasoMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    unmount();
    expect(onDone).not.toHaveBeenCalled();
    expect(eventos("demo_coach_done")).toEqual([{ module: "saude", passos: 2 }]);
  });

  it("com o alvo na tela: spotlight fixo com a sombra de 9999px e o anel magenta; card abaixo do alvo", () => {
    plantar('<div data-coach="treino-hoje"></div>', ret(200, 16, 328, 120));
    const { container } = render(<DemoCoach module="treino" onDone={() => {}} atrasoMs={0} />);
    const spot = screen.getByTestId("demo-coach-spotlight");
    expect(spot.style.boxShadow).toContain("0 0 0 9999px rgba(28,25,23,.58)");
    expect(spot.style.boxShadow).toContain("hsl(var(--accent))");
    expect(spot).toHaveClass("pointer-events-none");
    expect(spot.style.top).toBe("194px");      // 6px de folga
    expect(spot.style.height).toBe("132px");
    const card = container.querySelector("[data-lugar]") as HTMLElement;
    expect(card.dataset.lugar).toBe("abaixo");
    expect(card.style.top).toBe("338px");      // 194 + 132 + 12
    // o fundo que pega o toque fica transparente: quem escurece é a sombra do spotlight
    const fundo = container.querySelector('[aria-hidden="true"].absolute') as HTMLElement;
    expect(fundo.style.background).toBe("transparent");
  });

  it("sem alvo: nenhum spotlight, fundo escurecido e card no centro", () => {
    const { container } = render(<DemoCoach module="financas" onDone={() => {}} atrasoMs={0} />);
    expect(screen.queryByTestId("demo-coach-spotlight")).toBeNull();
    const fundo = container.querySelector('[aria-hidden="true"].absolute') as HTMLElement;
    expect(fundo.style.background.replace(/\s/g, "")).toMatch(/rgba\(28,25,23,0?\.58\)/);
    expect((container.querySelector("[data-lugar]") as HTMLElement).dataset.lugar).toBe("centro");
  });

  it("sem prefers-reduced-motion o card entra animado (só opacity/transform); com ele, nada anima", () => {
    const { container, unmount } = render(<DemoCoach module="financas" onDone={() => {}} atrasoMs={0} />);
    const card = container.querySelector("[data-lugar] > div") as HTMLElement;
    expect(card.className).toContain("animate-in");
    expect(card.className).toContain("duration-200");
    unmount();
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes("reduce") })) as typeof window.matchMedia;
    try {
      const r2 = render(<DemoCoach module="financas" onDone={() => {}} atrasoMs={0} />);
      expect((r2.container.querySelector("[data-lugar] > div") as HTMLElement).className).not.toContain("animate-in");
    } finally {
      window.matchMedia = original;
    }
  });
});

/* ============================================================
 * GEOMETRIA (pura)
 * ============================================================ */
describe("geometria do card", () => {
  it("abaixo se couber antes do CTA; senão acima, abaixo dos headers; alvo alto encosta na base", () => {
    const vh = 640, topo = 180, base = 96;
    expect(posicaoDoCard({ top: 200, left: 0, width: 300, height: 100 }, 160, vh, topo, base)).toEqual({ lugar: "abaixo", top: 312 });
    expect(posicaoDoCard({ top: 420, left: 0, width: 300, height: 100 }, 160, vh, topo, base)).toEqual({ lugar: "acima", top: 248 });
    expect(posicaoDoCard({ top: 190, left: 0, width: 300, height: 400 }, 160, vh, topo, base)).toEqual({ lugar: "abaixo", top: 384 });
    expect(posicaoDoCard(null, 160, vh, topo, base)).toEqual({ lugar: "centro", top: 240 });
  });

  it("o spotlight ganha 6px de folga e nunca sai da tela", () => {
    expect(retanguloDoSpotlight({ top: 100, left: 16, width: 328, height: 50 }, 360, 640)).toEqual({ top: 94, left: 10, width: 340, height: 62 });
    expect(retanguloDoSpotlight({ top: 0, left: 0, width: 360, height: 50 }, 360, 640)).toEqual({ top: 4, left: 4, width: 352, height: 52 });
  });

  it("elemento sem tamanho (escondido, jsdom) não é alvo", () => {
    expect(alvoVisivel({ top: 0, left: 0, width: 0, height: 0 })).toBe(false);
    expect(alvoVisivel(null)).toBe(false);
    expect(alvoVisivel({ top: 0, left: 0, width: 10, height: 10 })).toBe(true);
  });
});

/* ============================================================
 * CTA DO RODAPÉ
 * ============================================================ */
describe("DemoCta", () => {
  const monta = (props: { funnel?: boolean; tour?: boolean; from?: string }) =>
    render(<MemoryRouter><DemoCta {...props} /></MemoryRouter>);

  it("no shell diz de onde a pessoa veio e pra onde volta — e mantém o evento demo_quase_la e o destino", () => {
    monta({ funnel: true, tour: true, from: "w" });
    expect(screen.getByText("Seu plano continua daqui.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Voltar pro meu plano/ });
    expect(link).toHaveAttribute("href", "/app?step=compromissos");
    expect(screen.queryByText(/Quero o meu assim/)).toBeNull();
    fireEvent.click(link);
    expect(eventos("funnel_click")).toEqual([{ cta: "demo_quase_la" }]);
  });

  it("no shell a volta marcada pelo funil (core-demo-volta) continua valendo mais que o padrão", () => {
    sessionStorage.setItem("core-demo-volta", "/app?step=compromissos&x=1");
    monta({ funnel: true, tour: true, from: "w" });
    expect(screen.getByRole("link", { name: /Voltar pro meu plano/ })).toHaveAttribute("href", "/app?step=compromissos&x=1");
  });

  it("v105 (05/09): na WEB dentro do funil o botão é o MESMO do app — web e app idênticos", () => {
    mocks.shell = false;
    monta({ funnel: true, tour: true, from: "w" });
    expect(screen.getByRole("link", { name: /Voltar pro meu plano/ })).toHaveAttribute("href", "/comecar?step=signup");
    expect(screen.getByText(/Seu plano continua daqui/)).toBeInTheDocument();
  });

  it("fora do funil o convite continua: 'Criar conta'", () => {
    mocks.shell = false;
    monta({ funnel: false, tour: false });
    expect(screen.getByRole("link", { name: /Criar conta/ })).toBeInTheDocument();
    expect(screen.getByText(/Crie sua conta/)).toBeInTheDocument();
  });
});

/* ============================================================
 * ABA PADRÃO DO MÓDULO DE METAS
 * ============================================================ */
describe("aba padrão da demo", () => {
  it("o link da barra carimba tab=metas só no módulo de desenvolvimento", () => {
    expect(linkDoModuloDaDemo("desenvolvimento", "w")).toBe("/preview/desenvolvimento?funnel=1&tour=vida&from=w&tab=metas");
    expect(linkDoModuloDaDemo("financas", "w")).toBe("/preview/financas?funnel=1&tour=vida&from=w");
    expect(linkDoModuloDaDemo("rotina")).toBe("/preview/rotina?funnel=1&tour=vida");
  });

  it("a URL do W (sem tab) é normalizada uma vez; com tab, ou em outro módulo, nada muda", () => {
    expect(abaPadraoDaDemo("desenvolvimento", "funnel=1&tour=vida&from=w")).toBe("funnel=1&tour=vida&from=w&tab=metas");
    expect(abaPadraoDaDemo("desenvolvimento", "funnel=1&tour=vida&from=w&tab=metas")).toBeNull();
    expect(abaPadraoDaDemo("desenvolvimento", "funnel=1&tour=vida&tab=sobre")).toBeNull();
    expect(abaPadraoDaDemo("financas", "funnel=1&tour=vida&from=w")).toBeNull();
  });
});
