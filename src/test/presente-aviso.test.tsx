/**
 * O AVISO DO PRESENTE NO APP (31/10, src/lib/presente-aviso.ts + src/presente/AvisoPresente.tsx).
 *   · chave PRESENTE_AVISO "off" por padrão; QA ?presente-aviso=on|off|auto; só o SITE: iPhone e Android da loja NUNCA (crítica r1:
 *     o modo "web+android" saiu — a regra de pagamentos da Play), nem com o QA; a 2ª linha não parece cobrança do plano;
 *   · só vitalício pago na web, 5 dias ou mais depois da compra (crítica r2: o e-mail sai no dia 3);
 *   · × e toque escondem pra sempre (conta + aparelho); "1 vez": outra sessão não mostra de novo (crítica r2);
 *   · mora na página Você (as 2 caras), nunca na Home; a chave da conta está nas listas do aparelho.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const authState: { user: { id: string; email: string | null } | null } = { user: { id: "ana", email: "ana@exemplo.com.br" } };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));
const dados = vi.hoisted(() => ({ mapa: new Map<string, unknown>(), sets: [] as Array<[string, unknown]> }));
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({
    get: (k: string, d: unknown) => (dados.mapa.has(k) ? dados.mapa.get(k) : d),
    set: (k: string, v: unknown) => { dados.mapa.set(k, v); dados.sets.push([k, v]); },
  }),
}));
const linhas = vi.hoisted(() => ({ v: [] as Array<Record<string, unknown>> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: linhas.v, error: null }) }) }), functions: { invoke: vi.fn() } },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
const tokenDia3 = vi.hoisted(() => vi.fn());
vi.mock("@/presente/api", () => ({ tokenDia3: () => tokenDia3() }));
const plataforma = vi.hoisted(() => ({ v: "web" as "web" | "ios" | "android" }));
vi.mock("@/lib/native-shell", () => ({ plataformaApp: () => plataforma.v, isNativeShell: () => plataforma.v !== "web" }));

import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_AVISO_PRESENTE, CHAVE_FORCA_AVISO, PRESENTE_AVISO, SUB_AVISO, avisoEscondido, avisoLigadoAqui, compraQueLiberaAviso, forcaDoAviso,
} from "@/lib/presente-aviso";
import { AvisoPresente } from "@/presente/AvisoPresente";
import { CHAVES_DO_APARELHO, ehChaveDoAparelho } from "@/lib/chaves-do-aparelho";

const DIA = 86_400_000;
const AGORA = Date.parse("2026-10-31T15:00:00Z");
const vit = (diasAtras: number, extra: Record<string, unknown> = {}) => ({
  status: "active", payment_method: "pix", billing_period: "lifetime", plan: "lifetime", amount_cents: 2790, created_at: new Date(Date.now() - diasAtras * DIA).toISOString(), ...extra,
});

beforeEach(() => {
  dados.mapa.clear(); dados.sets.length = 0; linhas.v = [vit(6)]; plataforma.v = "web"; tokenDia3.mockReset();
  authState.user = { id: "ana", email: "ana@exemplo.com.br" };
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ }
  window.history.replaceState({}, "", "/voce?presente-aviso=on");
  vi.mocked(trackEvent).mockClear();
});
afterEach(() => cleanup());

describe("a chave", () => {
  it("padrão OFF; QA on/off/auto; só o site — iPhone e Android nunca, nem com o QA (crítica r1)", () => {
    expect(PRESENTE_AVISO).toBe("off");
    expect(avisoLigadoAqui({ modo: "off", plataforma: "web", forca: null })).toBe(false);
    expect(avisoLigadoAqui({ modo: "web", plataforma: "web", forca: null })).toBe(true);
    expect(avisoLigadoAqui({ modo: "web", plataforma: "android", forca: null })).toBe(false);
    for (const modo of ["off", "web"] as const) for (const p of ["ios", "android"] as const) expect(avisoLigadoAqui({ modo, plataforma: p, forca: "on" })).toBe(false);
    const fonte = readFileSync(join(__dirname, "../lib/presente-aviso.ts"), "utf8");
    expect(fonte).toMatch(/export type ModoAvisoPresente = "off" \| "web";/);
    expect(SUB_AVISO).toBe("De presente pra alguém · R$ 14,90");
    expect(avisoLigadoAqui({ modo: "off", plataforma: "web", forca: "on" })).toBe(true);
    expect(avisoLigadoAqui({ modo: "web", plataforma: "web", forca: "off" })).toBe(false);
    window.history.replaceState({}, "", "/voce");
    localStorage.clear();
    expect(forcaDoAviso("?presente-aviso=on")).toBe("on");
    expect(localStorage.getItem(CHAVE_FORCA_AVISO)).toBe("on");
    expect(forcaDoAviso("")).toBe("on"); // guardado no aparelho
    expect(forcaDoAviso("?presente-aviso=auto")).toBeNull();
  });
  it("só vitalício pago na web, 5 dias ou mais depois da compra (crítica r2: o e-mail do dia 3 não cai no mesmo dia)", () => {
    expect(compraQueLiberaAviso([vit(5)], Date.now())).toBe(true);
    expect(compraQueLiberaAviso([vit(4.9)], Date.now())).toBe(false);
    expect(compraQueLiberaAviso([vit(3)], Date.now())).toBe(false);
    expect(compraQueLiberaAviso([vit(10, { payment_method: "play_store" })])).toBe(false);
    expect(compraQueLiberaAviso([vit(10, { payment_method: "presente" })])).toBe(false);
    expect(compraQueLiberaAviso([vit(10, { billing_period: "annual", plan: "core-pro" })])).toBe(false);
    expect(compraQueLiberaAviso([vit(10, { amount_cents: 0 })])).toBe(false);
    expect(compraQueLiberaAviso([vit(10, { status: "canceled" })])).toBe(false);
    expect(compraQueLiberaAviso([])).toBe(false);
  });
  it("× = pra sempre; 7 dias depois da 1ª vez some sozinho", () => {
    expect(avisoEscondido(null, AGORA)).toBe(false);
    expect(avisoEscondido({ fechado: "2026-10-30T00:00:00Z" }, AGORA)).toBe(true);
    expect(avisoEscondido({ vistoEm: new Date(AGORA - 6 * DIA).toISOString() }, AGORA)).toBe(false);
    expect(avisoEscondido({ vistoEm: new Date(AGORA - 7 * DIA).toISOString() }, AGORA)).toBe(true);
  });
  it("crítica r2 ('1 vez'): apareceu numa sessão → a mesma sessão segue vendo; outra sessão não", () => {
    const m = { vistoEm: new Date(AGORA - 60_000).toISOString(), sessao: "s1" };
    expect(avisoEscondido(m, AGORA, "s1")).toBe(false);
    expect(avisoEscondido(m, AGORA, "s2")).toBe(true);
  });
});

const montar = () => render(
  <MemoryRouter initialEntries={["/voce"]}>
    <Routes>
      <Route path="/voce" element={<AvisoPresente estilo="classico" />} />
      <Route path="/presente/dar" element={<div data-testid="pagina-dar" />} />
    </Routes>
  </MemoryRouter>,
);

describe("o aviso na tela", () => {
  it("aparece (1 linha, sem gênero, sem 'só hoje') e guarda a 1ª vista na conta e no aparelho", async () => {
    montar();
    const aviso = await screen.findByTestId("aviso-presente");
    expect(aviso.textContent).toMatch(/Leve alguém junto/);
    expect(aviso.textContent).toMatch(/R\$ 14,90/);
    expect(aviso.textContent).not.toMatch(/só hoje|\b(ele|ela)\b/i);
    await waitFor(() => expect(dados.sets.some(([k, v]) => k === CHAVE_AVISO_PRESENTE && !!(v as { vistoEm?: string }).vistoEm)).toBe(true));
    expect(JSON.parse(localStorage.getItem(CHAVE_AVISO_PRESENTE) ?? "{}").vistoEm).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith("presente_aviso_view", { estilo: "classico" });
  });
  it("crítica r2: a mesma sessão (outra tela da Você) ainda vê; numa sessão nova não aparece mais", async () => {
    montar();
    await screen.findByTestId("aviso-presente");
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CHAVE_AVISO_PRESENTE) ?? "{}").sessao).toBeTruthy());
    cleanup();
    montar();
    expect(await screen.findByTestId("aviso-presente")).toBeTruthy(); // mesma aba
    cleanup();
    sessionStorage.clear(); // outra visita
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("aviso-presente")).toBeNull();
  });
  it("× fecha pra sempre (não volta ao montar de novo)", async () => {
    montar();
    fireEvent.click(await screen.findByTestId("aviso-presente-fechar"));
    await waitFor(() => expect(screen.queryByTestId("aviso-presente")).toBeNull());
    expect((dados.mapa.get(CHAVE_AVISO_PRESENTE) as { fechado?: string }).fechado).toBeTruthy();
    cleanup();
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("aviso-presente")).toBeNull();
  });
  it("o toque pede o token da conta e abre /presente/dar?t=… (e esconde o aviso)", async () => {
    tokenDia3.mockResolvedValueOnce("T".repeat(32));
    montar();
    fireEvent.click(await screen.findByTestId("aviso-presente-abrir"));
    expect(await screen.findByTestId("pagina-dar")).toBeTruthy();
    expect((dados.mapa.get(CHAVE_AVISO_PRESENTE) as { via?: string }).via).toBe("toque");
  });
  it("o token falhou → fica na tela com 'toque pra tentar de novo'", async () => {
    tokenDia3.mockResolvedValueOnce(null);
    montar();
    fireEvent.click(await screen.findByTestId("aviso-presente-abrir"));
    await waitFor(() => expect(screen.getByTestId("aviso-presente").textContent).toMatch(/tentar de novo/));
  });
  it("não aparece: chave off, iPhone, compra de 4 dias, compra na loja", async () => {
    const casos: Array<() => void> = [
      () => { window.history.replaceState({}, "", "/voce"); },
      () => { plataforma.v = "ios"; },
      () => { linhas.v = [vit(4)]; },
      () => { linhas.v = [vit(10, { payment_method: "play_store" })]; },
    ];
    for (const prep of casos) {
      cleanup(); localStorage.clear(); dados.mapa.clear();
      window.history.replaceState({}, "", "/voce?presente-aviso=on");
      prep();
      if (!window.location.search) localStorage.removeItem(CHAVE_FORCA_AVISO);
      montar();
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId("aviso-presente")).toBeNull();
    }
  });
});

describe("onde mora", () => {
  const SRC = join(__dirname, "..");
  const todos = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? todos(p) : /\.(tsx?|jsx?)$/.test(n) ? [p] : [];
  });
  it("só a página Você usa o aviso (as 2 caras + o menu do avatar, que é a Você do site na Home clássica); nenhuma Home importa", () => {
    const usam = todos(SRC).filter((f) => !f.includes(`${join("src", "test")}`) && /from "@\/presente\/AvisoPresente"/.test(readFileSync(f, "utf8")));
    expect(usam.map((f) => f.slice(SRC.length + 1)).sort()).toEqual(["components/home/AccountDrawer.tsx", "pages/Voce.tsx"]);
    expect(readFileSync(join(SRC, "components/home/AccountDrawer.tsx"), "utf8")).toMatch(/\{!isGuest && <AvisoPresente estilo="menu" \/>\}/);
    const voce = readFileSync(join(SRC, "pages/Voce.tsx"), "utf8");
    expect(voce).toMatch(/<AvisoPresente estilo="classico" \/>/);
    expect(voce).toMatch(/aviso=\{<AvisoPresente estilo="e" \/>\}/);
    expect(readFileSync(join(SRC, "components/home-nova/e/VoceE.tsx"), "utf8")).toMatch(/\{aviso\}/);
  });
  it("a chave da conta também é do aparelho (a vassoura não apaga o espelho)", () => {
    expect(CHAVES_DO_APARELHO.has(CHAVE_AVISO_PRESENTE)).toBe(true);
    expect(ehChaveDoAparelho(CHAVE_AVISO_PRESENTE)).toBe(true);
  });
});
