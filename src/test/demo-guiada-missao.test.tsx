/**
 * A MISSÃO DE 1 MINUTO na demo (28/09, redesenhada 30/09) — o caminho inteiro,
 * com módulos de mentira no lugar dos de verdade:
 *   · braço "on": faixa 1/3 + cartão do passo 1 com "Começar →"; o post-it dos
 *     CHIPS no formulário (1 toque = o registro dela, gravado pelo mesmo `set`
 *     do módulo e visto pela tela na hora); a COMEMORAÇÃO da Missão do app
 *     ("Primeiro registro feito!" 33→66%) com o botão "Ver meu mês →"; o passo
 *     3 com o número dela subindo e "Continuar →"; a "MISSÃO CUMPRIDA" numa
 *     peça só (lista com 3 quadradinhos, 100%, confete, as DUAS saídas);
 *   · a TRAVA SUAVE do CTA fixo: "1 toque e é seu →" até o 1º registro OU o
 *     tempo OU 1 toque nele; "Pular" e a barra de módulos sempre vivos;
 *   · teclado aberto (campo em foco) = o holofote some; fechou, volta;
 *   · Rotina: a ação é MARCAR o quadradinho de hoje (rotina-habits-checked);
 *   · digitar continua valendo (o "+" do módulo);
 *   · a barra de módulos continua funcionando: trocar no meio encerra a
 *     missão (demo_guia_pular trocou_modulo) sem prender;
 *   · o item SOBREVIVE a 5 módulos de passeio (e ao storage zerado): volta
 *     pro módulo dele e chega no paywall ("O que você já construiu");
 *   · o paywall grava o item na conta — só ele;
 *   · braço "off" (controle): a demo de hoje, com o braço no evento.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  trackEventBeacon: analytics.trackEventBeacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({}),
  markActivation: vi.fn(),
}));
vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: true, ehFunilRoi2: () => true }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => String(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
// o sorteio do A/B (na entrada da demo) controlado pelo teste; o resto do módulo é o de verdade
const sorteio = vi.hoisted(() => ({ valor: null as null | "1" | "0", chamadas: 0 }));
vi.mock("@/lib/demo-guiada-braco", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo-guiada-braco")>()),
  sortearBracoDaDemo: () => { sorteio.chamadas++; return sorteio.valor; },
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: () => null,
  aquecerCheckoutPix: vi.fn(),
  prepararPixAdiantado: () => ({ tocou: () => {}, parar: () => {} }),
}));

/* Módulos de mentira. Finanças lê os gastos como o Index de verdade
 * (usePersistedState — é assim que a escrita do chip tem que chegar na tela),
 * tem o formulário com a MESMA âncora do módulo real (add-expense) numa linha
 * com campos, e o MEU MÊS (add-bill) com o "Saiu" que o passo 3 lê. */
