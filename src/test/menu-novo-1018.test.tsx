/**
 * MENU NOVO DA CONTA (1.0.18) — ver src/lib/menu-novo.ts.
 *
 * Trava: (1) a chave `menu_novo` (todos|off) pelo RevenueCat, padrão "todos" com e sem resposta; (2) a folha do avatar em
 * 3 grupos (você · App · Ajuda) + Sair, na ordem do desenho, sem a Retrospectiva; (3) Aparência abre dentro da folha e
 * troca o tema (classe dark + gravado + tema_trocado origem "menu"); (4) `menu_item_click {item, grupo}`; (5) o topo da
 * Home sem sol e paleta; (6) chave off = o menu e o topo de hoje; (7) o aviso único (escuro/cor ≠ Original), que não
 * repete ao reabrir e nunca aparece pra quem estava no Claro · Original.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const nativo = vi.hoisted(() => ({ v: false }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "ana.souza@gmail.com", created_at: new Date(Date.now() - 20 * 86400e3).toISOString() } as { id: string; email: string; created_at: string } | null,
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
import { AccountDrawer } from "@/components/home/AccountDrawer";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import {
  CHAVE_AVISO_MENU_NOVO, CHAVE_FORCA_MENU_NOVO, CHAVE_MENU_NOVO_APARELHO, _zerarMenuNovoRemoto, consumirAvisoMenuNovo,
  guardarForcaMenuNovoDaUrl, lerMenuNovoRemoto, menuNovoLigado, modoMenuNovo, registrarMenuNovoRemoto,
} from "@/lib/menu-novo";
import { ehChaveDoAparelho } from "@/lib/chaves-do-aparelho";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
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
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };

const montar = (ui: ReactNode) => render(
  <MemoryRouter initialEntries={["/home"]}>
    <ThemeProvider>
      <Provedor>
        <Routes><Route path="*" element={<>{ui}<Onde /></>} /></Routes>
      </Provedor>
    </ThemeProvider>
  </MemoryRouter>,
);
const montarMenu = (props: Partial<Parameters<typeof AccountDrawer>[0]> = {}) =>
  montar(<AccountDrawer open onOpenChange={() => {}} displayName="Ana Souza" {...props} />);

const lifeData = { userName: "Ana", dayScore: 30, tasksTotal: 0, tasksCompleted: 0, mealsTotal: 0, mealsLogged: 0, waterGlasses: 0, waterGoal: 8 } as unknown as LifeHubData;
const dos = (nome: string) => eventos.filter(([n]) => n === nome).map(([, d]) => d);
const ids = (el: HTMLElement) => [...el.querySelectorAll("[data-testid^='menu-']")].map((b) => b.getAttribute("data-testid")!.replace("menu-", ""))
  .filter((id) => !["plano-status", "conquistas-dias", "aparencia-estado", "caixa-app", "caixa-ajuda"].includes(id));

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); eventos.length = 0; nuvem.dados = {};
  nativo.v = false;
  _zerarMenuNovoRemoto();
  auth.billingPeriod = "annual"; auth.isSubscribed = true; auth.subLoaded = true; auth.inGracePeriod = false; auth.subscriptionEnd = null;
  auth.signOut.mockClear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-missao-dose");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ------------------------------------------------------------------ a chave */

