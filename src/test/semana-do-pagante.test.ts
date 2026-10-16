/**
 * SEMANA DO PAGANTE (16/10, lib/semana-do-pagante + lib/notificacoes). O que este arquivo trava:
 *   · a verdade da loja: teste com renovação ligada arma pro fim do teste; compra paga recente
 *     confirma (sem mudar o começo); teste cancelado desarma; renovação de 1 ano não começa outra semana;
 *   · os 7 avisos: ids 960001–960007, na hora de uso, nunca hoje nem no passado, rodízio
 *     Finanças → Rotina → Saúde sem repetir texto, domingo = resumo da semana, número no de amanhã;
 *   · nada de preço, cobrança, assinatura, cancelar;
 *   · a chave "Primeira semana" desligada = nada; "sem aviso" na missão = nada;
 *   · o lembrete do dia 2 CEDE o dia que a semana cobre (1 notificação por dia);
 *   · a faixa 960000 não colide com ninguém; a chave do aparelho está classificada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  pendentes: [] as Array<{ id: number; title?: string; body?: string; schedule?: { at?: Date }; extra?: Record<string, unknown> }>,
  schedule: vi.fn(async (x: { notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra: Record<string, unknown> }> }) => {
    for (const n of x.notifications) { ln.pendentes = ln.pendentes.filter((p) => p.id !== n.id); ln.pendentes.push(n); }
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
    getDeliveredNotifications: async () => ({ notifications: [] }),
    cancel: (x: Parameters<typeof ln.cancel>[0]) => ln.cancel(x),
    schedule: (x: Parameters<typeof ln.schedule>[0]) => ln.schedule(x),
  },
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));

import {
  BASE_SEMANA_PAGANTE, CHAVE_SEMANA_PAGANTE, TEXTOS_DA_SEMANA, TEXTO_DO_DOMINGO, conferirSemanaDoPagante, decidirSemanaDoPagante,
  lerSemanaDoPagante, gravarSemanaDoPagante, planejarSemanaDoPagante, type EstadoSemanaPagante,
} from "@/lib/semana-do-pagante";
import { BASES_LEMBRETES, FAIXAS_AVULSAS, cancelarLembreteDia2, sincronizarLembreteDia2, tipoDoAviso } from "@/lib/notificacoes";
import { BASE_DIA2, EVENTO_DIA2, type Leitor } from "@/lib/lembrete-dia2";
import { ehChaveDoAparelho } from "@/lib/chaves-do-aparelho";

const D = 86_400_000;
const leitor = (dados: Record<string, unknown>): Leitor => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
const vazio = leitor({});
const as = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);
const ligarShell = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const PROIBIDO = /cancel|cobran|cobra|cart[aã]o|R\$\s?\d+,\d{2}\b(?! )|pre[cç]o|assinatura|Apple|App Store|teste grátis|vitalíc/i;

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  ln.permissao = "granted";
  ln.pendentes = [];
  ln.schedule.mockClear();
  ln.cancel.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(as(2026, 10, 14, 10, 0)); // quarta 14/10/2026, 10h
});
afterEach(() => { vi.useRealTimers(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ a verdade da loja */

