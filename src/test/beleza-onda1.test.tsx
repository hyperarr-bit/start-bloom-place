/**
 * BELEZA — ONDA 1 do "módulo completo" (28/09, decisões do dono): abas SKINCARE ·
 * CABELO · MEUS PRODUTOS · CUIDADOS. Cada teste monta a peça real e confere o DADO
 * gravado (formato das chaves de conta real), não só a tela.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
  },
}));

import Beleza from "@/pages/Beleza";
import {
  CHAVE_LAVAGENS, CHAVE_PERFIL_CABELO, CHAVE_PLANO_CABELO, DIAS_ENTRE_RECONSTRUCOES, agendaCapilar, criarPlano, diasEntre, estadoDaFila,
  etapaDaVez, gerarCronograma, lavagensNoCiclo, lerDadosDoCabelo, perfilDasRespostas, planejarCabelo, proximaLavagem, ritmoDaFrequencia,
  type LavagemCapilar, type PlanoCapilar,
} from "@/lib/beleza-cabelo";
import { BASES_LEMBRETES } from "@/lib/notificacoes";

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
beforeEach(() => { toastMock.mockClear(); toastMock.error.mockClear(); toastMock.success.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

const HOJE = localDayKey();

/** Store reativo: gravar re-renderiza (a Beleza lê as chaves direto do store). */
const criarStoreReativo = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
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
  const montar = (ui: ReactNode, rota = "/beleza") => render(<MemoryRouter initialEntries={[rota]}><Provider>{ui}</Provider></MemoryRouter>);
  return { dados, montar };
};

/* ═════════════════════════════ ABAS ═════════════════════════════ */

describe("Abas: ROTINA virou SKINCARE e o DIÁRIO virou 'Fotos da pele'", () => {
  const comFoto = {
    "skincare-diary": [
      { id: "d1", date: HOJE, skinStatus: "boa", mood: "😊", notes: "Pele calma depois do retinol", photoUrl: "https://x/foto-1.webp" },
      { id: "d2", date: "2026-09-01", skinStatus: "acne", mood: "😐", notes: "Espinha no queixo", photoUrl: "https://x/foto-2.webp" },
    ],
  };

  it("não existe mais aba ROTINA nem DIÁRIO; as fotos de quem já tinha aparecem em SKINCARE, mesma chave", () => {
    const store = criarStoreReativo(comFoto);
    store.montar(<Beleza />);
    expect(screen.getByRole("button", { name: /SKINCARE/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^✨\s*ROTINA$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /DIÁRIO/ })).not.toBeInTheDocument();
    const fotos = screen.getByTestId("fotos-da-pele");
    expect(within(fotos).getByRole("heading", { name: /FOTOS DA PELE/ })).toBeInTheDocument();
    expect(within(fotos).getByText("Pele calma depois do retinol")).toBeInTheDocument();
    expect(within(fotos).getByText("Espinha no queixo")).toBeInTheDocument();
    expect(within(fotos).getByText(/2 registros • 2 fotos/)).toBeInTheDocument();
    // abrir não grava nada
    expect(store.dados["skincare-diary"]).toEqual(comFoto["skincare-diary"]);
  });

  it("o link antigo (?aba=diario) abre SKINCARE com as fotos; ?aba=produtos abre MEUS PRODUTOS", () => {
    const a = criarStoreReativo(comFoto);
    const t = a.montar(<Beleza />, "/beleza?aba=diario");
    expect(screen.getByRole("button", { name: /SKINCARE/ }).className).toMatch(/notion-tab-active/);
    expect(screen.getByTestId("fotos-da-pele")).toBeInTheDocument();
    t.unmount();
    criarStoreReativo({}).montar(<Beleza />, "/beleza?aba=produtos");
    expect(screen.getByRole("button", { name: /MEUS PRODUTOS/ }).className).toMatch(/notion-tab-active/);
    expect(screen.queryByTestId("fotos-da-pele")).not.toBeInTheDocument();
  });
});