const moduloDeMentira = async (nome: string) => {
  const { useUserData } = await import("@/hooks/use-user-data");
  const { usePersistedState } = await import("@/hooks/use-persisted-state");
  const Modulo = () => {
    const { get } = useUserData();
    const [gastos, setGastos] = usePersistedState<Array<{ id: string; description: string; value: number }>>("finance-expenses", []);
    const lista = Array.isArray(gastos) ? gastos : [];
    const habitos = get<string[]>("rotina-habits", []);
    const [checked, setChecked] = usePersistedState<Record<string, boolean[]>>("rotina-habits-checked", {});
    const hoje = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"][(new Date().getDay() + 6) % 7];
    return (
      <div data-testid={`modulo-${nome}`}>
        <ul>{lista.map((g) => <li key={g.id} data-testid="gasto">{g.description}</li>)}</ul>
        {nome === "financas" && (
          <>
            <div>
              <input placeholder="+ Novo gasto" data-testid="campo-nome" readOnly />
              <input placeholder="Valor" readOnly />
              <button
                data-spotlight="add-expense"
                onClick={() => setGastos([...lista, { id: "novo-1", description: "Pão", value: 7, category: "outros", date: "2026-09-30", paymentMethod: "pix" } as never])}
              >
                +
              </button>
            </div>
            <div data-spotlight="add-bill">
              <div>MEU MÊS</div>
              <div><span>↓ Saiu R$ 3.718</span></div>
            </div>
          </>
        )}
        {nome === "rotina" && (
          <div className="rounded-lg">
            <div><button data-spotlight="add-habit">+ Hábito</button></div>
            <table>
              <tbody>
                {["SEGUNDA", "TERÇA", hoje].filter((d, i, a) => a.indexOf(d) === i).map((dia) => (
                  <tr key={dia} data-testid={`linha-${dia}`}>
                    <td>{dia}</td>
                    {(Array.isArray(habitos) ? habitos : []).map((h, i) => (
                      <td key={h}>
                        <button
                          role="checkbox"
                          aria-checked={!!checked?.[dia]?.[i]}
                          data-testid={dia === hoje ? `check-${i}` : undefined}
                          onClick={() => {
                            const novo = { ...checked, [dia]: [...(checked?.[dia] ?? habitos.map(() => false))] };
                            novo[dia][i] = !novo[dia][i];
                            setChecked(novo);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };
  return { default: Modulo };
};
vi.mock("@/pages/Index", () => moduloDeMentira("financas"));
vi.mock("@/pages/Rotina", () => moduloDeMentira("rotina"));
vi.mock("@/pages/Treino", () => moduloDeMentira("treino"));
vi.mock("@/pages/Dieta", () => moduloDeMentira("dieta"));
vi.mock("@/pages/Saude", () => moduloDeMentira("saude"));
vi.mock("@/pages/DesenvolvimentoPessoal", () => moduloDeMentira("desenvolvimento"));

import Preview from "@/pages/Preview";
import { PaywallDia14 } from "@/pages/funis/dia14/PaywallDia14";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { esquecerMissao, estadoDaMissao } from "@/lib/demo-guiada";
import { idDoItem } from "@/lib/demo-guiada-registro";
import { TEMPOS_DA_MISSAO } from "@/components/demo-guiada/alvos";

// os tempos de verdade, guardados antes de o teste encurtar
const TEMPOS_REAIS = { ...TEMPOS_DA_MISSAO };

MotionGlobalConfig.skipAnimations = true;
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
// jsdom não mede nada: todo elemento tem um retângulo de mentira (o anel precisa ver o alvo)
Element.prototype.getBoundingClientRect = function () {
  return { top: 200, left: 10, width: 300, height: 40, bottom: 240, right: 310, x: 10, y: 200, toJSON() { return this; } } as DOMRect;
};
window.scrollBy = () => {};

/** Como no App: cada módulo é uma página nova (Routes com key = pathname). */
const Rotas = () => {
  const location = useLocation();
  return (
    <>
      <Routes location={location} key={location.pathname}>
        <Route path="/preview/:moduleKey" element={<Preview />} />
        <Route path="/inicio" element={<p data-testid="cadastro">cadastro</p>} />
      </Routes>
      <p data-testid="url">{location.pathname + location.search}</p>
    </>
  );
};
const abrirDemo = async (url: string, modulo = "financas") => {
  render(<MemoryRouter initialEntries={[url]}><Rotas /></MemoryRouter>);
  await screen.findByTestId(`modulo-${modulo}`);
};
const pilula = (nome: string) => within(document.querySelector(".demo-tour-nav") as HTMLElement).getByText(nome).closest("a") as HTMLAnchorElement;
const irPara = async (nome: string, modulo: string) => {
  act(() => { fireEvent.click(pilula(nome)); });
  await screen.findByTestId(`modulo-${modulo}`);
};
const eventos = (nome: string) => analytics.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
const quaseLa = () => screen.getByText("Quase lá").closest("a") as HTMLAnchorElement;
const DEMO = "/preview/financas?funnel=1&tour=vida&from=dia14";
const ROTINA = "/preview/rotina?funnel=1&tour=vida&from=dia14";
const C_CAFE = "c=gasto%7CCaf%C3%A9%7C12";

/** Espera o post-it do passo 2 (o anel só aparece com a rolagem assentada: ~500 ms). */
const esperarPostIt = () => screen.findByTestId("demo-guia-postit", {}, { timeout: 4000 });
/** Toca num chip (o aviso pras telas da mesma chave sai num microtask: por isso o act assíncrono). */
const tocarChip = async (nome: string) => {
  const postit = await esperarPostIt();
  const chip = within(postit).getAllByTestId("demo-guia-chip").find((b) => b.textContent?.includes(nome)) as HTMLElement;
  await act(async () => { fireEvent.pointerDown(chip); fireEvent.click(chip); await Promise.resolve(); });
};
/** O caminho inteiro até a "Missão cumprida", pelos botões. */
const cumprirComCafe = async () => {
  await tocarChip("Café");
  const festa = await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
  act(() => { fireEvent.click(within(festa).getByTestId("demo-guia-ver")); });
  const passo3 = await screen.findByTestId("demo-guia-passo3", {}, { timeout: 4000 });
  act(() => { fireEvent.click(within(passo3).getByTestId("demo-guia-continuar")); });
  return screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  esquecerMissao();
  auth.user = null;
  sorteio.valor = null;
  sorteio.chamadas = 0;
  analytics.trackEvent.mockClear();
  window.history.replaceState({}, "", "/");
  // comemorações encurtadas no teste (o fluxo é o mesmo; os tempos reais estão travados abaixo)
  Object.assign(TEMPOS_DA_MISSAO, { inicio: 60, antesDoHolofote: 50, registrou: 30, primeiroRegistro: 900, olhar: 900, trava: 60_000 });
});
afterEach(() => {
  cleanup();
  Object.assign(TEMPOS_DA_MISSAO, TEMPOS_REAIS);
});

describe("os tempos da missão", () => {
  it("a 1ª comemoração é a do app (2,8 s) mais o tempo de ler o botão; o resto só anda sozinho como rede de segurança", () => {
    expect(TEMPOS_REAIS.primeiroRegistro).toBeGreaterThanOrEqual(2800);
    expect(TEMPOS_REAIS.primeiroRegistro).toBeLessThanOrEqual(5000);
    expect(TEMPOS_REAIS.olhar).toBeGreaterThanOrEqual(6000);
    expect(TEMPOS_REAIS.inicio).toBe(3000);
    // a trava suave do CTA: 20 s (mediana de quem pula é 13 s; p75 30 s — segura os apressados por 7 s, não por 41)
    expect(TEMPOS_REAIS.trava).toBe(20_000);
  });
});

describe("o sorteio do A/B é na ENTRADA da demo (e o braço vai carimbado na URL)", () => {
  it("fora do experimento (chave desligada): a URL e o evento ficam os de hoje", async () => {
    await abrirDemo(DEMO);
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(sorteio.chamadas).toBe(1);
    expect(screen.getByTestId("url").textContent).toBe(DEMO);
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    const vista = eventos("funnel_view").find((e) => e.step === "demo");
    expect(vista).toEqual({ step: "demo", tour: "vida", module: "financas" });
    expect(quaseLa()).toBeTruthy(); // e o CTA de sempre, sem trava
    expect(screen.queryByTestId("demo-cta-travado")).toBeNull();
  });

  it("sorteou a missão: a URL ganha guia=1 (replace) e a faixa aparece", async () => {
    sorteio.valor = "1";
    await abrirDemo(DEMO);
    await screen.findByTestId("demo-guia-faixa");
    expect(screen.getByTestId("url").textContent).toBe(`${DEMO}&guia=1`);
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", guia: "on" }));
  });

  it("sorteou o controle: a URL ganha guia=0 e a demo é a de hoje", async () => {
    sorteio.valor = "0";
    await abrirDemo(DEMO);
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(screen.getByTestId("url").textContent).toBe(`${DEMO}&guia=0`);
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", guia: "off" }));
  });

  it("quem já tem braço na URL não é sorteado de novo; demo fora do funil do dia 14 nunca é sorteada", async () => {
    sorteio.valor = "0";
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    expect(sorteio.chamadas).toBe(0);
    cleanup();
    sorteio.valor = "1";
    await abrirDemo("/preview/financas?funnel=1&tour=vida");
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(sorteio.chamadas).toBe(0);
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
  });
});

describe("braço on: a missão, passo a passo", () => {
  it("nasce em 1/3 (área escolhida ✓) com o cartão do passo 1 e 'Começar →'; Pular; as pílulas levam o braço", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    const faixa = await screen.findByTestId("demo-guia-faixa");
    expect(faixa.textContent).toMatch(/Missão de 1 minuto/i);
    expect(faixa.textContent).toMatch(/1\/3/);
    expect(faixa.textContent).toMatch(/Área escolhida ✓/);
    expect(faixa.textContent).toMatch(/toca em 1 gasto seu/);
    expect(screen.getByTestId("demo-guia-pular")).toBeTruthy();
    const passo1 = screen.getByTestId("demo-guia-passo1");
    expect(passo1.textContent).toMatch(/Passo 1 de 3 · feito/);
    expect(passo1.textContent).toMatch(/Você começou por Finanças/);
    expect(within(passo1).getByTestId("demo-guia-mostrar").textContent).toMatch(/Começar/);
    expect(pilula("Rotina").getAttribute("href")).toContain("guia=1");
    expect(eventos("demo_guia_view")).toContainEqual(expect.objectContaining({ guia: "on", area: "dinheiro", modulo: "financas" }));
    expect(eventos("demo_guia_passo")).toContainEqual(expect.objectContaining({ n: 1 }));
  });

  it("passo 2: o POST-IT com os 3 gastos prontos e '✎ escrever o meu' em cima do formulário; o escuro nunca intercepta toque", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    const postit = await esperarPostIt();
    expect(postit.textContent).toMatch(/Passo 2 de 3 · 1 toque/i);
    expect(postit.textContent).toMatch(/Qual foi o seu último gasto\?/);
    const chips = within(postit).getAllByTestId("demo-guia-chip").map((b) => b.textContent);
    expect(chips).toEqual(["☕Café· R$ 12", "🚗Uber· R$ 23", "🍔Almoço· R$ 35"]);
    expect(within(postit).getByTestId("demo-guia-escrever").textContent).toMatch(/escrever o meu/);
    const anel = screen.getByTestId("demo-guia-anel-2");
    expect(anel.className).toMatch(/pointer-events-none/);
    expect(eventos("demo_guia_passo")).toContainEqual(expect.objectContaining({ n: 2 }));
    // o cartão do passo 1 já saiu
    expect(screen.queryByTestId("demo-guia-passo1")).toBeNull();
  });

  it("1 TOQUE no chip: o gasto entra na lista do módulo (pelo mesmo caminho do +), o chip vira ✓ e vem a comemoração com 'Ver meu mês →'", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await tocarChip("Café");
    // a tela do módulo (usePersistedState, como o Index de verdade) mostra o gasto na hora
    await waitFor(() => expect(screen.getAllByTestId("gasto").map((li) => li.textContent)).toContain("Café"));
    expect(estadoDaMissao().item).toEqual({ tipo: "gasto", nome: "Café", valor: 12 });
    expect(pilula("Rotina").getAttribute("href")).toContain(C_CAFE);
    // o chip tocado vira ✓ enquanto a linha aparece
    const chip = within(screen.getByTestId("demo-guia-postit")).getAllByTestId("demo-guia-chip").find((b) => b.textContent?.includes("Café")) as HTMLElement;
    expect(chip.querySelector("svg")).toBeTruthy();
    expect(eventos("demo_guia_chip")).toContainEqual(expect.objectContaining({ tipo: "gasto", nome: "Café", valor: 12, ok: true }));
    expect(eventos("demo_guia_registro")).toContainEqual(expect.objectContaining({ tipo: "gasto", via: "chip" }));
    expect(eventos("demo_guia_passo")).toContainEqual(expect.objectContaining({ n: 3, tipo: "gasto", via: "chip" }));
    expect(screen.getByTestId("demo-guia-faixa").textContent).toMatch(/2\/3/);

    // 1ª comemoração: igual ao dia 1 da Missão do app — fundo escuro, cartão branco, o gráfico que
    // sobe, o chip preto com o item dela, a barra verde 33% → 66%; e o BOTÃO de seguir
    const festa1 = await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull(); // uma peça de cada vez
    expect(festa1.textContent).toMatch(/Primeiro registro feito!/);
    expect(festa1.textContent).toMatch(/🔥 Café · R\$ 12 ✓/);
    expect(festa1.textContent).toMatch(/Missão de 1 minuto · 2 de 3/);
    expect(festa1.className).toMatch(/pointer-events-none/);
    expect(festa1.getAttribute("data-camada-guia")).toBe("demo-comemoracao");
    expect(festa1.querySelector("path")?.getAttribute("stroke")).toBe("hsl(330 65% 50%)");
    const barra1 = festa1.querySelector('[data-testid="demo-guia-comemoracao-barra"]') as HTMLElement;
    await waitFor(() => expect(barra1.style.width).toBe("66%"));
    expect(within(festa1).getByTestId("demo-guia-ver").textContent).toMatch(/Ver meu mês/);
    expect(document.querySelector("[data-adesivo]")).toBeNull();
  });

  it("passo 3: o número dela subindo (Saiu no mês R$ 3.718 → R$ 3.730) com o botão 'Continuar →'; depois a MISSÃO CUMPRIDA numa peça só", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await tocarChip("Café");
    const festa1 = await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
    act(() => { fireEvent.click(within(festa1).getByTestId("demo-guia-ver")); });
    expect(eventos("demo_guia_continuar")).toContainEqual(expect.objectContaining({ de: "festa1", via: "botao" }));
    const passo3 = await screen.findByTestId("demo-guia-passo3", {}, { timeout: 4000 });
    expect(screen.queryByTestId("demo-guia-comemoracao")).toBeNull();
    expect(passo3.textContent).toMatch(/Passo 3 de 3 · olha/i);
    expect(passo3.textContent).toMatch(/Saiu no mês — já com o seu Café/);
    expect(passo3.textContent).toMatch(/R\$ 3\.718/);
    await waitFor(() => expect(passo3.textContent).toMatch(/R\$ 3\.730/));
    expect(screen.getByTestId("demo-guia-faixa").textContent).toMatch(/1º registro: Café · R\$ 12 ✓ · olha o seu mês/);
    act(() => { fireEvent.click(within(passo3).getByTestId("demo-guia-continuar")); });
    expect(eventos("demo_guia_continuar")).toContainEqual(expect.objectContaining({ de: "olhar", via: "botao" }));

    const fim = await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
    expect(screen.queryByTestId("demo-guia-passo3")).toBeNull();
    expect(fim.textContent).toMatch(/Missão cumprida/);
    const lista = within(fim).getByTestId("demo-guia-lista");
    expect(lista.textContent).toMatch(/Área escolhida: Finanças/);
    expect(lista.textContent).toMatch(/Café · R\$ 12 anotado/);
    expect(lista.textContent).toMatch(/Olhou o seu mês/);
    expect(fim.textContent).toMatch(/Missão de 1 minuto · 100%/);
    expect(fim.textContent).toMatch(/já está anotado/);
    expect(within(fim).getByTestId("demo-guia-confete")).toBeTruthy();
    expect(within(fim).getByTestId("demo-guia-levar").textContent).toMatch(/Levar pros meus números/);
    expect(within(fim).getByTestId("demo-guia-explorar").textContent).toMatch(/Ver os outros módulos/);
    expect(eventos("demo_guia_feito")).toHaveLength(1);
    expect(eventos("demo_guia_feito")[0]).toEqual(expect.objectContaining({ tipo: "gasto", via: "chip" }));
    expect(screen.getByTestId("demo-guia-faixa").textContent).toMatch(/3\/3/);
    expect(document.querySelector("[data-adesivo]")).toBeNull();

    // "Ver os outros módulos": fecha, a faixa sai e a demo segue igual à de hoje
    act(() => { fireEvent.click(within(fim).getByTestId("demo-guia-explorar")); });
    expect(screen.queryByTestId("demo-guia-cumprida")).toBeNull();
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(eventos("demo_guia_explorar")).toContainEqual(expect.objectContaining({ via: "folha" }));
    await screen.findByText("Quase lá"); // o CTA fixo volta quando a folha fecha
    expect(quaseLa().getAttribute("href")).toContain(C_CAFE);
  });

  it("sem tocar em nada, a missão anda sozinha até a MISSÃO CUMPRIDA — e lá ela para: só sai por um dos dois botões", async () => {
    Object.assign(TEMPOS_DA_MISSAO, { primeiroRegistro: 120, olhar: 120 });
    await abrirDemo(`${DEMO}&guia=1`);
    await tocarChip("Uber");
    const fim = await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 5000 });
    expect(eventos("demo_guia_continuar")).toEqual([
      expect.objectContaining({ de: "festa1", via: "auto" }),
      expect.objectContaining({ de: "olhar", via: "auto" }),
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(screen.getByTestId("demo-guia-cumprida")).toBe(fim);
    expect(fim.textContent).toMatch(/Uber · R\$ 23/);
  });

  it("digitar continua valendo: o + do módulo anota o gasto dela e a missão segue igual (via 'digitado')", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    const mais = document.querySelector('[data-spotlight="add-expense"]') as HTMLElement;
    act(() => { fireEvent.pointerDown(mais); fireEvent.click(mais); });
    await screen.findByText(/2\/3/);
    expect(estadoDaMissao().item).toEqual({ tipo: "gasto", nome: "Pão", valor: 7 });
    expect(eventos("demo_guia_registro")).toContainEqual(expect.objectContaining({ tipo: "gasto", via: "digitado" }));
    const festa1 = await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
    expect(festa1.textContent).toMatch(/🔥 Pão · R\$ 7 ✓/);
  });

  it("'✎ escrever o meu' leva o foco pro campo do módulo — e com o teclado aberto o holofote SOME (nada escuro, nada em cima do campo); fechou, volta", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    const postit = await esperarPostIt();
    const campo = screen.getByTestId("campo-nome") as HTMLInputElement;
    act(() => { fireEvent.click(within(postit).getByTestId("demo-guia-escrever")); });
    expect(document.activeElement).toBe(campo);
    expect(eventos("demo_guia_escrever")).toHaveLength(1);
    await waitFor(() => expect(document.querySelector('[data-camada-guia="demo-holofote"]')).toBeNull());
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull();
    expect(eventos("demo_guia_teclado")).toContainEqual(expect.objectContaining({ passo: 2 }));
    // a faixa continua guiando por texto
    expect(screen.getByTestId("demo-guia-faixa").textContent).toMatch(/toca em 1 gasto seu/);
    act(() => { campo.blur(); });
    await screen.findByTestId("demo-guia-postit", {}, { timeout: 3000 });
  });

  it("'Levar pros meus números' vai pro cadastro com o item (o mesmo destino do 'Quase lá')", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    const fim = await cumprirComCafe();
    act(() => { fireEvent.click(within(fim).getByTestId("demo-guia-levar")); });
    await screen.findByTestId("cadastro");
    expect(screen.getByTestId("url").textContent).toBe(`/inicio?step=signup&porta=vida&${C_CAFE}`);
    expect(eventos("demo_guia_levar")).toHaveLength(1);
    expect(eventos("funnel_click")).toContainEqual({ cta: "demo_quase_la", via: "guia" });
  });

  it("Pular: a faixa sai, a trava sai e a demo segue (sem item nenhum)", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    expect(screen.getByTestId("demo-cta-travado")).toBeTruthy();
    act(() => { fireEvent.click(screen.getByTestId("demo-guia-pular")); });
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-guia-passo1")).toBeNull();
    // 30/09: a missão começa no cartão do passo 1 — pular logo de cara é pular no passo 1
    expect(eventos("demo_guia_pular")).toContainEqual(expect.objectContaining({ motivo: "botao", passo: 1 }));
    expect(eventos("demo_guia_trava")).toContainEqual(expect.objectContaining({ motivo: "pular" }));
    await screen.findByText("Quase lá");
    expect(quaseLa().getAttribute("href")).not.toContain("c=");
  });
});

describe("a TRAVA SUAVE do CTA fixo", () => {
  it("nasce '1 toque e é seu →' no lugar do 'Quase lá'; 1 toque nela reacende a missão (não sai da demo) e o CTA volta a ser o de sempre", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    const travado = screen.getByTestId("demo-cta-travado");
    expect(travado.textContent).toMatch(/1 toque e é seu/);
    expect(screen.queryByText("Quase lá")).toBeNull();
    expect(document.body.textContent).toMatch(/falta 1 toque/);
    act(() => { fireEvent.click(travado); });
    expect(screen.getByTestId("url").textContent).toContain("/preview/financas"); // continua na demo
    expect(eventos("demo_guia_cta")).toContainEqual(expect.objectContaining({ estado: "travado", passo: 1 }));
    expect(eventos("demo_guia_trava")).toContainEqual(expect.objectContaining({ motivo: "cta" }));
    await screen.findByText("Quase lá");
    expect(screen.queryByTestId("demo-cta-travado")).toBeNull();
    // o toque no CTA travado pulou o cartão do passo 1 e foi direto pro post-it
    await esperarPostIt();
    // o 2º toque é o "Quase lá" de sempre: sai pro cadastro e conta como pular
    act(() => { fireEvent.click(quaseLa()); });
    await screen.findByTestId("cadastro");
    expect(eventos("demo_guia_pular")).toContainEqual(expect.objectContaining({ motivo: "quase_la" }));
  });

  it("acaba sozinha com o tempo (20 s de verdade)", async () => {
    Object.assign(TEMPOS_DA_MISSAO, { trava: 200 });
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-cta-travado");
    await screen.findByText("Quase lá", {}, { timeout: 3000 });
    expect(eventos("demo_guia_trava")).toContainEqual(expect.objectContaining({ motivo: "tempo" }));
    expect(screen.getByTestId("demo-guia-faixa")).toBeTruthy(); // a missão continua
  });

  it("acaba com o 1º registro (e o CTA passa a levar o item)", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await tocarChip("Café");
    await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
    expect(eventos("demo_guia_trava")).toContainEqual(expect.objectContaining({ motivo: "item" }));
    expect(screen.queryByTestId("demo-cta-travado")).toBeNull();
  });
});

