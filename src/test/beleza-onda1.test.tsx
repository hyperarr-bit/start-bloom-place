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
import {
  CHAVE_CUIDADOS, MODELOS, faltaDoCuidado, gastoNoMes, marcarFeito, marcarHorario, noMesCorrente, novoCuidado, ordenarCuidados,
  planejarCuidados, proximaDoCuidado, textoDaFalta, textoDoPacote, type Cuidado,
} from "@/lib/beleza-cuidados";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { ExpenseTable } from "@/components/ExpenseTable";
import { ProximosCompromissos } from "@/components/rotina/Compromissos";

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

/* ═════════════════════════════ F2 — CUIDADOS ═════════════════════════════ */

describe("CUIDADOS — a próxima data (intervalos do dono, editáveis)", () => {
  it("modelos com os intervalos padrão: unha 7, gel 21, sobrancelha 21, cera 28, laser 45 (com pacote), raiz 35", () => {
    const dias = Object.fromEntries(MODELOS.map((m) => [m.tipo, m.intervaloDias]));
    expect(dias).toEqual({ unha: 7, "unha-gel": 21, sobrancelha: 21, cera: 28, laser: 45, raiz: 35 });
    expect(novoCuidado("laser", "x").pacote).toEqual({ total: 10, feitas: 0 });
    expect(novoCuidado("unha", "x")).toMatchObject({ avisoLigado: false, avisoDiasAntes: 2, historico: [] });
  });

  it("próxima = última + intervalo; o horário marcado manda; FALTA em palavras; a tabela põe o atrasado no topo", () => {
    const unha = { ...novoCuidado("unha", "a"), ultima: "2026-09-21" };
    const sobr = { ...novoCuidado("sobrancelha", "b"), ultima: "2026-09-09" };
    const raiz = { ...novoCuidado("raiz", "c"), ultima: "2026-08-16" };
    const novo = novoCuidado("cera", "d");
    expect(proximaDoCuidado(unha)).toBe(SEG);
    expect(textoDaFalta(faltaDoCuidado(unha, SEG))).toBe("hoje");
    expect(textoDaFalta(faltaDoCuidado(sobr, SEG))).toBe("2 dias");
    expect(textoDaFalta(faltaDoCuidado(raiz, SEG))).toBe("venceu há 8 dias");
    expect(proximaDoCuidado(novo)).toBeUndefined();
    expect(ordenarCuidados([sobr, novo, unha, raiz], SEG).map((c) => c.id)).toEqual(["c", "a", "b", "d"]);
    expect(proximaDoCuidado({ ...sobr, horario: { data: "2026-10-03", hora: "10:00", compromissoId: "k" } })).toBe("2026-10-03");
  });

  it("FEITO: vira a última, entra no histórico com preço e local, conta a sessão do pacote e cumpre o horário", () => {
    const laser = { ...novoCuidado("laser", "l"), ultima: "2026-08-20", local: "Espaço Laser", pacote: { total: 10, feitas: 4 }, horario: { data: SEG, hora: "15:30", compromissoId: "k" } };
    const depois = marcarFeito(laser, SEG, { preco: 89.9 });
    expect(depois).toMatchObject({ ultima: SEG, preco: 89.9, pacote: { total: 10, feitas: 5 } });
    expect(depois.horario).toBeUndefined();
    expect(depois.historico).toEqual([{ data: SEG, preco: 89.9, local: "Espaço Laser" }]);
    expect(proximaDoCuidado(depois)).toBe("2026-11-12"); // 28/09 + 45
    expect(textoDoPacote(depois.pacote)).toBe("sessão 6 de 10");
    // feito num dia ANTERIOR à última não volta a "última" pra trás
    expect(marcarFeito({ ...novoCuidado("unha", "u"), ultima: SEG, historico: [] }, "2026-09-20").ultima).toBe(SEG);
  });

  it("gasto do mês por cuidado ('R$ 180 com unha em setembro')", () => {
    const unha = { ...novoCuidado("unha", "a"), historico: ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"].map((data) => ({ data, preco: 45 })) };
    expect(gastoNoMes(unha, "2026-09")).toEqual({ total: 135, vezes: 3 });
    expect(noMesCorrente("2026-09-02", SEG)).toBe(true);
    expect(noMesCorrente("2026-08-31", SEG)).toBe(false);
  });

  it("aviso sem horário: desligado não agenda; ligado, 2 dias antes às 09:00; com horário marcado, quem avisa é o compromisso", () => {
    const sobr = { ...novoCuidado("sobrancelha", "b"), ultima: "2026-09-09" }; // próxima 30/09
    const agora = new Date(2026, 8, 27, 20, 0);
    expect(planejarCuidados([sobr], BASES_LEMBRETES.cuidados, agora)).toEqual([]);
    const avisos = planejarCuidados([{ ...sobr, avisoLigado: true }], BASES_LEMBRETES.cuidados, agora);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ quando: new Date(2026, 8, 28, 9, 0), title: "✏️ Sobrancelha em 2 dias", id: 1720000 });
    expect(planejarCuidados([{ ...sobr, avisoLigado: true, horario: { data: "2026-09-30", hora: "10:00", compromissoId: "k" } }], BASES_LEMBRETES.cuidados, agora)).toEqual([]);
    expect(BASES_LEMBRETES.cuidados).toBe(1720000);
  });

  it("MARQUEI HORÁRIO: um compromisso da Rotina (origem beleza); marcar de novo troca o mesmo, sem duplicar", () => {
    const laser = { ...novoCuidado("laser", "l", "Laser axila"), local: "Espaço Laser", pacote: { total: 10, feitas: 4 } };
    const r1 = marcarHorario(laser, [], "2026-10-02", "15:30", 1440, "c1");
    expect(r1.compromissos).toHaveLength(1);
    expect(r1.compromissos[0]).toMatchObject({ id: "c1", titulo: "Laser axila · sessão 5 de 10", data: "2026-10-02", hora: "15:30", aviso: 1440, local: "Espaço Laser", origem: "beleza", ref: "l" });
    const r2 = marcarHorario(r1.cuidado, [...r1.compromissos, { id: "outro", titulo: "Dentista", data: "2026-10-05", hora: "09:00" }], "2026-10-03", "10:00", 60, "c2");
    expect(r2.compromissos.map((c) => c.id).sort()).toEqual(["c1", "outro"]);
    expect(r2.cuidado.horario).toEqual({ data: "2026-10-03", hora: "10:00", compromissoId: "c1" });
  });
});

