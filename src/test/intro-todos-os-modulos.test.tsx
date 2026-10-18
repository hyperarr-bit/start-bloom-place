/**
 * NENHUM MÓDULO ABRE SEM TUTORIAL NA 1ª ABERTURA (regra do dono, 17/10: "o usuário não vai esperar 1 dia pra entrar
 * no módulo") — e TUTORIAL É UMA VEZ POR MÓDULO (feito ou pulado por qualquer caminho, inclusive a dose da missão).
 *
 * A grade: os 16 módulos × {sem missão, braço A, braço B} × a posição do módulo no plano {hoje (dose 1 por fazer),
 * amanhã (dose 2), dia 3 (dose 3), fora do plano} — e, em cada caso, a 2ª abertura depois de feita/pulada e a
 * abertura depois da dose daquele módulo feita. A única exceção aceita: a 1ª abertura JÁ é a dose do dia daquele
 * módulo (aí a dose é o tutorial; `moduloDaMissaoHoje()` tem que apontar pra ele).
 *
 * Decide em dois níveis: a regra (porQueNaoMostrar) e a tela (IntroDoModulo monta a faixa). A tabela módulo × caso
 * sai no fim (console) pro relatório.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, cleanup, fireEvent, screen, act, waitFor } from "@testing-library/react";
import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import { CHAVE_FORCA_INTRO, INTROS, MODULOS_COM_INTRO, chaveIntroVista, marcarIntroVista, porQueNaoMostrar, type Leitor } from "@/lib/intro-modulo";
import {
  CHAVE_ESTADO_MISSAO_DOSES, CHAVE_FORCA_MISSAO_DOSES, MODULOS as MODULOS_DA_MISSAO, apagarMissao, definirDonoDaMissao, donoDaConta, gravarMissao, iniciarMissao, lerMissao, moduloDaMissaoHoje,
  type EstadoMissaoDoses, type ModuloDaMissao,
} from "@/lib/missao-doses";
import { guardarForcaDia1Cheio } from "@/lib/dia1-cheio";
import { MODULOS } from "@/lib/modulos";
import { localDayKey } from "@/lib/utils";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados = {}) {
  const estado = { dados: { ...inicial } as Dados };
  const ouvintes = new Set<() => void>();
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    useState(() => { ouvintes.add(subir); });
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set, versao]); // eslint-disable-line react-hooks/exhaustive-deps
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const get: Leitor = <T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f);
  const set = (k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; ouvintes.forEach((o) => o()); };
  return { estado, Provedor, get, set };
}

const TODOS = MODULOS.map((m) => m.id) as ModuloDaMissao[];
const hoje = localDayKey();
const feita = { dia: hoje, rotulo: "feito" };
type Braco = "sem" | "A" | "B";
type Posicao = "hoje" | "amanha" | "dia3" | "fora";
const CASOS: Array<[Braco, Posicao]> = [["sem", "fora"], ["A", "hoje"], ["A", "amanha"], ["A", "dia3"], ["A", "fora"], ["B", "hoje"], ["B", "amanha"], ["B", "dia3"], ["B", "fora"]];
const outros = (m: ModuloDaMissao, n: number): ModuloDaMissao[] => (["financas", "rotina", "saude", "treino", "dieta", "casa"] as ModuloDaMissao[]).filter((x) => x !== m).slice(0, n);
/** O plano de 3 doses que põe `m` na posição pedida (ou fora dele). */
const planoPara = (m: ModuloDaMissao, pos: Posicao): [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao] => {
  const o = outros(m, 3);
  if (pos === "hoje") return [m, o[0], o[1]];
  if (pos === "amanha") return [o[0], m, o[1]];
  if (pos === "dia3") return [o[0], o[1], m];
  return [o[0], o[1], o[2]];
};
const faixa = () => document.querySelector("[data-testid=intro-modulo-faixa]");
const ligarMissao = () => { (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true; localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on"); };
/** A missão no aparelho pro caso: nasceu hoje, boas-vindas vistas, braço A ou B (dia 1 cheio ligado por QA). */
const armarMissao = (braco: Braco, plano: [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao], feitos: EstadoMissaoDoses["feitos"] = {}) => {
  if (braco === "sem") { apagarMissao(); return; }
  guardarForcaDia1Cheio("?dia1-cheio=on");
  gravarMissao({ ...iniciarMissao(plano, hoje, undefined, braco), boasVindas: true, feitos });
};

const tabela: string[] = [];
const registrar = (m: string, caso: string, oQueAparece: string) => { tabela.push(`| ${m} | ${caso} | ${oQueAparece} |`); };

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  definirDonoDaMissao(null);
  localStorage.setItem(CHAVE_FORCA_INTRO, "on");
  ligarMissao();
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; document.documentElement.removeAttribute("data-intro-modulo-faixa"); delete document.documentElement.dataset.missaoDose; guardarForcaDia1Cheio("?dia1-cheio=auto"); });
afterAll(() => {
  // a tabela módulo × caso → o que aparece (pro relatório)
  console.log(["| módulo | caso | 1ª abertura |", "|---|---|---|", ...tabela].join("\n"));
});

