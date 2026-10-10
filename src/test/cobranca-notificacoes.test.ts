/**
 * AVISOS LOCAIS DO CARTÃO RECUSADO (10/10, 1.0.14) — +24 h e +72 h depois de
 * detectar, faixa 940000, cancelados quando a cobrança entra. Atrás da chave
 * COBRANCA_V14 (QA: ?cobranca-v14=on). Ver lib/cobranca-recusada e lib/notificacoes.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  pendentes: [] as Array<{ id: number; title?: string; body?: string; schedule?: { at?: Date }; extra?: Record<string, unknown> }>,
  schedule: vi.fn(async (x: { notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra?: Record<string, unknown> }> }) => {
    for (const n of x.notifications) ln.pendentes.push({ id: n.id, title: n.title, body: n.body, schedule: n.schedule, extra: n.extra });
    return {};
  }),
  cancel: vi.fn(async (x: { notifications: Array<{ id: number }> }) => {
    const ids = new Set(x.notifications.map((n) => n.id));
    ln.pendentes = ln.pendentes.filter((n) => !ids.has(n.id));
  }),
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => ({ display: ln.permissao }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.pendentes }),
    cancel: (x: { notifications: Array<{ id: number }> }) => ln.cancel(x),
    schedule: (x: Parameters<typeof ln.schedule>[0]) => ln.schedule(x),
  },
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); } }));

import { FAIXAS_AVULSAS, BASES_LEMBRETES, copyDoAvisoDeCobranca, tipoDoAviso, HORAS_DOS_AVISOS_DE_COBRANCA } from "@/lib/notificacoes";
import { CHAVE_FORCA_COBRANCA_V14, sincronizarAvisosDeCobranca } from "@/lib/cobranca-recusada";

const H = 3600e3;
const AGORA = new Date(2026, 9, 10, 15, 0, 0);
const PROBLEMA = { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-09T20:00:00Z" };
const SEM = { temProblema: false, comAcesso: false, url: null };

beforeEach(() => {
  localStorage.clear();
  ln.permissao = "granted";
  ln.pendentes = [];
  ln.schedule.mockClear();
  ln.cancel.mockClear();
  eventos.length = 0;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("faixa e copy", () => {
  it("mora em 940000, longe de todo tipo da central e das outras réguas; o tipo pros eventos é 'cobranca'", () => {
    expect(FAIXAS_AVULSAS.cobranca).toBe(940000);
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) expect(base < 940000 && base + 10000 <= 940000 || base >= 950000, tipo).toBe(true);
    expect(tipoDoAviso(940001)).toBe("cobranca");
    expect(tipoDoAviso(940002, { tipo: "cobranca" })).toBe("cobranca");
  });
  it("o texto: pagamento não passou, atualize o cartão na loja certa, sem valor", () => {
    expect(copyDoAvisoDeCobranca("App Store")).toEqual({ title: "Seu pagamento do CORE não passou", body: "Atualize o cartão na App Store pra não perder o acesso." });
    expect(copyDoAvisoDeCobranca("Google Play").body).toMatch(/Google Play/);
    expect(copyDoAvisoDeCobranca().body).toMatch(/App Store/); // iPhone no teste
    expect(HORAS_DOS_AVISOS_DE_COBRANCA).toEqual([24, 72]);
  });
});

describe("sincronizarAvisosDeCobranca", () => {
  it("chave DESLIGADA: nunca arma nada (o aparelho fica como hoje)", async () => {
    expect(await sincronizarAvisosDeCobranca(PROBLEMA)).toBe("nada");
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(localStorage.getItem("core-aviso-cobranca-notif")).toBeNull();
  });

  it("chave ligada + cartão recusado: arma +24 h e +72 h (ids 940001/940002, tipo cobranca, rota /home) UMA vez por detecção", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    expect(await sincronizarAvisosDeCobranca(PROBLEMA)).toBe("armado");
    expect(ln.pendentes.map((n) => n.id)).toEqual([940001, 940002]);
    expect((ln.pendentes[0].schedule!.at!.getTime() - AGORA.getTime()) / H).toBe(24);
    expect((ln.pendentes[1].schedule!.at!.getTime() - AGORA.getTime()) / H).toBe(72);
    expect(ln.pendentes[0].extra).toEqual({ tipo: "cobranca", rota: "/home", em: "2026-10-09T20:00:00Z" });
    expect(ln.pendentes[0].title).toBe("Seu pagamento do CORE não passou");
    expect(eventos).toContainEqual(["notif_cobranca_armada", { ok: true, em_h: [24, 72] }]);
    // a mesma detecção na próxima abertura: não re-arma (senão o +24 h andava pra frente a cada boot)
    ln.schedule.mockClear();
    expect(await sincronizarAvisosDeCobranca(PROBLEMA)).toBe("nada");
    expect(ln.schedule).not.toHaveBeenCalled();
    // detecção NOVA (outro mês, outro cartão recusado): re-arma, substituindo
    expect(await sincronizarAvisosDeCobranca({ ...PROBLEMA, detectadoEm: "2026-11-09T20:00:00Z" })).toBe("armado");
    expect(ln.pendentes.map((n) => n.id)).toEqual([940001, 940002]);
  });

  it("a cobrança entrou (sem problema): cancela os dois e esquece a marca", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    await sincronizarAvisosDeCobranca(PROBLEMA);
    expect(ln.pendentes).toHaveLength(2);
    expect(await sincronizarAvisosDeCobranca(SEM)).toBe("cancelado");
    expect(ln.pendentes).toHaveLength(0);
    expect(localStorage.getItem("core-aviso-cobranca-notif")).toBeNull();
    expect(await sincronizarAvisosDeCobranca(SEM)).toBe("nada");
  });

  it("sem permissão de notificação: não arma e conta o motivo; a chave da marca não é gravada (tenta de novo quando a permissão vier)", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    ln.permissao = "denied";
    expect(await sincronizarAvisosDeCobranca(PROBLEMA)).toBe("nada");
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos).toContainEqual(["notif_cobranca_armada", { ok: false, motivo: "sem_permissao" }]);
    expect(localStorage.getItem("core-aviso-cobranca-notif")).toBeNull();
  });

  it("desligar a chave depois de armado (rollback / ?cobranca-v14=off): cancela o que sobrou", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    await sincronizarAvisosDeCobranca(PROBLEMA);
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "off");
    expect(await sincronizarAvisosDeCobranca(PROBLEMA)).toBe("cancelado");
    expect(ln.pendentes).toHaveLength(0);
  });
});
