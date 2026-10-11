/**
 * PORTA → APP JÁ LOGADO (10/10, build 38): o app troca o código da Porta (site) por sessão.
 *
 * O que não pode quebrar:
 *   · `core://entrar?h=…` vira SESSÃO (não rota), no arranque frio e com o app aberto; entrou → /home;
 *     `core://entrar` sem código abre o /entrar;
 *   · o resgate chama a função, faz verifyOtp com o token_hash e registra porta_handoff {via, ok, motivo};
 *   · assinante logado NUNCA é deslogado; conta sem assinatura troca (limpando o cache da anterior);
 *   · a abertura sem conta: link da Porta deu certo → /home; código falhou → /entrar; sem link → welcome;
 *   · área de transferência é PROIBIDA: nada no app a lê (o código-fonte é conferido abaixo).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

/* ---------------------------------------------------------------- mocks */
const getSession = vi.fn();
const verifyOtp = vi.fn();
const signInWithPassword = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const purgeLocalUserCache = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ purgeLocalUserCache: () => purgeLocalUserCache() }));
const app = vi.hoisted(() => ({ launch: null as string | null, ouvintes: [] as ((e: { url: string }) => void)[] }));
vi.mock("@capacitor/app", () => ({
  App: {
    getLaunchUrl: async () => (app.launch ? { url: app.launch } : undefined),
    addListener: async (_n: string, f: (e: { url: string }) => void) => { app.ouvintes.push(f); return { remove: async () => {} }; },
  },
}));
vi.mock("@/lib/auth-nativo", () => ({ ehRetornoDeLogin: (u?: string) => !!u && u.startsWith("core://auth"), sessaoDoLink: vi.fn(), fecharNavegador: vi.fn() }));

import { trackEvent } from "@/lib/analytics";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _zerarHandoff, codigoDoLinkDaPorta, ehLinkDeEntrar, resgatarCodigo } from "@/lib/porta-handoff";
import { PortaPrimeiraAbertura } from "@/components/PortaPrimeiraAbertura";

const CODIGO = "ABCDEFGH23";
const sessao = (email: string) => ({ data: { session: { user: { id: `id-${email}`, email } } } });
const semSessao = () => ({ data: { session: null } });
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);

/** a função porta-handoff e o check-subscription, por nome */
const servidor = (o: { resgate?: unknown; assinante?: boolean | "erro" } = {}) => {
  invoke.mockImplementation(async (nome: string) => {
    if (nome === "check-subscription") {
      if (o.assinante === "erro") return { data: null, error: { message: "fora" } };
      return { data: { subscribed: !!o.assinante }, error: null };
    }
    if (nome === "porta-handoff") {
      const r = o.resgate ?? { data: { token_hash: "hash-1", email: "ana@exemplo.com" }, error: null };
      if (r instanceof Error) throw r;
      return r;
    }
    return { data: null, error: null };
  });
};
const erroHttp = (corpo: Record<string, unknown>) => ({ data: null, error: { message: "Edge Function returned a non-2xx status code", context: { json: async () => corpo } } });

const nativo = (plataforma: "ios" | "android" | null) => {
  if (plataforma) (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => plataforma };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};

beforeEach(() => {
  _zerarHandoff();
  [getSession, verifyOtp, signInWithPassword, invoke, purgeLocalUserCache].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear();
  getSession.mockResolvedValue(semSessao());
  verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
  servidor();
  try { localStorage.clear(); } catch { /* noop */ }
  app.launch = null;
  app.ouvintes = [];
  nativo("ios");
});
afterEach(() => { cleanup(); nativo(null); vi.useRealTimers(); });

/* ---------------------------------------------------------------- o link */
describe("links da Porta", () => {
  it("core://entrar?h=… (e o futuro https://coreaplicativo.com.br/abrir?h=…) dão o código; o resto não", () => {
    expect(codigoDoLinkDaPorta(`core://entrar?h=${CODIGO.toLowerCase()}`)).toBe(CODIGO);
    expect(codigoDoLinkDaPorta(`https://coreaplicativo.com.br/abrir?h=${CODIGO}`)).toBe(CODIGO);
    expect(codigoDoLinkDaPorta(`https://www.coreaplicativo.com.br/abrir/?h=${CODIGO}`)).toBe(CODIGO);
    expect(codigoDoLinkDaPorta("core://entrar?h=TESTE")).toBe("TESTE"); // formato torto: o resgate recusa e registra
    expect(codigoDoLinkDaPorta("core://entrar")).toBeNull();
    expect(codigoDoLinkDaPorta(`core://porta?c=${CODIGO}`)).toBeNull(); // o esquema antigo morreu antes de sair
    expect(codigoDoLinkDaPorta("core://financas")).toBeNull();
    expect(codigoDoLinkDaPorta(`http://coreaplicativo.com.br/abrir?h=${CODIGO}`)).toBeNull();
    expect(codigoDoLinkDaPorta(`https://outro.com/abrir?h=${CODIGO}`)).toBeNull();
    expect(codigoDoLinkDaPorta(`https://coreaplicativo.com.br/p/${CODIGO}`)).toBeNull();
    expect(codigoDoLinkDaPorta(null)).toBeNull();
    expect(ehLinkDeEntrar("core://entrar")).toBe(true);
    expect(ehLinkDeEntrar("core://financas")).toBe(false);
  });

  it("PROIBIDO clipboard: nada do app lê a área de transferência", () => {
    const raiz = process.cwd();
    const fontes = ["src/lib/porta-handoff.ts", "src/components/PortaPrimeiraAbertura.tsx", "src/lib/deep-link.ts", "ios/App/App/AppDelegate.swift"]
      .map((f) => readFileSync(join(raiz, f), "utf8"));
    for (const f of fontes) {
      expect(f).not.toMatch(/UIPasteboard|navigator\.clipboard|clipboardLer|clipboardTemLink|detectPatterns/);
    }
  });
});

