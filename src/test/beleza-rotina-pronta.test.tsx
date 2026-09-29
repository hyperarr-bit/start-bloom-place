/**
 * BELEZA — rotina pronta em 3 toques + skincare de hoje + lembrete (28/09, protótipo).
 *
 * O que trava aqui:
 *  1. o GERADOR (tipo de pele × objetivo × nível → passos e frequências): as 75
 *     combinações têm protetor todo dia de manhã, nenhum conflito de ativos na
 *     agenda, retinol e ácido nunca no mesmo dia, domingo de descanso, pele
 *     sensível/seca com esfoliante no máximo 2× por semana;
 *  2. "o que eu uso hoje" por dia da semana, com o índice do array INTEIRO;
 *  3. o FORMATO ANTIGO continua abrindo (passo sem dias/produto, checks por
 *     índice) e o formato novo continua legível pelo app antigo (nenhuma chave
 *     muda de tipo — a lição de 28/09 em Finanças);
 *  4. o AGENDAMENTO do lembrete (manhã/noite, texto do dia, hoje feito não
 *     avisa, sensível tira os ativos, faixa própria de id);
 *  5. as telas: 3 toques gravam a rotina; escolher produto liga passo e
 *     MEUS PRODUTOS (a antiga Bancada); o card da Home marca hoje e ontem; o lembrete grava a chave nova;
 *  6. a lista curada: formato, fonte, PAO padrão marcado, indicados pra cada passo.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
// o cliente do Supabase aponta pra PRODUÇÃO: nenhum evento sai daqui
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
  },
}));

import {
  ATIVO_DO_TIPO, OPCOES_NIVEL, OPCOES_OBJETIVO, OPCOES_PELE, PAO_PADRAO, alternarDia, buscarProdutos, conflitosDoPlano, sugerirDias,
  diaDaSemanaDaChave, diasDoPasso, ehTodoDia, gerarRotina, guardarNaBancada, indicadosPara, passoDigitado, passosDoDia, termosDoPasso, tipoPeloNome,
  type PassoDaRotina, type ProdutoDoCatalogo, type TipoDoPasso,
} from "@/lib/beleza-rotina";
import { algumLigado, lerDadosDoSkincare, lerLembreteSkincare, planejarSkincare, textoDoAviso } from "@/lib/beleza-lembrete";
import { BASES_LEMBRETES } from "@/lib/notificacoes";
import { assinaturaDos, lerDadosDosLembretes } from "@/lib/reagendar";
import { lerPrefs } from "@/lib/prefs-notificacoes";
import { conflitosDaRotina, getStepIcon } from "@/components/beleza/utils";
import { comWidget } from "@/hooks/use-home-widgets";
import catalogoBruto from "@/data/produtos-beleza.json";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { SkincareWidget } from "@/components/home/widgets/SkincareWidget";
import { ProductShelf } from "@/components/beleza/ProductShelf";
import Beleza from "@/pages/Beleza";

const CATALOGO = catalogoBruto as unknown as ProdutoDoCatalogo[];
const SEG = new Date(2026, 8, 28, 9, 40); // segunda, 28/09/2026 09:40
const HOJE = "2026-09-28";
const ONTEM = "2026-09-27";
const BASE = BASES_LEMBRETES.beleza;

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => { toastMock.mockClear(); toastMock.success.mockClear(); });
afterEach(() => { vi.useRealTimers(); });
const fixarData = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };

/** Store reativo (a Beleza lê direto do store a cada render, como no app). */
const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const Provider = ({ children }: { children: ReactNode }) => {
    const [estado, setEstado] = useState<Record<string, unknown>>(() => ({ ...dados }));
    const set = useCallback((chave: string, valor: unknown) => {
      dados[chave] = valor;
      setEstado((p) => ({ ...p, [chave]: valor }));
    }, []);
    const valor = useMemo<UserDataContextType>(() => ({
      get: <T,>(k: string, f: T) => (k in estado ? (estado[k] as T) : f),
      set, loaded: true, isGuest: true, fetchKey: async () => null,
    }), [estado, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode) => render(<MemoryRouter><Provider>{ui}</Provider></MemoryRouter>);
  /** A Home com a rota da Beleza de verdade: o toque tem que LEVAR pra lá. */
  const montarNaHome = (ui: ReactNode) =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Provider>
          <Routes>
            <Route path="/home" element={ui} />
            <Route path="/beleza" element={<p>PÁGINA DA BELEZA</p>} />
          </Routes>
        </Provider>
      </MemoryRouter>,
    );
  const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  return { dados, montar, montarNaHome, get };
};

const tipos = (l: PassoDaRotina[]) => l.map((p) => p.tipo);
const paraConflito = (l: PassoDaRotina[]) => l.map((p) => ({ nome: p.name, termos: termosDoPasso(p), dias: diasDoPasso(p) }));
const BASE_DA_ROTINA: (string | undefined)[] = ["limpeza", "hidratante", "protetor"];
const TODAS = OPCOES_PELE.flatMap((pele) => OPCOES_OBJETIVO.flatMap((obj) => OPCOES_NIVEL.map((nivel) => ({ pele: pele.id, objetivo: obj.id, nivel: nivel.id }))));

/* ═══════════════════════════ 1. o gerador ═══════════════════════════ */

