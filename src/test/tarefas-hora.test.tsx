/**
 * TAREFA COM HORÁRIO E DETALHES (28/09) — três chamados na mesma semana:
 *   22/09 "notificar na hora que deve tomar o remédio, beber água… tarefas que
 *          precisam ser lembradas naquele horário específico"
 *   26/09 "busco hábitos e tarefas com lembretes e notificações"
 *   28/09 "pôr alarme e também descrever mais coisas… ali em tarefas de hoje"
 *
 * O que trava aqui:
 *  1. tarefa antiga (sem os campos novos) continua igual — nada de migração;
 *  2. o aviso usa o sistema dos compromissos: antecedência, nada no passado,
 *     faixa própria de id, título = a tarefa, corpo = começo dos detalhes;
 *  3. marcar como feita cancela o aviso pendente (dado → assinatura → série
 *     refeita sem ela), provado até o plugin;
 *  4. a tela: hora + 🔔 na linha, tocar no texto ABRE (não marca), o
 *     quadradinho marca na chave de origem, "+ Nova tarefa" grava os campos.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import {
  AVISOS_TAREFA, CHAVE_TAREFAS_CARREIRA, CHAVE_TAREFAS_ROTINA, avisoDaTarefa, avisoJaPassou, detalhesDaTarefa, horaDaTarefa,
  normalizarHora, ordenarPorHora, planejarTarefas, resumoDosDetalhes, tarefasAgendaveis, tarefasValidas, textoDoAviso, type TarefaDoDia,
} from "@/lib/tarefas";
import { TETO_AVISOS } from "@/lib/compromissos";
import { BASES_LEMBRETES } from "@/lib/notificacoes";
import { assinaturaDos, lerDadosDosLembretes } from "@/lib/reagendar";
import { lerPrefs } from "@/lib/prefs-notificacoes";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { BlocoDeFases } from "@/components/fases/BlocoDeFases";
import { trackEvent } from "@/lib/analytics";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
// O cliente do Supabase aponta pra PRODUÇÃO e o trackEvent grava em analytics_events de verdade
// (foi o que sujou o banco em 27/09). Criar/editar tarefa emite evento: aqui ele não sai daqui.
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

const SEG_0940 = new Date(2026, 8, 28, 9, 40); // segunda, 28/09/2026 09:40
const HOJE = "2026-09-28";
const fixarData = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };
afterEach(() => { vi.useRealTimers(); });

const agua: TarefaDoDia = { id: "r2", texto: "Beber 500 ml de água", feito: false, dia: HOJE, hora: "10:30", aviso: 0 };
const remedio: TarefaDoDia = { id: "r1", texto: "Tomar o remédio da pressão", feito: true, dia: HOJE, hora: "08:00", aviso: 0 };
const antiga: TarefaDoDia = { id: "r0", texto: "Separar as roupas", feito: false, dia: HOJE }; // como TODA tarefa era até hoje
const deOntem: TarefaDoDia = { id: "r9", texto: "Ontem à noite", feito: false, dia: "2026-09-27", hora: "23:00", aviso: 0 };
const fornecedor: TarefaDoDia = {
  id: "c1", texto: "Ligar pro fornecedor da tinta", feito: false, dia: HOJE, hora: "15:00", aviso: 30,
  detalhes: "Pedir orçamento de 18 L da Suvinil fosca.\nConfirmar se entregam até sexta.\nFalar com a Rita: (11) 98877-6655",
};
const relatorio: TarefaDoDia = { id: "c2", texto: "Mandar o relatório pro Paulo", feito: false, dia: HOJE, detalhes: "Vendas por região.\nAnexar em PDF." };

const BASE = BASES_LEMBRETES.tarefa;

/* ─────────────────────────────── lógica ─────────────────────────────── */