/* ═════════════════════════════ F1 — CABELO ═════════════════════════════ */

/** 28/09/2026 é segunda. */
const SEG = "2026-09-28";
const fixarHoje = (dia = SEG, hora = 10) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const [a, m, d] = dia.split("-").map(Number);
  vi.setSystemTime(new Date(a, m - 1, d, hora, 0));
};
const conta = <T,>(lista: T[], x: T) => lista.filter((y) => y === x).length;
const lavou = (plano: PlanoCapilar, data: string, etapa: LavagemCapilar["etapa"], extra: Partial<LavagemCapilar> = {}): LavagemCapilar => ({
  id: `l-${data}-${Math.random().toString(36).slice(2, 6)}`, data, etapa, noPlano: true, plano: plano.id, feita: true,
  passos: [], extras: [], produtos: {}, tags: [], nota: "", ...extra,
});

describe("CABELO — o gerador do cronograma (4 semanas)", () => {
  it("frequência: 3×/semana = 12 lavagens (seg, qua, sex); 'a cada 3 dias' = 9", () => {
    expect(lavagensNoCiclo({ porSemana: 3 })).toBe(12);
    expect(lavagensNoCiclo({ intervaloDias: 3 })).toBe(9);
    expect(ritmoDaFrequencia({ porSemana: 3 })).toEqual({ tipo: "semana", dias: [0, 2, 4] });
    expect(ritmoDaFrequencia({ intervaloDias: 3 })).toEqual({ tipo: "intervalo", dias: 3 });
  });

  it("porosidade média, sem química: 1 reconstrução fechando o ciclo; hidratação é a maioria", () => {
    const seq = gerarCronograma({ curvaturas: ["ondulado"], quimica: "nenhuma", porosidade: "media", frequencia: { porSemana: 3 } });
    expect(seq).toHaveLength(12);
    expect(conta(seq, "reconstrucao")).toBe(1);
    expect(seq[11]).toBe("reconstrucao");
    expect(conta(seq, "hidratacao")).toBeGreaterThan(conta(seq, "nutricao"));
    expect(seq[0]).toBe("hidratacao");
  });

  it("porosidade alta ou descoloração: 2 reconstruções (meio e fim); 1×/semana nunca passa de 1", () => {
    const alta = gerarCronograma({ curvaturas: ["liso"], quimica: "nenhuma", porosidade: "alta", frequencia: { porSemana: 3 } });
    expect(conta(alta, "reconstrucao")).toBe(2);
    const desc = gerarCronograma({ curvaturas: ["liso"], quimica: "descoloracao", porosidade: "baixa", frequencia: { porSemana: 2 } });
    expect(conta(desc, "reconstrucao")).toBe(2);
    const umaVez = gerarCronograma({ curvaturas: ["crespo"], quimica: "descoloracao", porosidade: "alta", frequencia: { porSemana: 1 } });
    expect(umaVez).toHaveLength(4);
    expect(conta(umaVez, "reconstrucao")).toBe(1);
  });

  it("cacho e crespo puxam pra nutrição; liso e porosidade baixa, pra hidratação", () => {
    const base = { quimica: "nenhuma" as const, porosidade: "media" as const, frequencia: { porSemana: 3 } };
    const cacho = gerarCronograma({ ...base, curvaturas: ["cacheado"] });
    const liso = gerarCronograma({ ...base, curvaturas: ["liso"] });
    expect(conta(cacho, "nutricao")).toBeGreaterThan(conta(liso, "nutricao"));
    const baixa = gerarCronograma({ ...base, curvaturas: ["liso"], porosidade: "baixa" });
    expect(conta(baixa, "hidratacao")).toBeGreaterThanOrEqual(3 * conta(baixa, "nutricao"));
  });

  it("as respostas do teste de porosidade viram a porosidade do perfil (calculatePorosity)", () => {
    const r = { curvaturas: ["cacheado", "crespo", "liso"] as never, quimica: "transicao" as const, frequencia: { intervaloDias: 3 } };
    expect(perfilDasRespostas({ ...r, porosidade: [1, 1, 1] }, SEG)).toMatchObject({ porosidade: "baixa", curvaturas: ["cacheado", "crespo"] });
    expect(perfilDasRespostas({ ...r, porosidade: [2, 2, 2] }, SEG).porosidade).toBe("media");
    expect(perfilDasRespostas({ ...r, porosidade: [3, 3, 2] }, SEG).porosidade).toBe("alta");
  });
});

