/**
 * A SESSÃO ANÔNIMA FALHA SEMPRE PRO LADO ANTIGO (01/09).
 *
 * Este arquivo existe porque as decisões daqui são invisíveis quando funcionam
 * e caras quando quebram. O caminho novo — comprar antes de ter conta — só
 * pode existir se cada dúvida cair no comportamento comprovado de 31/08
 * (cadastro antes do paywall). Um `true` otimista aqui leva a pessoa até o
 * botão de comprar e a joga numa tela de erro fora do funil, com o anúncio já
 * pago.
 *
 * O que fica travado:
 *   · rede fora / resposta estranha / chave desligada → `anonimoLigado()` = false;
 *   · `signInAnonymously` recusado → "indisponivel", nunca exceção solta;
 *   · o e-mail entra ANTES do QR (26,1% dos pagantes fecham a aba e nunca
 *     voltariam pra dar o endereço depois);
 *   · a pendência do batismo é MARCADA, não deduzida de `is_anonymous` — que
 *     vira false assim que o e-mail entra;
 *   · `batizarConta` não reenvia o e-mail já gravado: isso cairia no fluxo de
 *     TROCA de endereço, que exige confirmação e prenderia quem acabou de pagar.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: mockAuth } }));

/** O módulo cacheia por aba (a chave e a indisponibilidade). Cada teste
 *  precisa de um módulo novo, senão o cache de um vaza pro outro. */
const carregar = async () => {
  vi.resetModules();
  return await import("./sessao-anonima");
};

beforeEach(() => {
  vi.restoreAllMocks();
  mockAuth.getSession.mockReset();
  mockAuth.getUser.mockReset();
  mockAuth.signInAnonymously.mockReset();
  mockAuth.signInWithPassword.mockReset();
  localStorage.clear();
  mockAuth.updateUser.mockReset();
});

describe("anonimoLigado — na dúvida, caminho antigo", () => {
  it("só devolve true quando o Supabase confirma a chave", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ external: { anonymous_users: true } }),
    }));
    const { anonimoLigado } = await carregar();
    expect(await anonimoLigado()).toBe(true);
  });

  it("chave desligada → false (é o estado real do projeto em 01/09)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ external: { anonymous_users: false, google: true } }),
    }));
    const { anonimoLigado } = await carregar();
    expect(await anonimoLigado()).toBe(false);
  });

  it("rede fora → false, sem estourar exceção no meio do funil", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { anonimoLigado } = await carregar();
    expect(await anonimoLigado()).toBe(false);
  });

  it("resposta sem o campo → false (nunca assume o caminho novo)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const { anonimoLigado } = await carregar();
    expect(await anonimoLigado()).toBe(false);
  });

  it("pergunta UMA vez por aba, mesmo com várias chamadas", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { anonymous_users: true } }) });
    vi.stubGlobal("fetch", f);
    const { anonimoLigado } = await carregar();
    await Promise.all([anonimoLigado(), anonimoLigado(), anonimoLigado()]);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("garantirSessao", () => {
  it("já logado: não cria usuário anônimo nenhum", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "x" } } });
    const { garantirSessao } = await carregar();
    expect(await garantirSessao()).toBe("ja-tinha");
    expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("sem sessão e chave ligada: abre a anônima", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.signInAnonymously.mockResolvedValue({ data: { session: { access_token: "y" } }, error: null });
    const { garantirSessao } = await carregar();
    expect(await garantirSessao()).toBe("anonima");
  });

  it("chave desligada: 'indisponivel' — o checkout volta a pedir login", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.signInAnonymously.mockResolvedValue({ data: null, error: { message: "Anonymous sign-ins are disabled" } });
    const { garantirSessao } = await carregar();
    expect(await garantirSessao()).toBe("indisponivel");
  });

  it("exceção da lib não vaza pro funil", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.signInAnonymously.mockRejectedValue(new Error("boom"));
    const { garantirSessao } = await carregar();
    expect(await garantirSessao()).toBe("indisponivel");
  });

  it("depois de falhar uma vez, não insiste a cada tentativa de compra", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.signInAnonymously.mockResolvedValue({ data: null, error: { message: "disabled" } });
    const { garantirSessao } = await carregar();
    await garantirSessao();
    await garantirSessao();
    expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});

