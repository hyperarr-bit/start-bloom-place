/**
 * NAVEGAÇÃO EM 3 ABAS (1.0.17, parte 3) — Hoje · Módulos · Você. Ver src/lib/nav-abas.ts.
 *
 * Trava: (1) a regra de visibilidade da barra por rota/estado (nativo × web, tutorial, missão, tour,
 * dentro do módulo, funil/site); (2) o Voltar do Android (histórico) entre abas; (3) os itens do Você
 * levam aonde devem (suporte incluído), com `voce_item_click`; (4) a Aparência liga o modo escuro;
 * (5) a Home com a chave: sem avatar/sol/paleta, engrenagem só pro tour; (6) chave desligada = o app de hoje (com o
 * menu novo da 1.0.18 — lib/menu-novo — o sol e a paleta saem do topo mesmo sem abas; `menu_novo: off` os devolve).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const nativo = vi.hoisted(() => ({ v: false }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "marina@exemplo.com", created_at: new Date(Date.now() - 6 * 86400e3).toISOString() } as { id: string; email: string; created_at: string } | null,
  isSubscribed: true, subLoaded: true, billingPeriod: "annual" as string | null, subscriptionEnd: null as string | null, inGracePeriod: false,
  signOut: vi.fn(async () => {}),
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ ...auth, session: null, loading: false, trialExpired: false, noTrial: false, trialDay: 1, trialHoursLeft: 0, graceDaysLeft: null, paymentMethod: null }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() }), Toaster: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }), resetPasswordForEmail: vi.fn() } },
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { ThemeProvider } from "@/hooks/use-theme";
import {
  ATRIBUTO_RAIZ, CHAVE_FORCA_NAV_ABAS, NAV_ABAS, abaDaRota, barraVisivel, destinoDaVolta, guardarForcaNavDaUrl, lerTela,
  dialogoAberto, marcarVolta, navAbasLigada, planoDeNavegacao,
} from "@/lib/nav-abas";
import { BarraDeAbas, __zerarPilhaDasAbas } from "@/components/nav/BarraDeAbas";
import Voce, { Aparencia, linhaDoPlano } from "@/pages/Voce";
import Modulos from "@/pages/Modulos";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { ModuleDrawer } from "@/components/home/ModuleDrawer";
import { TrilhoLateral } from "@/components/TrilhoLateral";
import { useVoltarDoModulo } from "@/lib/volta-da-demo";
import { EVENTO_MODULOS_EDITAR } from "@/lib/tour-home";
import type { LifeHubData } from "@/hooks/use-life-hub-data";

type Dados = Record<string, unknown>;
const nuvem = { dados: {} as Dados };
const Provedor = ({ children }: { children: ReactNode }) => {
  const [versao, subir] = useReducer((x: number) => x + 1, 0);
  const get = useCallback(<T,>(k: string, f: T): T => (k in nuvem.dados ? (nuvem.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => { nuvem.dados = { ...nuvem.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

/** Mostra a rota, o tipo da última navegação e o state (o "histórico" do Android é a pilha do router). */
const Onde = () => {
  const loc = useLocation();
  const tipo = useNavigationType();
  return <p data-testid="onde" data-tipo={tipo} data-state={JSON.stringify(loc.state ?? null)}>{loc.pathname}{loc.search}</p>;
};
/** Uma raiz pronta (o que a Home de verdade marca quando está na tela). */
const Raiz = ({ nome }: { nome: string }) => <div {...{ [ATRIBUTO_RAIZ]: nome }}>{nome}</div>;
/** Botão que simula o Voltar do Android (o WebView volta 1 no histórico). */
const VoltarAndroid = () => { const nav = useNavigate(); return <button data-testid="voltar-android" onClick={() => nav(-1)}>voltar</button>; };