describe("tarefa antiga continua igual (compatibilidade)", () => {
  it("sem hora, sem aviso, sem detalhes: nada muda e nada é agendado", () => {
    expect(horaDaTarefa(antiga)).toBeNull();
    expect(avisoDaTarefa(antiga)).toBe(-1);
    expect(detalhesDaTarefa(antiga)).toBe("");
    expect(tarefasAgendaveis([{ chave: CHAVE_TAREFAS_ROTINA, lista: [antiga] }], HOJE)).toEqual([]);
  });

  it("na lista, as com hora vêm primeiro (pela hora) e as sem hora mantêm a ordem de criação", () => {
    const outra = { ...antiga, id: "r00", texto: "Outra sem hora" };
    expect(ordenarPorHora([antiga, fornecedor, outra, agua]).map((t) => t.id)).toEqual(["r2", "c1", "r0", "r00"]);
  });

  it("dado torto fica de fora sem derrubar; id numérico antigo é aceito", () => {
    const lixo = [null, {}, "x", { id: "a", texto: "", dia: HOJE }, { id: "b", texto: "B", dia: "28/09" }, { id: 7, texto: "Num", feito: false, dia: HOJE }, antiga];
    expect(tarefasValidas(lixo).map((t) => t.texto)).toEqual(["Num", "Separar as roupas"]);
    expect(tarefasValidas("lixo")).toEqual([]);
  });

  it("hora e aviso normalizados: '9:05' vira '09:05', hora impossível é ignorada, aviso ausente = na hora", () => {
    expect(normalizarHora("9:05")).toBe("09:05");
    expect(normalizarHora("24:00")).toBeNull();
    expect(normalizarHora("abc")).toBeNull();
    expect(avisoDaTarefa({ ...antiga, hora: "10:00" })).toBe(0);
    expect(avisoDaTarefa({ ...antiga, hora: "10:00", aviso: -1 })).toBe(-1);
    expect(avisoDaTarefa({ ...antiga, hora: "10:00", aviso: 30 })).toBe(30);
    expect(avisoDaTarefa({ ...antiga, aviso: 30 })).toBe(-1); // aviso sem hora não existe
  });

  it("as antecedências são as dos compromissos, sem '1 dia antes' (a tarefa é do dia)", () => {
    expect(AVISOS_TAREFA.map((a) => a.rotulo)).toEqual(["Sem aviso", "Na hora", "15 min antes", "30 min antes", "1 hora antes", "2 horas antes"]);
  });
});

describe("aviso da tarefa (mesmo sistema dos compromissos)", () => {
  const fontes = [
    { chave: CHAVE_TAREFAS_ROTINA, lista: [remedio, agua, antiga, deOntem] },
    { chave: CHAVE_TAREFAS_CARREIRA, lista: [fornecedor, relatorio] },
  ];

  it("só as pendentes de hoje com hora e aviso viram notificação — título = tarefa, corpo = começo dos detalhes", () => {
    const agendaveis = tarefasAgendaveis(fontes, HOJE);
    expect(agendaveis.map((t) => t.id)).toEqual(["r2", "c1"]); // feita, sem hora e de ontem ficam de fora
    const avisos = planejarTarefas(agendaveis, BASE, SEG_0940);
    expect(avisos).toHaveLength(2);
    const [a, f] = avisos;
    expect(a.quando.getTime()).toBe(new Date(2026, 8, 28, 10, 30).getTime());
    expect(a.title).toBe("⏰ Beber 500 ml de água");
    expect(a.body).toBe("Agora, às 10:30"); // sem detalhes: o "quando" com as palavras do compromisso
    expect(a.rota).toBe("/rotina");
    expect(f.quando.getTime()).toBe(new Date(2026, 8, 28, 14, 30).getTime()); // 30 min antes das 15:00
    expect(f.title).toBe("⏰ Ligar pro fornecedor da tinta");
    expect(f.body.startsWith("Às 15:00 · Pedir orçamento de 18 L da Suvinil fosca. · Confirmar")).toBe(true);
    expect(f.largeBody).toContain("Falar com a Rita: (11) 98877-6655"); // o texto inteiro, ao expandir no Android
    expect(f.rota).toBe("/carreira");
    expect(avisos.map((x) => x.id)).toEqual([BASE, BASE + 1]);
  });

  it("aviso que já ficou pra trás não agenda; 'Sem aviso' não agenda", () => {
    const agendaveis = tarefasAgendaveis(fontes, HOJE);
    expect(planejarTarefas(agendaveis, BASE, new Date(2026, 8, 28, 14, 40))).toEqual([]); // 10:30 e 14:30 passaram
    const semAviso = tarefasAgendaveis([{ chave: CHAVE_TAREFAS_ROTINA, lista: [{ ...agua, aviso: -1 }] }], HOJE);
    expect(semAviso).toEqual([]);
    expect(avisoJaPassou(HOJE, "15:00", 30, new Date(2026, 8, 28, 14, 40))).toBe(true);
    expect(avisoJaPassou(HOJE, "15:00", 0, new Date(2026, 8, 28, 14, 40))).toBe(false);
  });

  it("respeita o teto do iOS e os ids ficam na faixa do tipo", () => {
    const muitas = Array.from({ length: 40 }, (_, i) => ({ ...agua, id: `m${i}`, hora: `${String(10 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}` }));
    const avisos = planejarTarefas(tarefasAgendaveis([{ chave: CHAVE_TAREFAS_ROTINA, lista: muitas }], HOJE), BASE, SEG_0940);
    expect(avisos).toHaveLength(TETO_AVISOS);
    expect(Math.max(...avisos.map((a) => a.id))).toBeLessThan(BASE + 10000);
  });

  it("o resumo dos detalhes junta as linhas e corta sem deixar pontuação antes das reticências", () => {
    expect(resumoDosDetalhes("Revisar o frete\n\n  Anexar o catálogo  ")).toBe("Revisar o frete · Anexar o catálogo");
    expect(resumoDosDetalhes("Confirmar se entregam até sexta.\nFalar com a Rita", 33)).toBe("Confirmar se entregam até sexta…");
  });

  it("o texto da ficha diz quando toca", () => {
    expect(textoDoAviso("15:00", 30)).toBe("Avisa às 14:30 (30 min antes)");
    expect(textoDoAviso("10:30", 0)).toBe("Avisa às 10:30, na hora");
    expect(textoDoAviso("10:30", -1)).toBe("Sem aviso");
  });
});