describe("a chave menu_novo (RevenueCat)", () => {
  it("ausente em todas as offerings = 'todos'; 'off' em qualquer uma vale; a current vence", () => {
    expect(lerMenuNovoRemoto({ current: { metadata: {} }, all: {} })).toBe("todos");
    expect(lerMenuNovoRemoto({ current: { metadata: { menu_novo: "off" } }, all: {} })).toBe("off");
    const outra = { metadata: { menu_novo: "off" } };
    expect(lerMenuNovoRemoto({ current: { metadata: {} }, all: { outra } })).toBe("off");
    expect(lerMenuNovoRemoto({ current: { metadata: { menu_novo: "todos" } }, all: { outra } })).toBe("todos");
    expect(lerMenuNovoRemoto({ current: { metadata: { menu_novo: "talvez" } }, all: {} })).toBe("todos");
  });
  it("RevenueCat nunca respondeu = 'todos'; a última resposta fica no aparelho (sobrevive à vassoura) e manda até a próxima", () => {
    expect(modoMenuNovo()).toBe("todos");
    registrarMenuNovoRemoto(null); // não respondeu: nada muda
    expect(localStorage.getItem(CHAVE_MENU_NOVO_APARELHO)).toBeNull();
    registrarMenuNovoRemoto({ current: { metadata: { menu_novo: "off" } }, all: {} });
    expect(menuNovoLigado()).toBe(false);
    expect(localStorage.getItem(CHAVE_MENU_NOVO_APARELHO)).toBe("off");
    _zerarMenuNovoRemoto(); // abriu de novo, RevenueCat ainda não respondeu: vale a cópia do aparelho
    expect(menuNovoLigado()).toBe(false);
    registrarMenuNovoRemoto({ current: { metadata: {} }, all: {} }); // a chave saiu da metadata = volta pro padrão
    expect(modoMenuNovo()).toBe("todos");
    expect(ehChaveDoAparelho(CHAVE_MENU_NOVO_APARELHO)).toBe(true);
    expect(ehChaveDoAparelho(CHAVE_AVISO_MENU_NOVO)).toBe(true);
  });
  it("QA no navegador: ?menu-novo=off|on|auto (no app das lojas o link é ignorado)", () => {
    guardarForcaMenuNovoDaUrl("?menu-novo=off");
    expect(menuNovoLigado()).toBe(false);
    guardarForcaMenuNovoDaUrl("?menu-novo=on");
    expect(menuNovoLigado()).toBe(true);
    guardarForcaMenuNovoDaUrl("?menu-novo=auto");
    expect(localStorage.getItem(CHAVE_FORCA_MENU_NOVO)).toBeNull();
    nativo.v = true;
    localStorage.setItem(CHAVE_FORCA_MENU_NOVO, "off");
    expect(menuNovoLigado()).toBe(true);
  });
});

/* ------------------------------------------------------------------ a folha */

