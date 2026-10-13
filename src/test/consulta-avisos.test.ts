/**
 * AVISO DA CONSULTA (13/10): véspera às 19h e 2 h antes (só com horário),
 * nada pro passado, faixa própria 1810000–1819999, refeito a cada mudança.
 * Toda conta de data é no fuso LOCAL, montada por partes (como o instanteDe
 * de lib/calendario) — os esperados aqui também são `new Date(a, m, d, h)`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  HORA_VESPERA, TETO_AVISOS_CONSULTA, consultasValidas, instanteLocal, momentosDoAviso, planejarAvisosConsulta, rotuloDoAviso, type ConsultaAgendavel,
} from "@/lib/consulta-avisos";
import { BASES_LEMBRETES, FAIXAS_AVULSAS } from "@/lib/notificacoes";
import { assinaturaDos, lerDadosDosLembretes } from "@/lib/reagendar";
import { lerPrefs } from "@/lib/prefs-notificacoes";

const BASE = 1810000;
const agora = new Date(2026, 9, 13, 10, 0); // terça 13/10/2026 10:00 (local)
const c = (over: Partial<ConsultaAgendavel> = {}): ConsultaAgendavel => ({
  id: "c1", doctor: "Dr. Hélio", specialty: "Neurologia", date: "2026-10-20", time: "14:30", address: "Rua A, 10", ...over,
});

describe("instante local (sem passar por UTC)", () => {
  it("monta data + hora no fuso local, por partes", () => {
    expect(instanteLocal("2026-10-20", "14:30")).toEqual(new Date(2026, 9, 20, 14, 30, 0, 0));
    expect(instanteLocal("2026-10-20", "", 0)).toEqual(new Date(2026, 9, 20, 0, 0, 0, 0));
    // "2026-10-20" via new Date() seria meia-noite UTC = 19/10 21h no Brasil; aqui o dia é sempre 20
    expect(instanteLocal("2026-10-20", "00:15")!.getDate()).toBe(20);
  });
  it("dado torto não vira data", () => {
    expect(instanteLocal("", "10:00")).toBeNull();
    expect(instanteLocal("20/10/2026", "10:00")).toBeNull();
    expect(instanteLocal("2026-02-31", "10:00")).toBeNull();
    expect(instanteLocal("2026-10-20", "25:00")).toBeNull();
    expect(instanteLocal("2026-10-20", "")).toBeNull(); // sem hora e sem padrão
  });
});

describe("os dois momentos de aviso", () => {
  it("véspera às 19:00 do dia anterior e 2 h antes do horário", () => {
    const m = momentosDoAviso(c(), agora);
    expect(m.vespera).toEqual(new Date(2026, 9, 19, HORA_VESPERA, 0, 0, 0));
    expect(m.antes).toEqual(new Date(2026, 9, 20, 12, 30, 0, 0));
  });
  it("consulta SEM horário: só a véspera", () => {
    const m = momentosDoAviso(c({ time: "" }), agora);
    expect(m.vespera).toEqual(new Date(2026, 9, 19, 19, 0));
    expect(m.antes).toBeNull();
    expect(rotuloDoAviso(c({ time: "" }), agora)).toBe("🔔 Aviso 1 dia antes, às 19h");
  });
  it("consulta que já passou: nada", () => {
    expect(momentosDoAviso(c({ date: "2026-10-12" }), agora)).toEqual({ vespera: null, antes: null });
    expect(momentosDoAviso(c({ date: "2026-10-13", time: "09:00" }), agora)).toEqual({ vespera: null, antes: null });
    expect(rotuloDoAviso(c({ date: "2022-04-13" }), agora)).toBeNull();
  });
  it("marcou hoje a de amanhã depois das 19h: a véspera já passou, fica só o 2 h antes", () => {
    const noite = new Date(2026, 9, 13, 20, 0);
    const m = momentosDoAviso(c({ date: "2026-10-14", time: "09:00" }), noite);
    expect(m.vespera).toBeNull();
    expect(m.antes).toEqual(new Date(2026, 9, 14, 7, 0));
    expect(rotuloDoAviso(c({ date: "2026-10-14", time: "09:00" }), noite)).toBe("🔔 Aviso 2 h antes");
  });
  it("consulta de hoje à tarde: o 2 h antes ainda sai", () => {
    const m = momentosDoAviso(c({ date: "2026-10-13", time: "15:00" }), agora);
    expect(m).toEqual({ vespera: null, antes: new Date(2026, 9, 13, 13, 0) });
  });
  it("virada do mês: a véspera do dia 1º é o último dia do mês anterior", () => {
    expect(momentosDoAviso(c({ date: "2026-11-01", time: "08:00" }), agora).vespera).toEqual(new Date(2026, 9, 31, 19, 0));
    expect(momentosDoAviso(c({ date: "2027-01-01", time: "" }), agora).vespera).toEqual(new Date(2026, 11, 31, 19, 0));
  });
  it("consulta à 00:30: o 2 h antes cai na noite anterior, depois da véspera", () => {
    const m = momentosDoAviso(c({ date: "2026-10-20", time: "00:30" }), agora);
    expect(m.vespera).toEqual(new Date(2026, 9, 19, 19, 0));
    expect(m.antes).toEqual(new Date(2026, 9, 19, 22, 30));
  });
  it("rótulo da linha com os dois avisos", () => {
    expect(rotuloDoAviso(c(), agora)).toBe("🔔 Aviso 1 dia antes e 2 h antes");
  });
});

describe("plano dos avisos", () => {
  it("dois avisos por consulta, na faixa própria, com médico, especialidade, hora e endereço no texto", () => {
    const avisos = planejarAvisosConsulta([c()], BASE, agora);
    expect(avisos).toHaveLength(2);
    const [vespera, antes] = avisos;
    expect(vespera).toMatchObject({ id: BASE, title: "🩺 Amanhã: consulta com Dr. Hélio", rota: "/saude?aba=log" });
    expect(vespera.body).toContain("Neurologia · às 14:30 · Rua A, 10");
    expect(antes).toMatchObject({ id: BASE + 1, title: "🩺 Daqui a 2 h: consulta com Dr. Hélio" });
    expect(antes.body).toContain("Às 14:30 · Rua A, 10");
  });
  it("consulta do dependente leva o nome dele", () => {
    const [a] = planejarAvisosConsulta([c({ quem: "Mãe" })], BASE, agora);
    expect(a.title).toBe("🩺 Amanhã: consulta com Dr. Hélio (Mãe)");
  });
  it("passadas ficam de fora; as futuras em ordem; ids distintos e dentro da faixa", () => {
    const avisos = planejarAvisosConsulta([
      c({ id: "velha", date: "2022-04-13" }),
      c({ id: "b", date: "2026-11-05", time: "" }),
      c({ id: "a", date: "2026-10-15", time: "08:00" }),
    ], BASE, agora);
    expect(avisos.map((a) => a.quando)).toEqual([
      new Date(2026, 9, 14, 19, 0), new Date(2026, 9, 15, 6, 0), new Date(2026, 10, 4, 19, 0),
    ]);
    expect(new Set(avisos.map((a) => a.id)).size).toBe(avisos.length);
    for (const a of avisos) expect(a.id >= BASES_LEMBRETES.consulta && a.id < BASES_LEMBRETES.consulta + 10000).toBe(true);
  });
  it(`teto de ${TETO_AVISOS_CONSULTA} (o iPhone descarta acima de 64 pendentes no app inteiro)`, () => {
    const muitas = Array.from({ length: 30 }, (_, i) => c({ id: `c${i}`, date: `2026-11-${String(i + 1).padStart(2, "0")}` })).filter((x) => instanteLocal(x.date, x.time));
    const avisos = planejarAvisosConsulta(muitas, BASE, agora);
    expect(avisos).toHaveLength(TETO_AVISOS_CONSULTA);
    expect(avisos[0].quando).toEqual(new Date(2026, 9, 31, 19, 0)); // os mais próximos ficam
  });
  it("dado torto (sem data, data em outro formato, lixo) não derruba o plano", () => {
    expect(consultasValidas([null, 3, { doctor: "X", date: "20/10/2026" }, { doctor: "", specialty: "", date: "2026-10-20" }, { doctor: "Y", date: "2026-10-20" }]))
      .toEqual([expect.objectContaining({ doctor: "Y", date: "2026-10-20" })]);
    expect(consultasValidas("lixo")).toEqual([]);
  });
});

describe("faixa e reagendamento", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("a faixa 1810000 não encosta em nenhuma outra (nem na régua do teste/missão)", () => {
    expect(BASES_LEMBRETES.consulta).toBe(1810000);
    const sobrepoe = (a: number, b: number) => a < b + 10000 && b < a + 10000;
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) if (tipo !== "consulta") expect(sobrepoe(base, 1810000), tipo).toBe(false);
    for (const [tipo, base] of Object.entries(FAIXAS_AVULSAS)) expect(sobrepoe(base, 1810000), tipo).toBe(false);
  });

  it("remarcar a consulta muda a assinatura (→ o useLembretes refaz a série); desligar na central também", () => {
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    const store: Record<string, unknown> = { "core-saude-appointments": [c()] };
    const get = <T,>(k: string, fb: T) => (k in store ? (store[k] as T) : fb);
    const prefs = lerPrefs(undefined);
    const antes = assinaturaDos(lerDadosDosLembretes(get), prefs);
    expect(lerDadosDosLembretes(get).consultas).toHaveLength(1);
    expect(lerDadosDosLembretes(get).consultasLigado).toBe(true); // nasce ligado
    store["core-saude-appointments"] = [c({ date: "2026-10-21" })];
    const remarcada = assinaturaDos(lerDadosDosLembretes(get), prefs);
    expect(remarcada).not.toBe(antes);
    store["notif-consultas-ligado"] = false;
    expect(assinaturaDos(lerDadosDosLembretes(get), prefs)).not.toBe(remarcada);
    // consulta antiga não entra no plano nem na assinatura
    store["notif-consultas-ligado"] = true;
    store["core-saude-appointments"] = [c({ date: "2026-10-21" }), c({ id: "velha", date: "2022-04-13" })];
    expect(assinaturaDos(lerDadosDosLembretes(get), prefs)).toBe(remarcada);
  });

  it("agendar: limpa a faixa (cancela os pendentes antigos, ex.: consulta apagada) e agenda os novos; desligado só limpa", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(agora);
    const agendados: { id: number; title: string; schedule: { at: Date }; extra: { rota: string } }[] = [];
    const cancelados: number[] = [];
    vi.resetModules();
    vi.doMock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
    vi.doMock("@capacitor/local-notifications", () => ({
      LocalNotifications: {
        checkPermissions: async () => ({ display: "granted" }),
        createChannel: async () => {},
        // um aviso de uma consulta que foi apagada + um do pet (outra faixa, não pode ser tocado)
        getPending: async () => ({ notifications: [{ id: 1810005 }, { id: 1800001 }] }),
        cancel: async ({ notifications }: { notifications: { id: number }[] }) => { cancelados.push(...notifications.map((n) => n.id)); },
        schedule: async ({ notifications }: { notifications: typeof agendados }) => { agendados.push(...notifications); },
      },
    }));
    try {
      const { agendarConsultas } = await import("@/lib/notificacoes");
      expect(await agendarConsultas([c()], { ligado: true })).toBe(2);
      expect(cancelados).toEqual([1810005]);
      expect(agendados.map((a) => [a.id, a.schedule.at.getTime(), a.extra.rota])).toEqual([
        [1810000, new Date(2026, 9, 19, 19, 0).getTime(), "/saude?aba=log"],
        [1810001, new Date(2026, 9, 20, 12, 30).getTime(), "/saude?aba=log"],
      ]);
      cancelados.length = 0; agendados.length = 0;
      expect(await agendarConsultas([c()], { ligado: false })).toBe(0);
      expect(cancelados).toEqual([1810005]);
      expect(agendados).toEqual([]);
    } finally {
      vi.doUnmock("@/lib/native-shell");
      vi.doUnmock("@capacitor/local-notifications");
    }
  });
});