function montarApp(rota: string, extra?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <ThemeProvider>
        <Provedor>
          <Routes>
            <Route path="/home" element={<Raiz nome="hoje" />} />
            <Route path="/modulos" element={<Modulos />} />
            <Route path="/voce" element={<Voce />} />
            <Route path="/voce/aparencia" element={<Aparencia />} />
            <Route path="*" element={null} />
          </Routes>
          <BarraDeAbas />
          <Onde />
          <VoltarAndroid />
          {extra}
        </Provedor>
      </ThemeProvider>
    </MemoryRouter>,
  );
}
const onde = () => screen.getByTestId("onde").textContent;
const dos = (nome: string) => eventos.filter(([n]) => n === nome).map(([, d]) => d);
/** a barra relê o DOM no próximo quadro (MutationObserver + requestAnimationFrame) */
const quadro = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); eventos.length = 0; nuvem.dados = {};
  nativo.v = false;
  auth.user = { id: "u1", email: "marina@exemplo.com", created_at: new Date(Date.now() - 6 * 86400e3).toISOString() };
  auth.billingPeriod = "annual"; auth.isSubscribed = true; auth.subLoaded = true; auth.inGracePeriod = false; auth.subscriptionEnd = null;
  auth.signOut.mockClear();
  __zerarPilhaDasAbas();
  vi.stubEnv("VITE_NAV_ABAS", "1");
  document.documentElement.removeAttribute("data-missao-doses-faixa");
  document.documentElement.classList.remove("dark");
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); document.body.className = ""; });

describe("a chave", () => {
  it("nasce DESLIGADA no código (o app de hoje até o dono aprovar o print)", () => {
    expect(NAV_ABAS).toBe("off");
    vi.stubEnv("VITE_NAV_ABAS", "");
    expect(navAbasLigada()).toBe(false);
    expect(navAbasLigada("on")).toBe(true);
  });
  it("VITE_NAV_ABAS=1 liga; no navegador ?nav-abas=on|off|auto manda; no app das lojas o link é ignorado", () => {
    expect(navAbasLigada()).toBe(true);
    vi.stubEnv("VITE_NAV_ABAS", "");
    guardarForcaNavDaUrl("?nav-abas=on");
    expect(navAbasLigada()).toBe(true);
    guardarForcaNavDaUrl("?nav-abas=auto");
    expect(localStorage.getItem(CHAVE_FORCA_NAV_ABAS)).toBeNull();
    expect(navAbasLigada()).toBe(false);
    nativo.v = true;
    guardarForcaNavDaUrl("?nav-abas=on&x=1");
    expect(navAbasLigada()).toBe(false);
  });
});