describe("definirEmailDaCompra — o e-mail entra ANTES do QR", () => {
  it("abre a sessão anônima e grava o endereço nela", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.signInAnonymously.mockResolvedValue({ data: { session: { access_token: "y" } }, error: null });
    mockAuth.getUser
      .mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })   // emailDaSessao: ainda não tem
      .mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } }); // depois do update
    mockAuth.updateUser.mockResolvedValue({ error: null });
    const { definirEmailDaCompra } = await carregar();
    expect(await definirEmailDaCompra(" A@B.com ")).toEqual({ erro: null });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ email: "a@b.com" });
    expect(localStorage.getItem("core-batismo-pendente")).toBe("u1");
  });

  it("e-mail torto nem chega no servidor", async () => {
    const { definirEmailDaCompra } = await carregar();
    expect((await definirEmailDaCompra("joao@")).erro).toBe("invalido");
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it("colisão vira 'email_em_uso' — e como nada foi pago, dá pra entrar", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "x" } } });
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: null } } });
    mockAuth.updateUser.mockResolvedValue({ error: { message: "A user with this email address has already been registered" } });
    const { definirEmailDaCompra } = await carregar();
    expect((await definirEmailDaCompra("a@b.com")).erro).toBe("email_em_uso");
  });

  it("chave de anônimo desligada: não finge que deu certo", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.signInAnonymously.mockResolvedValue({ data: null, error: { message: "disabled" } });
    const { definirEmailDaCompra } = await carregar();
    expect((await definirEmailDaCompra("a@b.com")).erro).toBe("falhou");
  });

  it("mesmo e-mail de novo é no-op — não cai no fluxo de TROCA (que exige confirmação)", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "x" } } });
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    const { definirEmailDaCompra } = await carregar();
    expect(await definirEmailDaCompra("a@b.com")).toEqual({ erro: null });
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});

describe("precisaBatizar — não confia em is_anonymous", () => {
  /* Ao ganhar e-mail, `is_anonymous` vira false. Se a tela de cadastro
   * deduzisse a pendência daquela flag, chamaria signUp, criaria um segundo
   * usuário e órfanaria a compra paga. Por isso a marca é explícita. */
  it("true quando a marca bate com o usuário atual, MESMO com is_anonymous false", async () => {
    localStorage.setItem("core-batismo-pendente", "u1");
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: false, email: "a@b.com" } } });
    const { precisaBatizar } = await carregar();
    expect(await precisaBatizar()).toBe(true);
  });

  it("false quando a marca é de OUTRO usuário (trocou de conta)", async () => {
    localStorage.setItem("core-batismo-pendente", "u1");
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u2", email: "c@d.com" } } });
    const { precisaBatizar } = await carregar();
    expect(await precisaBatizar()).toBe(false);
  });

  it("false sem marca nenhuma — conta normal segue pelo signUp", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    const { precisaBatizar } = await carregar();
    expect(await precisaBatizar()).toBe(false);
  });
});

describe("batizarConta — só senha e nome", () => {
  it("NÃO reenvia o e-mail que já está na conta (evitaria confirmação pendente)", async () => {
    localStorage.setItem("core-batismo-pendente", "u1");
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    const { batizarConta } = await carregar();
    expect(await batizarConta("segredo123", "Ana", "a@b.com")).toEqual({ erro: null });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      password: "segredo123", data: { full_name: "Ana", display_name: "Ana" },
    });
    expect(localStorage.getItem("core-batismo-pendente")).toBeNull();
  });

  it("conta sem e-mail (borda): aí sim manda o endereço junto", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: null } } });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    const { batizarConta } = await carregar();
    await batizarConta("segredo123", "Ana", "a@b.com");
    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      password: "segredo123", data: { full_name: "Ana", display_name: "Ana" }, email: "a@b.com",
    });
  });

  it("falha não apaga a marca — a pessoa pode tentar de novo", async () => {
    localStorage.setItem("core-batismo-pendente", "u1");
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    mockAuth.updateUser.mockResolvedValue({ error: { message: "network unreachable" } });
    const { batizarConta } = await carregar();
    expect((await batizarConta("x123456", "Ana")).erro).toBe("falhou");
    expect(localStorage.getItem("core-batismo-pendente")).toBe("u1");
  });
});

describe("entrarNaContaExistente — seguro porque é ANTES do dinheiro", () => {
  it("logar limpa a marca de batismo (conta de verdade não deve nada)", async () => {
    localStorage.setItem("core-batismo-pendente", "u1");
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    const { entrarNaContaExistente } = await carregar();
    expect(await entrarNaContaExistente("A@B.com", "senha123")).toEqual({ erro: null });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "senha123" });
    expect(localStorage.getItem("core-batismo-pendente")).toBeNull();
  });

  it("senha errada devolve erro e mantém a sessão de compra", async () => {
    localStorage.setItem("core-batismo-pendente", "u1");
    mockAuth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const { entrarNaContaExistente } = await carregar();
    expect((await entrarNaContaExistente("a@b.com", "errada")).erro).toBeTruthy();
    expect(localStorage.getItem("core-batismo-pendente")).toBe("u1");
  });
});