describe("deep link core://porta (deep-link.ts)", () => {
  const ligar = async () => {
    vi.resetModules(); // jaConsumiuAbertura é do módulo
    const m = await import("@/lib/deep-link");
    const { _zerarHandoff: zerar } = await import("@/lib/porta-handoff");
    zerar();
    const navegar = vi.fn();
    await m.ligarDeepLinks(navegar);
    return navegar;
  };

  it("arranque frio (getLaunchUrl): resgata, verifyOtp com o token_hash, vai pro /home (nunca a welcome)", async () => {
    app.launch = `core://entrar?h=${CODIGO}`;
    const navegar = await ligar();
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/home"));
    expect(invoke).toHaveBeenCalledWith("porta-handoff", { body: { acao: "resgatar", codigo: CODIGO, via: "link" } });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "magiclink" });
    expect(localStorage.getItem("porta-sem-att")).toBe("1"); // veio da Porta: sem o diálogo de ATT
  });

  it("app aberto (appUrlOpen, na welcome): mesma coisa; os atalhos de módulo seguem funcionando", async () => {
    const navegar = await ligar();
    expect(navegar).not.toHaveBeenCalled();
    app.ouvintes[0]({ url: `core://entrar?h=${CODIGO}` });
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/home"));
    app.ouvintes[0]({ url: "core://financas" });
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/financas"));
    app.ouvintes[0]({ url: "core://entrar" }); // sem código: só a tela de entrar
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/entrar"));
  });

  it("código recusado e sem conta no aparelho → /entrar (ela tem conta: veio da Porta)", async () => {
    servidor({ resgate: erroHttp({ erro: "codigo" }) });
    app.launch = `core://entrar?h=${CODIGO}`;
    const navegar = await ligar();
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/entrar"));
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("assinante logado: o link não faz nada (nem desloga, nem navega)", async () => {
    getSession.mockResolvedValue(sessao("assina@exemplo.com"));
    servidor({ assinante: true });
    app.launch = `core://entrar?h=${CODIGO}`;
    const navegar = await ligar();
    await waitFor(() => expect(eventos("porta_handoff")).toHaveLength(1));
    expect(navegar).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- o resgate */
describe("resgatarCodigo", () => {
  it("10/10: entrou pelo link = da Porta nesta sessão (a tela '3 dias grátis' aparece mesmo sem user_metadata.porta); falha não marca", async () => {
    const { entrouPeloLinkDaPorta, _zerarEntrouPeloLink } = await import("@/lib/porta-sessao");
    _zerarEntrouPeloLink();
    servidor({ resgate: erroHttp({ erro: "codigo" }) });
    await resgatarCodigo(CODIGO, "link");
    expect(entrouPeloLinkDaPorta()).toBe(false);
    _zerarHandoff();
    servidor({});
    await resgatarCodigo(CODIGO, "link");
    expect(entrouPeloLinkDaPorta()).toBe(true);
    _zerarEntrouPeloLink();
  });

  it("sucesso: porta_handoff {via, ok:true, motivo:'ok'}", async () => {
    const r = await resgatarCodigo(CODIGO.toLowerCase(), "link");
    expect(r).toEqual({ ok: true, motivo: "ok", trocouConta: false });
    expect(eventos("porta_handoff")[0]).toEqual({ via: "link", ok: true, motivo: "ok", trocou_conta: false });
  });

  it("código recusado pela função (400 { erro: 'codigo' }) → motivo codigo, sem verifyOtp", async () => {
    servidor({ resgate: erroHttp({ erro: "codigo" }) });
    expect(await resgatarCodigo(CODIGO, "link")).toEqual({ ok: false, motivo: "codigo" });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(eventos("porta_handoff")[0]).toMatchObject({ via: "link", ok: false, motivo: "codigo" });
  });

  it("limite (429), rede fora e formato torto", async () => {
    servidor({ resgate: erroHttp({ erro: "limite" }) });
    expect((await resgatarCodigo(CODIGO, "link")).motivo).toBe("limite");
    _zerarHandoff();
    servidor({ resgate: new Error("offline") });
    expect((await resgatarCodigo(CODIGO, "link")).motivo).toBe("rede");
    _zerarHandoff();
    invoke.mockClear();
    expect(await resgatarCodigo("TESTE", "link")).toEqual({ ok: false, motivo: "formato" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("verifyOtp: 'magiclink' recusado → tenta 'email'; os dois recusados → motivo sessao", async () => {
    verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: "otp" } });
    expect((await resgatarCodigo(CODIGO, "link")).ok).toBe(true);
    expect(verifyOtp.mock.calls.map((c) => c[0].type)).toEqual(["magiclink", "email"]);
    _zerarHandoff();
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: "otp_expired" } });
    expect(await resgatarCodigo(CODIGO, "link")).toEqual({ ok: false, motivo: "sessao" });
  });

  it("o mesmo código por dois caminhos no arranque frio (deep-link + abertura): UM resgate", async () => {
    const [a, b] = await Promise.all([resgatarCodigo(CODIGO, "link"), resgatarCodigo(CODIGO, "link")]);
    expect(a).toBe(b);
    expect(invoke.mock.calls.filter((c) => c[0] === "porta-handoff")).toHaveLength(1);
  });

  describe("já há uma conta no aparelho", () => {
    it("ASSINANTE: nunca desloga — nem chama a função, nem verifyOtp, nem limpa nada", async () => {
      getSession.mockResolvedValue(sessao("assina@exemplo.com"));
      servidor({ assinante: true });
      expect(await resgatarCodigo(CODIGO, "link")).toEqual({ ok: false, motivo: "assinante_logado" });
      expect(invoke.mock.calls.some((c) => c[0] === "porta-handoff")).toBe(false);
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(purgeLocalUserCache).not.toHaveBeenCalled();
    });

    it("não deu pra saber se assina (check-subscription falhou): trata como assinante", async () => {
      getSession.mockResolvedValue(sessao("quem@exemplo.com"));
      servidor({ assinante: "erro" });
      expect((await resgatarCodigo(CODIGO, "link")).motivo).toBe("assinante_logado");
      expect(verifyOtp).not.toHaveBeenCalled();
    });

    it("outra conta SEM assinatura: troca (limpa o cache da anterior antes)", async () => {
      getSession.mockResolvedValue(sessao("outra@exemplo.com"));
      servidor({ assinante: false });
      expect(await resgatarCodigo(CODIGO, "link")).toEqual({ ok: true, motivo: "ok", trocouConta: true });
      expect(purgeLocalUserCache).toHaveBeenCalledTimes(1);
      expect(purgeLocalUserCache.mock.invocationCallOrder[0]).toBeLessThan(verifyOtp.mock.invocationCallOrder[0]);
      expect(eventos("porta_handoff")[0]).toMatchObject({ ok: true, trocou_conta: true });
    });

    it("a MESMA conta do código: nada muda (sem verifyOtp, sem limpar)", async () => {
      getSession.mockResolvedValue(sessao("Ana@Exemplo.com"));
      servidor({ assinante: false });
      expect(await resgatarCodigo(CODIGO, "link")).toEqual({ ok: true, motivo: "mesma_conta" });
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(purgeLocalUserCache).not.toHaveBeenCalled();
    });
  });
});

/* ---------------------------------------------------------------- a 1ª abertura (RootGate) */
describe("PortaPrimeiraAbertura (no lugar do Navigate pra welcome)", () => {
  const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}</p>; };
  const montar = () => render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<PortaPrimeiraAbertura semPorta="/app" />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );

  it("Android (e web): welcome NA HORA", () => {
    nativo("android");
    montar();
    expect(screen.getByTestId("onde").textContent).toBe("/app");
  });

  it("iPhone sem link: welcome (sem resgate, sem aviso nenhum)", async () => {
    montar();
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("/app"));
    expect(invoke).not.toHaveBeenCalled();
    expect(localStorage.getItem("porta-sem-att")).toBeNull(); // app normal: o ATT segue como hoje
  });

  it("abriu frio pelo 'Abrir o CORE' (core://entrar?h=…): entra e vai pro /home, nunca a welcome", async () => {
    app.launch = `core://entrar?h=${CODIGO}`;
    montar();
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("/home"));
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(eventos("porta_handoff")[0]).toMatchObject({ via: "link", ok: true });
    expect(localStorage.getItem("porta-sem-att")).toBe("1");
  });

  it("o link era da Porta mas o código não vale (usado/vencido): /entrar", async () => {
    servidor({ resgate: erroHttp({ erro: "codigo" }) });
    app.launch = `core://entrar?h=${CODIGO}`;
    montar();
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("/entrar"));
  });

  it("o link de abertura vale UMA vez por processo (sair da conta e voltar pra '/' não resgata de novo)", async () => {
    app.launch = `core://entrar?h=${CODIGO}`;
    montar();
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("/home"));
    cleanup();
    montar();
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("/app"));
  });
});