describe("marcar como feita cancela o aviso pendente", () => {
  const storeCom = (tarefas: TarefaDoDia[]) => {
    const store: Record<string, unknown> = { [CHAVE_TAREFAS_CARREIRA]: tarefas };
    const get = <T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb);
    return { store, get };
  };

  it("a assinatura do useLembretes muda quando a tarefa é marcada (é isso que dispara o reagendamento)", () => {
    fixarData(SEG_0940);
    const { store, get } = storeCom([fornecedor]);
    const prefs = lerPrefs(undefined);
    expect(prefs.tarefas).toBe(true); // nasce ligado, como os compromissos
    const antes = lerDadosDosLembretes(get);
    expect(antes.tarefas.map((t) => t.id)).toEqual(["c1"]);
    const assinaturaAntes = assinaturaDos(antes, prefs);
    store[CHAVE_TAREFAS_CARREIRA] = [{ ...fornecedor, feito: true }];
    const depois = lerDadosDosLembretes(get);
    expect(depois.tarefas).toEqual([]);
    expect(assinaturaDos(depois, prefs)).not.toBe(assinaturaAntes);
    // desligado na central: a tarefa não entra na assinatura
    expect(assinaturaDos(antes, { ...prefs, tarefas: false })).toBe(assinaturaDos(depois, { ...prefs, tarefas: false }));
  });

  it("no aparelho: agenda na faixa das tarefas e, marcada como feita, o aviso some do sistema", async () => {
    fixarData(SEG_0940);
    const pendentes = new Map<number, { id: number; title: string; body: string; largeBody?: string; schedule: { at: Date }; extra: { rota: string } }>();
    vi.resetModules();
    vi.doMock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
    vi.doMock("@capacitor/local-notifications", () => ({
      LocalNotifications: {
        checkPermissions: async () => ({ display: "granted" }),
        createChannel: async () => {},
        getPending: async () => ({ notifications: [...pendentes.values()] }),
        cancel: async ({ notifications }: { notifications: { id: number }[] }) => { notifications.forEach((n) => pendentes.delete(n.id)); },
        schedule: async ({ notifications }: { notifications: { id: number; title: string; body: string; schedule: { at: Date }; extra: { rota: string } }[] }) => {
          notifications.forEach((n) => pendentes.set(n.id, n));
        },
      },
    }));
    try {
      const { reagendarTudo } = await import("@/lib/reagendar");
      const daFaixa = () => [...pendentes.values()].filter((n) => n.id >= BASE && n.id < BASE + 10000);
      const { store, get } = storeCom([fornecedor, relatorio]);

      const contagem = await reagendarTudo(get, lerPrefs(undefined));
      expect(contagem.tarefa).toBe(1);
      expect(daFaixa()).toHaveLength(1);
      const [n] = daFaixa();
      expect(n.title).toBe("⏰ Ligar pro fornecedor da tinta");
      expect(n.body).toMatch(/^Às 15:00 · Pedir orçamento/);
      expect(n.largeBody).toContain("Falar com a Rita");
      expect(n.schedule.at.getTime()).toBe(new Date(2026, 8, 28, 14, 30).getTime());
      expect(n.extra.rota).toBe("/carreira");

      // marcou como feita (o ✓ da Home grava na chave de origem) → o reagendamento limpa a faixa e não põe de volta
      store[CHAVE_TAREFAS_CARREIRA] = [{ ...fornecedor, feito: true }, relatorio];
      const depois = await reagendarTudo(get, lerPrefs(undefined));
      expect(depois.tarefa).toBe(0);
      expect(daFaixa()).toEqual([]);
    } finally {
      vi.doUnmock("@/lib/native-shell");
      vi.doUnmock("@capacitor/local-notifications");
      vi.resetModules();
    }
  });
});