describe("decidirSemanaDoPagante — pelos entitlements ativos do RevenueCat", () => {
  const agora = as(2026, 10, 14, 10).getTime();

  it("teste com renovação ligada: arma pro FIM do teste (antes da cobrança, que a pessoa costuma não abrir)", () => {
    const fim = agora + 2 * D;
    const d = decidirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: true, expirationDateMillis: fim } }, null, agora);
    expect(d).toEqual({ acao: "armar", estado: { v: 1, inicioMs: fim, origem: "fim_do_teste" } });
    // de novo, com o mesmo fim: nada a fazer
    expect(decidirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: true, expirationDateMillis: fim } }, { v: 1, inicioMs: fim, origem: "fim_do_teste" }, agora).acao).toBe("nada");
  });

  it("teste cancelado (willRenew false ou unsubscribe): desarma o que estava armado", () => {
    const atual: EstadoSemanaPagante = { v: 1, inicioMs: agora + D, origem: "fim_do_teste" };
    expect(decidirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: false, expirationDateMillis: agora + D } }, atual, agora)).toEqual({ acao: "cancelar" });
    expect(decidirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: true, unsubscribeDetectedAt: "2026-10-13", expirationDateMillis: agora + D } }, atual, agora)).toEqual({ acao: "cancelar" });
    expect(decidirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: false } }, null, agora)).toEqual({ acao: "nada" });
  });

  it("pagou agora (teste virou ano pago): confirma mantendo o começo do fim do teste", () => {
    const fimDoTeste = agora - 3 * 3600e3;
    const atual: EstadoSemanaPagante = { v: 1, inicioMs: fimDoTeste, origem: "fim_do_teste" };
    const d = decidirSemanaDoPagante({ pro: { periodType: "NORMAL", latestPurchaseDateMillis: fimDoTeste + 60e3, originalPurchaseDateMillis: agora - 3 * D } }, atual, agora);
    expect(d).toEqual({ acao: "armar", estado: { v: 1, inicioMs: fimDoTeste, origem: "fim_do_teste", confirmado: true } });
    // já confirmado: nada
    expect(decidirSemanaDoPagante({ pro: { periodType: "NORMAL", latestPurchaseDateMillis: fimDoTeste, originalPurchaseDateMillis: agora - 3 * D } }, { ...atual, confirmado: true }, agora).acao).toBe("nada");
  });

  it("comprou sem teste (ou a build não sabia do teste): começa na compra", () => {
    const compra = agora - 2 * D;
    expect(decidirSemanaDoPagante({ pro: { periodType: "NORMAL", latestPurchaseDateMillis: compra, originalPurchaseDateMillis: compra } }, null, agora))
      .toEqual({ acao: "armar", estado: { v: 1, inicioMs: compra, origem: "compra", confirmado: true } });
  });

  it("renovação (compra original antiga), pagamento de mais de 7 dias ou sem data: nada", () => {
    expect(decidirSemanaDoPagante({ pro: { periodType: "NORMAL", latestPurchaseDateMillis: agora - D, originalPurchaseDateMillis: agora - 370 * D } }, null, agora).acao).toBe("nada");
    expect(decidirSemanaDoPagante({ pro: { periodType: "NORMAL", latestPurchaseDateMillis: agora - 9 * D, originalPurchaseDateMillis: agora - 9 * D } }, null, agora).acao).toBe("nada");
    expect(decidirSemanaDoPagante({ pro: { periodType: "NORMAL" } }, null, agora).acao).toBe("nada");
    expect(decidirSemanaDoPagante({}, null, agora).acao).toBe("nada");
    expect(decidirSemanaDoPagante(null, null, agora).acao).toBe("nada");
  });

  it("conferirSemanaDoPagante grava, conta o evento e pede o reagendamento (EVENTO_DIA2)", () => {
    const ouvido = vi.fn();
    window.addEventListener(EVENTO_DIA2, ouvido);
    try {
      expect(conferirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: true, expirationDateMillis: agora + D } }, agora)).toBe("armar");
      expect(lerSemanaDoPagante()).toMatchObject({ inicioMs: agora + D, origem: "fim_do_teste" });
      expect(ouvido).toHaveBeenCalledTimes(1);
      expect(eventos).toContainEqual(["semana_pagante_estado", { acao: "armar", origem: "fim_do_teste", confirmado: false }]);
      expect(conferirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: false, expirationDateMillis: agora + D } }, agora)).toBe("cancelar");
      expect(lerSemanaDoPagante()).toBeNull();
      expect(ouvido).toHaveBeenCalledTimes(2);
    } finally { window.removeEventListener(EVENTO_DIA2, ouvido); }
  });
});

/* ------------------------------------------------------------ o plano */

