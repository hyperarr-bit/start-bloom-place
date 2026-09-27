/**
 * FUNIL ROI 2 (27/09) — o /inicio inteiro diz "você escolhe por onde começar
 * e leva os 16", em toda trilha, da porta ao Pix. Este arquivo trava:
 *   · a porta nova (copy, legendas, selos, SEM preço, "Entrar" discreto);
 *   · o bloco dos 16 com ✓ no paywall de TODAS as trilhas (a de dinheiro não
 *     via — e pagava o Pix a 38% contra 60% de quem escolhia "Tudo");
 *   · "Não é mensal, não é anual" no card do preço e o CTA "Liberar os 16";
 *   · a prova social viva com fallback (nunca 0, nunca número inventado);
 *   · o cadastro de 2 campos sem quebrar o signUp;
 *   · os beacons porta_saida / paywall_saida;
 *   · e o ROLLBACK: FUNIL_ROI2 = false devolve o funil de 19/09 inteiro.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

const chave = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: true, ehFunilRoi2: () => chave.on }));

const prova = vi.hoisted(() => ({ valor: null as null | { total: number; dia: number } }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => prova.valor,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => new Intl.NumberFormat("pt-BR").format(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  trackEventBeacon: analytics.trackEventBeacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({}),
}));

const auth = vi.hoisted(() => ({
  signUp: vi.fn().mockResolvedValue({ error: null, session: { user: { id: "u1" } } }),
  signIn: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false, isSubscribed: false, subLoaded: true, signUp: auth.signUp, signIn: auth.signIn }),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, set: vi.fn(), data: {}, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({ guardarCompraAnonima: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: ({ offer }: { offer: string }) => <div data-testid="pix-mock">oferta:{offer}</div>,
  aquecerCheckoutPix: vi.fn(),
  prepararPixAdiantado: () => ({ tocou: () => {}, parar: () => {} }),
}));

import ComecarDia14, { CentralScreen, RadarResultScreen } from "@/pages/funis/dia14/ComecarDia14";
import { PaywallDia14 } from "@/pages/funis/dia14/PaywallDia14";
import { AREAS, ALL_MODULE_ICONS, DOOR_AREAS, PORTA_TUDO, type AreaKey } from "@/lib/funnel";
import { linhaRecibo } from "@/components/paywall/PixCheckout";
import { rotuloDoModulo } from "@/pages/funis/dia14/pecas-roi2";

MotionGlobalConfig.skipAnimations = true;

const visibilidade = (v: "visible" | "hidden") =>
  Object.defineProperty(document, "visibilityState", { value: v, configurable: true });

const porta = (url = "/inicio?porta=vida") =>
  render(<MemoryRouter initialEntries={[url]}><ComecarDia14 /></MemoryRouter>);

const paywall = (answers: Record<string, string>) =>
  render(<MemoryRouter><PaywallDia14 context="funnel" answers={answers} /></MemoryRouter>);

const texto = () => document.body.textContent ?? "";

beforeEach(() => {
  chave.on = true;
  prova.valor = null;
  localStorage.clear();
  analytics.trackEvent.mockClear();
  analytics.trackEventBeacon.mockClear();
  auth.signUp.mockClear();
  visibilidade("visible");
});
afterEach(cleanup);

/* ------------------------------------------------------------ porta */