describe("CABELO — a fila: a etapa só anda com FEITO", () => {
  const perfil = perfilDasRespostas({ curvaturas: ["ondulado"], quimica: "nenhuma", frequencia: { porSemana: 3 }, porosidade: [2, 2, 2] }, SEG);
  const plano = criarPlano(perfil, SEG, "p1");
  const seq = plano.sequencia;

  it("começa hoje (segunda é dia de lavar) com a 1ª etapa; depois de FEITO, a próxima é quarta com a 2ª", () => {
    expect(agendaCapilar(plano, [], SEG)[0]).toMatchObject({ dia: SEG, etapa: seq[0] });
    const feita = [lavou(plano, SEG, seq[0])];
    expect(proximaLavagem(plano, feita, SEG)).toMatchObject({ dia: "2026-09-30", etapa: seq[1] });
  });

  it("pulou a quarta: na sexta a etapa ainda é a de quarta (o cronograma espera)", () => {
    const feita = [lavou(plano, SEG, seq[0])];
    expect(proximaLavagem(plano, feita, "2026-10-02")).toMatchObject({ dia: "2026-10-02", etapa: seq[1] });
  });

  it("lavagem fora do plano e lavagem começada (sem FEITO) não andam a fila", () => {
    const lavagens = [
      lavou(plano, SEG, seq[0]),
      lavou(plano, "2026-09-29", null, { noPlano: false }),
      lavou(plano, "2026-09-30", seq[1], { feita: false, passos: ["shampoo"] }),
    ];
    expect(estadoDaFila(plano, lavagens).feitasNoCiclo).toBe(1);
    expect(proximaLavagem(plano, lavagens, "2026-09-30")).toMatchObject({ dia: "2026-09-30", etapa: seq[1] });
  });

  it("refazer o cronograma (plano novo) começa a fila do zero", () => {
    const novo = { ...plano, id: "p2" };
    expect(estadoDaFila(novo, [lavou(plano, SEG, seq[0])]).feitasNoCiclo).toBe(0);
  });

  it("fim do ciclo: a fila recomeça (ciclo 2)", () => {
    const lavagens = seq.map((e, i) => lavou(plano, `2026-10-${String(i + 1).padStart(2, "0")}`, e));
    const est = estadoDaFila(plano, lavagens);
    expect(est.ciclo).toBe(2);
    expect(est.fila).toEqual(seq);
  });

  it(`reconstrução nunca a menos de ${DIAS_ENTRE_RECONSTRUCOES} dias da anterior: a R espera e a próxima etapa passa na frente`, () => {
    const v = etapaDaVez(["reconstrucao", "hidratacao"], seq, "2026-09-20", SEG);
    expect(v).toMatchObject({ etapa: "hidratacao", rEspera: true });
    expect(etapaDaVez(["reconstrucao", "hidratacao"], seq, "2026-09-10", SEG).etapa).toBe("reconstrucao");
    // porosidade alta, 3×/semana, 2 R por ciclo: em 60 dias de agenda, R sempre a ≥ 15 dias uma da outra
    const alta = criarPlano(perfilDasRespostas({ curvaturas: ["liso"], quimica: "descoloracao", frequencia: { porSemana: 3 }, porosidade: [3, 3, 3] }, SEG), SEG, "p3");
    const rs = agendaCapilar(alta, [], SEG, 60).filter((a) => a.etapa === "reconstrucao").map((a) => a.dia);
    expect(rs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < rs.length; i++) expect(diasEntre(rs[i - 1], rs[i])).toBeGreaterThanOrEqual(DIAS_ENTRE_RECONSTRUCOES);
  });

  it("'a cada 3 dias' conta a partir da ÚLTIMA lavagem feita; atrasou, a próxima é hoje", () => {
    const p = criarPlano({ ...perfil, frequencia: { intervaloDias: 3 } }, SEG, "p4");
    expect(agendaCapilar(p, [lavou(p, SEG, p.sequencia[0])], SEG).map((a) => a.dia).slice(0, 2)).toEqual(["2026-10-01", "2026-10-04"]);
    expect(proximaLavagem(p, [lavou(p, SEG, p.sequencia[0])], "2026-10-06")?.dia).toBe("2026-10-06");
  });

  it("MEU MÊS: mudar uma lavagem de dia (qua → qui) move só ela", () => {
    const movido = { ...plano, trocas: { "2026-09-30": "2026-10-01" } };
    expect(agendaCapilar(movido, [], SEG).map((a) => a.dia).slice(0, 4)).toEqual([SEG, "2026-10-01", "2026-10-02", "2026-10-05"]);
  });
});