describe("planejarSemanaDoPagante — os 7 avisos", () => {
  // pagou na quarta 14/10 às 15h (fim do teste); a hora de uso dela é 20h
  const estado: EstadoSemanaPagante = { v: 1, inicioMs: as(2026, 10, 14, 15).getTime(), origem: "fim_do_teste" };

  it("armado ANTES (no dia 2 do teste, segunda 12/10): 7 avisos, 1 por dia, às 20h, ids 960001–960007, começando no dia da cobrança", () => {
    const plano = planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: 20 * 60, agora: as(2026, 10, 12, 9) });
    expect(plano.ok).toBe(true);
    if (plano.ok !== true) return;
    expect(plano.avisos.map((a) => a.id)).toEqual([960001, 960002, 960003, 960004, 960005, 960006, 960007]);
    expect(plano.avisos[0].quando).toEqual(as(2026, 10, 14, 20));
    expect(plano.avisos[6].quando).toEqual(as(2026, 10, 20, 20));
    for (const a of plano.avisos) expect(a.quando.getHours()).toBe(20);
  });

  it("hora antes do pagamento (9h, pagou às 15h): o 1º aviso é no dia seguinte — continuam 7", () => {
    const plano = planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: 9 * 60, agora: as(2026, 10, 12, 9) });
    if (plano.ok !== true) throw new Error("devia planejar");
    expect(plano.avisos).toHaveLength(7);
    expect(plano.avisos[0].quando).toEqual(as(2026, 10, 15, 9));
  });

  it("nunca hoje (ela já abriu) nem no passado: abrindo na sexta 16/10, sobram os dias 4–7", () => {
    const plano = planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: 20 * 60, agora: as(2026, 10, 16, 8) });
    if (plano.ok !== true) throw new Error("devia planejar");
    expect(plano.avisos.map((a) => a.dia)).toEqual([4, 5, 6, 7]);
    expect(plano.avisos[0].quando).toEqual(as(2026, 10, 17, 20));
  });

  it("rodízio Finanças → Rotina → Saúde, sem repetir texto; domingo é o resumo da semana; tudo sem preço/cobrança/cancelar", () => {
    const plano = planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: 20 * 60, agora: as(2026, 10, 12, 9) });
    if (plano.ok !== true) throw new Error("devia planejar");
    // 14/10 qua, 15 qui, 16 sex, 17 sáb, 18 DOM, 19 seg, 20 ter
    expect(plano.avisos.map((a) => a.modulo)).toEqual(["financas", "rotina", "saude", "financas", "resumo", "rotina", "saude"]);
    expect(plano.avisos[4]).toMatchObject({ title: TEXTO_DO_DOMINGO.title, body: TEXTO_DO_DOMINGO.body, rota: "/home" });
    expect(plano.avisos.map((a) => a.rota)).toEqual(["/financas", "/rotina", "/saude", "/financas", "/home", "/rotina", "/saude"]);
    const titulos = plano.avisos.map((a) => a.title);
    expect(new Set(titulos).size).toBe(titulos.length);
    for (const a of plano.avisos) {
      expect(`${a.title} ${a.body}`).not.toMatch(PROIBIDO);
      expect(a.title.length).toBeLessThanOrEqual(60);
      expect(a.body.length).toBeLessThanOrEqual(120);
    }
    for (const lista of Object.values(TEXTOS_DA_SEMANA)) for (const t of lista) expect(`${t.title} ${t.body}`).not.toMatch(PROIBIDO);
  });

  it("começa pelo módulo que ela mais usa (Rotina com hábitos)", () => {
    const get = leitor({ "rotina-habits": [{ id: "h1", name: "Ler" }, { id: "h2", name: "Correr" }] });
    const plano = planejarSemanaDoPagante(get, estado, { ligado: true, hora: 20 * 60, agora: as(2026, 10, 12, 9) });
    if (plano.ok !== true) throw new Error("devia planejar");
    expect(plano.avisos[0].modulo).toBe("rotina");
    expect(plano.avisos[1].modulo).toBe("saude");
  });

  it("o de AMANHÃ leva o número dela quando existe (Finanças com renda: quanto dá pra gastar)", () => {
    const get = leitor({ "finance-incomes": [{ value: 3000 }], "finance-expenses": [], "finance-fixed-expenses": [] });
    const plano = planejarSemanaDoPagante(get, estado, { ligado: true, hora: 20 * 60, agora: as(2026, 10, 13, 9) });
    if (plano.ok !== true) throw new Error("devia planejar");
    expect(plano.avisos[0].modulo).toBe("financas");
    expect(plano.avisos[0].temNumero).toBe(true);
    expect(plano.avisos[0].title).toMatch(/Hoje dá pra gastar até R\$ /);
    expect(plano.avisos.slice(1).every((a) => !a.temNumero)).toBe(true);
  });

  it("desligado, sem estado, 'sem aviso' na missão ou semana já passada: nada", () => {
    expect(planejarSemanaDoPagante(vazio, estado, { ligado: false, hora: 600 })).toEqual({ ok: false, motivo: "desligado" });
    expect(planejarSemanaDoPagante(vazio, null, { ligado: true, hora: 600 })).toEqual({ ok: false, motivo: "sem_estado" });
    expect(planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: "sem" })).toEqual({ ok: false, motivo: "sem_aviso" });
    expect(planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: 600, agora: as(2026, 10, 25, 9) })).toEqual({ ok: false, motivo: "fim_da_semana" });
  });

  it("hora fora de 08:00–21:30 é puxada pra dentro (madrugada nunca)", () => {
    const plano = planejarSemanaDoPagante(vazio, estado, { ligado: true, hora: 2 * 60, agora: as(2026, 10, 12, 9) });
    if (plano.ok !== true) throw new Error("devia planejar");
    for (const a of plano.avisos) expect(a.quando.getHours()).toBe(8);
  });
});

/* ------------------------------------------------------------ no aparelho */

