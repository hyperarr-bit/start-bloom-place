/**
 * RECUPERAÇÃO DO PAYWALL (1.0.14, chave RECUPERACAO_PAYWALL em lib/ofertas-saida) — os dois
 * avisos locais de quem saiu do paywall do funil sem iniciar o teste: +3 h e às 9h da manhã
 * seguinte, faixa 950000, só com permissão já concedida (nunca pede), cancelados quando o
 * teste começa. Eventos: recuperacao_paywall_armada {ok, motivo}; o toque sai como
 * notif_toque tipo=recuperacao_paywall (pelo extra.tipo). Ver lib/notificacoes.
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

import {
  FAIXAS_AVULSAS, BASES_LEMBRETES, HORAS_ATE_A_RECUPERACAO, HORA_DA_MANHA_DA_RECUPERACAO, agendarRecuperacaoDoPaywall, cancelarRecuperacaoDoPaywall,
  copyDaRecuperacaoDoPaywall, quandoRecuperacaoDoPaywall, tipoDoAviso,
} from "@/lib/notificacoes";

beforeEach(() => {
  ln.permissao = "granted";
  ln.pendentes = [];
  ln.schedule.mockClear();
  ln.cancel.mockClear();
  eventos.length = 0;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
});
afterEach(() => { delete (window as { Capacitor?: unknown }).Capacitor; });

describe("faixa, horários e copy", () => {
  it("mora em 950000, longe das faixas da central e das outras réguas; o toque sai como recuperacao_paywall", () => {
    expect(FAIXAS_AVULSAS.recuperacaoPaywall).toBe(950000);
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) expect(base + 10000 <= 950000 || base >= 960000, tipo).toBe(true);
    for (const [nome, base] of Object.entries(FAIXAS_AVULSAS)) if (nome !== "recuperacaoPaywall") expect(base !== 950000, nome).toBe(true);
    expect(tipoDoAviso(950001, { tipo: "recuperacao_paywall" })).toBe("recuperacao_paywall");
    expect(tipoDoAviso(950002)).toBe("recuperacaoPaywall");
  });

  it("+3 h e a próxima 9h da manhã DEPOIS do 1º aviso", () => {
    expect(HORAS_ATE_A_RECUPERACAO).toBe(3);
    expect(HORA_DA_MANHA_DA_RECUPERACAO).toBe(9);
    const tarde = quandoRecuperacaoDoPaywall(new Date(2026, 9, 10, 15, 0));
    expect(tarde.tresHoras).toEqual(new Date(2026, 9, 10, 18, 0));
    expect(tarde.manha).toEqual(new Date(2026, 9, 11, 9, 0));
    const madrugada = quandoRecuperacaoDoPaywall(new Date(2026, 9, 10, 23, 30));
    expect(madrugada.tresHoras).toEqual(new Date(2026, 9, 11, 2, 30));
    expect(madrugada.manha).toEqual(new Date(2026, 9, 11, 9, 0));
    const cedo = quandoRecuperacaoDoPaywall(new Date(2026, 9, 10, 5, 0));
    expect(cedo.tresHoras).toEqual(new Date(2026, 9, 10, 8, 0));
    expect(cedo.manha).toEqual(new Date(2026, 9, 10, 9, 0));
    const seteDaManha = quandoRecuperacaoDoPaywall(new Date(2026, 9, 10, 7, 0));
    expect(seteDaManha.tresHoras).toEqual(new Date(2026, 9, 10, 10, 0));
    expect(seteDaManha.manha).toEqual(new Date(2026, 9, 11, 9, 0)); // as 9h de hoje já passaram quando o 1º aviso sai
  });

  it("os dois textos são diferentes, falam da área e dos 3 dias grátis, e nada de cobrança hoje", () => {
    const c = copyDaRecuperacaoDoPaywall("Dinheiro");
    expect(c.tresHoras.title).toBe("Seu plano de Dinheiro ficou salvo");
    expect(c.tresHoras.body).toMatch(/3 dias grátis/);
    expect(c.tresHoras.body).toMatch(/Nada é cobrado hoje/);
    expect(c.manha.title).not.toBe(c.tresHoras.title);
    expect(c.manha.body).toMatch(/Seu plano de Dinheiro/);
    expect(c.manha.body).toMatch(/3 dias grátis/);
    expect(copyDaRecuperacaoDoPaywall(null).tresHoras.title).toBe("Seu plano ficou salvo");
  });
});

describe("agendarRecuperacaoDoPaywall / cancelarRecuperacaoDoPaywall", () => {
  it("permissão concedida: arma 950001 (+3 h) e 950002 (manhã), com rota do funil e tipo; evento ok:true; armar de novo substitui", async () => {
    const r = await agendarRecuperacaoDoPaywall("Rotina", new Date(2026, 9, 10, 15, 0));
    expect(r.ok).toBe(true);
    expect(ln.pendentes.map((n) => n.id)).toEqual([950001, 950002]);
    expect(ln.pendentes[0].schedule?.at).toEqual(new Date(2026, 9, 10, 18, 0));
    expect(ln.pendentes[1].schedule?.at).toEqual(new Date(2026, 9, 11, 9, 0));
    expect(ln.pendentes[0].title).toBe("Seu plano de Rotina ficou salvo");
    expect(ln.pendentes[0].extra).toMatchObject({ tipo: "recuperacao_paywall", rota: "/app" });
    expect(ln.pendentes[1].extra).toMatchObject({ tipo: "recuperacao_paywall", rota: "/app" });
    expect(eventos).toEqual([["recuperacao_paywall_armada", expect.objectContaining({ ok: true })]]);
    await agendarRecuperacaoDoPaywall("Rotina", new Date(2026, 9, 10, 16, 0));
    expect(ln.pendentes.map((n) => n.id)).toEqual([950001, 950002]); // substituiu, não duplicou
    expect(ln.pendentes[0].schedule?.at).toEqual(new Date(2026, 9, 10, 19, 0));
  });

  it("sem permissão: NÃO pede, não arma, evento ok:false motivo sem_permissao", async () => {
    ln.permissao = "prompt";
    const r = await agendarRecuperacaoDoPaywall("Dinheiro");
    expect(r).toEqual({ ok: false, motivo: "sem_permissao" });
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos).toEqual([["recuperacao_paywall_armada", { ok: false, motivo: "sem_permissao" }]]);
    ln.permissao = "denied";
    expect((await agendarRecuperacaoDoPaywall("Dinheiro")).ok).toBe(false);
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it("cancelar (o teste começou) limpa só a faixa 950000", async () => {
    ln.pendentes.push({ id: 940001 }, { id: 930001 });
    await agendarRecuperacaoDoPaywall("Dinheiro", new Date(2026, 9, 10, 15, 0));
    expect(ln.pendentes).toHaveLength(4);
    await cancelarRecuperacaoDoPaywall();
    expect(ln.pendentes.map((n) => n.id)).toEqual([940001, 930001]);
  });
});
