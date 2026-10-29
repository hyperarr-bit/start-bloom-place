/**
 * CONTA: E-MAIL E SENHA LOGADA (29/10) — lib/conta-acesso + pages/conta + o "Sua conta" do AccountDrawer.
 *
 * Trava: como a pessoa entra (senha / Google / Apple); a anônima não vê nada; criar senha (Google) e trocar senha
 * (ok, curta, diferentes, mesma, reautenticação com código); trocar e-mail aplicado na hora, pendente (link) e em uso
 * por outra conta (mensagem + suporte, sem tocar em assinatura); o teclado do iPhone abrindo não derruba o formulário.
 * Respostas no formato do supabase-js 2.108 (AuthApiError com `code`).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useMemo, type ReactNode } from "react";
import { instalarTecladoIphone } from "./helpers/teclado-iphone";

type U = Record<string, unknown> | null;
const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  eventos: [] as Array<[string, Record<string, unknown>]>,
  updateUser: vi.fn(),
  reauthenticate: vi.fn(),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
  invoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { updateUser: h.updateUser, reauthenticate: h.reauthenticate, refreshSession: h.refreshSession, getUser: async () => ({ data: { user: h.user } }) },
    functions: { invoke: h.invoke },
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: h.user, session: null, loading: false, isSubscribed: true, subLoaded: true, billingPeriod: "annual", subscriptionEnd: null, inGracePeriod: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/hooks/use-home-nova", () => ({ useHomeNova: () => ({ ligada: false }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { h.eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() }), Toaster: () => null }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { ThemeProvider } from "@/hooks/use-theme";
import { AccountDrawer } from "@/components/home/AccountDrawer";
import { TrocarEmail, TrocarSenha } from "@/pages/conta/Conta";
import { comoEntra, podeGerenciarConta } from "@/lib/conta-acesso";

const erroAuth = (code: string, message: string, status = 422) => Object.assign(new Error(message), { name: "AuthApiError", code, status, __isAuthError: true });

const COM_SENHA: U = { id: "u1", email: "ana@exemplo.com", is_anonymous: false, identities: [{ provider: "email" }], app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} };
const SO_GOOGLE: U = { id: "u2", email: "bia@gmail.com", is_anonymous: false, identities: [{ provider: "google" }], app_metadata: { provider: "google", providers: ["google"] }, user_metadata: {} };
const ANONIMA: U = { id: "u3", email: "", is_anonymous: true, identities: [], app_metadata: { provider: "anonymous" }, user_metadata: {} };

const Provedor = ({ children }: { children: ReactNode }) => {
  const valor = useMemo<UserDataContextType>(() => ({ get: (<T,>(_k: string, f: T) => f) as UserDataContextType["get"], set: () => {}, loaded: true, isGuest: !h.user, fetchKey: async () => null }) as UserDataContextType, []);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}</p>; };
const montar = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <ThemeProvider>
      <Provedor>
        <Routes>
          <Route path="/conta/senha" element={<><TrocarSenha /><Onde /></>} />
          <Route path="/conta/email" element={<><TrocarEmail /><Onde /></>} />
          <Route path="*" element={<><AccountDrawer open onOpenChange={() => {}} inicial="account" displayName="Ana" /><Onde /></>} />
        </Routes>
      </Provedor>
    </ThemeProvider>
  </MemoryRouter>,
);
const digitar = (id: string, v: string) => fireEvent.change(document.getElementById(id)!, { target: { value: v } });
const dos = (n: string) => h.eventos.filter(([e]) => e === n).map(([, d]) => d);

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
beforeEach(() => {
  h.user = COM_SENHA; h.eventos.length = 0;
  for (const f of [h.updateUser, h.reauthenticate, h.invoke, h.refreshSession]) f.mockClear();
  h.updateUser.mockReset();
  h.reauthenticate.mockReset().mockResolvedValue({ data: {}, error: null });
});
afterEach(() => cleanup());

describe("como a pessoa entra", () => {
  it("senha, Google, Google+senha (marca tem_senha), Apple; anônima não gerencia", () => {
    expect(comoEntra(COM_SENHA as never)).toMatchObject({ senha: true, google: false, rotulo: "E-mail e senha" });
    expect(comoEntra(SO_GOOGLE as never)).toMatchObject({ senha: false, google: true, rotulo: "Google" });
    expect(comoEntra({ ...SO_GOOGLE, user_metadata: { tem_senha: true } } as never)).toMatchObject({ senha: true, rotulo: "Google e senha" });
    expect(comoEntra({ ...SO_GOOGLE, identities: [{ provider: "apple" }], app_metadata: {} } as never)).toMatchObject({ apple: true, senha: false, rotulo: "Apple" });
    expect(podeGerenciarConta(COM_SENHA as never)).toBe(true);
    expect(podeGerenciarConta(ANONIMA as never)).toBe(false);
    expect(podeGerenciarConta({ ...ANONIMA, email: "x@y.com" } as never)).toBe(false); // ainda anônima: a folha do batismo cuida
  });
});

describe("Minha conta (AccountDrawer)", () => {
  it("login por senha: e-mail, 'Entra com e-mail e senha', Trocar senha e Trocar e-mail (que abre /conta/email)", () => {
    montar("/home");
    expect(screen.getByTestId("conta-email-atual").textContent).toBe("ana@exemplo.com");
    expect(screen.getByTestId("conta-como-entra").textContent).toBe("Entra com e-mail e senha");
    expect(screen.getByTestId("conta-trocar-senha").textContent).toMatch(/Trocar senha/);
    fireEvent.click(screen.getByTestId("conta-trocar-email"));
    expect(screen.getByTestId("onde").textContent).toBe("/conta/email");
  });
  it("login por Google: 'Entra com Google' e CRIAR senha", () => {
    h.user = SO_GOOGLE;
    montar("/home");
    expect(screen.getByTestId("conta-como-entra").textContent).toBe("Entra com Google");
    fireEvent.click(screen.getByTestId("conta-trocar-senha"));
    expect(screen.getByTestId("onde").textContent).toBe("/conta/senha");
    expect(dos("conta_senha_open")).toEqual([{ criar: true }]);
  });
  it("troca pendente aparece na conta", () => {
    h.user = { ...COM_SENHA, new_email: "novo@exemplo.com" };
    montar("/home");
    expect(screen.getByTestId("conta-email-pendente-linha")).toBeTruthy();
  });
  it("anônima (sem e-mail) não vê Sua conta; e as telas mandam salvar o e-mail antes", () => {
    h.user = ANONIMA;
    montar("/home");
    expect(screen.queryByTestId("conta-sua-conta")).toBeNull();
    cleanup();
    montar("/conta/senha");
    expect(screen.getByTestId("conta-sem-email")).toBeTruthy();
    expect(screen.queryByTestId("conta-senha-form")).toBeNull();
    cleanup();
    montar("/conta/email");
    expect(screen.queryByTestId("conta-email-form")).toBeNull();
  });
});

describe("senha", () => {
  it("Google cria senha: updateUser({password, data.tem_senha}) e a tela diz como entrar no computador", async () => {
    h.user = SO_GOOGLE;
    h.updateUser.mockResolvedValue({ data: { user: SO_GOOGLE }, error: null });
    montar("/conta/senha");
    expect(screen.getByTestId("conta-senha-intro").textContent).toMatch(/Google/);
    expect(screen.getByTestId("conta-senha-salvar").textContent).toBe("Criar senha");
    digitar("conta-senha-nova", "girassol42"); digitar("conta-senha-confirma", "girassol42");
    fireEvent.click(screen.getByTestId("conta-senha-salvar"));
    await screen.findByTestId("conta-senha-pronto");
    expect(h.updateUser).toHaveBeenCalledWith({ password: "girassol42", data: { tem_senha: true } });
    expect(screen.getByTestId("conta-senha-pronto").textContent).toMatch(/coreaplicativo\.com\.br\/entrar/);
    expect(dos("conta_senha_ok")).toEqual([{ criou: true, codigo: false }]);
  });
  it("curta e diferentes não chamam o Supabase", async () => {
    montar("/conta/senha");
    digitar("conta-senha-nova", "abc12345"); digitar("conta-senha-confirma", "abc12346");
    fireEvent.click(screen.getByTestId("conta-senha-salvar"));
    expect((await screen.findByTestId("conta-senha-erro")).textContent).toMatch(/não estão iguais/);
    digitar("conta-senha-nova", "abc"); digitar("conta-senha-confirma", "abc");
    expect((screen.getByTestId("conta-senha-salvar") as HTMLButtonElement).disabled).toBe(true);
    expect(h.updateUser).not.toHaveBeenCalled();
  });
  it("erro do Supabase (mesma senha) vira mensagem clara", async () => {
    h.updateUser.mockResolvedValue({ data: { user: null }, error: erroAuth("same_password", "New password should be different from the old password.") });
    montar("/conta/senha");
    digitar("conta-senha-nova", "girassol42"); digitar("conta-senha-confirma", "girassol42");
    fireEvent.click(screen.getByTestId("conta-senha-salvar"));
    expect((await screen.findByTestId("conta-senha-erro")).textContent).toMatch(/já é a sua senha/);
    expect(dos("conta_senha_erro")).toEqual([{ motivo: "mesma" }]);
  });
  it("reautenticação exigida: manda o código, pede o código e repete com nonce", async () => {
    h.updateUser
      .mockResolvedValueOnce({ data: { user: null }, error: erroAuth("reauthentication_needed", "Password update requires reauthentication.", 400) })
      .mockResolvedValueOnce({ data: { user: COM_SENHA }, error: null });
    montar("/conta/senha");
    digitar("conta-senha-nova", "girassol42"); digitar("conta-senha-confirma", "girassol42");
    fireEvent.click(screen.getByTestId("conta-senha-salvar"));
    await screen.findByTestId("conta-senha-codigo");
    expect(h.reauthenticate).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId("conta-senha-salvar") as HTMLButtonElement).disabled).toBe(true); // sem código ainda
    digitar("conta-senha-codigo", "123456");
    fireEvent.click(screen.getByTestId("conta-senha-salvar"));
    await screen.findByTestId("conta-senha-pronto");
    expect(h.updateUser).toHaveBeenLastCalledWith({ password: "girassol42", data: { tem_senha: true }, nonce: "123456" });
  });
});

describe("e-mail", () => {
  const pedir = (novo = "ana.nova@exemplo.com", conf = novo) => {
    digitar("conta-email-novo", novo); digitar("conta-email-confirma", conf);
    fireEvent.click(screen.getByTestId("conta-email-salvar"));
  };
  it("aplicado na hora (confirmação desligada): mostra o e-mail novo, sem aviso no antigo", async () => {
    h.updateUser.mockResolvedValue({ data: { user: { ...COM_SENHA, email: "ana.nova@exemplo.com", new_email: null } }, error: null });
    montar("/conta/email");
    pedir();
    await screen.findByTestId("conta-email-aplicado");
    expect(h.updateUser).toHaveBeenCalledWith({ email: "ana.nova@exemplo.com" }, { emailRedirectTo: expect.stringMatching(/\/auth\/callback$/) });
    expect(h.invoke).not.toHaveBeenCalled();
    expect(dos("conta_email_ok")[0]).toMatchObject({ estado: "aplicado" });
  });
  it("pendente (link de confirmação, o caso deste projeto): pede pra confirmar e avisa o e-mail antigo; reenviar funciona", async () => {
    h.updateUser.mockResolvedValue({ data: { user: { ...COM_SENHA, new_email: "ana.nova@exemplo.com" } }, error: null });
    montar("/conta/email");
    pedir("  Ana.Nova@Exemplo.com ", "ana.nova@exemplo.com");
    const tela = await screen.findByTestId("conta-email-pendente");
    expect(tela.textContent).toMatch(/ana\.nova@exemplo\.com/);
    expect(tela.textContent).toMatch(/ana@exemplo\.com/);
    expect(h.invoke).toHaveBeenCalledWith("aviso-troca-email", { body: {} });
    fireEvent.click(screen.getByTestId("conta-email-reenviar"));
    await waitFor(() => expect(h.updateUser).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Mandamos de novo.")).toBeTruthy();
  });
  it("e-mail de outra conta: mensagem clara + suporte; nada além do updateUser", async () => {
    h.updateUser.mockResolvedValue({ data: { user: null }, error: erroAuth("email_exists", "A user with this email address has already been registered") });
    montar("/conta/email");
    pedir("outra@exemplo.com");
    expect((await screen.findByTestId("conta-email-erro")).textContent).toMatch(/outra conta/);
    expect(screen.getByTestId("conta-email-suporte").getAttribute("href")).toMatch(/^mailto:contato@coreaplicativo\.com\.br/);
    expect(h.invoke).not.toHaveBeenCalled();
    expect(dos("conta_email_erro")).toEqual([{ motivo: "em_uso" }]);
  });
  it("diferentes ou igual ao atual: nem chama o Supabase", async () => {
    montar("/conta/email");
    pedir("a@exemplo.com", "b@exemplo.com");
    expect((await screen.findByTestId("conta-email-erro")).textContent).toMatch(/não estão iguais/);
    pedir("ANA@exemplo.com");
    expect((await screen.findByTestId("conta-email-erro")).textContent).toMatch(/já é o e-mail/);
    expect(h.updateUser).not.toHaveBeenCalled();
  });
});

describe("teclado do iPhone", () => {
  it("abrir o teclado (área visível encolhe + rola) não derruba o formulário; o Enter do teclado envia", async () => {
    const t = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 336 }); // SE: o pior caso
    try {
      h.updateUser.mockResolvedValue({ data: { user: COM_SENHA }, error: null });
      montar("/conta/senha");
      const nova = document.getElementById("conta-senha-nova") as HTMLInputElement;
      t.abrir(nova);
      digitar("conta-senha-nova", "girassol42");
      t.trocarPara(document.getElementById("conta-senha-confirma")!);
      digitar("conta-senha-confirma", "girassol42");
      expect(nova.value).toBe("girassol42");
      // nada fixo no rodapé: o botão é irmão dos campos no mesmo formulário (fica logo abaixo deles, acima do teclado)
      const botao = screen.getByTestId("conta-senha-salvar");
      expect(botao.closest("form")).toBe(nova.closest("form"));
      expect(botao.className).not.toMatch(/\bfixed\b|\bsticky\b/);
      fireEvent.submit(nova.closest("form")!);
      await screen.findByTestId("conta-senha-pronto");
    } finally { t.desinstalar(); }
  });
  it("SE com teclado: focar o campo rola SÓ o que falta pro botão aparecer acima do teclado (uma vez, sem laço)", async () => {
    vi.useFakeTimers();
    const t = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 336 });
    const rolar = vi.fn();
    const antes = window.scrollBy;
    window.scrollBy = rolar as unknown as typeof window.scrollBy;
    try {
      montar("/conta/email");
      const botao = screen.getByTestId("conta-email-salvar");
      botao.getBoundingClientRect = () => ({ top: 309, bottom: 365, left: 16, right: 359, width: 343, height: 56, x: 16, y: 309, toJSON: () => ({}) }) as DOMRect;
      const campo = document.getElementById("conta-email-confirma") as HTMLInputElement;
      t.abrir(campo, 0); // foco + focusin + área visível encolhe
      vi.advanceTimersByTime(400);
      expect(rolar).toHaveBeenCalledTimes(1);
      expect(rolar).toHaveBeenCalledWith({ top: 365 + 12 - 331, behavior: "smooth" });
      t.assentar(); vi.advanceTimersByTime(1000);
      expect(rolar).toHaveBeenCalledTimes(1); // o teclado descer não dispara nada
    } finally { t.desinstalar(); window.scrollBy = antes; vi.useRealTimers(); }
  });
});
