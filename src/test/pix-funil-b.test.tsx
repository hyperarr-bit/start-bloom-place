/**
 * FUNIL B NO CHECKOUT PIX (30/09): porta → demo → paywall SEM conta → Pix na
 * hora → "Pronto" + senha DEPOIS de pagar. O risco nº 1 é o Pix sem dono (pagou
 * sem e-mail). Dado (21–28/07, 383 QRs): quem copia o código paga 75%, quem não
 * copia 4,6% — então no B o e-mail vem ACIMA do botão e copiar EXIGE e-mail
 * (escanear não). Sem a prop `funilB`, o checkout fica byte a byte igual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";

const m = vi.hoisted(() => ({
  invoke: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  guardar: vi.fn(),
  limparBatismo: vi.fn(),
  entrarSenha: vi.fn(),
  definirEmail: vi.fn(),
  track: vi.fn(),
  beacon: vi.fn(),
  fire: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: {
      signInWithOtp: m.signInWithOtp,
      verifyOtp: m.verifyOtp,
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: async () => "anonima",
  anonimoLigado: async () => true,
  emailDaSessao: async () => null,
  definirEmailDaCompra: m.definirEmail,
  entrarNaContaExistente: m.entrarSenha,
  marcarBatismoSeSemEmail: async () => {},
  guardarCompraAnonima: m.guardar,
  limparBatismo: m.limparBatismo,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, trackEventBeacon: m.beacon, getAttributionParams: () => ({}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/funnel", async (orig) => ({ ...(await orig()), isInAppBrowser: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: m.fire }));

import { PixCheckout } from "@/components/paywall/PixCheckout";

// O QR vem com imagem pra "escanear" render um <img> (sem base64 seria o SVG do qrcode.react).
const qr = (n: number) => ({
  data: { orderId: `ord${n}`, qrCode: `000201pix${n}`, qrCodeBase64: "data:image/png;base64,iVBORw0KGgo=", amount: "27,90", expiresAt: new Date(Date.now() + 30 * 60e3).toISOString() },
  error: null,
});

/** Ordem de chamada entre a gravação do e-mail e o clipboard. */
let seq = 0;
const ordem: { email?: number; clipboard?: number } = {};
const clipboard = () => (navigator.clipboard.writeText as ReturnType<typeof vi.fn>);

const botaoCopiar = () => screen.getByRole("button", { name: /Copiar código Pix/i });
const eventos = (nome: string) => m.track.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);

const abrir = (funilB?: { aoConfirmar: () => void }) => render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} funilB={funilB} />);
const chegarNoQr = async (funilB?: { aoConfirmar: () => void }) => {
  const r = abrir(funilB);
  await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 6000 });
  return r;
};
const digitarEmail = (v: string) => fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: v } });
const copiar = async () => { await act(async () => { fireEvent.click(botaoCopiar()); }); };
/** O botão diz "Copiado!" por 2,5 s depois do toque; espera virar "Copiar de novo" e toca. */
const copiarDeNovo = async () => {
  await waitFor(() => expect(screen.getByRole("button", { name: /Copiar de novo/i })).toBeInTheDocument(), { timeout: 4000 });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Copiar de novo/i })); });
};