describe("porta (1ª tela)", () => {
  it("diz que os 16 vêm juntos e pede só por onde começar — sem preço, com legendas e selos", () => {
    porta();
    expect(screen.getByTestId("porta-roi2")).toBeTruthy();
    expect(texto()).toMatch(/Sua vida inteira,\s*num app só\./);
    expect(texto()).toMatch(/São 16 módulos e todos vêm juntos no mesmo acesso\. Só me diz por onde a gente começa:/);
    for (const k of DOOR_AREAS) {
      expect(screen.getByText(AREAS[k].label)).toBeTruthy();
      expect(screen.getByText(AREAS[k].sub)).toBeTruthy();
    }
    expect(screen.getByText(PORTA_TUDO.label)).toBeTruthy();
    expect(screen.getByText(PORTA_TUDO.sub)).toBeTruthy();
    expect(screen.getByText("16 módulos juntos")).toBeTruthy();
    // dono 27/09: a 1ª tela não fala de pagamento
    expect(document.body.textContent ?? "").not.toMatch(/pagamento|R\$|pix/i);
    expect(texto()).toMatch(/App Store · Google Play/);
    expect(texto()).toMatch(/Leva 60 s · sem cadastro · os 16 módulos vêm em qualquer escolha/);
    // Ordem do dono (23/08): preço NUNCA na 1ª tela.
    expect(texto()).not.toMatch(/R\$/);
    // O que saiu: a pergunta que lia como "escolha UMA área" e o "4 perguntas".
    expect(texto()).not.toMatch(/Qual área tá mais fora de controle/);
    expect(texto()).not.toMatch(/4 perguntas rápidas/);
    expect(texto()).not.toMatch(/no seu ritmo/);
    const entrar = screen.getByRole("link", { name: "Entrar" });
    expect(entrar.getAttribute("href")).toBe("/auth");
  });

  it("tocar numa área leva ao quiz com a pílula '16 módulos · começo: X' no lugar do contador", async () => {
    porta();
    fireEvent.click(screen.getByText("Minha rotina"));
    const pilula = await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(pilula.textContent).toBe("16 módulos · começo: Rotina");
    expect(texto()).not.toMatch(/\d+\/\d+/);
    expect(analytics.trackEvent).toHaveBeenCalledWith("funnel_click", expect.objectContaining({ cta: "start", porta: "vida", area: "rotina" }));
  });

  it("'Tudo, sinceramente' continua caindo na trilha de dinheiro", async () => {
    porta();
    fireEvent.click(screen.getByText(PORTA_TUDO.label));
    const pilula = await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(pilula.textContent).toBe("16 módulos · começo: Dinheiro");
    expect(localStorage.getItem("core-funnel-area")).toBe("dinheiro");
  });

  it("beacon porta_saida: quem sai sem tocar manda segundos + tocou:false", () => {
    porta();
    window.dispatchEvent(new Event("pagehide"));
    expect(analytics.trackEventBeacon).toHaveBeenCalledTimes(1);
    const [nome, dados] = analytics.trackEventBeacon.mock.calls[0];
    expect(nome).toBe("funnel_view");
    expect(dados).toEqual(expect.objectContaining({ step: "porta_saida", porta: "vida", motivo: "fechou", tocou: false, tela: "start", roi2: true }));
    expect(typeof dados.segundos).toBe("number");
    // uma vez só por página
    visibilidade("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(analytics.trackEventBeacon).toHaveBeenCalledTimes(1);
  });

  it("beacon porta_saida: quem tocou numa área e depois escondeu a aba manda tocou:true e a tela em que estava", async () => {
    porta();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    visibilidade("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(analytics.trackEventBeacon).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "porta_saida", motivo: "escondeu", tocou: true, tela: "quiz" }));
  });

  it("quem volta da demo (?step=signup) NÃO gera porta_saida (o signup_saiu de sempre continua)", () => {
    porta("/inicio?step=signup");
    window.dispatchEvent(new Event("pagehide"));
    const passos = analytics.trackEventBeacon.mock.calls.map((c) => c[1]?.step);
    expect(passos).not.toContain("porta_saida");
    expect(passos).toContain("signup_saiu");
  });

  it("ROLLBACK: FUNIL_ROI2 desligado devolve a porta de 19/09", () => {
    chave.on = false;
    porta();
    expect(screen.queryByTestId("porta-roi2")).toBeNull();
    expect(texto()).toMatch(/Um app pra\s*vida inteira/);
    expect(texto()).toMatch(/Qual área tá mais fora de controle hoje\?/);
    expect(texto()).toMatch(/4 perguntas rápidas · sem cadastro agora/);
    expect(texto()).not.toMatch(/Sua vida inteira/);
  });
});

/* -------------------------------------------------- mapa e central */

describe("mapa e central", () => {
  it("o card do mapa diz que os outros 15 já vêm ligados", () => {
    render(<RadarResultScreen answers={{}} area="corpo" onDone={() => {}} />);
    expect(texto()).toMatch(/Seu começo: Corpo\./);
    expect(texto()).toMatch(/Os outros 15 módulos já vêm ligados — você abre quando quiser\./);
    expect(texto()).not.toMatch(/é por onde seu plano começa/);
  });

  it("a central marca os 16 como inclusos (✓) e só o escolhido como 'começa aqui'", () => {
    render(<CentralScreen area="rotina" onOpen={() => {}} />);
    expect(screen.getByTestId("central-roi2")).toBeTruthy();
    expect(texto()).toMatch(/Tudo isso é seu, de uma vez — 16 módulos no mesmo acesso\./);
    expect(texto()).toMatch(/Os 16 inclusos · nada é cobrado à parte · pagamento único/);
    expect(texto()).not.toMatch(/no seu ritmo/);
    expect(screen.getAllByTestId("tile-incluso")).toHaveLength(15);
    const inicio = screen.getByTestId("tile-comeca-aqui");
    expect(inicio.textContent).toMatch(/começa aqui/);
    expect(inicio.textContent).toMatch(/Rotina/);
  });

  it("ROLLBACK: central antiga volta com a frase de 19/09", () => {
    chave.on = false;
    render(<CentralScreen area="rotina" onOpen={() => {}} />);
    expect(screen.queryByTestId("central-roi2")).toBeNull();
    expect(texto()).toMatch(/Os 16 módulos já são seus/);
  });
});

/* ---------------------------------------------------------- paywall */

describe("paywall", () => {
  const trilhas: Array<[string, Record<string, string>]> = [
    ...(Object.keys(AREAS) as AreaKey[]).map((a): [string, Record<string, string>] => [a, { area: a, gasto: "R$ 100 a R$ 300" }]),
    ["tudo (cai em dinheiro)", { area: "dinheiro", atrapalha: "Quero organizar tudo", gasto: "Não faço ideia" }],
    ["sem área (funil padrão)", { gasto: "R$ 300 a R$ 500" }],
  ];

  it.each(trilhas)("trilha %s: os 16 com ✓, o escolhido marcado, 'não é mensal' e CTA 'Liberar os 16'", (_nome, answers) => {
    paywall(answers);
    expect(screen.getByTestId("paywall-roi2")).toBeTruthy();
    const leva = screen.getByTestId("leva-16");
    expect(within(leva).getByText("O que você leva")).toBeTruthy();
    for (const m of ALL_MODULE_ICONS) expect(within(leva).getByText(m.label)).toBeTruthy();
    expect(within(leva).getAllByTestId("tile-incluso")).toHaveLength(15);
    const area = (answers.area ?? "dinheiro") as AreaKey;
    expect(within(leva).getByTestId("tile-comeca-aqui").textContent).toMatch(rotuloDoModulo(area));
    expect(within(leva).getByText(/Você escolheu por onde começar\./)).toBeTruthy();

    expect(screen.getByTestId("nao-e-mensal").textContent).toBe("Não é mensal, não é anual. Nenhuma cobrança depois — nunca.");
    expect(screen.getByRole("button", { name: /Liberar os 16 módulos — R\$ 27,90 no Pix/ })).toBeTruthy();
    expect(screen.getByTestId("confiavel").textContent).toMatch(/É confiável\?/);
    expect(screen.getByTestId("confiavel").textContent).toMatch(/Garantia de 7 dias\./);
    expect(screen.getByTestId("mural").textContent).toMatch(/O que dizem na Google Play/);
    expect(screen.getByTestId("mural").textContent).toMatch(/Ver mais \d+ avaliações/);
    // 3 avaliações reais à vista, nenhuma nota/quantidade (veto de 03/09).
    expect(within(screen.getByTestId("mural")).getAllByLabelText("5 estrelas")).toHaveLength(3);
    expect(texto()).not.toMatch(/4,8|89 avaliações/);
    expect(texto()).not.toMatch(/no seu ritmo/);
    expect(texto()).not.toMatch(/97,90/);
    expect(texto()).not.toMatch(/Quero pra sempre/);
  });

  it("o CTA abre o MESMO checkout de hoje (oferta w27)", () => {
    paywall({ area: "dinheiro", gasto: "R$ 100 a R$ 300" });
    fireEvent.click(screen.getByRole("button", { name: /Liberar os 16 módulos/ }));
    expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w27");
    expect(analytics.trackEvent).toHaveBeenCalledWith("funnel_click", expect.objectContaining({ cta: "paywall_lifetime" }));
  });

  it("prova social: sem número vivo fica o texto fixo de sempre — nunca 0", () => {
    prova.valor = null;
    paywall({ area: "rotina" });
    expect(screen.getByTestId("laurel").textContent).toMatch(/\+1000 pessoas aprovaram o CORE/);
    expect(screen.getByTestId("laurel").textContent).not.toMatch(/\b0 pessoas/);
  });

  it("prova social: com número vivo mostra a contagem real formatada em pt-BR, sem o número das 24 h", () => {
    prova.valor = { total: 1382, dia: 32 };
    paywall({ area: "rotina" });
    const laurel = screen.getByTestId("laurel").textContent ?? "";
    expect(laurel).toMatch(/1\.382 pessoas já garantiram o acesso vitalício/);
    expect(laurel).not.toMatch(/\+1000/);
    expect(laurel).not.toMatch(/24 h|32/);
  });

  it("beacon paywall_saida: aba escondida manda segundos, rolagem e se tocou no CTA", () => {
    paywall({ area: "metas" });
    visibilidade("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(analytics.trackEventBeacon).toHaveBeenCalledWith("funnel_view", expect.objectContaining({
      step: "paywall_saida", motivo: "escondeu", tocou_cta: false, area: "metas", roi2: true,
    }));
    const dados = analytics.trackEventBeacon.mock.calls.find((c) => c[1]?.step === "paywall_saida")?.[1];
    expect(typeof dados.segundos).toBe("number");
    expect(typeof dados.rolou_pct).toBe("number");
    // uma vez só
    window.dispatchEvent(new Event("pagehide"));
    expect(analytics.trackEventBeacon.mock.calls.filter((c) => c[1]?.step === "paywall_saida")).toHaveLength(1);
  });

  it("beacon paywall_saida: depois de tocar no CTA sai com tocou_cta:true", () => {
    paywall({ area: "dinheiro", gasto: "R$ 100 a R$ 300" });
    fireEvent.click(screen.getByRole("button", { name: /Liberar os 16 módulos/ }));
    window.dispatchEvent(new Event("pagehide"));
    expect(analytics.trackEventBeacon).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "paywall_saida", tocou_cta: true }));
  });

  it("o evento de tela do paywall continua 'offer' com paywall_ab (leitura do admin) + a marca roi2", () => {
    paywall({ area: "dinheiro" });
    expect(analytics.trackEvent).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "offer", paywall_ab: "a", roi2: true }));
  });

  it("ROLLBACK: FUNIL_ROI2 desligado devolve o paywall de 19/09 (CTA 'Quero pra sempre', comparação com planilha no dinheiro)", () => {
    chave.on = false;
    paywall({ area: "dinheiro", gasto: "R$ 100 a R$ 300" });
    expect(screen.queryByTestId("paywall-roi2")).toBeNull();
    expect(screen.getByRole("button", { name: /Quero pra sempre — R\$ 27,90 no Pix/ })).toBeTruthy();
    expect(screen.queryByTestId("leva-16")).toBeNull();
    expect(screen.queryByTestId("nao-e-mensal")).toBeNull();
    expect(texto()).toMatch(/Planilha/);
    expect(texto()).not.toMatch(/Liberar os 16 módulos/);
  });
});

