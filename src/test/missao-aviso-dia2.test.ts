/**
 * AVISO "DIA 2 DA SUA MISSÃO" (28/09). A Missão conta o dia em janelas de 24 h
 * (diaDaMissao); o aviso caía no 1º horário preferido a +14 h, e quem começava
 * entre 8h30 e 18h30 recebia "Fechar o dia de hoje" ainda no dia 1 — registrava
 * e o app não contava nem comemorava. Aqui: o aviso cai SEMPRE no dia 2 da
 * Missão, em hora decente, no fuso de São Paulo.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  schedule: vi.fn(async (_: unknown) => ({})),
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => ({ display: ln.permissao }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    schedule: (x: unknown) => ln.schedule(x),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { quandoAvisarDia2, agendarReguaDaMissao } from "@/lib/notificacoes";
import { diaDaMissao, type Missao } from "@/lib/teste-gratis";
import { trackEvent } from "@/lib/analytics";

const H = 3600_000;
const TZ_ANTES = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Sao_Paulo"; });
afterAll(() => { if (TZ_ANTES === undefined) delete process.env.TZ; else process.env.TZ = TZ_ANTES; });

/** Hora do relógio de São Paulo, em segundos desde a meia-noite — lida pelo
 *  Intl, sem depender do fuso do processo. */
const segundosEmSP = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return n("hour") * 3600 + n("minute") * 60 + n("second");
};
const missao = (inicio: number): Missao => ({ inicio, area: "dinheiro", d1: false, d2: false, d3: false, vista: true, holofote: "dispensado" });

describe("quandoAvisarDia2 — sempre no dia 2 da Missão, em hora decente", () => {
  it("o teste roda no fuso de São Paulo (UTC−3, sem horário de verão)", () => {
    expect(new Date(2026, 8, 28, 12).getTimezoneOffset()).toBe(180);
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(180);
  });

  it("24 horas de início × horários preferidos 7h, 8h30, 12h, 18h e 21h (e os do funil 12h30/19h30)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      let casos = 0;
      for (const dia of [new Date(2026, 8, 28), new Date(2026, 11, 31)]) {
        for (let h = 0; h < 24; h++) {
          for (const [m, s] of [[0, 0], [4, 59], [5, 0], [25, 0], [25, 1], [29, 59], [30, 0], [31, 0], [54, 59], [55, 0], [59, 59]]) {
            const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, s, 123).getTime();
            for (const pref of [7, 8.5, 12, 18, 21, 12.5, 19.5]) {
              const aviso = quandoAvisarDia2(inicio, pref).getTime();
              const rotulo = `início ${new Date(inicio).toString()} · preferido ${pref}h → ${new Date(aviso).toString()}`;
              expect(aviso - inicio, rotulo).toBeGreaterThanOrEqual(24 * H);
              expect(aviso - inicio, rotulo).toBeLessThan(48 * H);
              const seg = segundosEmSP(new Date(aviso));
              expect(seg, rotulo).toBeGreaterThanOrEqual(8 * 3600);
              expect(seg, rotulo).toBeLessThanOrEqual(21 * 3600 + 30 * 60);
              // e o app, na hora do aviso, conta o DIA 2 (é o que faz registrar comemorar)
              vi.setSystemTime(aviso);
              expect(diaDaMissao(missao(inicio)), rotulo).toBe(2);
              casos++;
            }
          }
        }
      }
      expect(casos).toBe(2 * 24 * 11 * 7);
    } finally {
      vi.useRealTimers();
    }
  });

  it("o bug de antes: começou às 10h com 8h30 preferido → não é mais 8h30 do dia seguinte (ainda dia 1), é 10h05", () => {
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 10, 0).getTime(), 8.5)).toEqual(new Date(2026, 8, 29, 10, 5));
  });

  it("(a) o horário preferido, quando a 1ª ocorrência depois de +24 h vem até +36 h", () => {
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 7, 0).getTime(), 8.5)).toEqual(new Date(2026, 8, 29, 8, 30));
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 23, 0).getTime(), 8.5)).toEqual(new Date(2026, 8, 30, 8, 30)); // +33h30
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 12, 0).getTime(), 19.5)).toEqual(new Date(2026, 8, 29, 19, 30));
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 21, 30).getTime(), 8.5)).toEqual(new Date(2026, 8, 30, 8, 30)); // +35h
  });

  it("(b) +24 h + 5 min quando o preferido ficaria longe demais ou fora de hora decente", () => {
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 18, 0).getTime(), 12.5)).toEqual(new Date(2026, 8, 29, 18, 5)); // 12h30 seria +42h30
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 21, 0).getTime(), 7)).toEqual(new Date(2026, 8, 29, 21, 5)); // 7h não é hora decente
  });

  it("(c) o próximo 08:30 quando +24 h cai de madrugada ou tarde da noite", () => {
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 22, 0).getTime(), 19.5)).toEqual(new Date(2026, 8, 30, 8, 30));
    expect(quandoAvisarDia2(new Date(2026, 8, 28, 2, 0).getTime(), 21)).toEqual(new Date(2026, 8, 29, 8, 30));
  });
});