describe("CABELO — lembrete (nasce desligado, faixa própria)", () => {
  const perfil = perfilDasRespostas({ curvaturas: ["cacheado"], quimica: "coloracao", frequencia: { porSemana: 3 }, porosidade: [2, 2, 2] }, SEG);
  const plano = criarPlano(perfil, SEG, "p1");

  it("sem ligar, nada é agendado", () => {
    const d = lerDadosDoCabelo(<T,>(k: string, f: T) => ({ [CHAVE_PLANO_CABELO]: plano } as Record<string, unknown>)[k] as T ?? f);
    expect(d.prefs.dia.ligado).toBe(false);
    expect(d.prefs.vespera.ligado).toBe(false);
    expect(planejarCabelo(d, BASES_LEMBRETES.cabelo, new Date(2026, 8, 28, 7, 0))).toEqual([]);
  });

  it("ligado: aviso no dia de lavar às 08:30 com a etapa, e na véspera às 20:30; ids na faixa 1710000", () => {
    const avisos = planejarCabelo(
      { prefs: { dia: { ligado: true, hora: "08:30" }, vespera: { ligado: true, hora: "20:30" } }, plano, lavagens: [] },
      BASES_LEMBRETES.cabelo, new Date(2026, 8, 28, 7, 0),
    );
    expect(avisos[0].quando).toEqual(new Date(2026, 8, 28, 8, 30));
    expect(avisos[0].title).toMatch(/Hoje é dia de (HIDRATAÇÃO|NUTRIÇÃO|RECONSTRUÇÃO)/);
    expect(avisos[1].quando).toEqual(new Date(2026, 8, 29, 20, 30)); // véspera de quarta
    expect(avisos[1].body).toMatch(/Umectação/);
    expect(avisos.every((a) => a.id >= 1710000 && a.id < 1720000)).toBe(true);
    expect(BASES_LEMBRETES.cabelo).toBe(1710000);
  });
});