describe("CUIDADOS — a aba: FEITO → gasto nas Finanças; marquei horário → compromisso na Rotina", () => {
  it("adiciona sobrancelha, FEITO hoje com R$ 60 e 1 toque lança em Finanças · Beleza (perfil ativo, mês corrente) — e o gasto aparece na tabela de gastos", () => {
    fixarHoje();
    const store = criarStoreReativo({ "finance-perfil-ativo": "acme", "finance-expenses": [{ id: "antigo", description: "Mercado", value: 200, category: "mercado", date: "2026-09-02", paymentMethod: "pix" }] });
    store.montar(<Beleza />, "/beleza?aba=cuidados");
    expect(screen.getByRole("button", { name: /CUIDADOS/ }).className).toMatch(/notion-tab-active/);
    fireEvent.click(screen.getByTestId("modelo-sobrancelha"));
    const ficha = within(screen.getByTestId("ficha-cuidado"));
    fireEvent.change(ficha.getByLabelText("Preço"), { target: { value: "60,00" } });
    fireEvent.click(ficha.getByTestId("cuidado-feito"));
    const cuidados = store.dados[CHAVE_CUIDADOS] as Cuidado[];
    expect(cuidados[0]).toMatchObject({ tipo: "sobrancelha", ultima: SEG, preco: 60, historico: [{ data: SEG, preco: 60 }] });
    expect(ficha.getByTestId("feito-ok")).toHaveTextContent(/Próxima: .*19\/10/);
    // nada vai pra Finanças sozinho
    expect((store.dados["finance-expenses"] as unknown[]).length).toBe(1);
    fireEvent.click(ficha.getByTestId("lancar-financas"));
    const gastos = store.dados["finance-expenses"] as Record<string, unknown>[];
    expect(gastos).toHaveLength(2);
    expect(gastos[1]).toMatchObject({ description: "Sobrancelha", value: 60, category: "beleza", date: SEG, perfil: "acme", paymentMethod: "pix" });
    // aparece em Finanças: a tabela de gastos do mês mostra o lançamento na categoria Beleza
    const { unmount } = render(<UserDataContext.Provider value={{ get: <T,>(k: string, f: T) => (k in store.dados ? (store.dados[k] as T) : f), set: () => {}, loaded: true, isGuest: true, fetchKey: async () => null }}><ExpenseTable expenses={gastos as never} setExpenses={() => {}} mes="2026-09" /></UserDataContext.Provider>);
    const linha = screen.getByRole("button", { name: "Editar Sobrancelha" });
    expect(within(linha).getByText("Beleza")).toBeInTheDocument();
    unmount();
  });

  it("feito num dia do mês passado: registra, mas não oferece o balde deste mês", () => {
    fixarHoje();
    const store = criarStoreReativo({ [CHAVE_CUIDADOS]: [{ ...novoCuidado("unha", "u1"), ultima: "2026-08-20", preco: 45 }] });
    store.montar(<Beleza />, "/beleza?aba=cuidados");
    fireEvent.click(screen.getByTestId("linha-cuidado"));
    const ficha = within(screen.getByTestId("ficha-cuidado"));
    fireEvent.click(ficha.getByRole("button", { name: "Foi outro dia" }));
    fireEvent.change(ficha.getByTestId("dia-feito"), { target: { value: "2026-08-27" } });
    fireEvent.click(ficha.getByTestId("cuidado-feito-outro"));
    expect((store.dados[CHAVE_CUIDADOS] as Cuidado[])[0]).toMatchObject({ ultima: "2026-08-27" });
    expect(ficha.getByTestId("oferta-fora-do-mes")).toBeInTheDocument();
    expect(ficha.queryByTestId("lancar-financas")).not.toBeInTheDocument();
    expect(store.dados["finance-expenses"]).toBeUndefined();
  });

  it("MARQUEI HORÁRIO grava o compromisso e ele aparece nos PRÓXIMOS COMPROMISSOS da Rotina", () => {
    fixarHoje();
    const store = criarStoreReativo({ [CHAVE_CUIDADOS]: [{ ...novoCuidado("sobrancelha", "s1"), ultima: "2026-09-09", local: "Studio Bela" }] });
    store.montar(<Beleza />, "/beleza?aba=cuidados");
    fireEvent.click(screen.getByTestId("linha-cuidado"));
    const ficha = within(screen.getByTestId("ficha-cuidado"));
    fireEvent.click(ficha.getByTestId("marquei-horario"));
    fireEvent.change(ficha.getByTestId("horario-dia"), { target: { value: "2026-09-30" } });
    fireEvent.change(ficha.getByTestId("horario-hora"), { target: { value: "10:30" } });
    fireEvent.click(ficha.getByTestId("salvar-horario"));
    const compromissos = store.dados[CHAVE_COMPROMISSOS] as Compromisso[];
    expect(compromissos).toHaveLength(1);
    expect(compromissos[0]).toMatchObject({ titulo: "Sobrancelha", data: "2026-09-30", hora: "10:30", local: "Studio Bela", origem: "beleza", ref: "s1" });
    expect((store.dados[CHAVE_CUIDADOS] as Cuidado[])[0].horario).toMatchObject({ data: "2026-09-30", hora: "10:30", compromissoId: compromissos[0].id });
    // a Rotina lê a mesma chave: o compromisso está lá
    store.montar(<ProximosCompromissos lista={compromissos} onChange={() => {}} onAbrirDia={() => {}} />);
    expect(within(screen.getByTestId("proximos-compromissos")).getByText(/Sobrancelha/)).toBeInTheDocument();
  });
});
