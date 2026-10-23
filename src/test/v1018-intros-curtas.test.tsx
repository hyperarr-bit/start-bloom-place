/**
 * 1.0.18 — TUTORIAIS CURTOS + FINANÇAS MONTADA (dono 23/10, dados de 17–23/10 na 1ª abertura de módulo no iPhone:
 * 31% concluem, 37% pulam, 32% largam; os mais pulados Relacionamentos 58%, Finanças 56%, Viagens 55%, Dieta 53%,
 * Biblioteca 45%, Carreira 43%; o melhor é Beleza, curta e prática, 67% concluem).
 *
 *   1. Relacionamentos, Dieta, Viagens, Biblioteca e Carreira: 1 passo só = registrar a 1ª coisa; "Agora não" à vista;
 *      todo `modulo_intro_*` leva `versao: "curta"` (as longas saem iguais). Registrar conclui, pular fecha, e nada
 *      volta ao fechar/reabrir.
 *   2. Finanças: quem TERMINOU o Montar Finanças (`core-montar-financas` com `r: "pronto"`, aparelho ou conta) não vê o
 *      tutorial do módulo — conta como visto. Quem pulou o Montar ou nunca montou continua vendo.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor, act } from "@testing-library/react";
import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));

import { trackEvent } from "@/lib/analytics";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import { CHAVE_FORCA_INTRO, INTROS, chaveIntroVista, introVistaPeloMontar, porQueNaoMostrar, tutorialAntigoPodeMarcarVisto, type Leitor } from "@/lib/intro-modulo";
import { CHAVE_MONTAR_FINANCAS } from "@/lib/montar-financas";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados = {}) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    useState(() => 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v ?? null)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set, versao]); // eslint-disable-line react-hooks/exhaustive-deps
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const get: Leitor = <T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f);
  return { estado, Provedor, get };
}

const CURTAS = ["relacionamentos", "dieta", "viagens", "biblioteca", "carreira"] as const;
const faixa = () => document.querySelector("[data-testid=intro-modulo-faixa]");
const eventos = () => (trackEvent as unknown as { mock: { calls: Array<[string, Record<string, unknown>]> } }).mock.calls;
const doIntro = (m: string) => eventos().filter(([n, d]) => n.startsWith("modulo_intro_") && d?.modulo === m);
/** simula fechar o app e abrir de novo (a memória da tela some; aparelho e conta ficam) */
const reabrir = (s: ReturnType<typeof criarStore>, m: string) => { cleanup(); document.body.innerHTML = ""; return render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>); };
const esperarSemIntro = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 900)); }); expect(faixa()).toBeNull(); };

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(CHAVE_FORCA_INTRO, "on");
  vi.mocked(trackEvent).mockClear();
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; document.documentElement.removeAttribute("data-intro-modulo-faixa"); });

describe("1.0.18: os 5 tutoriais mais pulados viram 1 passo (registrar a 1ª coisa)", () => {
  it("config: versão curta, 1 passo de ação com chips e '+ Outro', copy curta e sem ponto no título", () => {
    for (const m of CURTAS) {
      const c = INTROS[m];
      expect(c.formato, m).toBe("toque");
      if (c.formato !== "toque") continue;
      expect(c.versao, m).toBe("curta");
      expect(c.passos.length, m).toBe(1);
      const p = c.passos[0];
      expect(p.olhar, m).toBeUndefined();
      expect(p.opcoes.length, m).toBeGreaterThanOrEqual(2);
      expect(!!p.executar, m).toBe(true);
      expect(p.outro, m).not.toBe(false);
      expect(p.pergunta.length, m).toBeLessThanOrEqual(30);
      expect(p.pergunta.endsWith("."), m).toBe(false);
      expect(c.pedido.endsWith("."), m).toBe(false);
      expect(c.pedido.length, m).toBeLessThanOrEqual(26);
      expect(c.pronto.length, m).toBeLessThanOrEqual(40);
    }
    // as outras seguem longas (e sem `versao`)
    for (const m of ["beleza", "pet", "casa", "treino"]) {
      const c = INTROS[m];
      expect(c.formato === "toque" && c.versao, m).toBeFalsy();
      expect(c.formato === "toque" && c.passos.length, m).toBeGreaterThanOrEqual(2);
    }
  });

  for (const m of CURTAS) {
    it(`${m}: 1 toque registra e CONCLUI (cartão do fim, 'Pronto' grava feita), eventos com versao "curta", e reabrir não repete`, { timeout: 30_000 }, async () => {
      const s = criarStore();
      render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>);
      expect(faixa()!.textContent).toContain("Primeira vez aqui");
      expect(screen.getByTestId("intro-modulo-agora-nao")).toBeTruthy(); // "Pular" à mão desde o 1º segundo
      const chip = (await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 9000 }))[0];
      expect(document.body.textContent).not.toMatch(/\b1 de 1\b/); // 1 passo: sem contador
      fireEvent.click(chip);
      await waitFor(() => expect(screen.getByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 9000 });
      expect(screen.getByTestId("intro-modulo-pronto").textContent).toMatch(/entrou\./);
      expect(faixa()!.textContent).toContain("pronto ✓");
      expect(screen.queryByTestId("intro-modulo-entendi")).toBeNull(); // nenhum "olha" depois
      fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
      expect(localStorage.getItem(chaveIntroVista(m))).toMatch(/^feita@/);
      expect(s.estado.dados["core-intro-feitas"]).toEqual([m]);
      expect(porQueNaoMostrar(m, s.get)).toBe("ja_vista");
      // eventos: os mesmos nomes de sempre, todos com versao "curta"
      const ev = doIntro(m);
      const nomes = ev.map(([n]) => n);
      for (const n of ["modulo_intro_vista", "modulo_intro_acao", "modulo_intro_registrou", "modulo_intro_concluida"]) expect(nomes, `${m}: ${n}`).toContain(n);
      for (const [n, d] of ev) expect(d.versao, `${m}: ${n}`).toBe("curta");
      expect(ev.find(([n]) => n === "modulo_intro_vista")![1].passos).toBe(1);
      expect(ev.find(([n]) => n === "modulo_intro_concluida")![1].passos).toBe(1);
      // fechar e reabrir o app: nada volta
      reabrir(s, m);
      await esperarSemIntro();
      reabrir(s, m);
      await esperarSemIntro();
    });

    it(`${m}: 'Agora não' pula (vista como pulada, evento com versao "curta") e reabrir não repete`, { timeout: 20_000 }, async () => {
      const s = criarStore();
      render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>);
      expect(faixa()).toBeTruthy();
      fireEvent.click(screen.getByTestId("intro-modulo-agora-nao"));
      expect(faixa()).toBeNull();
      expect(localStorage.getItem(chaveIntroVista(m))).toMatch(/^pulada@/);
      const pulou = doIntro(m).find(([n]) => n === "modulo_intro_pulou");
      expect(pulou?.[1]).toMatchObject({ modulo: m, passo: 1, versao: "curta", via: "agora_nao" });
      reabrir(s, m);
      await esperarSemIntro();
    });
  }

  it("largou no meio (fechou o app sem tocar): volta 1 vez só, com versao 'curta' no modulo_intro_saiu; depois nunca mais", { timeout: 20_000 }, async () => {
    const s = criarStore();
    const r = render(<s.Provedor><IntroDoModulo moduleId="viagens" /></s.Provedor>);
    expect(faixa()).toBeTruthy();
    r.unmount();
    expect(doIntro("viagens").find(([n]) => n === "modulo_intro_saiu")?.[1]).toMatchObject({ versao: "curta" });
    reabrir(s, "viagens");
    expect(faixa()).toBeTruthy(); // a 2ª aparição (a última)
    reabrir(s, "viagens");
    await esperarSemIntro();
  });

  it("as longas não levam `versao` nos eventos (Beleza igual a antes)", { timeout: 20_000 }, async () => {
    const s = criarStore();
    render(<s.Provedor><IntroDoModulo moduleId="beleza" /></s.Provedor>);
    expect(faixa()).toBeTruthy();
    fireEvent.click(screen.getByTestId("intro-modulo-agora-nao"));
    const ev = doIntro("beleza");
    expect(ev.length).toBeGreaterThan(0);
    for (const [, d] of ev) expect("versao" in d).toBe(false);
  });
});