/* ─────────────────────────────── tela ─────────────────────────────── */

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
const montar = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

describe("widget Tarefas de hoje (Home)", () => {
  it("mostra a hora e o 🔔; tocar no texto ABRE a ficha com os detalhes, sem marcar", () => {
    fixarData(SEG_0940);
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [remedio, agua, antiga], [CHAVE_TAREFAS_CARREIRA]: [fornecedor] });
    montar(<TasksWidget />, store);
    const w = screen.getByTestId("tasks-widget");
    expect(w).toHaveTextContent("SEGUNDA · 28/09");
    expect(w).toHaveTextContent("1/4 feitas");
    const linhas = within(w).getAllByTestId("linha-tarefa");
    // com hora primeiro (10:30, 15:00), depois a sem hora, e a feita riscada no pé
    expect(linhas.map((l) => l.textContent?.slice(0, 5))).toEqual(["10:30", "15:00", "Separ", "08:00"]);
    expect(linhas[1]).toHaveTextContent("30 min antes");
    expect(within(linhas[1]).getByTestId("detalhes-da-linha")).toHaveTextContent("Pedir orçamento de 18 L");
    expect(within(linhas[2]).queryByTestId("aviso-da-linha")).toBeNull(); // a antiga: sem sino

    fireEvent.click(screen.getByRole("button", { name: "Abrir Ligar pro fornecedor da tinta" }));
    const ficha = screen.getByTestId("ficha-tarefa");
    expect(within(ficha).getByTestId("ficha-hora")).toHaveTextContent("15:00");
    expect(within(ficha).getByTestId("ficha-aviso")).toHaveTextContent("Avisa às 14:30 (30 min antes)");
    expect(within(ficha).getByTestId("ficha-detalhes")).toHaveTextContent("Falar com a Rita: (11) 98877-6655");
    expect((store.dados[CHAVE_TAREFAS_CARREIRA] as TarefaDoDia[])[0].feito).toBe(false); // abrir não marca
  });

  it("o quadradinho marca na chave de origem e a tarefa fica riscada na lista (não some)", () => {
    fixarData(SEG_0940);
    const store = criarStore({ [CHAVE_TAREFAS_CARREIRA]: [fornecedor], "rotina-urgencies": [{ id: "u1", text: "Pagar o boleto", done: false }] });
    montar(<TasksWidget />, store);
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Ligar pro fornecedor da tinta" }));
    expect((store.dados[CHAVE_TAREFAS_CARREIRA] as TarefaDoDia[])[0].feito).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Pagar o boleto" }));
    expect((store.dados["rotina-urgencies"] as { done: boolean }[])[0].done).toBe(true);
    const w = screen.getByTestId("tasks-widget");
    expect(w).toHaveTextContent("2/2 feitas");
    expect(w).toHaveTextContent("Tudo feito por hoje");
    expect(screen.getByRole("checkbox", { name: "Concluir Pagar o boleto" })).toHaveAttribute("aria-checked", "true");
  });

  it("'+ Nova tarefa' cria nas tarefas de hoje da Rotina com horário, aviso e detalhes", () => {
    fixarData(SEG_0940);
    const store = criarStore();
    montar(<TasksWidget />, store);
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    expect(within(folha).getByTestId("dica-do-aviso")).toHaveTextContent("Sem horário");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "  Enviar a proposta pro Duarte " } });
    fireEvent.change(within(folha).getByLabelText("Horário da tarefa"), { target: { value: "11:00" } });
    fireEvent.change(within(folha).getByLabelText("Quando avisar"), { target: { value: "15" } });
    expect(within(folha).getByTestId("dica-do-aviso")).toHaveTextContent("O aviso toca às 10:45.");
    fireEvent.change(within(folha).getByLabelText("Detalhes da tarefa"), { target: { value: "Revisar o frete\nAnexar o catálogo\n" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    const salvas = store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[];
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ texto: "Enviar a proposta pro Duarte", feito: false, dia: HOJE, hora: "11:00", aviso: 15, detalhes: "Revisar o frete\nAnexar o catálogo" });
    expect(screen.getByTestId("tasks-widget")).toHaveTextContent("11:00");
    // o evento sai (mockado aqui — nunca pro banco de produção) com o que interessa medir
    expect(trackEvent).toHaveBeenCalledWith("tarefa_criada", { lista: CHAVE_TAREFAS_ROTINA, hora: true, aviso: 15, detalhes: true });
  });

  it("horário que já passou: avisa na hora de salvar que não vai tocar", () => {
    fixarData(SEG_0940);
    montar(<TasksWidget />, criarStore());
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    fireEvent.change(screen.getByLabelText("Horário da tarefa"), { target: { value: "08:00" } });
    expect(screen.getByTestId("dica-do-aviso")).toHaveTextContent("Esse horário já passou hoje");
  });

  it("vazio explica de onde vêm as tarefas e já oferece a nova", () => {
    montar(<TasksWidget />, criarStore());
    expect(screen.getByTestId("tasks-vazio")).toHaveTextContent(/Rotina/);
    expect(screen.getByTestId("nova-tarefa")).toHaveTextContent("horário e detalhes");
  });
});