describe("o menu novo: 3 grupos + Sair", () => {
  it("web: você (conta, plano, conquistas) · App (aparência, tutorial) · Ajuda (ajuda, privacidade e termos) · Sair — sem Retrospectiva", () => {
    montarMenu();
    expect(ids(screen.getByTestId("menu-grupo-voce"))).toEqual(["conta", "plano", "conquistas"]);
    // 1.0.22 (28/10): no site o menu ganha "Home · Nova/Clássica" (a escolha da Home — lib/home-nova; Android não tem)
    expect(ids(screen.getByTestId("menu-grupo-app"))).toEqual(["aparencia", "tutorial"]); // 1.0.22: a linha "Home" é só do app do iPhone
    expect(ids(screen.getByTestId("menu-grupo-ajuda"))).toEqual(["ajuda", "legal"]);
    expect(within(screen.getByTestId("menu-grupo-app")).getByText("App")).toBeTruthy();
    expect(within(screen.getByTestId("menu-grupo-ajuda")).getByText("Ajuda")).toBeTruthy();
    expect(screen.getByTestId("menu-sair").textContent).toBe("Sair");
    expect(screen.queryByText("Retrospectiva")).toBeNull();
    expect(screen.queryByText("Meu acesso")).toBeNull();
    expect(screen.queryByText("Notificações")).toBeNull();
    // o cartão: nome + e-mail
    expect(screen.getByTestId("menu-conta").textContent).toContain("Ana Souza");
    expect(screen.getByTestId("menu-conta").textContent).toContain("ana.souza@gmail.com");
    expect(screen.getByTestId("menu-conta").textContent).toContain("AN");
  });
  it("app da loja: Lembretes (era Notificações) e Usar no computador no grupo App, nessa ordem", () => {
    nativo.v = true;
    montarMenu();
    expect(ids(screen.getByTestId("menu-grupo-app"))).toEqual(["aparencia", "lembretes", "computador", "tutorial"]);
    fireEvent.click(screen.getByTestId("menu-lembretes"));
    expect(screen.getByTestId("onde").textContent).toBe("/notificacoes");
  });
  it("Meu plano mostra o plano: Anual · Mensal · Vitalício · Teste", () => {
    const plano = () => screen.getByTestId("menu-plano-status").textContent;
    montarMenu(); expect(plano()).toBe("Plano anual"); cleanup();
    auth.billingPeriod = "monthly"; montarMenu(); expect(plano()).toBe("Plano mensal"); cleanup();
    auth.billingPeriod = "lifetime"; montarMenu(); expect(plano()).toBe("Acesso vitalício"); cleanup();
    auth.billingPeriod = "annual"; auth.subscriptionEnd = new Date(Date.now() + 2 * 86400e3).toISOString();
    localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 2 * 86400e3));
    montarMenu(); expect(plano()).toMatch(/^(Teste grátis até|Plano anual)/);
  });
  it("Conquistas mostra a sequência '🔥 N dias'; sem sequência, sem número", () => {
    const hoje = localDayKey();
    nuvem.dados = { "core-dias-anotados": Array.from({ length: 11 }, (_, i) => somarDias(hoje, -i)).reverse() };
    montarMenu();
    expect(screen.getByTestId("menu-conquistas-dias").textContent).toBe("11 dias");
    cleanup();
    nuvem.dados = {};
    montarMenu();
    expect(screen.queryByTestId("menu-conquistas-dias")).toBeNull();
  });
  it("cada item conta menu_item_click {item, grupo} e leva aonde deve", () => {
    const casos: Array<[string, string, string | null]> = [
      ["plano", "voce", "/planos"], ["conquistas", "voce", "/conquistas"], ["ajuda", "ajuda", "/ajuda"],
    ];
    for (const [item, grupo, rota] of casos) {
      eventos.length = 0;
      montarMenu();
      fireEvent.click(screen.getByTestId(`menu-${item}`));
      expect(dos("menu_item_click")).toEqual([{ item, grupo, menu: "novo" }]);
      if (rota) expect(screen.getByTestId("onde").textContent).toBe(rota);
      cleanup();
    }
  });
  it("revisor 22/10: 'Plano de 30 dias' só com a compra do plano de OUTRA área (no fim do grupo você); toque leva pro /plano-30", () => {
    // sem compra: o item não existe
    montarMenu();
    expect(screen.queryByTestId("menu-plano30")).toBeNull();
    cleanup();
    // comprou o de Dinheiro: mora na aba KIT 30 DIAS de Finanças, não no menu
    nuvem.dados = { "core-kit-primeiro-mes": { comprado: true, area: "dinheiro" } };
    montarMenu();
    expect(screen.queryByTestId("menu-plano30")).toBeNull();
    cleanup();
    // valor estranho (sem comprado === true) não libera
    nuvem.dados = { "core-kit-primeiro-mes": { comprado: "sim", area: "rotina" } };
    montarMenu();
    expect(screen.queryByTestId("menu-plano30")).toBeNull();
    cleanup();
    // comprou o de Rotina: aparece em "você", com o rótulo, e leva pro plano
    nuvem.dados = { "core-kit-primeiro-mes": { comprado: true, area: "rotina", em: "2026-10-21T12:00:00Z" } };
    eventos.length = 0;
    montarMenu();
    expect(ids(screen.getByTestId("menu-grupo-voce"))).toEqual(["conta", "plano", "conquistas", "plano30"]);
    expect(screen.getByTestId("menu-plano30").textContent).toMatch(/Plano de 30 dias/);
    fireEvent.click(screen.getByTestId("menu-plano30"));
    expect(dos("menu_item_click")).toEqual([{ item: "plano30", grupo: "voce", menu: "novo" }]);
    expect(screen.getByTestId("onde").textContent).toBe("/plano-30");
  });
  it("Minha conta abre a sub-tela da conta; Privacidade e termos abre as duas páginas", () => {
    montarMenu();
    fireEvent.click(screen.getByTestId("menu-conta"));
    expect(dos("menu_item_click")).toEqual([{ item: "conta", grupo: "voce", menu: "novo" }]);
    expect(screen.getByText("Redefinir senha")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Voltar"));
    fireEvent.click(screen.getByTestId("menu-legal"));
    fireEvent.click(screen.getByText("Termos de uso"));
    expect(screen.getByTestId("onde").textContent).toBe("/termos");
  });
  it("Ver tutorial fecha a folha e chama o tutorial; Sair chama signOut", () => {
    const rever = vi.fn();
    const fechar = vi.fn();
    montarMenu({ onReplayTutorial: rever, onOpenChange: fechar });
    fireEvent.click(screen.getByTestId("menu-tutorial"));
    expect(fechar).toHaveBeenCalledWith(false);
    expect(rever).toHaveBeenCalledTimes(1);
    expect(dos("menu_item_click")).toEqual([{ item: "tutorial", grupo: "app", menu: "novo" }]);
    cleanup();
    montarMenu();
    fireEvent.click(screen.getByTestId("menu-sair"));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(dos("menu_item_click").at(-1)).toEqual({ item: "sair", grupo: "sair", menu: "novo" });
  });
});

