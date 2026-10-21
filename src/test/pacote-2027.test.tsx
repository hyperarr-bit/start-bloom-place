/**
 * O PACOTE "SEU 2027" DENTRO DO APP (21/10).
 *   · o motor puro: plano tolerante, o que vai pra cada módulo (dono = prefixo p27-/criadasMetas; salvar de novo não
 *     duplica nem apaga o que é da pessoa), as 12 revisões (abrem no dia 1; 5 tarefas com destino), o cofrinho (1.378);
 *   · o Planner 2027 em HTML (as páginas e os dados da pessoa, sem prometer o que não existe);
 *   · a aba: sem a chave nada aparece; com a chave, a explicação na 1ª abertura (gravada na conta) e ela NÃO volta ao
 *     reabrir; Planejar 2027 em 4 folhas grava nos módulos; revisão do mês trancada antes do dia 1; cofrinho marcável;
 *   · a página Dev. Pessoal só ganha a aba com a chave.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useMemo, useRef, useState } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com" }, isSubscribed: true, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig()), trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { trackEvent } from "@/lib/analytics";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { Pacote2027 } from "@/components/pacote-2027/Pacote2027";
import {
  CHAVE_COFRINHO_2027, CHAVE_DICA_2027, CHAVE_PACOTE_2027, CHAVE_PLANO_2027, TOTAL_COFRINHO, aplicarPlano2027, alternarSemana,
  idDaRevisao, lerCofrinho, lerPlano2027, mesAberto, mesDaVez, novoPlano2027, pacote2027Liberado, semanasDoMes, tarefasDoMes,
  totalGuardado, valorDaSemana, type Plano2027,
} from "@/lib/pacote-2027";
import { htmlDoPlanner2027, AREAS_DO_PLANNER } from "@/lib/pacote-2027-pdf";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";

beforeAll(() => { Element.prototype.scrollIntoView = () => {}; });
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); vi.mocked(trackEvent).mockClear(); });

const quando = (a: number, m: number, d: number, h = 10) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(a, m - 1, d, h, 0));
};
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);

type Controle = { dados: () => Record<string, unknown>; sistema: string[] };
const novoControle = (): Controle => ({ dados: () => ({}), sistema: [] });
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown, opts?: { system?: boolean }) => {
    ref.current = { ...ref.current, [k]: v };
    if (opts?.system) controle.sistema.push(k);
    setStore((prev) => ({ ...prev, [k]: v }));
  }, [controle]);
  controle.dados = () => ref.current;
  const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }) as unknown as UserDataContextType, [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const COMPRADO = { [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-21T15:00:00-03:00", pedido: "qr_1" } };
const montar = (inicial: Record<string, unknown>, c = novoControle()) => {
  const r = render(
    <MemoryRouter initialEntries={["/desenvolvimento?tab=2027"]}>
      <Provedor inicial={inicial} controle={c}>
        <Routes>
          <Route path="/desenvolvimento" element={<Pacote2027 />} />
          <Route path="/financas" element={<div data-testid="rota-financas" />} />
          <Route path="/retrospectiva" element={<div data-testid="rota-retro" />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return { c, ...r };
};

/* ───────────────────────── o motor ───────────────────────── */