describe("tarefas de hoje dentro do módulo (BlocoDeFases: Rotina e Carreira)", () => {
  const bloco = (store: ReturnType<typeof criarStore>) =>
    montar(<BlocoDeFases chaveFases="career-day-phases" chaveTarefas={CHAVE_TAREFAS_CARREIRA} fasesPadrao={[]} />, store);

  it("o + de sempre cria a tarefa do jeito antigo (sem campos novos)", () => {
    fixarData(SEG_0940);
    const store = criarStore();
    bloco(store);
    fireEvent.change(screen.getByPlaceholderText("Nova tarefa..."), { target: { value: "Follow-up com a Rita" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tarefa" }));
    const [t] = store.dados[CHAVE_TAREFAS_CARREIRA] as TarefaDoDia[];
    expect(Object.keys(t).sort()).toEqual(["dia", "feito", "id", "texto"]);
    expect(t).toMatchObject({ texto: "Follow-up com a Rita", feito: false, dia: HOJE });
  });

  it("o ⏰ abre a folha com o texto já digitado; editar pela ficha põe horário; apagar pede confirmação", () => {
    fixarData(SEG_0940);
    const store = criarStore({ [CHAVE_TAREFAS_CARREIRA]: [relatorio] });
    bloco(store);
    fireEvent.change(screen.getByPlaceholderText("Nova tarefa..."), { target: { value: "Reunião de pauta" } });
    fireEvent.click(screen.getByRole("button", { name: "Tarefa com horário ou detalhes" }));
    expect(screen.getByLabelText("O que precisa fazer")).toHaveValue("Reunião de pauta");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // a antiga ganha horário pela ficha → Editar
    fireEvent.click(screen.getByRole("button", { name: "Abrir Mandar o relatório pro Paulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar tarefa" }));
    expect(screen.getByLabelText("Detalhes da tarefa")).toHaveValue("Vendas por região.\nAnexar em PDF.");
    fireEvent.change(screen.getByLabelText("Horário da tarefa"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect((store.dados[CHAVE_TAREFAS_CARREIRA] as TarefaDoDia[])[0]).toMatchObject({ id: "c2", hora: "17:00", aviso: 0, detalhes: "Vendas por região.\nAnexar em PDF." });

    // apagar: o primeiro toque só arma
    fireEvent.click(screen.getByRole("button", { name: "Apagar tarefa" }));
    expect(store.dados[CHAVE_TAREFAS_CARREIRA] as TarefaDoDia[]).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Apagar?" }));
    expect(store.dados[CHAVE_TAREFAS_CARREIRA] as TarefaDoDia[]).toHaveLength(0);
  });
});