describe("Rotina: a missão é MARCAR 1 hábito de hoje (o toque mais comum da demo)", () => {
  it("o post-it pede o quadradinho; marcar 'Treinar' hoje vira o item dela, com 'Feitos hoje' subindo e 'Ver minha sequência →'", async () => {
    await abrirDemo(`${ROTINA}&guia=1`, "rotina");
    const faixa = await screen.findByTestId("demo-guia-faixa");
    expect(faixa.textContent).toMatch(/marca 1 hábito de hoje/);
    const postit = await esperarPostIt();
    expect(postit.textContent).toMatch(/Toca no quadradinho/);
    expect(within(postit).queryAllByTestId("demo-guia-chip")).toHaveLength(0);
    const check = screen.getByTestId("check-1");
    act(() => { fireEvent.pointerDown(check); fireEvent.click(check); });
    await screen.findByText(/2\/3/);
    expect(estadoDaMissao().item).toEqual({ tipo: "habito", nome: "Treinar" });
    expect(eventos("demo_guia_registro")).toContainEqual(expect.objectContaining({ tipo: "habito", via: "toque" }));
    const festa1 = await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
    expect(festa1.textContent).toMatch(/🔥 Treinar ✓/);
    expect(within(festa1).getByTestId("demo-guia-ver").textContent).toMatch(/Ver minha sequência/);
    act(() => { fireEvent.click(within(festa1).getByTestId("demo-guia-ver")); });
    // sem o card CONSISTÊNCIA no módulo de mentira, o passo 3 é pulado (fail-open) e vem a missão cumprida
    const fim = await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
    expect(fim.textContent).toMatch(/Treinar marcado hoje/);
    expect(fim.textContent).toMatch(/já está na sua semana/);
    expect(screen.getByTestId("demo-guia-faixa").textContent).toMatch(/Missão cumprida ✓ Treinar vai com você/);
  });
});