describe("o motor do pacote", () => {
  it("liberação: só comprado === true", () => {
    expect(pacote2027Liberado({ comprado: true })).toBe(true);
    expect(pacote2027Liberado({ comprado: "sim" })).toBe(false);
    expect(pacote2027Liberado(null)).toBe(false);
  });
  it("plano tolerante: lixo vira plano vazio; datas fora de 2027 e horas inválidas caem", () => {
    expect(lerPlano2027(null)).toEqual(novoPlano2027());
    const p = lerPlano2027({ metas: ["a", 3], gastarMes: "3200", datas: [{ id: "x", tipo: "checkup", titulo: "Check-up", dia: "2027-02-10" }, { id: "y", tipo: "data", titulo: "velha", dia: "2026-05-01" }], horaRevisao: "25:00" });
    expect(p.metas).toEqual(["a", "", ""]);
    expect(p.gastarMes).toBe(3200);
    expect(p.datas.map((d) => d.id)).toEqual(["x"]);
    expect(p.horaRevisao).toBe("20:00");
    expect(lerPlano2027({ horaRevisao: null }).horaRevisao).toBeNull();
  });
  it("aplicarPlano: metas com 4 trimestres e ano 2027; datas → Relações; check-up → Saúde; 12 revisões → Rotina; o resto intocado", () => {
    const p: Plano2027 = {
      ...novoPlano2027(), metas: ["Juntar R$ 5 mil", "Treinar 3x por semana", ""], gastarMes: 3200, guardarMes: 300,
      datas: [
        { id: "a", tipo: "aniversario", titulo: "Mãe", dia: "2027-03-14" },
        { id: "b", tipo: "checkup", titulo: "Check-up anual", dia: "2027-02-10" },
        { id: "c", tipo: "data", titulo: "IPVA", dia: "2027-01-20" },
      ],
      horaRevisao: "20:00",
    };
    const atuais = {
      goals: [{ id: "123", title: "Minha meta antiga", actionGroups: [] }], etiquetas: { "123": { tags: ["Pessoal"], ano: 2026, notas: "" } },
      relDates: [{ id: "r1", title: "Namoro", person: "", date: "2024-06-12", type: "anniversary" }],
      consultas: [{ id: "c1", doctor: "Dra. Lia", specialty: "Dermato", date: "2026-11-02", time: "", address: "", questions: "" }],
      compromissos: [{ id: "k1", titulo: "Pilates", data: "2026-10-20", hora: "07:00" }],
    };
    let n = 0;
    const r = aplicarPlano2027(p, atuais, () => `17990000000${n++}`);
    expect(r.goals).toHaveLength(3);
    expect(r.goals[0]).toEqual(atuais.goals[0]);
    const nova = r.goals[1] as { id: string; title: string; actionGroups: { label: string; tasks: unknown[] }[]; vision: { tempo: string } };
    expect(nova.title).toBe("Juntar R$ 5 mil");
    expect(nova.actionGroups.map((g) => g.label)).toEqual(["Jan–Mar 2027:", "Abr–Jun 2027:", "Jul–Set 2027:", "Out–Dez 2027:"]);
    expect(nova.vision.tempo).toBe("2027");
    expect(r.criadasMetas).toEqual(["179900000000", "179900000001"]);
    expect((r.etiquetas["179900000000"] as { ano: number }).ano).toBe(2027);
    expect(r.etiquetas["123"]).toEqual({ tags: ["Pessoal"], ano: 2026, notas: "" });
    expect(r.relDates.map((d) => d.id)).toEqual(["r1", "p27-a", "p27-c"]);
    expect(r.relDates[1]).toMatchObject({ title: "🎂 Aniversário: Mãe", date: "2027-03-14", type: "custom" });
    expect(r.consultas.map((c) => c.id)).toEqual(["c1", "p27-b"]);
    expect(r.consultas[1]).toMatchObject({ doctor: "Check-up anual", specialty: "Check-up", date: "2027-02-10", time: "" });
    expect(r.compromissos).toHaveLength(13);
    expect(r.compromissos[1]).toMatchObject({ id: idDaRevisao(1), data: "2027-01-01", hora: "20:00", aviso: 0, origem: "pacote-2027" });
    expect(r.compromissos[12]).toMatchObject({ id: "p27-rev-12", data: "2027-12-01" });

    // salvar DE NOVO (com o que foi criado): não duplica; meta que a pessoa mexeu não some; tirar data/hora tira só o do pacote
    const salvo = { ...p, criadasMetas: r.criadasMetas };
    const goalsEditados = r.goals.map((g) => (g.id === "179900000000" ? { ...g, problems: [{ id: "x", problem: "gasto com delivery", solution: "" }] } : g));
    const r2 = aplicarPlano2027({ ...salvo, metas: ["Juntar R$ 6 mil", "", "Ler 12 livros"], datas: salvo.datas.slice(0, 1), horaRevisao: null },
      { goals: goalsEditados, etiquetas: r.etiquetas, relDates: r.relDates, consultas: r.consultas, compromissos: r.compromissos }, () => "179900000009");
    expect(r2.goals).toHaveLength(4);
    expect(r2.goals.find((g) => g.id === "179900000000")).toMatchObject({ title: "Juntar R$ 6 mil", problems: [{ problem: "gasto com delivery" }] });
    expect(r2.goals.find((g) => g.id === "179900000001")).toMatchObject({ title: "Treinar 3x por semana" }); // apagou o texto: a meta fica
    expect(r2.criadasMetas).toEqual(["179900000000", "179900000001", "179900000009"]);
    expect(r2.relDates.map((d) => d.id)).toEqual(["r1", "p27-a"]);
    expect(r2.consultas.map((c) => c.id)).toEqual(["c1"]);
    expect(r2.compromissos.map((c) => c.id)).toEqual(["k1"]);
  });
  it("chave sincronizada nunca muda de tipo: entrada que não é lista vira lista, mapa vira mapa", () => {
    const r = aplicarPlano2027({ ...novoPlano2027(), metas: ["x", "", ""] }, { goals: "lixo", etiquetas: [], relDates: null, consultas: {}, compromissos: undefined });
    for (const v of [r.goals, r.relDates, r.consultas, r.compromissos]) expect(Array.isArray(v)).toBe(true);
    expect(Array.isArray(r.etiquetas)).toBe(false);
  });
  it("revisões: abrem no dia 1 de cada mês de 2027; antes de 2027 a da vez é janeiro", () => {
    expect(mesAberto(1, new Date(2026, 11, 31, 23, 59))).toBe(false);
    expect(mesAberto(1, new Date(2027, 0, 1, 0, 1))).toBe(true);
    expect(mesAberto(2, new Date(2027, 0, 31, 23, 0))).toBe(false);
    expect(mesDaVez(new Date(2026, 9, 21))).toBe(1);
    expect(mesDaVez(new Date(2027, 4, 9))).toBe(5);
    expect(mesDaVez(new Date(2028, 0, 2))).toBe(12);
  });
  it("as 5 tarefas do mês abrem a tela certa e usam o plano dela", () => {
    const p = { ...novoPlano2027(), metas: ["Juntar R$ 5 mil", "", ""], gastarMes: 3200, guardarMes: 300, datas: [{ id: "c", tipo: "data" as const, titulo: "IPVA", dia: "2027-01-20" }] };
    const t = tarefasDoMes(1, p);
    expect(t.map((x) => x.id)).toEqual(["olhar", "metas", "limites", "datas", "cofrinho"]);
    expect(t[0]).toMatchObject({ titulo: "Olhe o seu dezembro", destino: { rota: "/retrospectiva?mes=Dezembro" } });
    expect(t[1].destino).toMatchObject({ rota: "/desenvolvimento?tab=metas" });
    expect(t[1].como).toContain("Juntar R$ 5 mil");
    expect(t[2].como).toContain("R$ 3.200");
    expect(t[3].como).toContain("IPVA 20/01");
    expect(t[3].destino).toMatchObject({ rota: "/relacionamentos?aba=datas" });
    expect(t[4].destino).toMatchObject({ interno: "cofrinho" });
    expect(tarefasDoMes(3, p)[0].destino).toMatchObject({ rota: `/retrospectiva?mes=${encodeURIComponent("Fevereiro")}` });
    // texto honesto: nada de IA nem de promessa de resultado
    expect(JSON.stringify(Array.from({ length: 12 }, (_, i) => tarefasDoMes(i + 1, p))).toLowerCase()).not.toMatch(/\bia\b|intelig[eê]ncia artificial|garant/);
  });
  it("cofrinho: R$ 1 a R$ 52 = R$ 1.378; invertido; marcar e desmarcar; as 52 semanas cabem nos 12 meses", () => {
    expect(TOTAL_COFRINHO).toBe(1378);
    expect(valorDaSemana(1, false)).toBe(1);
    expect(valorDaSemana(1, true)).toBe(52);
    let c = lerCofrinho(null);
    c = alternarSemana(alternarSemana(alternarSemana(c, 3), 1), 2);
    expect(c.marcadas).toEqual([1, 2, 3]);
    expect(totalGuardado(c)).toBe(6);
    expect(totalGuardado({ ...c, invertido: true })).toBe(52 + 51 + 50);
    expect(alternarSemana(c, 2).marcadas).toEqual([1, 3]);
    expect(lerCofrinho({ marcadas: [0, 53, 5, 5, "x"] }).marcadas).toEqual([5]);
    const todas = Array.from({ length: 12 }, (_, i) => semanasDoMes(i + 1)).flat();
    expect(todas).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
  });
  it("as chaves do pacote são da CONTA (a vassoura pode levar; não são do aparelho)", () => {
    for (const k of [CHAVE_PACOTE_2027, CHAVE_PLANO_2027, CHAVE_COFRINHO_2027, CHAVE_DICA_2027]) {
      expect(ehChaveDoAparelho(k)).toBe(false);
      expect(vassouraLeva(k)).toBe(true);
    }
  });
});