describe("gerador da rotina (tipo × objetivo × nível → passos e frequências)", () => {
  it("são 75 combinações e todas saem com manhã e noite", () => {
    expect(TODAS).toHaveLength(75);
    for (const perfil of TODAS) {
      const r = gerarRotina(perfil);
      expect(r.manha.length, JSON.stringify(perfil)).toBeGreaterThanOrEqual(3);
      expect(r.noite.length, JSON.stringify(perfil)).toBeGreaterThanOrEqual(2);
    }
  });

  it("toda rotina: limpeza e hidratante todo dia nos dois períodos; protetor TODO DIA, por último, de manhã", () => {
    for (const perfil of TODAS) {
      const { manha, noite } = gerarRotina(perfil);
      const onde = JSON.stringify(perfil);
      expect(manha[0].tipo, onde).toBe("limpeza");
      expect(noite[0].tipo, onde).toBe("limpeza");
      expect(noite[noite.length - 1].tipo, onde).toBe("hidratante");
      const protetor = manha[manha.length - 1];
      expect(protetor.tipo, onde).toBe("protetor");
      expect(protetor.isSunscreen, onde).toBe(true);
      expect(ehTodoDia(protetor), onde).toBe(true);
      for (const p of [...manha, ...noite].filter((x) => BASE_DA_ROTINA.includes(x.tipo))) expect(ehTodoDia(p), onde).toBe(true);
      expect(noite.some((p) => p.isSunscreen), onde).toBe(false); // protetor não vai pra noite
    }
  });

  it("nenhuma combinação sai com conflito de ativos na agenda; retinol e ácido nunca no mesmo dia; domingo é descanso", () => {
    for (const perfil of TODAS) {
      const { manha, noite } = gerarRotina(perfil);
      const onde = JSON.stringify(perfil);
      expect(conflitosDoPlano(paraConflito(manha), paraConflito(noite)), onde).toEqual([]);
      const dias = (t: TipoDoPasso) => noite.filter((p) => p.tipo === t).flatMap((p) => diasDoPasso(p));
      const retinol = dias("retinol");
      const acidos = [...dias("acido-salicilico"), ...dias("acido-glicolico")];
      expect(retinol.filter((d) => acidos.includes(d)), onde).toEqual([]);
      expect(noite.some((p) => p.isAcid && diasDoPasso(p).includes(6)), onde).toBe(false);
    }
  });

  it("iniciante: no máximo UM tratamento além da base (começar devagar)", () => {
    for (const perfil of TODAS.filter((p) => p.nivel === "iniciante")) {
      const { manha, noite } = gerarRotina(perfil);
      const tratamentos = [...manha, ...noite].filter((p) => !BASE_DA_ROTINA.includes(p.tipo));
      expect(tratamentos.length, JSON.stringify(perfil)).toBeLessThanOrEqual(1);
    }
  });

  it("pele sensível: sem ácido glicólico, esfoliante no máximo 2×/semana, vitamina C em dias alternados", () => {
    for (const perfil of TODAS.filter((p) => p.pele === "sensivel")) {
      const { manha, noite } = gerarRotina(perfil);
      const onde = JSON.stringify(perfil);
      expect(tipos(noite), onde).not.toContain("acido-glicolico");
      for (const p of noite.filter((x) => x.isAcid)) expect(diasDoPasso(p).length, onde).toBeLessThanOrEqual(2);
      for (const p of manha.filter((x) => x.tipo === "vitamina-c")) expect(diasDoPasso(p), onde).toEqual([0, 2, 4]);
    }
  });

  it("pele seca: esfoliante no máximo 2×/semana", () => {
    for (const perfil of TODAS.filter((p) => p.pele === "seca")) {
      for (const p of gerarRotina(perfil).noite.filter((x) => x.isAcid)) expect(diasDoPasso(p).length, JSON.stringify(perfil)).toBeLessThanOrEqual(2);
    }
  });

  it("exemplos: acne iniciante (oleosa) = BHA ter e sáb; sinais intermediário = vitamina C todo dia + retinol seg/qua/sex", () => {
    const acne = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "iniciante" });
    expect(acne.manha.map((p) => p.name)).toEqual(["Gel de limpeza", "Hidratante leve (gel)", "Protetor solar (toque seco)"]);
    expect(acne.noite.map((p) => [p.name, diasDoPasso(p)])).toEqual([
      ["Gel de limpeza", [0, 1, 2, 3, 4, 5, 6]],
      ["Ácido salicílico (BHA)", [1, 5]],
      ["Hidratante leve (gel)", [0, 1, 2, 3, 4, 5, 6]],
    ]);
    const sinais = gerarRotina({ pele: "normal", objetivo: "sinais", nivel: "intermediario" });
    expect(sinais.manha.find((p) => p.tipo === "vitamina-c")?.dias).toBeUndefined(); // todo dia = sem o campo
    expect(diasDoPasso(sinais.noite.find((p) => p.tipo === "retinol"))).toEqual([0, 2, 4]);
  });

  it("manchas, pele sensível, avançado: o glicólico vira niacinamida e o retinol fica em 2×", () => {
    const r = gerarRotina({ pele: "sensivel", objetivo: "manchas", nivel: "avancado" });
    expect(tipos(r.noite)).toEqual(["limpeza", "retinol", "niacinamida", "hidratante"]);
    expect(diasDoPasso(r.noite[1])).toEqual([0, 4]);
    expect(r.manha.map((p) => p.name)).toEqual(["Limpeza suave", "Sérum de vitamina C", "Hidratante calmante", "Protetor solar"]);
  });

  it("o que está em 'ingredientes a evitar' não entra (\"Ácido Salicílico\" = ácido salicílico)", () => {
    const r = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" }, ["Ácido Salicílico"]);
    expect(tipos(r.noite)).not.toContain("acido-salicilico");
    expect(tipos(r.noite)).toContain("retinol");
  });

  it("o nome do passo gerado ainda acusa conflito no app ANTIGO (que só lê o nome) e ganha o ícone certo", () => {
    const r = gerarRotina({ pele: "normal", objetivo: "sinais", nivel: "avancado" });
    // o app antigo não sabe de dias: retinol e glicólico na mesma lista viram alerta lá (esperado)
    expect(conflitosDaRotina(r.manha.map((p) => p.name), r.noite.map((p) => p.name)).map((c) => c.ingredients)).toContainEqual(["retinol", "ácido glicólico"]);
    // ordem de aplicação da noite: limpeza, ácido, retinol, hidratante (cada ativo no seu dia)
    expect(r.noite.map((p) => getStepIcon(p.name))).toEqual(["🧹", "⚗️", "💎", "🧊"]);
  });
});

/* ═══════════════════════════ 2. o que usar hoje ═══════════════════════════ */