describe("a barra de módulos continua funcionando", () => {
  it("trocar de módulo NO MEIO da missão encerra a missão, sem prender e sem voltar sozinha", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    await irPara("Rotina", "rotina");
    expect(eventos("demo_guia_pular")).toContainEqual(expect.objectContaining({ motivo: "trocou_modulo", para: "rotina", guia: "on" }));
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-cta-travado")).toBeNull();
    expect(screen.getByTestId("url").textContent).toContain("/preview/rotina");
    await irPara("Finanças", "financas");
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    // cada módulo aberto conta, com o braço (métrica de proteção do A/B)
    expect(eventos("funnel_view").filter((e) => e.step === "demo").map((e) => [e.module, e.guia])).toEqual([
      ["financas", "on"], ["rotina", "on"], ["financas", "on"],
    ]);
  });

  it("O ITEM SOBREVIVE: 5 módulos de passeio (com o storage zerado no meio), volta pro módulo dele e chega no paywall", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    const fim = await cumprirComCafe();
    act(() => { fireEvent.click(within(fim).getByTestId("demo-guia-explorar")); });
    for (const [pil, mod] of [["Rotina", "rotina"], ["Treino", "treino"], ["Dieta", "dieta"]] as const) {
      await irPara(pil, mod);
      expect(screen.getByTestId("url").textContent).toContain(C_CAFE);
    }
    // o navegador do Instagram zera o storage (e a página perde a memória): a URL segura
    sessionStorage.clear();
    esquecerMissao();
    for (const [pil, mod] of [["Saúde", "saude"], ["Metas", "desenvolvimento"], ["Finanças", "financas"]] as const) {
      await irPara(pil, mod);
      expect(screen.getByTestId("url").textContent).toContain(C_CAFE);
    }
    // de volta em Finanças: o Café dela está no módulo, junto com o exemplo
    expect(within(screen.getByTestId("modulo-financas")).getByText("Café")).toBeTruthy();
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull(); // a missão não recomeça
    const volta = quaseLa().getAttribute("href") ?? "";
    expect(volta).toContain(C_CAFE);
    cleanup();

    // ...e o paywall (volta do "Quase lá" → cadastro → paywall) mostra o que ela construiu
    window.history.replaceState({}, "", volta);
    const semConta: UserDataContextType = { get: ((_k: string, f: unknown) => f) as UserDataContextType["get"], set: vi.fn(), loaded: true, isGuest: true, fetchKey: async () => null };
    render(<UserDataContext.Provider value={semConta}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    const bloco = await screen.findByTestId("construiu");
    expect(bloco.textContent).toMatch(/O que você já construiu/i);
    expect(bloco.textContent).toMatch(/Café · R\$ 12/);
    expect(bloco.textContent).toMatch(/por você/);
    expect(bloco.textContent).toMatch(/Finanças pronta/);
    expect(bloco.textContent).toMatch(/16 módulos/);
    expect(bloco.textContent).toMatch(/Fica salvo quando liberar/);
    // sem a arte do adesivo: no lugar, o 🔥 do chip da comemoração da Missão
    expect(bloco.querySelector("[data-adesivo]")).toBeNull();
    expect(bloco.textContent).toMatch(/🔥/);
    expect(eventos("paywall_construiu_view")).toContainEqual({ guia: "on", tipo: "gasto" });
  });
});