describe("Aparência (dentro do menu)", () => {
  it("mostra o estado (Claro · Original), abre a tela de Aparência e troca o tema: escuro + cor, gravados, com tema_trocado origem menu", () => {
    montarMenu();
    expect(screen.getByTestId("menu-aparencia-estado").textContent).toBe("Claro · Original");
    fireEvent.click(screen.getByTestId("menu-aparencia"));
    expect(dos("menu_item_click")).toEqual([{ item: "aparencia", grupo: "app", menu: "novo" }]);
    expect(screen.getByTestId("menu-tela-aparencia")).toBeTruthy();
    fireEvent.click(screen.getByTestId("modo-dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("core-theme-mode")).toBe("dark");
    fireEvent.click(screen.getByTestId("paleta-rose"));
    expect(localStorage.getItem("core-theme-palette")).toBe("rose");
    expect(dos("tema_trocado")).toEqual([
      { modo: "dark", paleta: "default", origem: "menu" },
      { modo: "dark", paleta: "rose", origem: "menu" },
    ]);
    // ‹ volta pro menu, que já mostra o tema novo
    fireEvent.click(screen.getByLabelText("Voltar"));
    expect(screen.getByTestId("menu-aparencia-estado").textContent).toBe("Escuro · Rosé");
  });
});

/* ------------------------------------------------------------------ o topo da Home */

describe("o topo da Home", () => {
  it("menu novo: saudação + avatar (sem o subtítulo, 1.0.19) — sem o sol e a paleta", () => {
    montar(<GreetingHeader data={lifeData} />);
    expect(screen.getByText(/Ana/)).toBeTruthy();
    expect(screen.queryByTestId("saudacao-subtitulo")).toBeNull();
    expect(screen.getByRole("button", { name: "Minha conta" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Alternar modo escuro" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trocar a cor do tema" })).toBeNull();
  });
  it("o avatar abre o menu novo (account_drawer_open com menu: novo)", () => {
    montar(<GreetingHeader data={lifeData} />);
    fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));
    expect(dos("account_drawer_open")).toEqual([{ via: "avatar", menu: "novo" }]);
    expect(screen.getByTestId("menu-novo")).toBeTruthy();
  });
});