describe("agendarReguaDaMissao — agenda o aviso calculado, com o texto de sempre", () => {
  // Lido no beforeEach, depois do beforeAll pôr o processo em São Paulo.
  // No corpo do describe o fuso ainda é o do processo (UTC nesta máquina) e
  // 28/09 10:00 viraria outro instante — o aviso caía em 08:30 em vez de 10:05.
  let INICIO = 0;
  const avisoAgendado = () => {
    const pedido = ln.schedule.mock.calls[0]?.[0] as { notifications: { id: number; title: string; body: string; schedule: { at: Date } }[] };
    return pedido.notifications;
  };

  beforeEach(() => {
    INICIO = new Date(2026, 8, 28, 10, 0).getTime();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    localStorage.clear();
    localStorage.setItem("core-missao", JSON.stringify(missao(INICIO)));
    ln.permissao = "granted";
    ln.schedule.mockClear();
    vi.mocked(trackEvent).mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("um aviso só (a véspera da cobrança não volta), no dia 2, com o texto de sempre", async () => {
    vi.setSystemTime(INICIO + 30_000); // tocou 30 s depois das boas-vindas
    await agendarReguaDaMissao("dinheiro", "Dinheiro", null);
    const avisos = avisoAgendado();
    expect(avisos).toHaveLength(1);
    expect(avisos[0].id).toBe(900001);
    expect(avisos[0].schedule.at).toEqual(quandoAvisarDia2(INICIO, 8.5));
    expect(avisos[0].schedule.at).toEqual(new Date(2026, 8, 29, 10, 5));
    expect(avisos[0].title).toBe("Dia 2 da sua missão 🔥");
    expect(avisos[0].body).toBe("Ontem você começou Dinheiro. Fechar o dia de hoje leva 1 minuto.");
    expect(trackEvent).toHaveBeenCalledWith("regua_missao_armada", expect.objectContaining({ ok: true, dia2_em_h: 24.1 }));
  });

  it("conta do início da MISSÃO, não do toque: boas-vindas abertas 5 h depois seguem no dia 2 dela", async () => {
    vi.setSystemTime(INICIO + 5 * H);
    await agendarReguaDaMissao("rotina", "Rotina", "noite");
    expect(avisoAgendado()[0].schedule.at).toEqual(quandoAvisarDia2(INICIO, 19.5));
    expect(avisoAgendado()[0].schedule.at).toEqual(new Date(2026, 8, 29, 19, 30));
  });

  it("se a hora do aviso já passou (tocou só no dia 2), não agenda no passado", async () => {
    vi.setSystemTime(new Date(2026, 8, 29, 11, 0).getTime()); // o aviso seria 29/09 10:05
    await agendarReguaDaMissao("dinheiro", "Dinheiro", null);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("regua_missao_armada", expect.objectContaining({ ok: false, motivo: "dia2_passou" }));
  });

  it("sem permissão continua como antes: nada agendado, desfecho vira evento", async () => {
    ln.permissao = "denied";
    vi.setSystemTime(INICIO + 30_000);
    await agendarReguaDaMissao("dinheiro", "Dinheiro", null);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("regua_missao_armada", expect.objectContaining({ ok: false, motivo: "sem_permissao" }));
  });
});