describe("os 16 módulos têm intro, e ela é a 1ª coisa que a pessoa vê — em qualquer caminho", () => {
  it("todos os 16 estão na lista de módulos com intro", () => {
    expect([...MODULOS_COM_INTRO].sort()).toEqual([...TODOS].sort());
    for (const m of TODOS) expect(INTROS[m], m).toBeTruthy();
  });

  for (const m of TODOS) {
    for (const [braco, pos] of CASOS) {
      const caso = braco === "sem" ? "sem missão" : `braço ${braco} · ${pos === "hoje" ? "dose de HOJE por fazer" : pos === "amanha" ? "dose de amanhã" : pos === "dia3" ? "dose do dia 3" : "fora do plano"}`;
      const doseEhOTutorial = pos === "hoje" && braco !== "sem";
      it(`${m} · ${caso}: ${doseEhOTutorial ? "a DOSE é o tutorial (a intro não dobra)" : "a intro aparece na 1ª abertura"}; 2ª abertura = nada; depois da dose feita = nada`, () => {
        const plano = planoPara(m, pos);
        armarMissao(braco, plano);
        const s = criarStore();
        // 1ª abertura: a regra e a tela
        const motivo = porQueNaoMostrar(m, s.get);
        const r = render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>);
        if (doseEhOTutorial) {
          expect(motivo, `${m} ${caso}`).toBe("missao");
          expect(moduloDaMissaoHoje(), `${m} ${caso}: a dose de hoje tem que ser deste módulo`).toBe(m);
          expect(faixa(), `${m} ${caso}`).toBeNull();
          registrar(m, caso, "a DOSE da missão (é o tutorial dele)");
        } else {
          expect(motivo, `${m} ${caso}: abriu pela 1ª vez e NÃO ganhou intro`).toBeNull();
          expect(faixa(), `${m} ${caso}: a faixa da intro não montou`).toBeTruthy();
          expect(faixa()!.textContent).toContain("Primeira vez aqui");
          // "Pular" à vista desde o 1º segundo (regra do dono)
          expect(screen.getByTestId("intro-modulo-pular")).toBeTruthy();
          registrar(m, caso, `intro ${INTROS[m].formato === "guiada" ? "guiada" : "de 1 toque"} ("${(INTROS[m] as { pedido: string }).pedido}")`);
          // 2ª abertura depois de PULAR: nada
          fireEvent.click(screen.getByTestId("intro-modulo-pular"));
          r.unmount();
          expect(porQueNaoMostrar(m, s.get), `${m} ${caso}: pulou e voltou`).toBe("ja_vista");
          const r2 = render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>);
          expect(faixa(), `${m} ${caso}: a intro voltou na 2ª abertura`).toBeNull();
          r2.unmount();
          // 2ª abertura depois de FEITA (a marca que o "Pronto" grava): nada — inclusive num aparelho novo (só a conta lembra)
          localStorage.removeItem(`core-intro-vista-${m}`); localStorage.removeItem(`core-intro-aberta-${m}`);
          const s2 = criarStore();
          marcarIntroVista(m, s2.get, s2.set, "feita");
          localStorage.removeItem(`core-intro-vista-${m}`);
          expect(porQueNaoMostrar(m, s2.get), `${m} ${caso}: feita, aparelho novo`).toBe("ja_vista");
        }
        r.unmount();
        // a dose deste módulo FEITA (em qualquer dia) = tutorial feito: nunca mais a intro
        if (braco !== "sem" && pos !== "fora") {
          const n = (plano.indexOf(m) + 1) as 1 | 2 | 3;
          const m0 = lerMissao()!;
          gravarMissao({ ...m0, feitos: { ...m0.feitos, [n]: feita } });
          const s3 = criarStore();
          expect(porQueNaoMostrar(m, s3.get), `${m} ${caso}: a dose foi feita e a intro voltou`).toBe("missao");
          const r3 = render(<s3.Provedor><IntroDoModulo moduleId={m} /></s3.Provedor>);
          expect(faixa()).toBeNull();
          r3.unmount();
        }
      });
    }
  }

  it("braço B, no dia 1, depois da dose 1: o módulo da dose 2 é a dose (ela está lá hoje); o da dose 3 e os de fora ganham a intro", () => {
    armarMissao("B", ["financas", "rotina", "saude"], { 1: feita });
    const s = criarStore();
    expect(moduloDaMissaoHoje()).toBe("rotina");
    expect(porQueNaoMostrar("rotina", s.get)).toBe("missao");
    expect(porQueNaoMostrar("saude", s.get)).toBeNull();
    expect(porQueNaoMostrar("dieta", s.get)).toBeNull();
    expect(porQueNaoMostrar("financas", s.get)).toBe("missao"); // feita = tutorial feito
  });

  it("braço A, dia 1 feito (Finanças): Rotina (amanhã) e Saúde (dia 3) ganham a intro HOJE se ela entrar por curiosidade — ela não espera 1 dia", () => {
    armarMissao("A", ["financas", "rotina", "saude"], { 1: feita });
    const s = criarStore();
    expect(moduloDaMissaoHoje()).toBe("financas");
    for (const m of ["rotina", "saude"]) {
      expect(porQueNaoMostrar(m, s.get), m).toBeNull();
      const r = render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>);
      expect(faixa(), m).toBeTruthy();
      r.unmount();
    }
  });

  it("quem tocou 'Explorar por conta própria': nenhuma dose — todo módulo ganha a intro; o que já tinha dose feita antes de explorar, não", () => {
    armarMissao("A", ["financas", "rotina", "saude"], { 1: feita });
    gravarMissao({ ...lerMissao()!, explorou: true });
    const s = criarStore();
    expect(moduloDaMissaoHoje()).toBeNull();
    for (const m of TODOS) expect(porQueNaoMostrar(m, s.get), m).toBe(m === "financas" ? "missao" : null);
  });

  it("a missão de OUTRA conta no mesmo aparelho não segura a intro de ninguém", () => {
    definirDonoDaMissao("conta-a");
    armarMissao("A", ["financas", "rotina", "saude"]);
    gravarMissao({ ...lerMissao()!, dono: donoDaConta("conta-a") }); // a orquestra grava o dono ao criar a missão
    expect(porQueNaoMostrar("financas", criarStore().get)).toBe("missao");
    definirDonoDaMissao("conta-b");
    expect(porQueNaoMostrar("financas", criarStore().get)).toBeNull();
    expect(localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)).toBeTruthy();
    expect(Object.keys(MODULOS_DA_MISSAO)).toHaveLength(16);
  });

  /* ───────────── 17/10 (dono: "tipo Finanças, que tem vários"): cada tutorial tem 3–4 passos e CHEGA NO FIM ───────────── */
  const guiadaPassos = (m: string) => (m === "rotina" ? 3 : m === "financas" || m === "saude" ? 2 : 0);
  it("cada um dos 16 tutoriais tem de 3 a 4 passos (ação real → olha → ação), e o 1º passo é sempre uma ação", () => {
    for (const m of TODOS) {
      const c = INTROS[m];
      const n = c.formato === "guiada" ? guiadaPassos(m) + (c.maisPassos?.length ?? 0) : c.passos.length;
      expect(n, `${m}: ${n} passos`).toBeGreaterThanOrEqual(3);
      expect(n, `${m}: ${n} passos`).toBeLessThanOrEqual(4);
      if (c.formato === "toque") { expect(c.passos[0].olhar, m).toBeUndefined(); expect(c.passos[0].opcoes.length, m).toBeGreaterThanOrEqual(2); }
    }
  });

  /** o que a pessoa faz NO MÓDULO nos passos que escutam (jsdom não tem o módulo: a conta recebe a escrita) */
  const acaoNoModulo: Record<string, (s: ReturnType<typeof criarStore>) => void> = {
    treino: (s) => { const plano = s.get<Record<string, { exercises: Array<Record<string, unknown>> }>>("saude-workouts-v2", {}); const dia = Object.keys(plano).find((d) => plano[d]?.exercises?.length) ?? "SEGUNDA"; s.set("saude-workouts-v2", { ...plano, [dia]: { ...plano[dia], exercises: plano[dia].exercises.map((e, i) => (i === 0 ? { ...e, done: true } : e)) } }); },
    detox: (s) => { const h = s.get<Array<Record<string, unknown>>>("detox-habits", []); s.set("detox-habits", h.map((x, i) => (i === 0 ? { ...x, checkins: [hoje] } : x))); },
    pet: (s) => { const pets = s.get<Array<{ id: string }>>("pet-list", []); s.set(`pet-routine-${hoje}`, { [pets[0]?.id ?? "p"]: { food: true } }); },
  };
  for (const m of TODOS.filter((x) => INTROS[x].formato === "toque")) {
    it(`${m}: o tutorial anda do 1º passo ao cartão do fim (chips, olhares pulados sem o card, ações no módulo) e 'Pronto' marca feito`, { timeout: 60_000 }, async () => {
      const s = criarStore();
      render(<s.Provedor><IntroDoModulo moduleId={m} /></s.Provedor>);
      expect(faixa()!.textContent).toContain("1 de ");
      const c = INTROS[m];
      const total = c.formato === "toque" ? c.passos.length : 0;
      let acoes = 0;
      for (let i = 0; i < 12 && !screen.queryByTestId("intro-modulo-pronto"); i++) {
        await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto") || screen.queryByTestId("intro-modulo-entendi") || screen.queryAllByTestId("demo-guia-chip")[0] || screen.queryByTestId("demo-guia-postit")).toBeTruthy(), { timeout: 9000 });
        if (screen.queryByTestId("intro-modulo-pronto")) break;
        const entendi = screen.queryByTestId("intro-modulo-entendi");
        if (entendi) { fireEvent.click(entendi); continue; }
        const chip = screen.queryAllByTestId("demo-guia-chip")[0];
        if (chip) { fireEvent.click(chip); acoes++; await waitFor(() => expect(document.contains(chip)).toBe(false), { timeout: 9000 }); continue; }
        // passo que escuta o módulo: a pessoa fez a ação lá
        act(() => { acaoNoModulo[m]?.(s); }); acoes++;
        await act(async () => { await new Promise((r) => setTimeout(r, 700)); });
      }
      await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 9000 });
      expect(faixa()!.textContent).toContain("pronto ✓");
      expect(acoes, `${m}: ações feitas`).toBeGreaterThanOrEqual(2);
      expect(screen.getByTestId("intro-modulo-pronto").textContent).toMatch(/já est(á|ão) aqui/);
      expect(total).toBeGreaterThanOrEqual(3);
      fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
      expect(localStorage.getItem(chaveIntroVista(m))).toMatch(/^feita@/);
      expect(porQueNaoMostrar(m, s.get)).toBe("ja_vista");
    });
  }

  it("Saúde (guiada): água → olha → continua no sono (3 de 4) → olha o IMC → o cartão do fim junta tudo e 'Pronto' marca feito", { timeout: 40_000 }, async () => {
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const s = criarStore();
    render(<s.Provedor><div><button type="button" data-spotlight="add-water">+250ml</button><IntroDoModulo moduleId="saude" /></div></s.Provedor>);
    expect(faixa()!.textContent).toContain("marca 1 copo d'água");
    await waitFor(() => expect(screen.queryAllByTestId("demo-guia-chip")[0]).toBeTruthy(), { timeout: 9000 });
    fireEvent.click(screen.getAllByTestId("demo-guia-chip")[0]); // 1 copo
    expect(Object.values(s.estado.dados["core-saude-water"] as Record<string, number>)[0]).toBe(1);
    // o "olha" da guiada (o card da água, com tamanho de mentira) → "Entendi" → os passos 3 e 4 no motor de 1 toque
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-entendi")).toBeTruthy(), { timeout: 9000 });
    fireEvent.click(screen.getByTestId("intro-modulo-entendi"));
    await waitFor(() => expect(faixa()!.textContent).toContain("3 de 4 · anota o sono"), { timeout: 9000 });
    await waitFor(() => expect(screen.queryAllByTestId("demo-guia-chip")[0]).toBeTruthy(), { timeout: 9000 });
    fireEvent.click(screen.getAllByTestId("demo-guia-chip")[1]); // 7 h
    expect(Object.values(s.estado.dados["core-saude-sleep"] as Record<string, number>)[0]).toBe(7);
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 9000 });
    expect(screen.getByTestId("intro-modulo-pronto").textContent).toContain("1 copo d'água e 7 h de sono já estão aqui. Saúde é isso");
    fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
    expect(localStorage.getItem(chaveIntroVista("saude"))).toMatch(/^feita@/);
    medir.mockRestore();
  });
});