describe("no app: agenda junto com o lembrete do dia 2 e ganha o dia", () => {
  it("sincronizarLembreteDia2 arma os 7 da semana; o dia 2 de amanhã CEDE (o dia já tem aviso)", async () => {
    ligarShell();
    vi.setSystemTime(as(2026, 10, 14, 16)); // pagou às 15h, abriu às 16h
    gravarSemanaDoPagante({ v: 1, inicioMs: as(2026, 10, 14, 15).getTime(), origem: "compra", confirmado: true });
    const r = await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-11T13:00:00Z" });
    expect(r).toEqual({ ok: false, motivo: "semana_do_pagante" });
    const daSemana = ln.pendentes.filter((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000);
    // hoje (14/10, já abriu às 16h — a hora de uso) fica de fora; 15–20/10
    expect(daSemana.map((n) => n.id)).toEqual([960002, 960003, 960004, 960005, 960006, 960007]);
    expect(daSemana[0].schedule?.at).toEqual(as(2026, 10, 15, 16));
    expect(daSemana[0].extra).toMatchObject({ tipo: "semana_pagante", dia: 2 });
    expect(ln.pendentes.some((n) => n.id >= BASE_DIA2 && n.id < BASE_DIA2 + 10000)).toBe(false);
    expect(eventos.find((e) => e[0] === "semana_pagante_agendada")?.[1]).toMatchObject({ ok: true, avisos: 6, confirmado: true, origem: "compra", hora: "16:00" });
    expect(eventos).toContainEqual(["lembrete_dia2_agendado", expect.objectContaining({ ok: false, motivo: "semana_do_pagante" })]);
    // reabrir igual: nada é refeito
    ln.schedule.mockClear();
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-11T13:00:00Z" });
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it("sem semana do pagante, o dia 2 segue como sempre", async () => {
    ligarShell();
    const r = await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-14T13:00:00Z" });
    expect(r.ok).toBe(true);
    expect(ln.pendentes.some((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000)).toBe(false);
  });

  it("chave 'Primeira semana' desligada: a semana do pagante também não arma; cancelarLembreteDia2 limpa as duas", async () => {
    ligarShell();
    gravarSemanaDoPagante({ v: 1, inicioMs: as(2026, 10, 14, 15).getTime(), origem: "compra", confirmado: true });
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-11T13:00:00Z", ligado: false });
    expect(ln.pendentes.some((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000)).toBe(false);
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-11T13:00:00Z", ligado: true });
    expect(ln.pendentes.filter((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000).length).toBeGreaterThan(0);
    await cancelarLembreteDia2();
    expect(ln.pendentes.some((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000)).toBe(false);
    // religar volta a armar (o estado ficou; só o 'último agendamento' saiu)
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-11T13:00:00Z", ligado: true });
    expect(ln.pendentes.filter((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000).length).toBeGreaterThan(0);
  });

  it("sem permissão: nada é agendado (e nada pede)", async () => {
    ligarShell();
    ln.permissao = "prompt";
    gravarSemanaDoPagante({ v: 1, inicioMs: as(2026, 10, 14, 15).getTime(), origem: "compra", confirmado: true });
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-11T13:00:00Z" });
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it("teste cancelado depois de armado: o estado some e a próxima sincronização limpa a faixa", async () => {
    ligarShell();
    const agora = Date.now();
    conferirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: true, expirationDateMillis: agora + 2 * D } }, agora);
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-12T13:00:00Z" });
    expect(ln.pendentes.filter((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000)).toHaveLength(7);
    conferirSemanaDoPagante({ pro: { periodType: "TRIAL", willRenew: false, expirationDateMillis: agora + 2 * D } }, agora);
    await sincronizarLembreteDia2(vazio, { criadoEm: "2026-10-12T13:00:00Z" });
    expect(ln.pendentes.some((n) => n.id >= BASE_SEMANA_PAGANTE && n.id < BASE_SEMANA_PAGANTE + 10000)).toBe(false);
  });
});

describe("faixa e chave", () => {
  it("960000 é avulsa, não colide com nenhum tipo nem régua; o toque vira tipo semanaPagante", () => {
    expect(FAIXAS_AVULSAS.semanaPagante).toBe(960000);
    const sobrepoe = (a: number, b: number) => a < b + 10000 && b < a + 10000;
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) expect(sobrepoe(960000, base), tipo).toBe(false);
    for (const [regua, base] of Object.entries(FAIXAS_AVULSAS)) if (regua !== "semanaPagante") expect(sobrepoe(960000, base), regua).toBe(false);
    expect(tipoDoAviso(960003)).toBe("semanaPagante");
  });

  it("a chave mora no aparelho (nenhuma vassoura apaga)", () => {
    expect(CHAVE_SEMANA_PAGANTE).toBe("core-semana-pagante");
    expect(ehChaveDoAparelho(CHAVE_SEMANA_PAGANTE)).toBe(true);
  });
});