/* 1.0.20 (2ª passada 26/10): com o menu da conta aberto na Home ANTIGA, a faixa do relógio (.app-safe-top-guard, z-index
   máximo) ficava BRANCA por cima do escurecido. Agora o menu deixa a faixa transparente enquanto está na tela. */
describe("a faixa do relógio com o menu da conta aberto (Home antiga)", () => {
  const raiz = () => document.documentElement;
  const corDaFaixa = () => raiz().style.getPropertyValue("--safe-top-cor");
  afterEach(() => { raiz().style.removeProperty("--safe-top-cor"); raiz().classList.remove("faixa-relogio-transparente"); });
  it.each([["menu novo", false], ["menu de antes (chave off)", true]])("%s: avatar abre → faixa transparente e sem desfoque; fecha → a cor de antes volta", async (_nome, chaveOff) => {
    if (chaveOff) registrarMenuNovoRemoto({ current: { metadata: { menu_novo: "off" } }, all: {} });
    raiz().style.setProperty("--safe-top-cor", "#ffffff");
    montar(<GreetingHeader data={lifeData} />);
    expect(corDaFaixa()).toBe("#ffffff"); // fechado: nada muda
    fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(corDaFaixa()).toBe("transparent");
    expect(raiz().classList.contains("faixa-relogio-transparente")).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(corDaFaixa()).toBe("#ffffff");
    expect(raiz().classList.contains("faixa-relogio-transparente")).toBe(false);
  });
});

describe("chave off = o menu e o topo de hoje (1.0.17)", () => {
  beforeEach(() => { registrarMenuNovoRemoto({ current: { metadata: { menu_novo: "off" } }, all: {} }); });
  it("topo com avatar, sol e paleta; o sol conta tema_trocado origem home_topo", () => {
    montar(<GreetingHeader data={lifeData} />);
    expect(screen.getByRole("button", { name: "Minha conta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alternar modo escuro" }));
    expect(screen.getByRole("button", { name: "Trocar a cor do tema" })).toBeTruthy();
    expect(dos("tema_trocado")).toEqual([{ modo: "dark", paleta: "default", origem: "home_topo" }]);
    fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));
    expect(dos("account_drawer_open")).toEqual([{ via: "avatar" }]);
  });
  it("a folha de antes: título Menu, Meu acesso, Retrospectiva, Notificações… sem grupos nem Aparência", () => {
    nativo.v = true;
    montarMenu();
    expect(screen.getByText("Menu")).toBeTruthy();
    for (const t of ["Minha conta", "Meu acesso", "Retrospectiva", "Conquistas", "Notificações", "Usar no computador", "Ajuda e suporte", "Ver tutorial", "Sair"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.queryByTestId("menu-novo")).toBeNull();
    expect(screen.queryByText("Aparência")).toBeNull();
    fireEvent.click(screen.getByText("Retrospectiva"));
    expect(screen.getByTestId("onde").textContent).toBe("/retrospectiva");
  });
});

/* ------------------------------------------------------------------ o aviso único */