describe("regra de visibilidade (pura)", () => {
  const base = { ligada: true, logado: true, raizPronta: true, camadaPorCima: false };
  it("só nas 3 raízes", () => {
    for (const p of ["/home", "/modulos", "/voce", "/voce/"]) expect(barraVisivel({ ...base, pathname: p })).toBe(true);
    for (const p of ["/financas", "/rotina", "/treino", "/conquistas", "/ajuda", "/retrospectiva", "/notificacoes", "/voce/aparencia", "/planos",
      "/", "/inicio", "/hoje", "/hoje/demo", "/missao", "/missao/app", "/assinar", "/assinatura", "/liberar", "/experimente", "/comece", "/app",
      "/auth", "/entrar", "/privacidade", "/termos", "/preview/financas", "/admin/funil"]) {
      expect(barraVisivel({ ...base, pathname: p })).toBe(false);
    }
  });
  it("deslogado, chave off, tutorial/carregando (sem raiz) ou camada guiada por cima: sem barra", () => {
    expect(barraVisivel({ ...base, pathname: "/home", logado: false })).toBe(false);
    expect(barraVisivel({ ...base, pathname: "/home", ligada: false })).toBe(false);
    expect(barraVisivel({ ...base, pathname: "/home", raizPronta: false })).toBe(false);
    expect(barraVisivel({ ...base, pathname: "/home", camadaPorCima: true })).toBe(false);
  });
  it("abaDaRota", () => {
    expect(abaDaRota("/home")).toBe("hoje");
    expect(abaDaRota("/modulos")).toBe("modulos");
    expect(abaDaRota("/voce")).toBe("voce");
    expect(abaDaRota("/voce/aparencia")).toBeNull();
  });
  it("dialogoAberto (1.0.19, barra de vidro): folha/diálogo PADRÃO aberto (Radix: role=dialog + data-state=open) conta; fechado, ou sem data-state (as folhas da Home nova), não", () => {
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    expect(dialogoAberto()).toBe(true);
    document.body.innerHTML = '<div role="alertdialog" data-state="open"></div>';
    expect(dialogoAberto()).toBe(true);
    document.body.innerHTML = '<div role="dialog" data-state="closed"></div>';
    expect(dialogoAberto()).toBe(false);
    document.body.innerHTML = '<div role="dialog" aria-label="Registrar agora"></div>';
    expect(dialogoAberto()).toBe(false);
    document.body.innerHTML = "";
    expect(dialogoAberto()).toBe(false);
  });

  it("lerTela: tour/missão/festa/holofote e os atributos da missão em doses contam como camada", () => {
    document.body.innerHTML = `<div ${ATRIBUTO_RAIZ}="hoje"></div>`;
    expect(lerTela()).toEqual({ raizPronta: true, camadaPorCima: false });
    for (const sel of ['data-camada-guia="tour-home"', 'data-camada-guia="missao-boas-vindas"', 'data-camada-guia="plano-amanha"', "data-momento"]) {
      document.body.innerHTML = `<div ${ATRIBUTO_RAIZ}="hoje"></div><div ${sel}></div>`;
      expect(lerTela().camadaPorCima).toBe(true);
    }
    document.body.innerHTML = `<div ${ATRIBUTO_RAIZ}="hoje"></div>`;
    for (const a of ["data-missao-dose", "data-missao-doses-faixa", "data-missao-tutorial", "data-funil-missao", "data-intro-modulo-faixa"]) {
      document.documentElement.setAttribute(a, "1");
      expect(lerTela().camadaPorCima).toBe(true);
      document.documentElement.removeAttribute(a);
    }
    document.body.innerHTML = "";
  });
});

describe("Voltar do Android entre abas (planoDeNavegacao)", () => {
  it("Hoje → aba empilha; aba → aba substitui; aba → Hoje volta 1 (se a Hoje está logo abaixo) ou substitui", () => {
    expect(planoDeNavegacao("/home", "/voce", false).tipo).toBe("empilhar");
    expect(planoDeNavegacao("/voce", "/modulos", true).tipo).toBe("substituir");
    expect(planoDeNavegacao("/modulos", "/home", true).tipo).toBe("voltar");
    expect(planoDeNavegacao("/modulos", "/home", false).tipo).toBe("substituir");
    expect(planoDeNavegacao("/voce", "/voce", false).tipo).toBe("nada");
  });
});