describe("o que usar hoje (por dia da semana)", () => {
  const { noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" });
  // noite: [0] Gel de limpeza · [1] Ácido salicílico ter/qui/sáb · [2] Retinol seg/sex · [3] Hidratante

  it("segunda é noite de retinol; terça, de ácido; domingo, descanso — com o índice do array inteiro", () => {
    expect(diaDaSemanaDaChave(HOJE)).toBe(0);
    expect(diaDaSemanaDaChave("2026-10-04")).toBe(6);
    const nomes = (dia: number) => passosDoDia(noite, dia).map(({ passo, i }) => `${i}:${passo.name}`);
    expect(nomes(0)).toEqual(["0:Gel de limpeza", "2:Retinol", "3:Hidratante leve (gel)"]);
    expect(nomes(1)).toEqual(["0:Gel de limpeza", "1:Ácido salicílico (BHA)", "3:Hidratante leve (gel)"]);
    expect(nomes(6)).toEqual(["0:Gel de limpeza", "3:Hidratante leve (gel)"]);
  });

  it("passo sem dias (rotina antiga) entra todo dia; dias tortos ([], [9], texto) também — o passo nunca some", () => {
    const antiga = [{ name: "Vitamina C" }, { name: "Hidratante", dias: [] }, { name: "Tônico", dias: [9, "x"] }, null, { name: "" }];
    for (let d = 0; d < 7; d++) expect(passosDoDia(antiga, d).map(({ i }) => i)).toEqual([0, 1, 2]);
    expect(passosDoDia("lixo", 0)).toEqual([]);
  });

  it("alternarDia: tira e põe; o último dia não sai; os 7 de volta = sem o campo (todo dia)", () => {
    const p: PassoDaRotina = { name: "Retinol", dias: [0, 4] };
    expect(alternarDia(p, 4).dias).toEqual([0]);
    expect(alternarDia({ name: "Retinol", dias: [0] }, 0)).toEqual({ name: "Retinol", dias: [0] }); // mesmo objeto de volta
    expect(alternarDia({ name: "X", dias: [0, 1, 2, 3, 4, 5] }, 6)).toEqual({ name: "X" });
    expect(alternarDia({ name: "Limpeza" }, 6).dias).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

/* ═══════════════════════════ 3. formato antigo × novo ═══════════════════════════ */

describe("formato antigo continua abrindo (e o novo continua legível pelo app antigo)", () => {
  it("rotina antiga (sem dias nem produto) abre na tabela do dia com os checks por índice, SEM o ciclo de 4 dias", () => {
    fixarData(SEG);
    const store = criarStore({
      "skincare-am-steps": [{ name: "Vitamina C" }, { name: "Protetor solar", isSunscreen: true }],
      "skincare-pm-steps": [{ name: "Demaquilante" }, { name: "Retinol", isAcid: true }],
      "skincare-morning-checked": { [HOJE]: [0] },
      "skincare-cycle-start": HOJE,
    });
    store.montar(<SkincareRoutine />);
    const linhas = screen.getAllByTestId("passo-skincare");
    expect(linhas.map((l) => within(l).getByRole("checkbox").getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false"]);
    expect(screen.queryByText(/Skin Cycling/)).not.toBeInTheDocument(); // o ciclo saiu pra todo mundo (28/09)
    expect(screen.getByTestId("semana-skincare")).toBeInTheDocument();
    // marcar o protetor grava o índice 1 no MESMO formato
    fireEvent.click(within(linhas[1]).getByRole("checkbox"));
    expect(store.dados["skincare-morning-checked"]).toEqual({ [HOJE]: [0, 1] });
  });

  it("depois das 3 perguntas + produto escolhido, cada chave tem o MESMO tipo de antes e os campos que o app antigo lê", async () => {
    fixarData(SEG);
    const store = criarStore({ "beauty-products": [], "skincare-morning-checked": {}, "skincare-night-checked": {} });
    store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByTestId("opcao-oleosa"));
    fireEvent.click(screen.getByTestId("opcao-acne"));
    fireEvent.click(screen.getByTestId("opcao-intermediario"));
    // escolhe um produto da lista pro protetor
    fireEvent.click(screen.getByRole("button", { name: "Abrir Protetor solar (toque seco)" }));
    fireEvent.click(await screen.findByTestId("abrir-lista"));
    fireEvent.click((await screen.findAllByTestId("produto-da-lista"))[0]);
    await screen.findByTestId("produto-na-ficha");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    const am = store.dados["skincare-am-steps"] as unknown[];
    const pm = store.dados["skincare-pm-steps"] as unknown[];
    for (const lista of [am, pm]) {
      expect(Array.isArray(lista)).toBe(true);
      for (const p of lista as Record<string, unknown>[]) {
        expect(typeof p.name).toBe("string");
        expect(["boolean", "undefined"]).toContain(typeof p.isSunscreen);
        expect(["boolean", "undefined"]).toContain(typeof p.isAcid);
      }
    }
    for (const k of ["skincare-morning-checked", "skincare-night-checked"]) {
      const mapa = store.dados[k] as Record<string, unknown>;
      expect(mapa && typeof mapa === "object" && !Array.isArray(mapa)).toBe(true);
      for (const v of Object.values(mapa)) expect(Array.isArray(v) && (v as unknown[]).every(Number.isInteger)).toBe(true);
    }
    const bancada = store.dados["beauty-products"] as Record<string, unknown>[];
    expect(bancada).toHaveLength(1);
    const tipoDe: Record<string, string> = {
      id: "string", name: "string", category: "string", brand: "string", opened: "boolean", openedDate: "string", paoMonths: "number",
      expiry: "string", notes: "string", rating: "number", repurchase: "boolean", price: "number", sizeMl: "number", photoUrl: "string",
      frequency: "string", finished: "boolean",
    };
    for (const [campo, tipo] of Object.entries(tipoDe)) expect(typeof bancada[0][campo], campo).toBe(tipo);
    expect([3, 6, 9, 12, 18, 24]).toContain(bancada[0].paoMonths); // o select de PAO do app antigo tem essas opções
    // o passo aponta pro produto (campo opcional novo)
    expect((am as PassoDaRotina[]).find((p) => p.isSunscreen)?.produtoId).toBe(bancada[0].id);
    // chaves novas nascem objeto
    expect(store.dados["skincare-perfil"]).toEqual({ pele: "oleosa", objetivo: "acne", nivel: "intermediario" });
  });

  it("a Bancada de sempre mostra o produto da lista e editar mantém os campos novos", () => {
    const { bancada } = guardarNaBancada([], CATALOGO.find((p) => p.categoria === "protetor")!, "p1");
    const store = criarStore({ "beauty-products": bancada });
    store.montar(<ProductShelf />);
    fireEvent.click(screen.getByText(bancada[0].name));
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.change(screen.getAllByPlaceholderText("Nome do produto").at(-1)!, { target: { value: "Meu protetor" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const salvo = (store.dados["beauty-products"] as Record<string, unknown>[])[0];
    expect(salvo).toMatchObject({ id: "p1", name: "Meu protetor", catalogoId: bancada[0].catalogoId, paoPadrao: bancada[0].paoPadrao });
  });

  it("widget desconhecido pro app antigo não entra duas vezes na Home e não sobrescreve lista torta", () => {
    expect(comWidget([], "skincare", "large")).toEqual([{ id: "skincare", size: "large" }]);
    expect(comWidget([{ id: "skincare", size: "small" }], "skincare", "large")).toBeNull();
    expect(comWidget({ torto: true }, "skincare", "large")).toBeNull();
  });
});

/* ═══════════════════ 3b. sem o ciclo de 4 dias: a migração ═══════════════════ */

describe("sem o ciclo fixo de 4 dias (28/09): rotina antiga vira 'todo dia' e ganha a oferta de alternar", () => {
  // como uma conta real que só usou o app antigo: nomes digitados, flags, checks por índice
  const ANTIGA = {
    "skincare-am-steps": [{ name: "Gel de limpeza" }, { name: "Vitamina C" }, { name: "Protetor solar", isSunscreen: true }],
    "skincare-pm-steps": [{ name: "Demaquilante" }, { name: "Retinol", isAcid: true }, { name: "Ácido glicólico", isAcid: true }, { name: "Hidratante" }],
    "skincare-morning-checked": { [HOJE]: [0, 1], [ONTEM]: [0, 1, 2] },
    "skincare-night-checked": { [ONTEM]: [0, 3] },
    "skincare-cycle-start": "2026-09-10",
  };
  const copia = () => JSON.parse(JSON.stringify(ANTIGA)) as typeof ANTIGA;

  it("abre sem ciclo, com TODOS os passos hoje e na semana (todo dia), e sem gravar nada", () => {
    fixarData(SEG);
    const store = criarStore(copia());
    store.montar(<SkincareRoutine />);
    expect(screen.queryByText(/Skin Cycling|CICLO DE 4 DIAS/)).not.toBeInTheDocument();
    // hoje: os 7 passos, nenhum some (o app antigo mostra exatamente estes)
    expect(screen.getAllByTestId("passo-skincare")).toHaveLength(7);
    expect(screen.queryByTestId("fora-manha")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fora-noite")).not.toBeInTheDocument();
    // a semana: uma linha por passo, cada uma nos 7 dias
    const semana = screen.getByTestId("semana-skincare");
    expect(within(semana).getAllByTestId("linha-semana")).toHaveLength(7);
    // checks de hoje no lugar (índice 0 e 1 da manhã)
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-checked")).slice(0, 3)).toEqual(["true", "true", "false"]);
    // abrir não escreveu nada: formato e dados idênticos ao que o app antigo gravou
    expect(store.dados).toEqual(copia());
  });

  it("retinol + ácido todo dia: o conflito aparece e o 'Alternar' põe retinol seg/qua/sex e ácido ter/qui/sáb — só esses dois mudam", () => {
    fixarData(SEG);
    const store = criarStore(copia());
    store.montar(<SkincareRoutine />);
    expect(screen.getByText(/CONFLITOS DETECTADOS/)).toBeInTheDocument();
    const oferta = screen.getByTestId("sugestao-alternar");
    expect(oferta).toHaveTextContent("Retinol seg · qua · sex; Ácido glicólico ter · qui · sáb");
    fireEvent.click(within(oferta).getByRole("button", { name: "Alternar" }));

    const pm = store.dados["skincare-pm-steps"] as PassoDaRotina[];
    expect(pm).toEqual([
      { name: "Demaquilante" },
      { name: "Retinol", isAcid: true, dias: [0, 2, 4] },
      { name: "Ácido glicólico", isAcid: true, dias: [1, 3, 5] },
      { name: "Hidratante" },
    ]);
    expect(store.dados["skincare-am-steps"]).toEqual(ANTIGA["skincare-am-steps"]); // manhã intocada
    expect(store.dados["skincare-night-checked"]).toEqual(ANTIGA["skincare-night-checked"]); // checks intocados
    expect(screen.queryByText(/CONFLITOS DETECTADOS/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("sugestao-alternar")).not.toBeInTheDocument();
    // segunda = noite de retinol; o ácido fica pra terça
    expect(screen.getByTestId("fora-noite")).toHaveTextContent("Hoje não: Ácido glicólico (ter · qui · sáb)");

    // Desfazer volta a rotina exatamente como era
    const ultimo = toastMock.mock.calls[toastMock.mock.calls.length - 1];
    expect(ultimo[0]).toBe("Ativos em dias alternados");
    act(() => { ultimo[1].action.onClick(); });
    expect(store.dados["skincare-pm-steps"]).toEqual(ANTIGA["skincare-pm-steps"]);
  });

  it("'Agora não' guarda a escolha em chave NOVA (objeto) e a oferta não volta", () => {
    fixarData(SEG);
    const store = criarStore(copia());
    const t = store.montar(<SkincareRoutine />);
    fireEvent.click(within(screen.getByTestId("sugestao-alternar")).getByRole("button", { name: "Agora não" }));
    expect(store.dados["skincare-dicas-prefs"]).toEqual({ alternarDispensado: true });
    expect(screen.queryByTestId("sugestao-alternar")).not.toBeInTheDocument();
    t.unmount();
    criarStore({ ...copia(), "skincare-dicas-prefs": { alternarDispensado: true } }).montar(<SkincareRoutine />);
    expect(screen.queryByTestId("sugestao-alternar")).not.toBeInTheDocument();
  });

  it("rotina só com o básico (sem ativo à noite) não recebe oferta nenhuma", () => {
    fixarData(SEG);
    criarStore({ "skincare-am-steps": [{ name: "Limpeza" }, { name: "Protetor", isSunscreen: true }], "skincare-pm-steps": [{ name: "Hidratante" }] })
      .montar(<SkincareRoutine />);
    expect(screen.queryByTestId("sugestao-alternar")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("semana-skincare")).getAllByTestId("linha-semana")).toHaveLength(3);
  });

  it("sugerirDias: retinoide nas vagas seg/qua/sex; 1 ácido ter/qui/sáb; 2 ácidos dividem (AHA e BHA nunca juntos); passo com dias fica", () => {
    expect(sugerirDias([{ name: "Retinol", isAcid: true }])).toEqual([{ i: 0, dias: [0, 2, 4] }]);
    expect(sugerirDias([{ name: "Limpeza" }, { name: "AHA", isAcid: true }, { name: "BHA", isAcid: true }])).toEqual([
      { i: 1, dias: [1, 5] }, { i: 2, dias: [3] },
    ]);
    expect(sugerirDias([{ name: "Retinol", isAcid: true, dias: [0] }, { name: "Hidratante" }])).toEqual([]);
    expect(sugerirDias("lixo")).toEqual([]);
    // o que a sugestão monta não tem conflito
    const noite: PassoDaRotina[] = [{ name: "Retinol", isAcid: true }, { name: "Ácido glicólico (AHA)", isAcid: true }, { name: "Ácido salicílico (BHA)", isAcid: true }];
    const aplicada = noite.map((p, i) => ({ ...p, ...(sugerirDias(noite).find((m) => m.i === i) ? { dias: sugerirDias(noite).find((m) => m.i === i)!.dias } : {}) }));
    expect(conflitosDoPlano([], paraConflito(aplicada))).toEqual([]);
    expect(conflitosDoPlano([], paraConflito(noite)).length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════ 4. o lembrete ═══════════════════════════ */

describe("agendamento do lembrete do skincare", () => {
  const { manha, noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" });
  const dados = (extra: Record<string, unknown> = {}) => {
    const d: Record<string, unknown> = {
      "skincare-am-steps": manha,
      "skincare-pm-steps": noite,
      "skincare-lembrete-prefs": { manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } },
      ...extra,
    };
    return lerDadosDoSkincare(<T,>(k: string, f: T) => (k in d ? (d[k] as T) : f), HOJE);
  };

  it("nasce desligado; dado torto volta pro padrão (07:30 e 21:30); hora normalizada", () => {
    expect(lerLembreteSkincare(undefined)).toEqual({ manha: { ligado: false, hora: "07:30" }, noite: { ligado: false, hora: "21:30" } });
    expect(lerLembreteSkincare("lixo")).toEqual(lerLembreteSkincare(undefined));
    expect(lerLembreteSkincare({ manha: { ligado: true, hora: "7:05" }, noite: { ligado: "sim", hora: "25:00" } })).toEqual({
      manha: { ligado: true, hora: "07:05" }, noite: { ligado: false, hora: "21:30" },
    });
    expect(planejarSkincare({ ...dados(), prefs: lerLembreteSkincare(undefined) }, BASE, SEG)).toEqual([]);
  });

  it("segunda 09:40: o 1º é HOJE 21:30 (a manhã já passou), com o passo do dia no título", () => {
    const avisos = planejarSkincare(dados(), BASE, SEG);
    expect(avisos[0]).toMatchObject({ quando: new Date(2026, 8, 28, 21, 30), title: "🌙 Hoje é noite de Retinol", body: "Gel de limpeza · Retinol · Hidratante leve" });
    expect(avisos[1]).toMatchObject({ quando: new Date(2026, 8, 29, 7, 30), title: "☀️ Skincare da manhã", body: "Gel de limpeza · Niacinamida · Hidratante leve · Protetor solar" });
    expect(avisos[2]).toMatchObject({ quando: new Date(2026, 8, 29, 21, 30), title: "🌙 Hoje é noite de Ácido salicílico" });
    // domingo 04/10: descanso
    expect(avisos.find((a) => a.quando.getTime() === new Date(2026, 9, 4, 21, 30).getTime())?.title).toBe("🌙 Noite de descanso da pele");
    expect(avisos.every((a) => a.quando.getTime() > SEG.getTime())).toBe(true);
    expect(avisos.length).toBeLessThanOrEqual(24);
  });

  it("ids na faixa própria da Beleza (1700000+), um por aviso, sem invadir a das tarefas", () => {
    expect(BASE).toBe(1700000);
    const avisos = planejarSkincare(dados(), BASE, SEG);
    expect(avisos.map((a) => a.id)).toEqual(avisos.map((_, i) => BASE + i));
    for (const a of avisos) expect(a.id >= BASE && a.id < BASE + 10000).toBe(true);
  });

  it("noite de hoje já feita: o aviso de hoje não vem; feita em parte: diz o que falta", () => {
    const tudo = planejarSkincare(dados({ "skincare-night-checked": { [HOJE]: [0, 2, 3] } }), BASE, SEG);
    expect(tudo[0].quando).toEqual(new Date(2026, 8, 29, 7, 30));
    const parte = planejarSkincare(dados({ "skincare-night-checked": { [HOJE]: [0] } }), BASE, SEG);
    expect(parte[0]).toMatchObject({ quando: new Date(2026, 8, 28, 21, 30), body: "Falta: Retinol · Hidratante leve" });
  });

  it("pele marcada Sensível hoje: o aviso da noite de hoje vem sem os ativos (os dos outros dias não mudam)", () => {
    const avisos = planejarSkincare(dados({ "skincare-daily-checkin": { [HOJE]: "sensivel" } }), BASE, SEG);
    expect(avisos[0]).toMatchObject({ title: "🌙 Skincare da noite", body: "Pele sensível hoje: sem ativos. Gel de limpeza · Hidratante leve" });
    expect(avisos[2].title).toBe("🌙 Hoje é noite de Ácido salicílico");
  });

  it("só a noite ligada, às 22:15: só avisos às 22:15", () => {
    const d = dados({ "skincare-lembrete-prefs": { manha: { ligado: false, hora: "07:30" }, noite: { ligado: true, hora: "22:15" } } });
    const avisos = planejarSkincare(d, BASE, SEG);
    expect(avisos.length).toBe(11);
    expect(avisos.every((a) => a.quando.getHours() === 22 && a.quando.getMinutes() === 15)).toBe(true);
  });

  it("período sem passo naquele dia não gera aviso; texto vazio = nada", () => {
    expect(textoDoAviso("manha", [])).toBeNull();
    expect(textoDoAviso("noite", [{ i: 0, nome: "Retinol", dias: [0], ativo: true, todoDia: false }], { sensivel: true })).toBeNull();
  });

  it("marcar um passo de hoje muda a assinatura (o aviso pendente é refeito); desligado não entra na assinatura", () => {
    fixarData(SEG);
    const base: Record<string, unknown> = {
      "skincare-am-steps": manha, "skincare-pm-steps": noite,
      "skincare-lembrete-prefs": { manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } },
    };
    const leitor = (d: Record<string, unknown>) => <T,>(k: string, f: T) => (k in d ? (d[k] as T) : f);
    const prefs = lerPrefs(undefined);
    const antes = assinaturaDos(lerDadosDosLembretes(leitor(base)), prefs);
    const depois = assinaturaDos(lerDadosDosLembretes(leitor({ ...base, "skincare-night-checked": { [HOJE]: [0] } })), prefs);
    expect(depois).not.toBe(antes);
    const desligado = { ...base, "skincare-lembrete-prefs": { manha: { ligado: false, hora: "07:30" }, noite: { ligado: false, hora: "21:30" } } };
    const a = assinaturaDos(lerDadosDosLembretes(leitor(desligado)), prefs);
    const b = assinaturaDos(lerDadosDosLembretes(leitor({ ...desligado, "skincare-night-checked": { [HOJE]: [0] } })), prefs);
    expect(a).toBe(b);
    expect(algumLigado(lerDadosDosLembretes(leitor(base)).skincare!.prefs)).toBe(true);
  });
});

/* ═══════════════════════════ 5. as telas ═══════════════════════════ */

describe("telas", () => {
  it("rotina vazia: 3 toques gravam a rotina de manhã e de noite; aparece o 'rotina pronta' com lembrete e Home", () => {
    fixarData(SEG);
    const store = criarStore({});
    store.montar(<SkincareRoutine />);
    expect(screen.getByText("Como é a sua pele?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("opcao-mista"));
    expect(screen.getByText("O que você mais quer cuidar agora?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("opcao-manchas"));
    expect(screen.getByText("Quanto de rotina você topa?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("opcao-intermediario"));

    const esperado = gerarRotina({ pele: "mista", objetivo: "manchas", nivel: "intermediario" });
    expect(store.dados["skincare-am-steps"]).toEqual(esperado.manha);
    expect(store.dados["skincare-pm-steps"]).toEqual(esperado.noite);
    expect(screen.getByTestId("postit-pronta")).toHaveTextContent(/pele mista, foco em manchas/);
    // segunda: o glicólico (ter/sáb) fica de fora hoje, e a tela diz
    expect(screen.getByTestId("fora-noite")).toHaveTextContent("Hoje não: Ácido glicólico (ter · sáb)");
    // o lembrete sai do post-it, nas horas padrão
    fireEvent.click(within(screen.getByTestId("postit-lembrete")).getByRole("button", { name: "Ligar" }));
    expect(store.dados["skincare-lembrete-prefs"]).toEqual({ manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } });
    fireEvent.click(within(screen.getByTestId("postit-home")).getByRole("button", { name: "Pôr" }));
    expect(store.dados["core-home-widgets-v2"]).toEqual([{ id: "skincare", size: "large" }]);
  });

  it("rotina pronta traz o aviso discreto do dermatologista (no post-it e no pé); rotina montada à mão não", () => {
    fixarData(SEG);
    const store = criarStore({});
    const t = store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByTestId("opcao-normal"));
    fireEvent.click(screen.getByTestId("opcao-basico"));
    fireEvent.click(screen.getByTestId("opcao-iniciante"));
    const texto = "Orientação geral — não substitui a avaliação de um dermatologista.";
    expect(screen.getByTestId("aviso-dermatologista-pronta")).toHaveTextContent(texto);
    expect(screen.getByTestId("aviso-dermatologista")).toHaveTextContent(texto);
    t.unmount();
    // voltando depois (sem o "acabou de montar"): fica só o pé
    criarStore({ ...store.dados }).montar(<SkincareRoutine />);
    expect(screen.queryByTestId("aviso-dermatologista-pronta")).not.toBeInTheDocument();
    expect(screen.getByTestId("aviso-dermatologista")).toHaveTextContent(texto);
  });

  it("rotina montada à mão (sem as 3 perguntas) não mostra o aviso", () => {
    fixarData(SEG);
    criarStore({ "skincare-am-steps": [{ name: "Limpeza" }] }).montar(<SkincareRoutine />);
    expect(screen.queryByTestId("aviso-dermatologista")).not.toBeInTheDocument();
  });

  it("'Prefiro montar do zero' abre a tabela vazia com os campos de sempre", () => {
    fixarData(SEG);
    const store = criarStore({});
    store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByTestId("do-zero"));
    fireEvent.change(screen.getByLabelText("Novo passo da manhã"), { target: { value: "Protetor FPS 50" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar passo da manhã" }));
    expect(store.dados["skincare-am-steps"]).toEqual([{ name: "Protetor FPS 50", tipo: "protetor", isSunscreen: true }]);
  });

  it("escolher produto: indicados do passo, liga passo e Bancada; o mesmo produto em outro passo não duplica", async () => {
    fixarData(SEG);
    const { manha, noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "iniciante" });
    const store = criarStore({ "skincare-am-steps": manha, "skincare-pm-steps": noite, "skincare-perfil": { pele: "oleosa" } });
    store.montar(<SkincareRoutine />);
    // "+ escolher produto" do hidratante da manhã abre direto a lista
    const hidratante = screen.getAllByTestId("passo-skincare")[1];
    fireEvent.click(within(hidratante).getByTestId("escolher-produto"));
    const itens = await screen.findAllByTestId("produto-da-lista");
    expect(itens.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(itens[0]);
    await screen.findByTestId("produto-na-ficha");
    const bancada = store.dados["beauty-products"] as { id: string; catalogoId: string; paoMonths: number; paoPadrao: boolean }[];
    expect(bancada).toHaveLength(1);
    const escolhido = CATALOGO.find((p) => p.id === bancada[0].catalogoId)!;
    expect(escolhido.categoria).toBe("hidratante");
    expect(bancada[0].paoMonths).toBe(escolhido.pao);
    expect((store.dados["skincare-am-steps"] as PassoDaRotina[])[1].produtoId).toBe(bancada[0].id);
    // "Abri hoje": a validade começa a contar na Bancada
    fireEvent.click(screen.getByTestId("abri-hoje"));
    expect((store.dados["beauty-products"] as { openedDate: string }[])[0].openedDate).toBe(HOJE);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // o mesmo hidratante na noite: aparece em "NOS SEUS PRODUTOS" e reusa o item
    const noiteHidratante = within(screen.getByTestId("periodo-noite")).getAllByTestId("passo-skincare").at(-1)!;
    fireEvent.click(within(noiteHidratante).getByTestId("escolher-produto"));
    const meus = await screen.findByTestId("nos-seus-produtos");
    expect(within(meus.parentElement!).getByText("NOS SEUS PRODUTOS")).toBeInTheDocument();
    fireEvent.click(within(meus).getAllByTestId("produto-da-lista")[0]);
    expect(store.dados["beauty-products"] as unknown[]).toHaveLength(1);
    expect((store.dados["skincare-pm-steps"] as PassoDaRotina[]).at(-1)?.produtoId).toBe(bancada[0].id);
  });

  it("produto digitado à mão vai pra Bancada com o PAO padrão da categoria do passo", async () => {
    fixarData(SEG);
    const { manha, noite } = gerarRotina({ pele: "normal", objetivo: "sinais", nivel: "iniciante" });
    const store = criarStore({ "skincare-am-steps": manha, "skincare-pm-steps": noite });
    store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Retinol" }));
    fireEvent.click(await screen.findByTestId("abrir-lista"));
    await screen.findAllByTestId("produto-da-lista");
    fireEvent.click(screen.getByRole("button", { name: /Não achei/ }));
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Farmácia de manipulação" } });
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Retinol 0,5% manipulado" } });
    fireEvent.click(screen.getByRole("button", { name: /Usar este produto/ }));
    const salvo = (store.dados["beauty-products"] as Record<string, unknown>[])[0];
    expect(salvo).toMatchObject({ name: "Retinol 0,5% manipulado", brand: "Farmácia de manipulação", paoMonths: PAO_PADRAO.retinoide, category: "Skincare" });
    expect(salvo.catalogoId).toBeUndefined();
  });

  it("ficha: mudar os dias do passo grava `dias`; o último dia não sai; remover tem Desfazer", () => {
    fixarData(SEG);
    const { manha, noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" });
    const store = criarStore({ "skincare-am-steps": manha, "skincare-pm-steps": noite });
    store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Retinol" }));
    const dias = screen.getByRole("group", { name: "Dias do passo" });
    fireEvent.click(within(dias).getByRole("button", { name: "Quarta" }));
    expect((store.dados["skincare-pm-steps"] as PassoDaRotina[])[2].dias).toEqual([0, 2, 4]);
    fireEvent.click(within(dias).getByRole("button", { name: "Quarta" }));
    fireEvent.click(within(dias).getByRole("button", { name: "Sexta" }));
    fireEvent.click(within(dias).getByRole("button", { name: "Segunda" })); // último: não sai
    expect((store.dados["skincare-pm-steps"] as PassoDaRotina[])[2].dias).toEqual([0]);
    expect(toastMock).toHaveBeenCalledWith(expect.stringMatching(/pelo menos 1 dia/));
    fireEvent.click(screen.getByRole("button", { name: "Tirar Retinol da rotina" }));
    expect((store.dados["skincare-pm-steps"] as PassoDaRotina[]).map((p) => p.name)).not.toContain("Retinol");
    const ultimo = toastMock.mock.calls[toastMock.mock.calls.length - 1];
    act(() => { ultimo[1].action.onClick(); });
    expect((store.dados["skincare-pm-steps"] as PassoDaRotina[])[2].name).toBe("Retinol");
  });

  it("card da Home: mostra os passos de hoje, marca na chave da Beleza, marca ONTEM no dia certo, abre a Beleza", () => {
    fixarData(SEG);
    const { manha, noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" });
    const store = criarStore({ "skincare-am-steps": manha, "skincare-pm-steps": noite, "skincare-morning-checked": { [HOJE]: [0] } });
    store.montarNaHome(<SkincareWidget size="large" />);
    const card = screen.getByTestId("skincare-widget");
    expect(within(card).getByText("SEGUNDA · 28/09")).toBeInTheDocument();
    expect(within(card).getByTestId("contagem-skincare")).toHaveTextContent("1/7");
    expect(within(card).getByText("Retinol")).toBeInTheDocument();
    expect(within(card).queryByText("Ácido salicílico (BHA)")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("checkbox", { name: "Marcar Retinol" }));
    expect(store.dados["skincare-night-checked"]).toEqual({ [HOJE]: [2] });
    // ONTEM (domingo): descanso, e o check vai pro dia 27
    fireEvent.click(within(card).getByRole("button", { name: "ONTEM" }));
    expect(within(card).getByText("DOMINGO · 27/09")).toBeInTheDocument();
    expect(within(card).queryByText("Retinol")).not.toBeInTheDocument();
    fireEvent.click(within(card).getAllByRole("checkbox")[0]);
    expect(store.dados["skincare-morning-checked"]).toEqual({ [HOJE]: [0], [ONTEM]: [0] });
    // tocar no passo (não no quadradinho) abre a Beleza
    fireEvent.click(within(card).getAllByRole("button", { name: "Abrir Beleza: Gel de limpeza" })[0]); // manhã e noite têm a limpeza
    expect(screen.getByText("PÁGINA DA BELEZA")).toBeInTheDocument();
  });

  it("card da Home sem rotina convida pras 3 perguntas", () => {
    fixarData(SEG);
    criarStore({}).montar(<SkincareWidget size="large" />);
    expect(screen.getByTestId("skincare-vazio")).toHaveTextContent(/3 perguntas/);
  });

  it("lembrete: ligar grava a chave nova (objeto) e o site avisa que só toca no app do celular", () => {
    fixarData(SEG);
    const { manha, noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" });
    const store = criarStore({ "skincare-am-steps": manha, "skincare-pm-steps": noite });
    store.montar(<SkincareRoutine />);
    const card = screen.getByTestId("lembrete-skincare");
    expect(within(card).getByTestId("lembrete-so-no-app")).toHaveTextContent("No site o lembrete não toca — ele toca no app do celular.");
    fireEvent.click(within(card).getByRole("switch", { name: "Lembrete da noite" }));
    expect(store.dados["skincare-lembrete-prefs"]).toEqual({ manha: { ligado: false, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } });
    // a prévia do próximo aviso é o texto que o celular recebe
    expect(within(card).getByTestId("proximo-aviso")).toHaveTextContent("Hoje é noite de Retinol");
    fireEvent.change(within(card).getByLabelText("Hora do lembrete da noite"), { target: { value: "22:15" } });
    expect((store.dados["skincare-lembrete-prefs"] as { noite: { hora: string } }).noite.hora).toBe("22:15");
  });
});

/* ═══════════════════ 5b. "Bancada" virou MEUS PRODUTOS (dono, 28/09) ═══════════════════ */

describe("MEUS PRODUTOS (a antiga Bancada)", () => {
  it("a aba e o título dizem MEUS PRODUTOS; nenhum texto da Beleza fala em bancada; a chave de dados é a mesma", () => {
    fixarData(SEG);
    const { bancada } = guardarNaBancada([], CATALOGO.find((p) => p.categoria === "protetor")!, "p1");
    const store = criarStore({ "beauty-products": bancada, "skincare-am-steps": [{ name: "Protetor", isSunscreen: true, produtoId: "p1" }] });
    store.montar(<Beleza />);
    expect(screen.queryByText(/bancada/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /MEUS PRODUTOS/ }));
    expect(screen.getByText("🧴 MEUS PRODUTOS")).toBeInTheDocument();
    expect(screen.getByText(bancada[0].name)).toBeInTheDocument(); // o produto de sempre, lido de `beauty-products`
    expect(screen.queryByText(/bancada/i)).not.toBeInTheDocument();
    expect(Object.keys(store.dados)).toContain("beauty-products");
  });
});

/* ═══════════════════════════ 6. a lista curada ═══════════════════════════ */

describe("lista curada de produtos (src/data/produtos-beleza.json)", () => {
  const CATEGORIAS = Object.keys(PAO_PADRAO);
  const VOCAB = new Set([
    "ácido glicólico", "ácido lático", "ácido mandélico", "ácido salicílico", "lha", "retinol", "retinal", "vitamina c", "niacinamida",
    "ácido hialurônico", "ceramidas", "pantenol", "centella asiática", "ácido tranexâmico", "alfa-arbutin", "zinco", "ácido ferúlico",
    "vitamina e", "bakuchiol", "ureia", "esqualano", "ácido azelaico", "peptídeos", "cafeína", "argila", "ácido kójico", "colágeno",
  ]);
  const TEXTURAS = new Set(["fluido", "gel", "gel-creme", "creme", "loção", "bastão", "spray", "mousse", "pó", "sérum", "balm", "óleo"]);

  it("~250 produtos (200+), ids únicos, campos no formato, fonte https em cada um", () => {
    expect(CATALOGO.length).toBeGreaterThanOrEqual(200);
    expect(new Set(CATALOGO.map((p) => p.id)).size).toBe(CATALOGO.length);
    for (const p of CATALOGO) {
      expect(p.marca.trim() && p.nome.trim(), p.id).toBeTruthy();
      expect(CATEGORIAS, p.id).toContain(p.categoria);
      for (const a of p.ativos) expect(VOCAB.has(a), `${p.id}: ${a}`).toBe(true);
      expect(new URL(p.fonte).protocol, p.id).toBe("https:");
      expect(Number.isInteger(p.pao) && p.pao >= 1, p.id).toBe(true);
      expect(typeof p.paoPadrao, p.id).toBe("boolean");
    }
  });

  it("rodada 2 (dono, 28/09): protetor em várias texturas e COM COR, lábios e máscaras, e as marcas nacionais pedidas", () => {
    const protetores = CATALOGO.filter((p) => p.categoria === "protetor");
    expect(protetores.length).toBeGreaterThanOrEqual(30);
    expect(protetores.filter((p) => p.cor).length).toBeGreaterThanOrEqual(8);
    expect(new Set(protetores.map((p) => p.textura).filter(Boolean)).size).toBeGreaterThanOrEqual(4);
    for (const p of CATALOGO) if (p.textura != null) expect(TEXTURAS.has(p.textura), `${p.id}: ${p.textura}`).toBe(true);
    for (const c of ["labios", "mascara", "olhos"] as const) expect(CATALOGO.filter((p) => p.categoria === c).length, c).toBeGreaterThanOrEqual(3);
    const marcas = new Set(CATALOGO.map((p) => p.marca));
    for (const m of ["Principia", "Sallve", "Creamy", "Simple Organic", "Nivea", "Neutrogena", "Vult", "Payot", "Adcos", "Mantecorp Skincare", "Darrow"]) {
      expect(marcas.has(m), m).toBe(true);
    }
  });

  it("passo digitado acha a categoria certa: 'Protetor labial' = lábios, 'Máscara de argila' = máscara, 'Contorno dos olhos' = olhos", () => {
    expect(tipoPeloNome("Protetor labial")).toBe("labios");
    expect(tipoPeloNome("Hidratante labial")).toBe("labios");
    expect(tipoPeloNome("Máscara de argila")).toBe("mascara");
    expect(tipoPeloNome("Máscara hidratante noturna")).toBe("mascara");
    expect(tipoPeloNome("Contorno dos olhos")).toBe("olhos");
    expect(tipoPeloNome("Creme para olheiras")).toBe("olhos");
    expect(tipoPeloNome("Protetor solar FPS 50")).toBe("protetor"); // o de sempre continua
    expect(passoDigitado("Protetor labial", "manha").isSunscreen).toBeUndefined(); // não vira o "OBRIGATÓRIO" do rosto
    for (const t of ["labios", "mascara", "olhos"] as const) {
      const lista = indicadosPara(CATALOGO, t);
      expect(lista.length, t).toBeGreaterThanOrEqual(3);
      expect(lista.every((p) => p.categoria === t), t).toBe(true);
    }
  });

  it("PAO sem rótulo = padrão da categoria, marcado; PAO da página traz de onde veio", () => {
    for (const p of CATALOGO) {
      if (p.paoPadrao) expect(p.pao, p.id).toBe(PAO_PADRAO[p.categoria]);
      else expect(p.fontePao, p.id).toBeTruthy();
    }
  });

  it("todo tipo de passo que o gerador cria tem pelo menos 3 indicados; busca por marca acha", () => {
    const tiposDoGerador: TipoDoPasso[] = ["limpeza", "hidratante", "protetor", ...(Object.keys(ATIVO_DO_TIPO) as TipoDoPasso[])];
    for (const t of tiposDoGerador) expect(indicadosPara(CATALOGO, t).length, t).toBeGreaterThanOrEqual(3);
    expect(buscarProdutos(CATALOGO, "anthelios").every((p) => /anthelios/i.test(p.nome))).toBe(true);
    // "cor" (o termo mais buscado): os COM cor primeiro, "Sem Cor" pro fim; "fluido" acha pela textura
    const comCor = buscarProdutos(CATALOGO, "cor", "oleosa", [], 30, "protetor");
    expect(comCor.slice(0, 5).every((p) => p.cor)).toBe(true);
    const primeiroSemCor = comCor.findIndex((p) => /sem cor/i.test(p.nome));
    if (primeiroSemCor >= 0) expect(comCor.slice(primeiroSemCor).every((p) => !p.cor)).toBe(true);
    expect(buscarProdutos(CATALOGO, "protetor fluido", undefined, undefined, 50).every((p) => p.textura === "fluido" || /fluid/i.test(p.nome))).toBe(true);
    // no passo do hidratante, "cerave hidratante" traz o HIDRATANTE antes da loção de limpeza
    expect(buscarProdutos(CATALOGO, "cerave hidratante", undefined, undefined, 30, "hidratante")[0].categoria).toBe("hidratante");
  });

  it("quem evita um ingrediente vê o produto com ele por último", () => {
    const comSalicilico = indicadosPara(CATALOGO, "acido-salicilico", "oleosa", ["ácido salicílico"]);
    expect(comSalicilico.length).toBeGreaterThan(0); // todos têm: continuam na lista, marcados
    const hidratantes = indicadosPara(CATALOGO, "hidratante", "oleosa", ["niacinamida"]);
    const primeiroComNiacinamida = hidratantes.findIndex((p) => p.ativos.includes("niacinamida"));
    expect(hidratantes.slice(primeiroComNiacinamida).every((p) => p.ativos.includes("niacinamida"))).toBe(true);
  });
});
