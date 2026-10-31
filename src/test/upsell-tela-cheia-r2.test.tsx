/**
 * Upsell 2027 em tela cheia · rodada 2 (crítica r2, 31/10):
 *   · /entrar pelo "Planejar meu 2027" (e= + next= do 2027 B) abre no CÓDIGO por e-mail; a senha vira link (compradora M1);
 *   · o "Pronto" mostra App Store + Google Play e diz "entre com o código" (compradora M2);
 *   · a frase de onde funciona (Android na próxima versão) fica DENTRO da barra fixa (honestidade M1);
 *   · a legenda do zoom é pílula sólida em caixa normal (compradora M3);
 *   · Esc = "Agora não" e a landing por baixo fica inert enquanto a página está aberta (técnico B3).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  instalouVindoDoSite: () => false,
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, signIn: async () => ({ error: null }) }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: async () => ({}), signInWithOtp: vi.fn(async () => ({ error: null })) } } }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: async () => ({ error: null }), entrarComApple: async () => ({ error: null }) }));
vi.mock("@/components/app/RestaurarCompras", () => ({ RestaurarCompras: () => null }));

import Entrar from "@/pages/Entrar";
import { criarUpsell2027, type CtxU2027 } from "@/landing/upsell-2027";
import { LINK_PLANEJAR_2027, ondeCurtoU27Pagina, portaDoLink } from "@/lib/planner-2027-chave";

beforeEach(() => { localStorage.clear(); eventos.length = 0; });
afterEach(() => { cleanup(); document.body.innerHTML = ""; });

const montarEntrar = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/entrar" element={<Entrar />} /></Routes>
  </MemoryRouter>,
);

describe("/entrar pelo 'Planejar meu 2027'", () => {
  it("abre no código por e-mail (sem 'Bem-vindo de volta' nem campo de senha); a senha é link secundário", () => {
    montarEntrar(portaDoLink(LINK_PLANEJAR_2027, "ana@exemplo.com"));
    expect(screen.getByTestId("entrar-codigo-primeiro").textContent).toContain("código de 8 números");
    expect(screen.getByTestId("entrar-codigo-primeiro").textContent).toContain("ana@exemplo.com");
    expect(screen.queryByText("Bem-vindo de volta")).toBeNull();
    expect(screen.queryByPlaceholderText("A senha que você criou")).toBeNull();
    expect(screen.getByTestId("entrar-com-codigo").textContent).toContain("Mandar o código pro meu e-mail");
    fireEvent.click(screen.getByTestId("entrar-com-senha"));
    expect(screen.getByPlaceholderText("A senha que você criou")).not.toBeNull();
  });
  it("fora do link do 2027 (ou sem e-mail), a tela fica igual: senha primeiro", () => {
    montarEntrar("/entrar?e=ana%40exemplo.com&next=%2Fplanos%3Foferta%3Dw97");
    expect(screen.queryByTestId("entrar-codigo-primeiro")).toBeNull();
    expect(screen.getByText("Bem-vindo de volta")).not.toBeNull();
    expect(screen.getByPlaceholderText("A senha que você criou")).not.toBeNull();
    cleanup();
    montarEntrar(portaDoLink(LINK_PLANEJAR_2027, null));
    expect(screen.queryByTestId("entrar-codigo-primeiro")).toBeNull();
    expect(screen.getByPlaceholderText("A senha que você criou")).not.toBeNull();
  });
});

function oferta(compra: string, extra: Partial<CtxU2027> = {}) {
  const caixa = document.createElement("div"), card = document.createElement("div");
  const aoTerminar = vi.fn();
  const u = criarUpsell2027(compra, {
    caixa, card, evento: (n, d) => { eventos.push([n, d ?? {}]); }, copiarNoToque: async () => ({ ok: true, via: "x" }), copiarTexto: async () => true, desenharQr: () => {}, email: () => "ana@exemplo.com",
    linhaConfirmada: () => "O CORE é seu pra sempre.", aoTerminar, aoMudar: () => {}, faixaConfirmada: () => "o CORE é seu pra sempre",
    api: { gerar: async () => ({ orderId: "o1", qrCode: "0002", qrCodeBase64: null, expiresAt: "2099-01-01T00:00:00Z", donoIgual: true }), conferir: async () => false, simulado: true }, ...extra,
  });
  u.render();
  return { u, aoTerminar };
}

describe("a página do 2027 · rodada 2", () => {
  it("a frase do Android fica dentro da barra fixa, sob o preço (some quando os 2 apps tiverem a build)", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on&planner-estilo=core");
    const { u } = oferta("r2-barra");
    const linha = document.querySelector("#u27-pag .u27p-barra [data-testid=u2027-onde-barra]");
    expect(linha?.textContent).toBe("Hoje no site e no iPhone · Android na próxima versão");
    expect(ondeCurtoU27Pagina(true, true)).toBe("");
    expect(ondeCurtoU27Pagina(true, false)).toBe("Hoje no site e no iPhone · Android na próxima versão");
    u.parar();
  });
  it("o selo EXEMPLO das miniaturas fica dentro da caixa da imagem (canto esquerdo, fora do ícone)", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on&planner-estilo=codex");
    const { u } = oferta("r2-selo");
    for (const b of Array.from(document.querySelectorAll("#u27-pag .u27p-folhas button"))) expect(b.querySelector(".u27p-fimg > .u27p-ex")).not.toBeNull();
    u.parar();
  });
  it("zoom: a legenda é pílula, caixa normal, só EXEMPLO em destaque", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on&planner-estilo=core");
    const { u } = oferta("r2-zoom");
    (document.querySelector('#u27-pag [data-folha="semana"]') as HTMLButtonElement).click();
    const leg = document.querySelector("#u27-zoom small")!;
    expect(leg.querySelector("b")!.textContent).toBe("EXEMPLO");
    expect(leg.textContent).toBe("EXEMPLO · o seu sai com a semana em que você baixar");
    u.parar();
  });
  it("aberta: a landing por baixo fica inert; Esc = Agora não (e o inert sai)", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on");
    const main = document.createElement("main"); main.className = "lp"; document.body.appendChild(main);
    const { u, aoTerminar } = oferta("r2-esc");
    expect(main.hasAttribute("inert")).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("u27-pag")).toBeNull();
    expect(main.hasAttribute("inert")).toBe(false);
    expect(aoTerminar).toHaveBeenCalled();
    expect(eventos.some(([n, d]) => n === "landing_u2027_nao" && d.de === "esc")).toBe(true);
    u.parar();
  });
  it("Pronto: App Store + Google Play e 'entre com o código', sem senha", async () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on");
    const { u } = oferta("r2-pronto", { api: { gerar: async () => ({ orderId: "o2", qrCode: "0002", qrCodeBase64: null, expiresAt: "2099-01-01T00:00:00Z", donoIgual: true }), conferir: async () => true, simulado: true } });
    (document.getElementById("u27-quero") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById("u27-ja-paguei")).not.toBeNull());
    (document.getElementById("u27-ja-paguei") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector("#u27-pag [data-testid=u2027-pronto]")).not.toBeNull());
    const lojas = document.querySelector("#u27-pag [data-testid=u2027-pronto-lojas]")!;
    expect(lojas.querySelector('[data-loja="ios"]')).not.toBeNull();
    expect(lojas.querySelector('[data-loja="android"]')).not.toBeNull();
    expect(document.querySelector("#u27-pag [data-testid=u2027-onde]")!.textContent).toContain("Entre com o código que vai pro ana@exemplo.com, sem senha.");
    u.parar();
  });
});
