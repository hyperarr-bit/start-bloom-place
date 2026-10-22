/**
 * 1.0.18 (dono 21/10) — duas portas do funil do iPhone:
 *   · welcome: "Já tem conta? Entrar" vira "Já sou cliente · Entrar" (abaixo do Começar, menor); o toque leva pro
 *     /entrar?de=welcome com o MESMO `app_welcome_login`;
 *   · /entrar vindo da welcome, no app: "Ainda não tem conta? Monte seu plano" → volta pro funil (/app), com
 *     `entrar_sem_conta_funil`; o login de quem tem conta continua igual; nunca com ?next=, na web, sem vir da
 *     welcome nem pra quem instalou vindo do site;
 *   · "Seu plano de 3 dias": o botão "Fechado" vira "Começar meu Dia 1" — mesma ação, mesmos eventos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const estado = vi.hoisted(() => ({ nativo: true, doSite: false, signIn: vi.fn(async () => ({ error: null as null | { message: string } })) }));

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  instalouVindoDoSite: () => estado.doSite,
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => estado.nativo }));
vi.mock("@/lib/att-ios", () => ({ pedirRastreamentoIos: async () => "nao_ios", segurarReservaNativaDoATT: () => {} }));
vi.mock("@/lib/revenuecat", () => ({ initRevenueCat: async () => {}, prefetchAnualIos: async () => {}, restaurar: async () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, signIn: estado.signIn }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: async () => ({}) } } }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: async () => ({ error: null }), entrarComApple: async () => ({ error: null }) }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => true }));
vi.mock("@/components/auth/EntrarComCodigo", () => ({ EntrarComCodigo: () => null }));
vi.mock("@/components/app/RestaurarCompras", () => ({ RestaurarCompras: () => null }));

import { WelcomeCalai } from "@/pages/funis/w/WelcomeCalai";
import { PlanoDe3Dias, TEXTO_BOTAO_PLANO } from "@/pages/funis/w/PlanoDe3Dias";
import Entrar from "@/pages/Entrar";

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  estado.nativo = true;
  estado.doSite = false;
  estado.signIn.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
});
afterEach(() => { cleanup(); });

const dos = (nome: string) => eventos.filter(([n]) => n === nome).map(([, d]) => d);

function Onde() {
  const l = useLocation();
  return <div data-testid="onde">{l.pathname + l.search}</div>;
}

const montarEntrar = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/app" element={<div data-testid="funil">funil</div>} />
        <Route path="/home" element={<div data-testid="home">home</div>} />
      </Routes>
      <Onde />
    </MemoryRouter>,
  );

describe("welcome: 'Já sou cliente · Entrar'", () => {
  it("aparece ABAIXO do Começar; o texto antigo saiu; o toque emite app_welcome_login e chama onEntrar", () => {
    const onEntrar = vi.fn();
    render(<MemoryRouter><WelcomeCalai onComecar={() => {}} onEntrar={onEntrar} /></MemoryRouter>);
    const link = screen.getByTestId("welcome-ja-sou-cliente");
    expect(link).toHaveTextContent("Já sou cliente · Entrar");
    expect(screen.queryByText(/Já tem conta\?/)).toBeNull();
    const comecar = screen.getByTestId("welcome-comecar");
    expect(comecar.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(link);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(dos("app_welcome_login")).toHaveLength(1);
    expect(dos("app_welcome_start")).toHaveLength(0);
  });

  it("sem onEntrar, leva pro /entrar?de=welcome", () => {
    render(
      <MemoryRouter initialEntries={["/funil-w"]}>
        <Routes>
          <Route path="/funil-w" element={<WelcomeCalai onComecar={() => {}} />} />
          <Route path="/entrar" element={<div>entrar</div>} />
        </Routes>
        <Onde />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("welcome-ja-sou-cliente"));
    expect(screen.getByTestId("onde")).toHaveTextContent("/entrar?de=welcome");
  });

  it("quem instalou vindo do site continua vendo 'Entrar na minha conta' + 'Ainda não tenho conta? Começar'", () => {
    estado.doSite = true;
    render(<MemoryRouter><WelcomeCalai onComecar={() => {}} onEntrar={() => {}} /></MemoryRouter>);
    expect(screen.getByTestId("welcome-entrar-conta")).toHaveTextContent("Entrar na minha conta");
    expect(screen.queryByTestId("welcome-ja-sou-cliente")).toBeNull();
    expect(screen.getByText(/Ainda não tenho conta\?/)).toBeInTheDocument();
  });
});

describe("/entrar vindo da welcome: a volta pro funil", () => {
  it("no app, ?de=welcome: 'Ainda não tem conta? Monte seu plano' → /app, com entrar_sem_conta_funil", () => {
    montarEntrar("/entrar?de=welcome");
    const volta = screen.getByTestId("entrar-sem-conta-funil");
    expect(volta).toHaveTextContent("Ainda não tem conta?");
    expect(volta).toHaveTextContent("Monte seu plano");
    // vem ANTES da Apple/Google (que criariam conta nova pulando o quiz)
    const apple = screen.getByText("Continuar com a Apple").closest("button")!;
    expect(volta.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(volta);
    expect(dos("entrar_sem_conta_funil")).toEqual([{ origem: "welcome" }]);
    expect(screen.getByTestId("funil")).toBeInTheDocument();
    expect(screen.getByTestId("onde")).toHaveTextContent(/^\/app$/);
  });

  it("o login de quem TEM conta segue intacto (mesmo vindo da welcome): e-mail + senha → signIn → /home + login_completed", async () => {
    montarEntrar("/entrar?de=welcome");
    expect(screen.getByText("Entrar no seu CORE")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Seu e-mail/i), { target: { value: "ana@gmail.com" } });
    fireEvent.change(screen.getByLabelText(/Sua senha/i), { target: { value: "segredo123" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Entrar no meu CORE/ })); });
    expect(estado.signIn).toHaveBeenCalledWith("ana@gmail.com", "segredo123");
    expect(dos("login_completed")).toEqual([expect.objectContaining({ method: "password", source: "email_access" })]);
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(dos("entrar_sem_conta_funil")).toHaveLength(0);
  });

  it("Apple e Google continuam na tela", () => {
    montarEntrar("/entrar?de=welcome");
    expect(screen.getByText("Continuar com a Apple")).toBeInTheDocument();
    expect(screen.getByText("Continuar com Google")).toBeInTheDocument();
  });

  it("não aparece: sem ?de=welcome, com ?next= (link de e-mail), na web, nem pra quem instalou vindo do site", () => {
    montarEntrar("/entrar");
    expect(screen.queryByTestId("entrar-sem-conta-funil")).toBeNull();
    cleanup();
    montarEntrar("/entrar?de=welcome&next=%2Fplanos%3Foferta%3Dw97");
    expect(screen.queryByTestId("entrar-sem-conta-funil")).toBeNull();
    cleanup();
    estado.nativo = false;
    montarEntrar("/entrar?de=welcome");
    expect(screen.queryByTestId("entrar-sem-conta-funil")).toBeNull();
    cleanup();
    estado.nativo = true;
    estado.doSite = true;
    montarEntrar("/entrar?de=welcome");
    expect(screen.queryByTestId("entrar-sem-conta-funil")).toBeNull();
  });
});

describe("'Seu plano de 3 dias': 'Começar meu Dia 1' no lugar do 'Fechado'", () => {
  it("o botão tem o texto novo, no mesmo testid; o toque emite os MESMOS eventos e segue (onDone)", () => {
    const onDone = vi.fn();
    render(<PlanoDe3Dias area="dinheiro" onDone={onDone} />);
    const botao = screen.getByTestId("plano-3-dias-fechado");
    expect(TEXTO_BOTAO_PLANO).toBe("Começar meu Dia 1");
    expect(botao).toHaveTextContent("Começar meu Dia 1");
    expect(screen.queryByText("Fechado")).toBeNull();
    fireEvent.click(botao);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(dos("funnel_quiz_answer").map((d) => [d.step, d.answer])).toEqual([
      ["compromisso_1", "claro"], ["compromisso_2", "claro"], ["compromisso_3", "claro"],
    ]);
    expect(dos("funnel_click")).toEqual([
      expect.objectContaining({ cta: "contrato_assinou", funil: "w", tela: "plano_3_dias" }),
      expect.objectContaining({ cta: "plano_3_dias_fechado", funil: "w", area: "dinheiro", marcados: 3 }),
    ]);
    // 2º toque não repete (o botão trava)
    fireEvent.click(botao);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
