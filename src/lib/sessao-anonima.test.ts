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
 *   · e-mail já usado no batismo → "email_em_uso" (quem chama PRECISA
 *     distinguir: trocar de conta aí deixaria a compra paga órfã).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInAnonymously: vi.fn(),
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

describe("ehSessaoAnonima — decide entre updateUser e signUp", () => {
  it("usuário anônimo é reconhecido pela claim", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: true, email: null } } });
    const { ehSessaoAnonima } = await carregar();
    expect(await ehSessaoAnonima()).toBe(true);
  });

  it("conta de verdade NÃO é anônima (senão o batismo trocaria a senha dela)", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u2", is_anonymous: false, email: "a@b.com" } } });
    const { ehSessaoAnonima } = await carregar();
    expect(await ehSessaoAnonima()).toBe(false);
  });

  it("sem usuário: não é sessão anônima (é ausência de sessão)", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } });
    const { ehSessaoAnonima } = await carregar();
    expect(await ehSessaoAnonima()).toBe(false);
  });

  it("lib sem a claim: cai no fallback do e-mail vazio", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u3", email: null } } });
    const { ehSessaoAnonima } = await carregar();
    expect(await ehSessaoAnonima()).toBe(true);
  });
});

describe("batizarSessaoAnonima", () => {
  it("põe e-mail, senha e nome na MESMA conta (nunca cria outra)", async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null });
    const { batizarSessaoAnonima } = await carregar();
    expect(await batizarSessaoAnonima("a@b.com", "segredo123", "Ana")).toEqual({ erro: null });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      email: "a@b.com", password: "segredo123",
      data: { full_name: "Ana", display_name: "Ana" },
    });
  });

  it("e-mail já usado vira 'email_em_uso' — quem chama tem que pedir outro", async () => {
    mockAuth.updateUser.mockResolvedValue({ error: { message: "A user with this email address has already been registered" } });
    const { batizarSessaoAnonima } = await carregar();
    expect((await batizarSessaoAnonima("a@b.com", "x123456", "Ana")).erro).toBe("email_em_uso");
  });

  it("qualquer outro erro vira 'falhou', não é confundido com colisão", async () => {
    mockAuth.updateUser.mockResolvedValue({ error: { message: "network unreachable" } });
    const { batizarSessaoAnonima } = await carregar();
    expect((await batizarSessaoAnonima("a@b.com", "x123456", "Ana")).erro).toBe("falhou");
  });
});