describe("o aviso único (tema fora do padrão quando o menu novo aparece)", () => {
  const esperar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }); });

  it("modo escuro: o balão aparece 1x no avatar, some sozinho e NÃO volta ao reabrir", async () => {
    localStorage.setItem("core-theme-mode", "dark");
    montar(<GreetingHeader data={lifeData} />);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull(); // espera a Home assentar
    await esperar(1300);
    expect(screen.getByTestId("aviso-menu-novo").textContent).toMatch(/Modo escuro e cores agora ficam aqui no menu, em Aparência/);
    expect(dos("menu_novo_aviso_visto")).toEqual([{ modo: "dark", paleta: "default" }]);
    expect(localStorage.getItem(CHAVE_AVISO_MENU_NOVO)).toBe("visto");
    await esperar(8100);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    cleanup();
    // reabrir o app (a vassoura não leva a chave do aparelho)
    montar(<GreetingHeader data={lifeData} />);
    await esperar(3000);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    expect(dos("menu_novo_aviso_visto")).toHaveLength(1);
  });

  it("cor ≠ Original também; tocar no balão abre o menu direto na Aparência", async () => {
    localStorage.setItem("core-theme-palette", "areia");
    montar(<GreetingHeader data={lifeData} />);
    await esperar(1300);
    fireEvent.click(screen.getByTestId("aviso-menu-novo"));
    expect(screen.getByTestId("menu-tela-aparencia")).toBeTruthy();
    expect(dos("account_drawer_open")).toEqual([{ via: "aviso", menu: "novo" }]);
    expect(dos("menu_novo_aviso_toque")).toHaveLength(1);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
  });

  it("Claro · Original: nunca vê — nem depois de trocar pro escuro (a decisão é da 1ª vez)", async () => {
    montar(<GreetingHeader data={lifeData} />);
    await esperar(1300);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    expect(localStorage.getItem(CHAVE_AVISO_MENU_NOVO)).toBe("nao-precisa");
    cleanup();
    localStorage.setItem("core-theme-mode", "dark");
    montar(<GreetingHeader data={lifeData} />);
    await esperar(3000);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    expect(consumirAvisoMenuNovo("dark", "rose")).toBe(false);
  });

  it("com camada por cima (missão, tour…) espera ela sair — e só então conta como visto", async () => {
    localStorage.setItem("core-theme-mode", "dark");
    document.documentElement.setAttribute("data-missao-dose", "1");
    montar(<GreetingHeader data={lifeData} />);
    await esperar(4000);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    expect(localStorage.getItem(CHAVE_AVISO_MENU_NOVO)).toBeNull();
    document.documentElement.removeAttribute("data-missao-dose");
    await esperar(1100);
    expect(screen.getByTestId("aviso-menu-novo")).toBeTruthy();
  });

  it("revisor 22/10: a tela/card de cobrança recusada (role=alertdialog) por cima — espera ela sair, só então aparece e conta", async () => {
    localStorage.setItem("core-theme-mode", "dark");
    const recusa = document.createElement("div");
    recusa.setAttribute("role", "alertdialog");
    document.body.appendChild(recusa);
    montar(<GreetingHeader data={lifeData} />);
    await esperar(4000);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    expect(localStorage.getItem(CHAVE_AVISO_MENU_NOVO)).toBeNull();
    expect(dos("menu_novo_aviso_visto")).toHaveLength(0);
    recusa.remove();
    await esperar(1100);
    expect(screen.getByTestId("aviso-menu-novo")).toBeTruthy();
    expect(localStorage.getItem(CHAVE_AVISO_MENU_NOVO)).toBe("visto");
  });

  it("revisor 22/10: uma folha que entra por cima do balão já na tela tira o balão na hora (nunca fica escondido por baixo)", async () => {
    localStorage.setItem("core-theme-mode", "dark");
    montar(<GreetingHeader data={lifeData} />);
    await esperar(1300);
    expect(screen.getByTestId("aviso-menu-novo").hasAttribute("data-aviso-menu-novo")).toBe(true); // a missão enxerga o balão por isto
    const folha = document.createElement("div");
    folha.setAttribute("role", "alertdialog");
    document.body.appendChild(folha);
    await esperar(400);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    folha.remove();
  });

  it("chave off: nada de aviso (e nada gravado — vale quando o menu novo aparecer)", async () => {
    registrarMenuNovoRemoto({ current: { metadata: { menu_novo: "off" } }, all: {} });
    localStorage.setItem("core-theme-mode", "dark");
    montar(<GreetingHeader data={lifeData} />);
    await esperar(3000);
    expect(screen.queryByTestId("aviso-menu-novo")).toBeNull();
    expect(localStorage.getItem(CHAVE_AVISO_MENU_NOVO)).toBeNull();
  });
});