describe("a barra no app", () => {
  it.each([[false], [true]])("aparece na Hoje (nativo=%s), com 3 abas, aria e a Hoje ativa", async (n) => {
    nativo.v = n;
    montarApp("/home");
    await quadro();
    const barra = screen.getByTestId("barra-de-abas");
    expect(barra.getAttribute("aria-label")).toBe("Navegação principal");
    expect(screen.getAllByRole("button", { name: /^(Hoje|Módulos|Você)$/ })).toHaveLength(3);
    expect(screen.getByTestId("aba-hoje").getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("aba-voce").getAttribute("aria-current")).toBeNull();
    expect(document.body.classList.contains("com-abas")).toBe(true);
  });

  it("chave desligada: nada (nem a classe no body)", async () => {
    vi.stubEnv("VITE_NAV_ABAS", "");
    montarApp("/home");
    await quadro();
    expect(screen.queryByTestId("barra-de-abas")).toBeNull();
    expect(document.body.classList.contains("com-abas")).toBe(false);
  });

  it("dentro do módulo e nas subpáginas: sem barra", async () => {
    for (const r of ["/financas", "/ajuda", "/conquistas", "/voce/aparencia"]) {
      montarApp(r);
      await quadro();
      expect(screen.queryByTestId("barra-de-abas"), r).toBeNull();
      cleanup();
    }
  });

  it("deslogado: sem barra", async () => {
    auth.user = null;
    montarApp("/home");
    await quadro();
    expect(screen.queryByTestId("barra-de-abas")).toBeNull();
  });

  it("Home no tutorial/carregando (sem a raiz marcada): sem barra", async () => {
    render(
      <MemoryRouter initialEntries={["/home"]}><Provedor><Routes><Route path="/home" element={<div>tutorial</div>} /></Routes><BarraDeAbas /></Provedor></MemoryRouter>,
    );
    await quadro();
    expect(screen.queryByTestId("barra-de-abas")).toBeNull();
  });

  it("tour da Home / missão por cima: some na hora e volta quando a camada sai", async () => {
    const Camada = ({ ligada }: { ligada: boolean }) => (ligada ? <div data-camada-guia="tour-home" /> : null);
    const { rerender } = montarApp("/home", <Camada ligada />);
    await quadro();
    expect(screen.queryByTestId("barra-de-abas")).toBeNull();
    rerender(
      <MemoryRouter initialEntries={["/home"]}><ThemeProvider><Provedor>
        <Routes><Route path="/home" element={<Raiz nome="hoje" />} /></Routes><BarraDeAbas /><Onde /><Camada ligada={false} />
      </Provedor></ThemeProvider></MemoryRouter>,
    );
    await quadro();
    expect(screen.getByTestId("barra-de-abas")).toBeTruthy();
    // a faixa da missão em doses (atributo no <html>)
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    await quadro();
    expect(screen.queryByTestId("barra-de-abas")).toBeNull();
    document.documentElement.removeAttribute("data-missao-doses-faixa");
    await quadro();
    expect(screen.getByTestId("barra-de-abas")).toBeTruthy();
  });

  it("tab_click {tab} e o Voltar do Android: Hoje → Você (empilha) → Módulos (substitui) → Voltar = Hoje", async () => {
    montarApp("/home");
    await quadro();
    fireEvent.click(screen.getByTestId("aba-voce"));
    await quadro();
    expect(onde()).toBe("/voce");
    expect(screen.getByTestId("onde").dataset.tipo).toBe("PUSH");
    fireEvent.click(screen.getByTestId("aba-modulos"));
    await quadro();
    expect(onde()).toBe("/modulos");
    expect(screen.getByTestId("onde").dataset.tipo).toBe("REPLACE");
    expect(dos("tab_click")).toEqual([{ tab: "voce", de: "hoje" }, { tab: "modulos", de: "voce" }]);
    fireEvent.click(screen.getByTestId("voltar-android"));
    await quadro();
    expect(onde()).toBe("/home");
  });

  it("aba → Hoje pela barra volta 1 no histórico (não empilha outra Hoje)", async () => {
    montarApp("/home");
    await quadro();
    fireEvent.click(screen.getByTestId("aba-modulos"));
    await quadro();
    fireEvent.click(screen.getByTestId("aba-hoje"));
    await quadro();
    expect(onde()).toBe("/home");
    expect(screen.getByTestId("onde").dataset.tipo).toBe("POP");
  });

  it("aba aberta por link direto (sem Hoje embaixo): Hoje substitui", async () => {
    montarApp("/voce");
    await quadro();
    fireEvent.click(screen.getByTestId("aba-hoje"));
    await quadro();
    expect(onde()).toBe("/home");
    expect(screen.getByTestId("onde").dataset.tipo).toBe("REPLACE");
  });

  it("tocar na aba atual não navega nem conta clique", async () => {
    montarApp("/home");
    await quadro();
    fireEvent.click(screen.getByTestId("aba-hoje"));
    expect(dos("tab_click")).toHaveLength(0);
    expect(onde()).toBe("/home");
  });
});