describe("checkout Pix — Funil B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // `?gw=asaas` vale antes do FORCE_GATEWAY (o localStorage "pix-ab-force" só
    // entra quando o FORCE está nulo): o Pix nasce na Asaas e a confirmação é o
    // `asaas-pix check`. Sem isso a w27 iria pra Cakto (FORCE_GATEWAY="cakto").
    window.history.replaceState(null, "", "/inicio?gw=asaas");
    Element.prototype.scrollIntoView = () => {}; // jsdom não tem; o B foca o campo na hora
    seq = 0;
    delete ordem.email;
    delete ordem.clipboard;
    let n = 0;
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr(++n);
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: false, status: "PENDING" }, error: null };
      return { data: {}, error: null };
    });
    m.definirEmail.mockImplementation(async () => { ordem.email = ++seq; return { erro: null }; });
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { ordem.clipboard = ++seq; }) } });
  });

  it("sem funilB (hoje): o e-mail vem DEPOIS do botão, copiar sem e-mail copia, e nenhum evento leva a marca", async () => {
    await chegarNoQr();
    const bloco = screen.getByTestId("pix-email-qr");
    expect(botaoCopiar().compareDocumentPosition(bloco) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(bloco).getByText("Pra onde mandamos seu acesso?")).toBeInTheDocument();
    expect(screen.queryByText("Onde mando o acesso?")).not.toBeInTheDocument();
    await copiar();
    expect(clipboard()).toHaveBeenCalledWith("000201pix1");
    expect(m.definirEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/Código copiado!/)).toBeInTheDocument();
    expect(m.track).toHaveBeenCalledWith("pix_copied", { offer: "w27", context: "funnel" });
    expect(m.track).toHaveBeenCalledWith("funnel_view", { step: "pix_email_destaque", offer: "w27", context: "funnel" });
    expect(m.track.mock.calls.every(([, dados]) => !("funil" in (dados ?? {})))).toBe(true);
  }, 20000);

  it("com funilB: o bloco do e-mail vem ANTES do botão, com 'Onde mando o acesso?'", async () => {
    await chegarNoQr({ aoConfirmar: vi.fn() });
    const bloco = screen.getByTestId("pix-email-qr");
    expect(bloco.compareDocumentPosition(botaoCopiar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(bloco).getByText("Onde mando o acesso?")).toBeInTheDocument();
    expect(within(bloco).getByText("Só o e-mail — é por ele que você entra no app do celular e em outro aparelho.")).toBeInTheDocument();
    expect(within(bloco).getByPlaceholderText("seu@email.com")).toBeInTheDocument();
    expect(within(bloco).getByRole("button", { name: /Salvar e-mail/i })).toBeInTheDocument();
    expect(m.track).toHaveBeenCalledWith("pix_checkout_open", expect.objectContaining({ funil: "b" }));
    expect(m.track).toHaveBeenCalledWith("pix_generated", expect.objectContaining({ funil: "b", order_id: "ord1" }));
  }, 20000);

  it("com funilB, campo vazio ou inválido: NÃO copia, mostra o erro, foca o campo e mede", async () => {
    await chegarNoQr({ aoConfirmar: vi.fn() });
    await copiar();
    expect(clipboard()).not.toHaveBeenCalled();
    expect(screen.getByText("Coloca seu e-mail pra copiar o código — é pra onde vai o acesso.")).toBeInTheDocument();
    expect(screen.queryByText(/Código copiado!/)).not.toBeInTheDocument();
    expect(screen.getByTestId("pix-email-qr").dataset.destaque).toBe("1");
    expect(screen.getByPlaceholderText("seu@email.com")).toHaveFocus();
    expect(m.track).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "pix_email_obrigatorio", motivo: "vazio", funil: "b" }));
    expect(eventos("pix_copied")).toHaveLength(0);
    // inválido é a mesma coisa
    digitarEmail("ana@");
    await copiar();
    expect(clipboard()).not.toHaveBeenCalled();
    expect(m.track).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "pix_email_obrigatorio", motivo: "invalido", funil: "b" }));
    expect(m.definirEmail).not.toHaveBeenCalled();
  }, 20000);

  it("com funilB, e-mail válido: grava o e-mail ANTES do clipboard, copia, marca o evento e diz pra onde vai o acesso", async () => {
    await chegarNoQr({ aoConfirmar: vi.fn() });
    digitarEmail("ana@exemplo.com");
    await copiar();
    expect(m.definirEmail).toHaveBeenCalledWith("ana@exemplo.com");
    expect(clipboard()).toHaveBeenCalledWith("000201pix1");
    expect(ordem.email).toBeLessThan(ordem.clipboard!);
    expect(m.track).toHaveBeenCalledWith("pix_copied", expect.objectContaining({ funil: "b", offer: "w27" }));
    expect(m.track).toHaveBeenCalledWith("funnel_click", expect.objectContaining({ cta: "pix_email_ok", no_qr: true, funil: "b" }));
    expect(screen.getByText(/Código copiado!/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pix-email-salvo")).toHaveTextContent("Acesso vai pra ana@exemplo.com — pode fechar esta tela sem medo."));
    expect(screen.queryByTestId("pix-email-qr")).not.toBeInTheDocument();
    // no B o destaque de "código copiado — pra onde mando?" não existe: o e-mail já foi dado
    expect(eventos("funnel_view").some((e) => e.step === "pix_email_destaque")).toBe(false);
  }, 20000);

  it("com funilB, gravação falhou: o código foi copiado e o bloco fica ACIMA do passo a passo, com o erro", async () => {
    m.definirEmail.mockResolvedValue({ erro: "falhou", mensagem: "rede" });
    await chegarNoQr({ aoConfirmar: vi.fn() });
    digitarEmail("ana@exemplo.com");
    await copiar();
    expect(clipboard()).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Código copiado!/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Não consegui salvar agora. Tenta de novo?")).toBeInTheDocument());
    const bloco = screen.getByTestId("pix-email-qr");
    const passos = screen.getByText("Agora é só colar no app do seu banco:");
    expect(bloco.compareDocumentPosition(passos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("pix-email-salvo")).not.toBeInTheDocument();
    // "Copiar de novo" tenta gravar de novo (e copia de novo)
    m.definirEmail.mockResolvedValue({ erro: null });
    await copiarDeNovo();
    expect(m.definirEmail).toHaveBeenCalledTimes(2);
    expect(clipboard()).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByTestId("pix-email-salvo")).toBeInTheDocument());
  }, 20000);

  it("com funilB, e-mail em uso: o código copiado vale, aparece o 'já tem conta' e copiar de novo pede pra entrar", async () => {
    m.definirEmail.mockResolvedValue({ erro: "email_em_uso" });
    await chegarNoQr({ aoConfirmar: vi.fn() });
    digitarEmail("eliza@gmail.com");
    await copiar();
    expect(clipboard()).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Código copiado!/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pix-ja-tem-conta-qr")).toBeInTheDocument());
    expect(m.guardar).toHaveBeenCalled(); // a sessão anônima (com o QR que pode já estar pago) fica guardada
    expect(screen.getByTestId("entrar-com-codigo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prefiro usar minha senha/i })).toBeInTheDocument();
    expect(m.track).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "pix_email_ja_tem_conta", no_qr: true, funil: "b" }));
    // sem entrar na conta, o Pix não pode ir pro pedido anônimo de novo
    await copiarDeNovo();
    expect(clipboard()).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Entra na sua conta ali em cima (código no e-mail) e o Pix vai pra ela.")).toBeInTheDocument();
    expect(m.track).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "pix_email_obrigatorio", motivo: "conta_existe", funil: "b" }));
  }, 20000);

  it("com funilB: 'Prefiro escanear' mostra o QR sem e-mail e avisa que o e-mail vem depois", async () => {
    await chegarNoQr({ aoConfirmar: vi.fn() });
    expect(screen.queryByAltText("QR Code Pix")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Prefiro escanear o QR code/i }));
    expect(screen.getByAltText("QR Code Pix")).toBeInTheDocument();
    expect(screen.getByTestId("pix-escanear-sem-email")).toHaveTextContent("Escaneou sem e-mail? Depois de pagar, a gente pede seu e-mail aqui mesmo — não fecha esta tela.");
    expect(m.track).toHaveBeenCalledWith("pix_qr_reveal", expect.objectContaining({ funil: "b" }));
    expect(m.definirEmail).not.toHaveBeenCalled();
    // e-mail salvo depois: a linha some (não tem mais o que pedir)
    digitarEmail("ana@exemplo.com");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Salvar e-mail/i })); });
    await waitFor(() => expect(screen.queryByTestId("pix-escanear-sem-email")).not.toBeInTheDocument());
    expect(screen.getByTestId("pix-email-salvo")).toHaveTextContent("Acesso vai pra ana@exemplo.com");
    expect(screen.getByAltText("QR Code Pix")).toBeInTheDocument();
  }, 20000);

  it("com funilB: pagou → aoConfirmar, sem a tela 'Entrar no meu app'; pix_confirmed leva a marca", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr(1);
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, status: "RECEIVED" }, error: null };
      return { data: {}, error: null };
    });
    const aoConfirmar = vi.fn();
    await chegarNoQr({ aoConfirmar });
    // o 1º poll sai 3 s depois do QR
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1), { timeout: 6000 });
    expect(m.track).toHaveBeenCalledWith("pix_confirmed", expect.objectContaining({ funil: "b", gateway: "asaas" }));
    expect(m.fire).toHaveBeenCalledWith("checkout");
    expect(screen.queryByRole("button", { name: /Entrar no meu app/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Pagamento confirmado/)).not.toBeInTheDocument();
    // fica no QR até o pai desmontar (o Pronto é dele)
    expect(botaoCopiar()).toBeInTheDocument();
    // (dentro do act: o countdown do QR segue marcando os segundos enquanto a gente espera)
    await act(async () => { await new Promise((r) => setTimeout(r, 3200)); });
    expect(aoConfirmar).toHaveBeenCalledTimes(1); // o polling parou
  }, 20000);

  it("sem funilB: pagou → a tela 'confirmed' de sempre, com 'Entrar no meu app'", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr(1);
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, status: "RECEIVED" }, error: null };
      return { data: {}, error: null };
    });
    await chegarNoQr();
    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar no meu app/i })).toBeInTheDocument(), { timeout: 6000 });
    expect(m.track).toHaveBeenCalledWith("pix_confirmed", { offer: "w27", context: "funnel", gateway: "asaas", braco: "asaas" });
  }, 20000);

  it("com funilB: TODO evento do fluxo (abrir → QR → copiar → pagar → sair) leva funil:'b'", async () => {
    let pago = false;
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr(1);
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: pago }, error: null };
      return { data: {}, error: null };
    });
    const aoConfirmar = vi.fn();
    const { unmount } = await chegarNoQr({ aoConfirmar });
    digitarEmail("ana@exemplo.com");
    await copiar();
    pago = true;
    window.dispatchEvent(new Event("focus")); // voltou do banco: checa na hora
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1), { timeout: 6000 });
    unmount(); // pix_qr_saida "desmontou"
    const nomes = m.track.mock.calls.map((c) => c[0]);
    for (const esperado of ["pix_checkout_open", "funnel_view", "pix_sessao_anonima", "pix_generated", "pix_copied", "funnel_click", "pix_confirmed", "pix_qr_saida"]) {
      expect(nomes).toContain(esperado);
    }
    for (const [nome, dados] of m.track.mock.calls) {
      expect({ nome, dados }).toEqual({ nome, dados: expect.objectContaining({ funil: "b" }) });
    }
    expect(m.beacon).not.toHaveBeenCalled();
  }, 20000);
});