describe("paywall → conta (o caminho de quem paga)", () => {
  it("com a conta carregada, grava SÓ o item dela pela chave real, uma vez", async () => {
    auth.user = { id: "u1" };
    const dados: Record<string, unknown> = {};
    const set = vi.fn((k: string, v: unknown) => { dados[k] = v; });
    const ctx: UserDataContextType = { get: ((k: string, f: unknown) => (k in dados ? dados[k] : f)) as UserDataContextType["get"], set, loaded: true, isGuest: false, fetchKey: async () => null };
    window.history.replaceState({}, "", `/inicio?step=signup&${C_CAFE}`);
    const { rerender } = render(<UserDataContext.Provider value={ctx}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    await screen.findByTestId("construiu");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("finance-expenses", [
      { id: idDoItem({ tipo: "gasto", nome: "Café", valor: 12 }), description: "Café", category: "outros", value: 12, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), paymentMethod: "pix" },
    ], { system: true });
    rerender(<UserDataContext.Provider value={{ ...ctx }}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    expect(set).toHaveBeenCalledTimes(1);
    expect(eventos("demo_guia_conta")).toContainEqual(expect.objectContaining({ ok: true, chaves: "finance-expenses" }));
  });

  it("antes da conta carregar do servidor, não grava nada (gravar antes apagaria o que uma conta antiga tinha)", async () => {
    auth.user = { id: "u1" };
    const set = vi.fn();
    const ctx: UserDataContextType = { get: ((_k: string, f: unknown) => f) as UserDataContextType["get"], set, loaded: false, isGuest: false, fetchKey: async () => null };
    window.history.replaceState({}, "", `/inicio?step=signup&${C_CAFE}`);
    render(<UserDataContext.Provider value={ctx}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    await screen.findByTestId("construiu");
    expect(set).not.toHaveBeenCalled();
  });
});

describe("o bloco nunca derruba o paywall", () => {
  it("erro dentro do bloco (ex.: fora do provedor de dados) = o bloco some e o preço continua na tela", async () => {
    window.history.replaceState({}, "", `/inicio?step=signup&${C_CAFE}`);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter>);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.getByTestId("paywall-roi2")).toBeTruthy();
    expect(document.body.textContent).toMatch(/Liberar os 16 módulos/);
    erro.mockRestore();
  });
});

describe("braço off (controle do A/B)", () => {
  it("é a demo de hoje: sem faixa, sem item, sem trava — só o braço nos eventos e nas pílulas", async () => {
    await abrirDemo(`${DEMO}&guia=0`);
    await act(async () => { await new Promise((r) => setTimeout(r, 1500)); });
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-cta-travado")).toBeNull();
    expect(pilula("Rotina").getAttribute("href")).toBe("/preview/rotina?funnel=1&tour=vida&from=dia14&guia=0");
    expect(quaseLa().getAttribute("href")).toBe("/inicio?step=signup&porta=vida");
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", guia: "off" }));
    expect(eventos("demo_guia_view")).toHaveLength(0);
  });
});
