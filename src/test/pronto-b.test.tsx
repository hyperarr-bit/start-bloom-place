/**
 * PRONTO + SENHA DEPOIS DE PAGAR (Funil B, 30/09) — a tela que fecha a conta
 * de quem pagou o Pix numa sessão anônima:
 *   · com e-mail na sessão: 1 campo (senha), o e-mail num chip fixo;
 *   · sem e-mail (escaneou o QR): e-mail + senha;
 *   · a senha vai pra MESMA conta (batizarConta) — nunca signUp, nunca signOut;
 *   · "já tem conta": entrar por código, e a compra vai junto (a anônima foi
 *     guardada no mount, antes de qualquer botão que troque de sessão);
 *   · quem já tinha conta antes do Pix pula a senha;
 *   · pronto: o item da demo vai pra conta pela chave real, 1×, {system:true};
 *     lojas + "Já tenho conta? Entrar" + /como-entrar; "Abrir meu CORE" vai
 *     pro módulo da área.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";

const m = vi.hoisted(() => ({
  track: vi.fn(),
  precisaBatizar: vi.fn(),
  emailDaSessao: vi.fn(),
  batizarConta: vi.fn(),
  guardar: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  dados: {} as Record<string, unknown>,
  set: vi.fn(),
  user: { id: "u1" } as { id: string } | null,
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/lib/sessao-anonima", () => ({
  precisaBatizar: m.precisaBatizar,
  emailDaSessao: m.emailDaSessao,
  batizarConta: m.batizarConta,
  guardarCompraAnonima: m.guardar,
  limparBatismo: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: m.user, loading: false, signUp: m.signUp, signIn: vi.fn(), signOut: m.signOut }),
}));
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({
    get: (k: string, f: unknown) => (k in m.dados ? m.dados[k] : f),
    set: m.set,
    loaded: true,
    isGuest: false,
    fetchKey: async () => null,
  }),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: m.signInWithOtp,
      verifyOtp: m.verifyOtp,
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
    },
    functions: { invoke: vi.fn() },
  },
}));

import ProntoB from "@/pages/funis/dia14/ProntoB";
import { idDoItem } from "@/lib/demo-guiada-registro";

MotionGlobalConfig.skipAnimations = true;

const CAFE = { tipo: "gasto" as const, nome: "Café", valor: 12 };
const eventos = (nome: string) => m.track.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
const campoSenha = () => screen.getByPlaceholderText("Crie uma senha (mín. 6)");
const botaoCriar = () => screen.getByRole("button", { name: /Criar senha e entrar/ });

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(m.dados)) delete m.dados[k];
  m.set.mockImplementation((k: string, v: unknown) => { m.dados[k] = v; });
  m.user = { id: "u1" };
  m.precisaBatizar.mockResolvedValue(true);
  m.emailDaSessao.mockResolvedValue("ana@exemplo.com");
  m.batizarConta.mockResolvedValue({ erro: null });
  m.guardar.mockResolvedValue(undefined);
  m.signInWithOtp.mockResolvedValue({ error: null });
  m.verifyOtp.mockResolvedValue({ error: null });
  // jsdom não navega: o href vira um campo simples que dá pra ler (mesmo truque do apagar-dados.test)
  Object.defineProperty(window, "location", { value: { ...window.location, href: "", search: "", pathname: "/" }, writable: true });
});
afterEach(cleanup);

describe("ProntoB: o mount", () => {
  it("confirma na hora, guarda a sessão anônima ANTES de qualquer botão, mede a vista e espera a sessão responder", async () => {
    render(<ProntoB area="dinheiro" item={CAFE} respostas={{ vitoria: "Saber pra onde vai meu dinheiro" }} />);
    // ainda sem resposta da sessão: o selo, o título e a folha já estão na tela; o card espera
    expect(screen.getByText("Pronto! Os 16 módulos são seus.")).toBeInTheDocument();
    expect(screen.getByText(/Pagamento único confirmado/)).toHaveTextContent("Pagamento único confirmado — nenhuma cobrança depois.");
    expect(screen.getByTestId("pronto-b-carregando")).toBeInTheDocument();
    expect(screen.queryByTestId("pronto-b-senha")).toBeNull();
    expect(screen.queryByTestId("pronto-b-entrar")).toBeNull();
    expect(m.guardar).toHaveBeenCalledTimes(1);
    expect(eventos("funnel_view")).toEqual([{ step: "pronto", funil: "b", tem_item: true, area: "dinheiro" }]);

    // a folha do planner: o item dela, a vitória do quiz, os 16
    const folha = screen.getByTestId("pronto-b-construiu");
    expect(folha).toHaveTextContent("O que já é seu");
    expect(folha).toHaveTextContent("Café · R$ 12 já está em Finanças");
    expect(folha).toHaveTextContent("Vitória da semana: Saber pra onde vai meu dinheiro");
    expect(folha).toHaveTextContent("16 módulos no mesmo acesso");

    await screen.findByTestId("pronto-b-senha");
    expect(screen.queryByTestId("pronto-b-carregando")).toBeNull();
    // nada gravado na conta antes da senha
    expect(m.set).not.toHaveBeenCalled();
  });
});

describe("com e-mail na sessão + precisa batizar", () => {
  it("1 campo (senha) e o e-mail num chip; o botão só liga com 6+; a senha vai pra MESMA conta; depois o item, as lojas e 'Abrir meu CORE'", async () => {
    render(<ProntoB area="dinheiro" item={CAFE} respostas={{}} />);
    const card = await screen.findByTestId("pronto-b-senha");
    expect(card).toHaveTextContent("Cria sua senha");
    expect(card).toHaveTextContent("É com ela que você entra no app do celular e em qualquer aparelho.");
    expect(screen.getByTestId("pronto-b-email")).toHaveTextContent("ana@exemplo.com");
    expect(screen.queryByPlaceholderText("Seu e-mail")).toBeNull();
    expect(campoSenha()).toHaveAttribute("autocomplete", "new-password");
    expect(campoSenha()).toHaveAttribute("type", "password");

    expect(botaoCriar()).toBeDisabled();
    fireEvent.change(campoSenha(), { target: { value: "segre" } });
    expect(botaoCriar()).toBeDisabled();
    expect(card).toHaveTextContent("pelo menos 6 caracteres (5/6)");
    fireEvent.change(campoSenha(), { target: { value: "segredo1" } });
    expect(botaoCriar()).toBeEnabled();

    // o olhinho
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(campoSenha()).toHaveAttribute("type", "text");

    await act(async () => { fireEvent.click(botaoCriar()); });
    expect(m.batizarConta).toHaveBeenCalledTimes(1);
    expect(m.batizarConta).toHaveBeenCalledWith("segredo1", "", "ana@exemplo.com");
    expect(m.signUp).not.toHaveBeenCalled();
    expect(m.signOut).not.toHaveBeenCalled();
    expect(eventos("funnel_click")).toContainEqual({ cta: "batismo_submit", funil: "b", sem_email: false });
    expect(eventos("funnel_click")).toContainEqual({ cta: "batismo_ok", funil: "b" });

    const entrar = await screen.findByTestId("pronto-b-entrar");
    expect(screen.queryByTestId("pronto-b-senha")).toBeNull();
    expect(entrar).toHaveTextContent("Sua conta: ana@exemplo.com");

    // o item da demo foi pra conta pela chave real, 1×, como registro do sistema
    await waitFor(() => expect(m.set).toHaveBeenCalledTimes(1));
    expect(m.set).toHaveBeenCalledWith("finance-expenses", [
      { id: idDoItem(CAFE), description: "Café", category: "outros", value: 12, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), paymentMethod: "pix" },
    ], { system: true });
    expect(eventos("demo_guia_conta")).toEqual([{ guia: "on", funil: "b", tipo: "gasto", ok: true, chaves: "finance-expenses" }]);

    // as lojas + o toque certo no app + o passo a passo
    expect(within(entrar).getByTestId("loja-app-store")).toBeInTheDocument();
    expect(within(entrar).getByTestId("loja-play")).toBeInTheDocument();
    expect(within(entrar).getByTestId("loja-play").getAttribute("href")).toContain("web_pos_compra_b");
    expect(entrar).toHaveTextContent("Já tenho conta? Entrar");
    expect(within(entrar).getByRole("link", { name: /Ver o passo a passo/ })).toHaveAttribute("href", "/como-entrar");

    fireEvent.click(screen.getByRole("button", { name: /Abrir meu CORE/ }));
    expect(eventos("funnel_click")).toContainEqual({ cta: "pronto_abrir_app", funil: "b" });
    expect(window.location.href).toBe("/financas");
  });

  it("o erro que não é colisão: avisa que a compra não se perde e deixa tentar de novo", async () => {
    m.batizarConta.mockResolvedValueOnce({ erro: "falhou", mensagem: "boom" });
    render(<ProntoB area="dinheiro" item={CAFE} respostas={{}} />);
    await screen.findByTestId("pronto-b-senha");
    fireEvent.change(campoSenha(), { target: { value: "segredo1" } });
    await act(async () => { fireEvent.click(botaoCriar()); });
    expect(screen.getByRole("alert")).toHaveTextContent("Não consegui salvar sua senha. Tenta de novo — sua compra não se perde.");
    expect(eventos("funnel_error")).toContainEqual({ where: "batismo", funil: "b", message: "boom" });
    expect(screen.queryByTestId("pronto-b-entrar")).toBeNull();
    expect(botaoCriar()).toBeEnabled();
    // de novo, agora deu
    await act(async () => { fireEvent.click(botaoCriar()); });
    expect(m.batizarConta).toHaveBeenCalledTimes(2);
    await screen.findByTestId("pronto-b-entrar");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("sem e-mail na sessão (escaneou o QR)", () => {
  it("o usuário anônimo do Supabase vem com email \"\" (não null): também é 'sem e-mail' — pede o campo e o botão liga", async () => {
    m.emailDaSessao.mockResolvedValue("");
    render(<ProntoB area="dinheiro" item={CAFE} respostas={{}} />);
    await screen.findByTestId("pronto-b-senha");
    expect(screen.queryByTestId("pronto-b-email")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Seu e-mail"), { target: { value: "bia@exemplo.com" } });
    fireEvent.change(campoSenha(), { target: { value: "segredo1" } });
    expect(botaoCriar()).toBeEnabled();
  });

  it("2 campos: e-mail + senha; o botão exige e-mail válido e 6+; o e-mail vai normalizado pro batismo", async () => {
    m.emailDaSessao.mockResolvedValue(null);
    render(<ProntoB area="dinheiro" item={CAFE} respostas={{}} />);
    const card = await screen.findByTestId("pronto-b-senha");
    expect(screen.queryByTestId("pronto-b-email")).toBeNull();
    expect(card).toHaveTextContent("Pra onde mando o acesso? Sem isso não dá pra entrar em outro aparelho.");
    const email = screen.getByPlaceholderText("Seu e-mail");
    expect(email).toHaveAttribute("autocomplete", "email");

    fireEvent.change(campoSenha(), { target: { value: "segredo1" } });
    expect(botaoCriar()).toBeDisabled();
    fireEvent.change(email, { target: { value: "nova@exemplo" } });
    expect(botaoCriar()).toBeDisabled();
    fireEvent.change(email, { target: { value: "  Nova@Exemplo.com " } });
    expect(botaoCriar()).toBeEnabled();

    m.emailDaSessao.mockResolvedValue("nova@exemplo.com"); // depois do batismo a sessão tem o e-mail
    await act(async () => { fireEvent.click(botaoCriar()); });
    expect(m.batizarConta).toHaveBeenCalledWith("segredo1", "", "nova@exemplo.com");
    expect(eventos("funnel_click")).toContainEqual({ cta: "batismo_submit", funil: "b", sem_email: true });
    const entrar = await screen.findByTestId("pronto-b-entrar");
    expect(entrar).toHaveTextContent("Sua conta: nova@exemplo.com");
    expect(m.signUp).not.toHaveBeenCalled();
  });
});

describe("e-mail que já tem conta (email_em_uso)", () => {
  const chegarNaColisao = async (email = "eliza@gmail.com") => {
    render(<ProntoB area="dinheiro" item={CAFE} respostas={{}} />);
    await screen.findByTestId("pronto-b-senha");
    const campoEmail = screen.queryByPlaceholderText("Seu e-mail");
    if (campoEmail) fireEvent.change(campoEmail, { target: { value: email } });
    fireEvent.change(campoSenha(), { target: { value: "segredo1" } });
    await act(async () => { fireEvent.click(botaoCriar()); });
  };

  it("oferece ENTRAR por código (a compra vai junto), não um beco; o código troca de sessão e cai no pronto — sem signUp, sem signOut", async () => {
    m.emailDaSessao.mockResolvedValue(null);
    m.batizarConta.mockResolvedValue({ erro: "email_em_uso" });
    await chegarNaColisao();
    expect(screen.getByTestId("pronto-b-email-em-uso")).toHaveTextContent("Esse e-mail já tem conta no CORE. Entra nela e a compra vai junto.");
    expect(screen.getByTestId("entrar-com-codigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar senha e entrar/ })).toBeNull();
    expect(screen.queryByTestId("pronto-b-entrar")).toBeNull();
    expect(eventos("funnel_error")).toContainEqual({ where: "batismo_email_em_uso", funil: "b" });
    // a anônima (dona do Pix) foi guardada no mount, antes do botão que troca de sessão
    expect(m.guardar).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.click(screen.getByTestId("entrar-com-codigo")); });
    expect(m.signInWithOtp).toHaveBeenCalledWith({ email: "eliza@gmail.com", options: { shouldCreateUser: false } });
    fireEvent.change(screen.getByLabelText("Código do e-mail"), { target: { value: "12345678" } });
    m.emailDaSessao.mockResolvedValue("eliza@gmail.com"); // agora a sessão é a conta que já existia
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Entrar$/ })); });
    expect(m.verifyOtp).toHaveBeenCalledWith({ email: "eliza@gmail.com", token: "12345678", type: "email" });
    expect(eventos("funnel_click")).toContainEqual(expect.objectContaining({ cta: "signup_success", via: "codigo_email", funil: "pronto_b" }));
    const entrar = await screen.findByTestId("pronto-b-entrar");
    expect(entrar).toHaveTextContent("Sua conta: eliza@gmail.com");
    expect(m.signUp).not.toHaveBeenCalled();
    expect(m.signOut).not.toHaveBeenCalled();
    expect(m.batizarConta).toHaveBeenCalledTimes(1);
  });

  it("'usar outro e-mail' (só quando o e-mail foi digitado aqui) volta o formulário limpo", async () => {
    m.emailDaSessao.mockResolvedValue(null);
    m.batizarConta.mockResolvedValue({ erro: "email_em_uso" });
    await chegarNaColisao();
    fireEvent.click(screen.getByRole("button", { name: /usar outro e-mail/ }));
    expect(screen.queryByTestId("entrar-com-codigo")).toBeNull();
    expect(screen.getByPlaceholderText("Seu e-mail")).toHaveValue("");
    expect(botaoCriar()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Seu e-mail"), { target: { value: "outra@exemplo.com" } });
    expect(botaoCriar()).toBeEnabled();
  });

  it("com o e-mail fixo na sessão não há 'usar outro e-mail': o código é o caminho", async () => {
    m.batizarConta.mockResolvedValue({ erro: "email_em_uso" });
    await chegarNaColisao();
    expect(screen.getByTestId("entrar-com-codigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /usar outro e-mail/ })).toBeNull();
    expect(screen.getByTestId("pronto-b-email")).toHaveTextContent("ana@exemplo.com");
  });
});

describe("já tinha conta antes do Pix (não precisa batizar)", () => {
  it("pula a senha: direto no pronto, o item gravado, e 'Abrir meu CORE' vai pro módulo da área", async () => {
    m.precisaBatizar.mockResolvedValue(false);
    render(<ProntoB area="metas" item={CAFE} respostas={{}} />);
    const entrar = await screen.findByTestId("pronto-b-entrar");
    expect(screen.queryByTestId("pronto-b-senha")).toBeNull();
    expect(m.batizarConta).not.toHaveBeenCalled();
    expect(entrar).toHaveTextContent("Sua conta: ana@exemplo.com");
    await waitFor(() => expect(m.set).toHaveBeenCalledTimes(1));
    expect(m.set.mock.calls[0][0]).toBe("finance-expenses");
    expect(eventos("demo_guia_conta")).toContainEqual(expect.objectContaining({ funil: "b", ok: true, chaves: "finance-expenses" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir meu CORE/ }));
    expect(window.location.href).toBe("/desenvolvimento");
  });

  it("o item já estava na conta: não duplica (ja_tinha); sem área, abre em Finanças", async () => {
    m.precisaBatizar.mockResolvedValue(false);
    m.dados["finance-expenses"] = [{ id: idDoItem(CAFE), description: "Café", category: "outros", value: 12, date: "2026-09-30", paymentMethod: "pix" }];
    render(<ProntoB area={null} item={CAFE} respostas={{}} />);
    await screen.findByTestId("pronto-b-entrar");
    await waitFor(() => expect(eventos("demo_guia_conta")).toHaveLength(1));
    expect(m.set).not.toHaveBeenCalled();
    expect(eventos("demo_guia_conta")[0]).toEqual(expect.objectContaining({ ok: true, chaves: "ja_tinha" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir meu CORE/ }));
    expect(window.location.href).toBe("/financas");
  });
});

describe("sem item da demo", () => {
  it("nada é gravado, a folha não tem a linha do item e mostra os 16 módulos", async () => {
    m.precisaBatizar.mockResolvedValue(false);
    render(<ProntoB area="rotina" item={null} respostas={{}} />);
    await screen.findByTestId("pronto-b-entrar");
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(m.set).not.toHaveBeenCalled();
    expect(eventos("demo_guia_conta")).toHaveLength(0);
    const folha = screen.getByTestId("pronto-b-construiu");
    expect(folha).not.toHaveTextContent("já está em");
    expect(folha).toHaveTextContent("16 módulos no mesmo acesso");
    expect(eventos("funnel_view")).toEqual([{ step: "pronto", funil: "b", tem_item: false, area: "rotina" }]);
  });
});