/* --------------------------------------------------------- cadastro */

describe("cadastro", () => {
  it("2 campos (e-mail + senha), título com o valor da conta, plano guardado — e o signUp segue válido sem nome", async () => {
    localStorage.setItem("core-funnel-area", "metas");
    porta("/inicio?step=signup");
    expect(screen.getByTestId("cadastro-roi2")).toBeTruthy();
    expect(texto()).toMatch(/Salva seu plano\s*em 10 segundos/);
    expect(texto()).toMatch(/É com esse e-mail que você entra no app do celular/);
    expect(screen.queryByPlaceholderText("Seu nome")).toBeNull();
    expect(screen.getByPlaceholderText("Seu melhor e-mail")).toBeTruthy();
    expect(screen.getByPlaceholderText("Crie uma senha (mín. 6)")).toBeTruthy();
    expect(screen.getByTestId("cadastro-plano-guardado").textContent).toMatch(/Seu plano de Metas \+ 15 módulos fica guardado nessa conta/);
    expect(texto()).toMatch(/Sem cartão agora · sem mensalidade · 16 módulos inclusos/);
    // fora do webview o Google continua existindo, como link discreto
    expect(screen.getByTestId("signup-google-link").textContent).toMatch(/ou continuar com Google/);

    const cta = screen.getByRole("button", { name: /Salvar e ver meu acesso/ });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Seu melhor e-mail"), { target: { value: "Ana@Exemplo.com" } });
    fireEvent.change(screen.getByPlaceholderText("Crie uma senha (mín. 6)"), { target: { value: "segredo1" } });
    expect((cta as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cta);
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledTimes(1));
    expect(auth.signUp).toHaveBeenCalledWith("ana@exemplo.com", "segredo1", undefined);
    expect(analytics.trackEvent).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "signup_tela", variante: "roi2" }));
  });

  it("ROLLBACK: FUNIL_ROI2 desligado devolve o cadastro de 3 campos", () => {
    chave.on = false;
    porta("/inicio?step=signup");
    expect(screen.queryByTestId("cadastro-roi2")).toBeNull();
    expect(screen.getByPlaceholderText("Seu nome")).toBeTruthy();
    expect(texto()).toMatch(/Só falta 1 passo pra você/);
  });
});

/* -------------------------------------------------------------- pix */

describe("recibo do Pix", () => {
  it("vitalício diz 'pagamento único (não renova)'; o mês pré-pago continua '30 dias'", () => {
    expect(linhaRecibo("w27")).toBe("16 módulos · acesso vitalício · pagamento único (não renova)");
    expect(linhaRecibo("lifetime")).toBe("16 módulos · acesso vitalício · pagamento único (não renova)");
    expect(linhaRecibo("downsell")).toBe("16 módulos · acesso vitalício · pagamento único (não renova)");
    expect(linhaRecibo("w25")).toBe("16 módulos · 30 dias de acesso");
  });

  it("ROLLBACK: recibo de 19/09", () => {
    chave.on = false;
    expect(linhaRecibo("w27")).toBe("16 módulos · acesso vitalício");
    expect(linhaRecibo("w25")).toBe("16 módulos · 30 dias de acesso");
  });
});