describe("1.0.18: Finanças — quem já montou (Montar Finanças 'pronto') não vê o tutorial do módulo", () => {
  const marca = (r: "pronto" | "pulou") => ({ r, em: new Date().toISOString() });

  it("montou (marca na CONTA): conta como vista, a intro não aparece, nem ao reabrir", { timeout: 20_000 }, async () => {
    const s = criarStore({ [CHAVE_MONTAR_FINANCAS]: marca("pronto"), "finance-incomes": [{ id: "r", value: 2400 }] });
    expect(introVistaPeloMontar("financas", s.get)).toBe(true);
    expect(porQueNaoMostrar("financas", s.get)).toBe("ja_vista");
    expect(tutorialAntigoPodeMarcarVisto("financas", s.get)).toBe(true);
    render(<s.Provedor><IntroDoModulo moduleId="financas" /></s.Provedor>);
    await esperarSemIntro();
    reabrir(s, "financas");
    await esperarSemIntro();
    expect(doIntro("financas").find(([n]) => n === "modulo_intro_vista")).toBeUndefined();
  });

  it("montou (marca só no APARELHO, conta ainda hidratando): também não aparece", async () => {
    localStorage.setItem(CHAVE_MONTAR_FINANCAS, JSON.stringify(marca("pronto")));
    const s = criarStore();
    expect(porQueNaoMostrar("financas", s.get)).toBe("ja_vista");
    render(<s.Provedor><IntroDoModulo moduleId="financas" /></s.Provedor>);
    await esperarSemIntro();
  });

  it("nunca montou: o tutorial de Finanças aparece como sempre", async () => {
    const s = criarStore();
    expect(introVistaPeloMontar("financas", s.get)).toBe(false);
    expect(porQueNaoMostrar("financas", s.get)).toBeNull();
    render(<s.Provedor><IntroDoModulo moduleId="financas" /></s.Provedor>);
    await waitFor(() => expect(faixa()).toBeTruthy());
  });

  it("pulou o Montar: o Montar não foi o guia — o tutorial aparece", async () => {
    const s = criarStore({ [CHAVE_MONTAR_FINANCAS]: marca("pulou") });
    localStorage.setItem(CHAVE_MONTAR_FINANCAS, JSON.stringify({ vistas: 1 })); // vista sem decisão também não conta
    expect(porQueNaoMostrar("financas", s.get)).toBeNull();
    render(<s.Provedor><IntroDoModulo moduleId="financas" /></s.Provedor>);
    await waitFor(() => expect(faixa()).toBeTruthy());
  });

  it("a marca do Montar só vale pra Finanças (os outros módulos seguem a regra de sempre)", () => {
    const s = criarStore({ [CHAVE_MONTAR_FINANCAS]: marca("pronto") });
    for (const m of ["rotina", "saude", ...CURTAS]) expect(porQueNaoMostrar(m, s.get), m).toBeNull();
  });
});