describe("CABELO — a aba: 4 perguntas → cronograma → cabelo de hoje", () => {
  it("responde as 4 perguntas, grava as chaves novas e mostra o CABELO DE HOJE com a etapa", () => {
    fixarHoje();
    const store = criarStoreReativo({});
    store.montar(<Beleza />, "/beleza?aba=cabelo");
    expect(screen.getByRole("button", { name: /CABELO/ }).className).toMatch(/notion-tab-active/);
    fireEvent.click(screen.getByTestId("curva-ondulado"));
    fireEvent.click(screen.getByTestId("curva-cacheado"));
    fireEvent.click(screen.getByTestId("continuar-curva"));
    fireEvent.click(screen.getByTestId("quimica-coloracao"));
    fireEvent.click(screen.getByTestId("modo-intervalo"));
    fireEvent.click(screen.getByTestId("freq-3"));
    expect(screen.getByTestId("frase-frequencia")).toHaveTextContent("Lavo a cada 3 dias");
    fireEvent.click(screen.getByTestId("continuar-frequencia"));
    fireEvent.click(screen.getByTestId("poro-0-2"));
    fireEvent.click(screen.getByTestId("poro-1-2"));
    fireEvent.click(screen.getByTestId("poro-2-3"));
    fireEvent.click(screen.getByTestId("montar-cronograma-pronto"));

    // 2 + 2 + 3 = 7 → porosidade ALTA (calculatePorosity: até 3 baixa, até 6 média)
    expect(store.dados[CHAVE_PERFIL_CABELO]).toMatchObject({ curvaturas: ["ondulado", "cacheado"], quimica: "coloracao", frequencia: { intervaloDias: 3 }, porosidade: "alta", respostasPorosidade: [2, 2, 3] });
    const plano = store.dados[CHAVE_PLANO_CABELO] as PlanoCapilar;
    expect(plano).toMatchObject({ ritmo: { tipo: "intervalo", dias: 3 }, inicio: SEG });
    expect(plano.sequencia).toHaveLength(9);
    expect(screen.getByTestId("cronograma-pronto")).toHaveTextContent(/em 4 semanas/);
    // a cada 3 dias, o dia 1 é hoje
    expect(screen.getByTestId("status-cabelo")).toHaveTextContent(/Dia de (HIDRATAÇÃO|NUTRIÇÃO)/);
    expect(screen.getAllByTestId("passo-cabelo")).toHaveLength(5);
  });

  it("marcar passo guarda a lavagem começada; FEITO anda a fila; 'fora do plano' registra sem andar", () => {
    fixarHoje();
    const perfil = perfilDasRespostas({ curvaturas: ["liso"], quimica: "nenhuma", frequencia: { porSemana: 3 }, porosidade: [2, 2, 2] }, SEG);
    const plano = criarPlano(perfil, SEG, "p1");
    const store = criarStoreReativo({ [CHAVE_PERFIL_CABELO]: perfil, [CHAVE_PLANO_CABELO]: plano });
    store.montar(<Beleza />, "/beleza?aba=cabelo");
    const hoje = within(screen.getByTestId("cabelo-de-hoje"));
    fireEvent.click(hoje.getByRole("checkbox", { name: "Marcar Shampoo" }));
    let lav = store.dados[CHAVE_LAVAGENS] as LavagemCapilar[];
    expect(lav).toHaveLength(1);
    expect(lav[0]).toMatchObject({ data: SEG, noPlano: true, plano: "p1", feita: false, passos: ["shampoo"], etapa: plano.sequencia[0] });
    fireEvent.click(hoje.getByTestId("tag-brilho"));
    fireEvent.click(hoje.getByTestId("lavagem-feita"));
    lav = store.dados[CHAVE_LAVAGENS] as LavagemCapilar[];
    expect(lav[0]).toMatchObject({ feita: true, tags: ["brilho"] });
    expect(hoje.getByTestId("status-cabelo")).toHaveTextContent(/feita/);
    expect(hoje.getByTestId("proxima-depois")).toHaveTextContent(new RegExp(`qua · ${plano.sequencia[1] === "nutricao" ? "NUTRIÇÃO" : "HIDRATAÇÃO"}`));

    // ontem (domingo) não era dia: "lavei fora do plano" registra sem mexer na fila
    fireEvent.click(hoje.getByRole("button", { name: "ONTEM" }));
    fireEvent.click(hoje.getAllByTestId("lavei-fora")[0]);
    fireEvent.click(hoje.getByTestId("salvar-fora"));
    lav = store.dados[CHAVE_LAVAGENS] as LavagemCapilar[];
    expect(lav.find((l) => l.data === "2026-09-27")).toMatchObject({ noPlano: false, feita: true, etapa: null });
    expect(estadoDaFila(plano, lav).feitasNoCiclo).toBe(1);
  });
});