describe("aba Você", () => {
  const abrirVoce = async () => { montarApp("/voce"); await quadro(); };
  it.each([
    ["voce-conquistas", "/conquistas", "conquistas", { origem: "voce" }],
    ["voce-retrospectiva", "/retrospectiva", "retrospectiva", null],
    ["voce-aparencia", "/voce/aparencia", "aparencia", null],
    ["voce-ajuda", "/ajuda", "ajuda", null],
    ["voce-plano", "/planos", "plano", null],
    ["voce-privacidade", "/privacidade", "privacidade", null],
    ["voce-termos", "/termos", "termos", null],
  ])("%s → %s com voce_item_click", async (testid, rota, item, state) => {
    await abrirVoce();
    await act(async () => { fireEvent.click(screen.getByTestId(testid)); });
    await quadro();
    expect(onde()).toBe(rota);
    expect(JSON.parse(screen.getByTestId("onde").dataset.state ?? "null")).toEqual(state);
    expect(dos("voce_item_click")).toEqual([{ item }]);
    // a seta ← da subpágina volta pro Você
    expect(destinoDaVolta(rota, "/home")).toBe("/voce");
  });

  it("suporte alcançável em 2 toques (Você → Ajuda e suporte) e sem barra lá dentro", async () => {
    await abrirVoce();
    expect(screen.getByTestId("barra-de-abas")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("voce-ajuda")); });
    await quadro();
    expect(onde()).toBe("/ajuda");
    expect(screen.queryByTestId("barra-de-abas")).toBeNull();
  });

  it("Rever tutorial → Hoje com o pedido no state; Sair chama signOut", async () => {
    await abrirVoce();
    fireEvent.click(screen.getByTestId("voce-tutorial"));
    await quadro();
    expect(onde()).toBe("/home");
    expect(JSON.parse(screen.getByTestId("onde").dataset.state ?? "null")).toEqual({ reverTutorial: true });
    cleanup();
    await abrirVoce();
    fireEvent.click(screen.getByTestId("voce-sair"));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(dos("voce_item_click").map((d) => d.item)).toEqual(["tutorial", "sair"]);
  });

  it("Minha conta abre direto a sub-tela da conta (account_drawer_open via voce)", async () => {
    nuvem.dados = { "core-user-name": "Marina Souza" };
    await abrirVoce();
    expect(screen.getByText("Marina Souza")).toBeTruthy();
    expect(screen.getByText("MS")).toBeTruthy();
    fireEvent.click(screen.getByTestId("voce-conta"));
    await quadro();
    expect(screen.getByText("Redefinir senha")).toBeTruthy();
    expect(screen.getByText("Excluir minha conta")).toBeTruthy();
    expect(dos("account_drawer_open")).toEqual([{ via: "voce" }]);
  });

  it("web: sem Lembretes nem Usar no computador; app: com os dois", async () => {
    await abrirVoce();
    expect(screen.queryByTestId("voce-lembretes")).toBeNull();
    expect(screen.queryByTestId("voce-computador")).toBeNull();
    cleanup();
    nativo.v = true;
    await abrirVoce();
    expect(screen.getByTestId("voce-lembretes")).toBeTruthy();
    expect(screen.getByTestId("voce-computador")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("voce-lembretes")); });
    await quadro();
    expect(onde()).toBe("/notificacoes");
  });

  it("linha do plano", () => {
    const a = { subLoaded: true, isSubscribed: true, billingPeriod: "annual", subscriptionEnd: "2026-10-22T12:00:00Z", inGracePeriod: false };
    expect(linhaDoPlano(a)).toBe("Plano anual");
    expect(linhaDoPlano(a, true)).toMatch(/^Teste grátis até 22/);
    expect(linhaDoPlano({ ...a, billingPeriod: "lifetime" })).toBe("Acesso vitalício");
    expect(linhaDoPlano({ ...a, isSubscribed: false })).toBe("Sem plano ativo");
    expect(linhaDoPlano({ ...a, inGracePeriod: true })).toBe("Pagamento pendente");
    expect(linhaDoPlano({ ...a, subLoaded: false })).toBe("Ver meu acesso");
  });
});