describe("o Planner 2027 pra imprimir", () => {
  it("capa, calendário, metas, dinheiro, datas, cofrinho, revisão e as 16 áreas (2 por folha) — com os dados dela, escapados", () => {
    const p = { ...novoPlano2027(), metas: ["Juntar <R$ 5 mil>", "", ""], gastarMes: 3200, guardarMes: 300, datas: [{ id: "a", tipo: "aniversario" as const, titulo: "Mãe", dia: "2027-03-14" }] };
    const html = htmlDoPlanner2027(p, { marcadas: [1, 2], invertido: false }, new Date(2026, 9, 21));
    expect(AREAS_DO_PLANNER).toHaveLength(16);
    for (const s of ["Planner <em>2027</em>", "Minhas 3 metas de 2027", "Meu dinheiro em 2027", "As datas que importam", "Cofrinho das 52 semanas", "Revisão do mês", "As 16 áreas · 8 de 8"]) expect(html).toContain(s);
    for (const a of AREAS_DO_PLANNER) expect(html).toContain(a.nome);
    expect(html).toContain("Juntar &lt;R$ 5 mil&gt;");
    expect(html).not.toContain("<R$ 5 mil>");
    expect(html).toContain("R$ 3.200");
    expect(html).toContain("14/03");
    expect(html).toContain("R$ 1.378");
    expect((html.match(/class="pg"/g) ?? []).length).toBe(7 + 8);
    expect((html.match(/<div class="ok">/g) ?? []).length).toBe(2);
    expect(html).toContain("@page{size:A4");
  });
});