describe("Aparência (modo escuro + cores, que saíram do topo da Home)", () => {
  it("Escuro liga a classe dark e grava; Claro desliga; a cor grava a paleta", async () => {
    montarApp("/voce/aparencia");
    await quadro();
    expect(screen.getByTestId("modo-light").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("modo-dark"));
    await quadro();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("core-theme-mode")).toBe("dark");
    expect(screen.getByTestId("modo-dark").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("paleta-ocean"));
    await quadro();
    expect(localStorage.getItem("core-theme-palette")).toBe("ocean");
    fireEvent.click(screen.getByTestId("modo-light"));
    await quadro();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(dos("tema_trocado")).toEqual([
      { modo: "dark", paleta: "default", origem: "aparencia" },
      { modo: "dark", paleta: "ocean", origem: "aparencia" },
      { modo: "light", paleta: "ocean", origem: "aparencia" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await quadro();
    expect(onde()).toBe("/voce");
  });
});

describe("aba Módulos", () => {
  it("abre o módulo (home_modulo com origem) e a seta ← do módulo volta pra aba", async () => {
    montarApp("/modulos");
    await quadro();
    expect(screen.getByTestId("barra-de-abas")).toBeTruthy();
    fireEvent.click(screen.getByTestId("modulo-rotina"));
    await quadro();
    expect(onde()).toBe("/rotina");
    expect(dos("home_modulo")[0]).toMatchObject({ modulo: "rotina", origem: "aba_modulos" });
    expect(destinoDaVolta("/rotina", "/home")).toBe("/modulos");
    // outra entrada no módulo (pendência, notificação): a volta não vale
    expect(destinoDaVolta("/financas", "/home")).toBe("/home");
  });

  it("Editar: esconder manda pra Ocultos e grava na mesma preferência da Home; Pronto fecha", async () => {
    montarApp("/modulos");
    await quadro();
    fireEvent.click(screen.getByTestId("modulos-editar"));
    expect(dos("home_modulos_editar")).toEqual([{ origem: "aba_modulos" }]);
    fireEvent.click(screen.getByRole("button", { name: "Esconder Pet" }));
    await quadro();
    expect(screen.getByText(/Ocultos · 1/)).toBeTruthy();
    expect((nuvem.dados["core-module-prefs"] as { hidden: string[] }).hidden).toEqual(["pet"]);
    fireEvent.click(screen.getByRole("button", { name: "Subir Treino" }));
    await quadro();
    expect((nuvem.dados["core-module-prefs"] as { order: string[] }).order.slice(0, 2)).toEqual(["treino", "financas"]);
    fireEvent.click(screen.getByTestId("modulos-editar"));
    expect(screen.getByTestId("modulos-editar").textContent).toBe("Editar");
  });

  it("?editar=1 (o '+N ocultos' da Home) chega editando", async () => {
    montarApp("/modulos?editar=1");
    await quadro();
    expect(screen.getByTestId("modulos-editar").textContent).toBe("Pronto");
  });
});

describe("seta ← dos módulos (useVoltarDoModulo)", () => {
  const Seta = () => { const v = useVoltarDoModulo(); return <button data-testid="seta" onClick={v}>←</button>; };
  const montarModulo = () => render(
    <MemoryRouter initialEntries={["/financas"]}><Routes><Route path="*" element={<><Seta /><Onde /></>} /></Routes></MemoryRouter>,
  );
  it("aberto pela aba Módulos → volta pra ela; senão → Hoje (o de sempre)", () => {
    marcarVolta("/financas", "/modulos");
    montarModulo();
    fireEvent.click(screen.getByTestId("seta"));
    expect(onde()).toBe("/modulos");
    cleanup();
    sessionStorage.clear();
    montarModulo();
    fireEvent.click(screen.getByTestId("seta"));
    expect(onde()).toBe("/home");
  });
});

const lifeData = { userName: "Marina", dayScore: 30, tasksTotal: 0, tasksCompleted: 0, mealsTotal: 0, mealsLogged: 0, waterGlasses: 0, waterGoal: 8 } as unknown as LifeHubData;
const montarSimples = (ui: ReactNode) => render(<MemoryRouter initialEntries={["/home"]}><ThemeProvider><Provedor>{ui}<Onde /></Provedor></ThemeProvider></MemoryRouter>);

describe("topo da Home", () => {
  it("com a chave: só a saudação (sem avatar, sol e paleta)", () => {
    montarSimples(<GreetingHeader data={lifeData} />);
    expect(screen.getByText(/Marina/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Minha conta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Alternar modo escuro" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trocar a cor do tema" })).toBeNull();
  });
  it("sem a chave e com o menu novo da 1.0.18 (padrão): avatar, sem sol e paleta (moram no menu › Aparência)", () => {
    vi.stubEnv("VITE_NAV_ABAS", "");
    montarSimples(<GreetingHeader data={lifeData} />);
    expect(screen.getByRole("button", { name: "Minha conta" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Alternar modo escuro" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trocar a cor do tema" })).toBeNull();
  });
  it("sem a chave e com menu_novo off: avatar, sol e paleta como na 1.0.17", () => {
    vi.stubEnv("VITE_NAV_ABAS", "");
    localStorage.setItem("core-menu-novo", "off");
    montarSimples(<GreetingHeader data={lifeData} />);
    expect(screen.getByRole("button", { name: "Minha conta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alternar modo escuro" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trocar a cor do tema" })).toBeTruthy();
  });
});

describe("grade de módulos da Home", () => {
  it("com a chave: sem engrenagem; o tour (evento) ainda abre a edição e a engrenagem aparece só pra fechar", async () => {
    montarSimples(<ModuleDrawer />);
    expect(screen.queryByRole("button", { name: "Editar módulos" })).toBeNull();
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MODULOS_EDITAR, { detail: { editar: true } })); });
    expect(screen.getByRole("button", { name: "Fechar edição dos módulos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Esconder Pet" })).toBeTruthy();
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MODULOS_EDITAR, { detail: { editar: false } })); });
    expect(screen.queryByRole("button", { name: "Fechar edição dos módulos" })).toBeNull();
  });
  it("com a chave: '+N ocultos · Editar' leva pra aba Módulos já editando", () => {
    nuvem.dados = { "core-module-prefs": { favorites: [], hidden: ["pet", "detox"], order: [] } };
    montarSimples(<ModuleDrawer />);
    fireEvent.click(screen.getByText(/\+2 ocultos · Editar/));
    expect(onde()).toBe("/modulos?editar=1");
  });
  it("sem a chave: a engrenagem de sempre", () => {
    vi.stubEnv("VITE_NAV_ABAS", "");
    montarSimples(<ModuleDrawer />);
    expect(screen.getByRole("button", { name: "Editar módulos" })).toBeTruthy();
  });
});

describe("computador (trilho lateral)", () => {
  it("com a chave: Hoje, Organizar e Você no trilho; aparece também em /voce e /modulos", () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    render(<MemoryRouter initialEntries={["/voce"]}><Provedor><TrilhoLateral /><Onde /></Provedor></MemoryRouter>);
    expect(screen.getByTestId("trilho-lateral")).toBeTruthy();
    expect(screen.getByText("Hoje")).toBeTruthy();
    expect(screen.getByTestId("trilho-voce").getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByText("Organizar"));
    expect(onde()).toBe("/modulos");
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  });
});