/* ───────────────────────── a aba ───────────────────────── */

describe("a aba SEU 2027", () => {
  it("sem a chave da conta: nada aparece", () => {
    montar({});
    expect(screen.queryByTestId("pacote-2027")).toBeNull();
    expect(screen.queryByTestId("pacote-2027-boas-vindas")).toBeNull();
    expect(document.body.textContent).toBe("");
  });

  it("1ª abertura: a explicação; 'Ver o pacote antes' grava na conta e ela NÃO volta ao reabrir", () => {
    quando(2026, 10, 21);
    const { c, unmount } = montar(COMPRADO);
    expect(screen.getByTestId("pacote-2027-boas-vindas")).toBeTruthy();
    expect(document.body.textContent).toContain("Seu ano inteiro, num lugar só");
    fireEvent.click(screen.getByTestId("pacote-2027-depois"));
    expect(c.dados()[CHAVE_DICA_2027]).toBe("true");
    expect(screen.getByTestId("pacote-2027")).toBeTruthy();
    unmount();
    // reabrir o app com o que ficou na conta
    montar({ ...c.dados() });
    expect(screen.queryByTestId("pacote-2027-boas-vindas")).toBeNull();
    expect(screen.getByTestId("pacote-2027")).toBeTruthy();
    expect(eventos("plano2027_aba_view").length).toBeGreaterThan(0);
  });

  it("Planejar 2027: 4 folhas → Salvar grava o plano e os módulos; reabrir mostra 'Planejado' e nada se repete", async () => {
    quando(2026, 10, 21);
    const { c, unmount } = montar({ ...COMPRADO, "goals-board-v2": [], "rotina-compromissos": [{ id: "k1", titulo: "Pilates", data: "2026-10-20", hora: "07:00" }] });
    fireEvent.click(screen.getByTestId("pacote-2027-comecar"));
    expect(screen.getByTestId("planejar-2027").getAttribute("data-passo")).toBe("1");
    fireEvent.change(screen.getByTestId("planejar-2027-meta-1"), { target: { value: "Juntar R$ 5 mil" } });
    fireEvent.click(screen.getByText("✈️ Fazer uma viagem"));
    expect((screen.getByTestId("planejar-2027-meta-2") as HTMLInputElement).value).toBe("Fazer uma viagem");
    fireEvent.click(screen.getByTestId("planejar-2027-proximo"));
    fireEvent.change(screen.getByTestId("planejar-2027-gastarMes"), { target: { value: "3.200" } });
    fireEvent.change(screen.getByTestId("planejar-2027-guardarMes"), { target: { value: "300" } });
    expect(document.body.textContent).toContain("R$ 3.600 guardados");
    fireEvent.click(screen.getByTestId("planejar-2027-proximo"));
    fireEvent.change(screen.getByTestId("planejar-2027-data-nome"), { target: { value: "Mãe" } });
    fireEvent.change(screen.getByTestId("planejar-2027-data-dia"), { target: { value: "2027-03-14" } });
    fireEvent.click(screen.getByTestId("planejar-2027-data-add"));
    fireEvent.click(screen.getByTestId("planejar-2027-tipo-checkup"));
    fireEvent.change(screen.getByTestId("planejar-2027-data-nome"), { target: { value: "Check-up anual" } });
    fireEvent.change(screen.getByTestId("planejar-2027-data-dia"), { target: { value: "2027-02-10" } });
    fireEvent.click(screen.getByTestId("planejar-2027-data-add"));
    expect(screen.getAllByTestId("planejar-2027-data")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("planejar-2027-proximo"));
    fireEvent.click(screen.getByTestId("planejar-2027-hora-21:00"));
    expect(screen.getByTestId("planejar-2027-resumo").textContent).toContain("2 metas");
    fireEvent.click(screen.getByTestId("planejar-2027-proximo"));

    await waitFor(() => expect(screen.getByTestId("pacote-2027")).toBeTruthy());
    const d = c.dados();
    const plano = lerPlano2027(d[CHAVE_PLANO_2027]);
    expect(plano.salvoEm).toBeTruthy();
    expect(plano.metas).toEqual(["Juntar R$ 5 mil", "Fazer uma viagem", ""]);
    expect(plano.horaRevisao).toBe("21:00");
    expect((d["goals-board-v2"] as unknown[]).length).toBe(2);
    expect((d["rel-dates"] as { title: string }[]).map((x) => x.title)).toEqual(["🎂 Aniversário: Mãe"]);
    expect((d["core-saude-appointments"] as { doctor: string }[]).map((x) => x.doctor)).toEqual(["Check-up anual"]);
    const comp = d["rotina-compromissos"] as { id: string; hora: string }[];
    expect(comp).toHaveLength(13);
    expect(comp[0].id).toBe("k1");
    expect(comp.slice(1).every((x) => x.hora === "21:00")).toBe(true);
    expect(c.sistema).toContain(CHAVE_PLANO_2027);
    expect(eventos("plano2027_salvo")[0]).toMatchObject({ metas: 2, datas: 2, hora: "21:00" });
    expect(screen.getByTestId("pacote-2027-planejar").textContent).toContain("Planejado");
    unmount();
    montar({ ...c.dados() });
    expect(screen.queryByTestId("pacote-2027-boas-vindas")).toBeNull();
    expect(screen.queryByTestId("planejar-2027")).toBeNull();
    expect(screen.getByTestId("pacote-2027-planejar").textContent).toContain("Planejado");
  });

  it("fechar o Planejar no X não grava nada", () => {
    quando(2026, 10, 21);
    const { c } = montar(COMPRADO);
    fireEvent.click(screen.getByTestId("pacote-2027-comecar"));
    fireEvent.change(screen.getByTestId("planejar-2027-meta-1"), { target: { value: "Meta" } });
    fireEvent.click(screen.getByTestId("planejar-2027-fechar"));
    expect(c.dados()[CHAVE_PLANO_2027]).toBeUndefined();
    expect(c.dados()["goals-board-v2"]).toBeUndefined();
    expect(screen.getByTestId("pacote-2027")).toBeTruthy(); // a explicação já foi vista (abriu o Planejar)
  });

  it("revisões: em out/2026 janeiro está trancado; em janeiro/2027 abre, a tarefa marca e abre a tela certa", () => {
    quando(2026, 10, 21);
    const base = { ...COMPRADO, [CHAVE_DICA_2027]: "true" };
    const { unmount } = montar(base);
    expect((screen.getByTestId("pacote-2027-mes-1") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("pacote-2027-mes-1").textContent).toContain("abre 01/01");
    unmount();
    cleanup();
    quando(2027, 1, 1, 9);
    const { c } = montar(base);
    expect((screen.getByTestId("pacote-2027-mes-1") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("pacote-2027-mes-2") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("pacote-2027-mes-1"));
    expect(screen.getByTestId("pacote-2027-revisao-1").textContent).toContain("IPVA");
    fireEvent.click(screen.getByLabelText("Marcar Olhe o seu dezembro"));
    expect(lerPlano2027(c.dados()[CHAVE_PLANO_2027]).revisoes["1"]).toEqual({ olhar: "2027-01-01" });
    expect(eventos("plano2027_revisao_tarefa")[0]).toMatchObject({ mes: 1, tarefa: "olhar" });
    fireEvent.click(screen.getByText("Abrir a retrospectiva"));
    expect(screen.getByTestId("rota-retro")).toBeTruthy();
  });

  it("cofrinho: marcar soma, invertido troca os valores, tudo na conta como gravação de sistema", () => {
    quando(2026, 10, 21);
    const { c } = montar({ ...COMPRADO, [CHAVE_DICA_2027]: "true" });
    fireEvent.click(screen.getByTestId("pacote-2027-abrir-cofrinho"));
    fireEvent.click(screen.getByTestId("pacote-2027-semana-1"));
    fireEvent.click(screen.getByTestId("pacote-2027-semana-10"));
    expect(screen.getByTestId("pacote-2027-cofrinho-total").textContent).toBe("R$ 11");
    fireEvent.click(screen.getByText("Começar pelo R$ 52"));
    expect(screen.getByTestId("pacote-2027-cofrinho-total").textContent).toBe("R$ 95");
    expect(lerCofrinho(c.dados()[CHAVE_COFRINHO_2027])).toEqual({ marcadas: [1, 10], invertido: true });
    expect(c.sistema).toContain(CHAVE_COFRINHO_2027);
  });

  it("nada de compra no app: a aba não fala de Pix, preço nem site", () => {
    quando(2026, 10, 21);
    montar({ ...COMPRADO, [CHAVE_DICA_2027]: "true" });
    expect(document.body.textContent).not.toMatch(/pix|r\$ 19,90|coreaplicativo|comprar/i);
  });
});

describe("Dev. Pessoal só ganha a aba com a chave (fonte)", () => {
  it("a aba entra condicionada ao pacote e aceita ?tab=2027", async () => {
    const { readFileSync } = await import("node:fs");
    const s = readFileSync("src/pages/DesenvolvimentoPessoal.tsx", "utf8");
    expect(s).toMatch(/temPacote2027 \? \[ABA_2027, \.\.\.ABAS_DP\] : ABAS_DP/);
    expect(s).toMatch(/activeTab === ABA_2027\.id && temPacote2027 && <Pacote2027 \/>/);
  });
});
