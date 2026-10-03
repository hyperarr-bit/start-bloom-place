/**
 * LEMBRETE DO DIA 2 / 1ª SEMANA (03/10, lib/lembrete-dia2 + lib/notificacoes).
 * O que este arquivo trava:
 *   · a HORA: a da 1ª abertura de hoje, limitada a 08:00–21:30; a combinada na missão vence;
 *     "sem aviso" na missão = nenhum lembrete;
 *   · REAGENDAR a cada abertura (cancela o pendente, refaz pra amanhã) e PARAR no dia 8;
 *   · conta antiga não ganha a semana (o 1º uso é o dia da conta);
 *   · preferência "Primeira semana" desligada = nada; sem permissão = nada (e nada pede);
 *   · o CONTEÚDO por módulo com e sem número, e o passo de amanhã da missão (uma notificação só);
 *   · a FAIXA de id própria (930000) e a colisão com outro aviso no mesmo minuto;
 *   · a permissão pedida UMA vez: negou ou adiou → não insiste;
 *   · a entrega: o que está na bandeja vira `notif_entregue` uma vez cada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  pedidos: 0,
  pendentes: [] as Array<{ id: number; title?: string; schedule?: { at?: Date }; extra?: Record<string, unknown> }>,
  entregues: [] as Array<{ id: number; title?: string; extra?: Record<string, unknown> }>,
  schedule: vi.fn(async (_: unknown) => ({})),
  cancel: vi.fn(async (_: unknown) => {}),
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => { ln.pedidos += 1; return { display: ln.permissao === "prompt" ? "granted" : ln.permissao }; },
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.pendentes }),
    getDeliveredNotifications: async () => ({ notifications: ln.entregues }),
    cancel: (x: unknown) => ln.cancel(x),
    schedule: (x: unknown) => ln.schedule(x),
  },
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));

import {
  BASE_DIA2, CHAVE_DIA2, DIAS_DE_LEMBRETE, ID_DIA2, HORA_MAX, HORA_MIN, clampHora, combinarHora, conteudoDaMissao, conteudoDoLembrete, conteudoDoModulo,
  diaDoUso, horaDoLembrete, horaSugeridaDaMissao, lerDia2, moduloMaisUsado, planejarLembreteDia2, quandoLembrar, registrarAbertura, type Leitor,
} from "@/lib/lembrete-dia2";
import { FAIXAS_AVULSAS, BASES_LEMBRETES, adiarPermissaoDia2, pedirPermissaoDia2, registrarEntregues, sincronizarLembreteDia2, tipoDoAviso } from "@/lib/notificacoes";
import { CHAVE_ESTADO_MISSAO_DOSES, iniciarMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";

const leitor = (dados: Record<string, unknown>): Leitor => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
const vazio = leitor({});
const as = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);
const agendado = () => (ln.schedule.mock.calls.at(-1)?.[0] as { notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra: Record<string, unknown> }> }).notifications[0];
const ligarShell = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  ln.permissao = "granted";
  ln.pedidos = 0;
  ln.pendentes = [];
  ln.entregues = [];
  ln.schedule.mockClear();
  ln.cancel.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(as(2026, 10, 3, 10, 0)); // sábado 03/10/2026, 10h
});
afterEach(() => { vi.useRealTimers(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ a hora */

describe("a hora do lembrete", () => {
  it("é a da 1ª abertura de HOJE, limitada a 08:00–21:30 (quem abre às 7h recebe às 8h; às 23h, às 21:30)", () => {
    expect(clampHora(7 * 60)).toBe(HORA_MIN);
    expect(clampHora(23 * 60)).toBe(HORA_MAX);
    expect(clampHora(19 * 60 + 17)).toBe(19 * 60 + 17);
    const e = registrarAbertura(as(2026, 10, 3, 6, 40));
    expect(horaDoLembrete(e)).toBe(8 * 60);
    // a 2ª abertura do mesmo dia NÃO muda a hora (a 1ª é a que fica)
    const e2 = registrarAbertura(as(2026, 10, 3, 15, 0));
    expect(e2.abertura).toEqual({ dia: "2026-10-03", min: 6 * 60 + 40 });
    // amanhã a 1ª abertura é outra
    const e3 = registrarAbertura(as(2026, 10, 4, 22, 10));
    expect(e3.abertura).toEqual({ dia: "2026-10-04", min: 22 * 60 + 10 });
    expect(horaDoLembrete(e3)).toBe(HORA_MAX);
  });

  it("amanhã, na hora dela — e o dia da semana/dia do uso batem", () => {
    const e = registrarAbertura(as(2026, 10, 3, 19, 17));
    const q = quandoLembrar(e, as(2026, 10, 3, 19, 17));
    expect("quando" in q && q.quando).toEqual(as(2026, 10, 4, 19, 17));
    expect("quando" in q && q.origemHora).toBe("abertura");
    expect(diaDoUso(e, "2026-10-03")).toBe(1);
    expect(diaDoUso(e, "2026-10-04")).toBe(2);
    expect(diaDoUso(e, "2026-10-10")).toBe(8);
  });

  it("a hora combinada na missão vence a da abertura e vale a semana; 'sem aviso' = nenhum lembrete", () => {
    registrarAbertura(as(2026, 10, 3, 10, 0));
    combinarHora("20h");
    const e = lerDia2()!;
    expect(horaDoLembrete(e)).toBe(20 * 60);
    const q = quandoLembrar(e, as(2026, 10, 3, 10, 0));
    expect("quando" in q && q.quando).toEqual(as(2026, 10, 4, 20, 0));
    expect("quando" in q && q.origemHora).toBe("missao");
    // no dia seguinte a abertura muda, a hora combinada fica
    registrarAbertura(as(2026, 10, 4, 7, 0));
    expect(horaDoLembrete(lerDia2()!)).toBe(20 * 60);
    combinarHora("sem");
    expect(quandoLembrar(lerDia2()!, as(2026, 10, 4, 7, 0))).toEqual({ motivo: "sem_aviso" });
  });

  it("o chip pré-marcado na comemoração é o mais perto da hora da abertura (no app); na web, 12h", () => {
    const e = registrarAbertura(as(2026, 10, 3, 18, 30));
    expect(horaSugeridaDaMissao(e)).toBe("12h"); // web
    ligarShell();
    expect(horaSugeridaDaMissao(e)).toBe("20h");
    expect(horaSugeridaDaMissao(registrarAbertura(as(2026, 10, 4, 9, 10)))).toBe("8h");
    expect(horaSugeridaDaMissao(registrarAbertura(as(2026, 10, 5, 13, 0)))).toBe("12h");
  });

  it("PARA no dia 8: no 7º dia de uso nada é marcado pro 8º; conta antiga não ganha a semana", () => {
    const e = registrarAbertura(as(2026, 10, 3, 10, 0));
    expect(DIAS_DE_LEMBRETE).toBe(7);
    // dia 6 → marca pro dia 7
    expect("quando" in quandoLembrar(e, as(2026, 10, 8, 10, 0))).toBe(true);
    // dia 7 → o de amanhã seria o dia 8: não existe
    expect(quandoLembrar(e, as(2026, 10, 9, 10, 0))).toEqual({ motivo: "fim_da_semana" });
    expect(quandoLembrar(e, as(2026, 10, 20, 10, 0))).toEqual({ motivo: "fim_da_semana" });
    // conta criada em setembro: o 1º uso é o dia da conta → já passou da semana
    localStorage.clear();
    const antiga = registrarAbertura(as(2026, 10, 3, 10, 0), "2026-09-01T12:00:00Z");
    expect(antiga.primeiroUso).toBe("2026-09-01");
    expect(quandoLembrar(antiga, as(2026, 10, 3, 10, 0))).toEqual({ motivo: "fim_da_semana" });
    // conta criada hoje de manhã (compra → cadastro): o 1º uso é hoje
    localStorage.clear();
    expect(registrarAbertura(as(2026, 10, 3, 10, 0), "2026-10-03T11:30:00Z").primeiroUso).toBe("2026-10-03");
  });
});

/* ------------------------------------------------------------ o conteúdo */

describe("o conteúdo: dado da própria pessoa, do módulo que ela mais usou", () => {
  const amanha = as(2026, 10, 4, 19, 0); // domingo

  it("o módulo mais usado pelas chaves que ele grava (empate: a ordem da grade); sem registro, null", () => {
    expect(moduloMaisUsado(vazio)).toBeNull();
    expect(moduloMaisUsado(leitor({ "finance-expenses": [{}], "rotina-habits": ["Água", "Ler"], "rotina-habits-checked": { DOMINGO: [true, true] } }))).toBe("rotina");
    expect(moduloMaisUsado(leitor({ "finance-expenses": [{}, {}], "core-saude-water": { "2026-10-03": 3 } }))).toBe("financas");
  });

  it("Finanças com número: 'Hoje dá pra gastar até R$ X' (orçamento de amanhã); conta que vence amanhã/hoje; sem receita, o texto genérico", () => {
    const c = conteudoDoModulo(leitor({ "finance-incomes": [{ value: 3500 }], "finance-expenses": [{ value: 500 }], "finance-fixed-expenses": [{ value: 1200 }] }), "financas", amanha);
    // (3500 − 1700) / dias restantes de outubro a partir do dia 4 (28) = 64,28 → R$ 64
    expect(c.title).toBe("Hoje dá pra gastar até R$ 64");
    expect(c.temNumero).toBe(true);
    expect(c.rota).toBe("/financas");
    const vence = conteudoDoModulo(leitor({ "finance-dueDays": [{ day: 4, bills: [{ name: "Conta de luz", paid: false }] }] }), "financas", amanha);
    expect(vence.title).toBe("Conta de luz vence hoje");
    const vesp = conteudoDoModulo(leitor({ "finance-dueDays": [{ day: 5, bills: [{ name: "Internet", paid: false }] }] }), "financas", amanha);
    expect(vesp.title).toBe("Internet vence amanhã");
    const paga = conteudoDoModulo(leitor({ "finance-dueDays": [{ day: 4, bills: [{ name: "Conta de luz", paid: true }] }] }), "financas", amanha);
    expect(paga).toMatchObject({ title: "Anota o gasto de hoje", temNumero: false });
  });

  it("Rotina: 'N hábitos te esperando hoje' + a sequência SÓ se hoje já foi anotado; Treino: o grupo do dia; Saúde: a meta de copos; sem dado, o genérico de cada módulo", () => {
    const rot = conteudoDoModulo(leitor({ "rotina-habits": ["Água", "Andar", "Ler"], "core-dias-anotados": ["2026-10-02", "2026-10-03"] }), "rotina", amanha, "2026-10-03");
    expect(rot.title).toBe("3 hábitos te esperando hoje");
    expect(rot.body).toContain("a sua sequência de 2 dias continua");
    const semHoje = conteudoDoModulo(leitor({ "rotina-habits": [{ name: "Água" }], "core-dias-anotados": ["2026-10-01", "2026-10-02"] }), "rotina", amanha, "2026-10-03");
    expect(semHoje.title).toBe("1 hábito te esperando hoje");
    expect(semHoje.body).not.toContain("sequência");
    expect(conteudoDoModulo(vazio, "rotina", amanha)).toMatchObject({ title: "Monta a sua rotina de hoje", temNumero: false });
    const tre = conteudoDoModulo(leitor({ "saude-workouts-v2": { DOMINGO: { muscles: ["Peito", "Tríceps"], exercises: [] } }, "treino-active-days": ["DOMINGO"] }), "treino", amanha);
    expect(tre.title).toBe("Hoje é treino de peito e tríceps");
    const descanso = conteudoDoModulo(leitor({ "saude-workouts-v2": { SEGUNDA: { muscles: ["Costas"] } }, "treino-active-days": ["SEGUNDA"] }), "treino", amanha);
    expect(descanso).toMatchObject({ title: "Monta o treino de hoje", temNumero: false });
    expect(conteudoDoModulo(leitor({ "core-saude-water-goal": 10 }), "saude", amanha)).toMatchObject({ title: "Meta de hoje: 10 copos d'água", temNumero: true });
    expect(conteudoDoModulo(vazio, "saude", amanha).title).toBe("Meta de hoje: 8 copos d'água");
    expect(conteudoDoModulo(leitor({ "lib-books": [{ title: "Hábitos", status: "lendo", pages: 300, currentPage: 260 }] }), "biblioteca", amanha).title).toBe("Faltam 40 páginas de Hábitos");
    expect(conteudoDoModulo(vazio, "pet", amanha)).toMatchObject({ title: "Como está o seu pet hoje?", rota: "/pet", temNumero: false });
  });

  it("com a missão em doses pendente, o conteúdo é o PASSO DE AMANHÃ (uma notificação só); cumprida ou abandonada há dias, volta ao módulo", () => {
    const m: EstadoMissaoDoses = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } };
    const c = conteudoDaMissao(m, "2026-10-03")!;
    expect(c.title).toBe("🔥 Dia 2 da missão: 📅 Rotina");
    expect(c.body).toBe("Marca 1 hábito no quadradinho — 40 segundos e o passo 2 de 3 fica feito (1 de 3 já foram).");
    expect(c.modulo).toBe("missao");
    expect(c.rota).toBe("/rotina");
    // sem boas-vindas vistas ainda (ela nem viu a missão): não promete passo
    expect(conteudoDaMissao({ ...m, boasVindas: false }, "2026-10-03")).toBeNull();
    // cumprida: volta ao módulo
    expect(conteudoDaMissao({ ...m, feitos: { 1: { dia: "a", rotulo: "" }, 2: { dia: "b", rotulo: "" }, 3: { dia: "c", rotulo: "" } } }, "2026-10-05")).toBeNull();
    // abandonada: no dia 6 da missão já não faz sentido "dia 2 da missão"
    expect(conteudoDaMissao(m, "2026-10-08")).toBeNull();
    // o leitor completo: missão primeiro; sem missão, o módulo mais usado; sem nada, a área da porta; sem área, Finanças
    expect(conteudoDoLembrete(leitor({ "core-saude-water": { "2026-10-03": 2 } }), { missao: m, amanha }).modulo).toBe("missao");
    expect(conteudoDoLembrete(leitor({ "core-saude-water": { "2026-10-03": 2 } }), { missao: null, amanha }).modulo).toBe("saude");
    expect(conteudoDoLembrete(vazio, { missao: null, amanha, area: "corpo" }).modulo).toBe("treino");
    expect(conteudoDoLembrete(vazio, { missao: null, amanha }).modulo).toBe("financas");
  });

  it("o plano junta tudo; desligado na central = nada", () => {
    const e = registrarAbertura(as(2026, 10, 3, 9, 30));
    const p = planejarLembreteDia2(leitor({ "rotina-habits": ["Água"] }), e, { ligado: true, missao: null, agora: as(2026, 10, 3, 9, 30) });
    expect(p.ok === true && p.quando).toEqual(as(2026, 10, 4, 9, 30));
    expect(p.ok === true && p.conteudo.modulo).toBe("rotina");
    expect(p.ok === true && p.diaDoUso).toBe(2);
    expect(planejarLembreteDia2(vazio, e, { ligado: false, missao: null })).toEqual({ ok: false, motivo: "desligado" });
  });
});

/* ------------------------------------------------------------ o agendamento */

describe("sincronizarLembreteDia2 — a cada abertura, no app", () => {
  const dados = leitor({ "finance-expenses": [{ value: 30 }], "finance-incomes": [{ value: 3000 }] });

  it("faixa própria (930000), sem colidir com nenhum tipo da central nem com as outras réguas", () => {
    expect(FAIXAS_AVULSAS.dia2).toBe(BASE_DIA2);
    expect(ID_DIA2).toBe(930001);
    for (const base of [...Object.values(BASES_LEMBRETES), FAIXAS_AVULSAS.resgate, FAIXAS_AVULSAS.teste, FAIXAS_AVULSAS.missao, FAIXAS_AVULSAS.missaoAntiga, FAIXAS_AVULSAS.lembreteTeste]) {
      expect(base < BASE_DIA2 ? base + 10000 <= BASE_DIA2 : base >= BASE_DIA2 + 10000, `${base}`).toBe(true);
    }
    expect(tipoDoAviso(930001)).toBe("dia2");
    expect(tipoDoAviso(100931)).toBe("contas");
    expect(tipoDoAviso(900001)).toBe("missao");
    expect(tipoDoAviso(5, { tipo: "x" })).toBe("x");
  });

  it("agenda AMANHÃ na hora da abertura, com o texto da pessoa, extra {tipo, em, rota} e o evento medido", async () => {
    ligarShell();
    vi.setSystemTime(as(2026, 10, 3, 19, 17));
    const r = await sincronizarLembreteDia2(dados, { criadoEm: "2026-10-03T13:00:00Z", area: "dinheiro" });
    expect(r.ok).toBe(true);
    const n = agendado();
    expect(n.id).toBe(ID_DIA2);
    expect(n.schedule.at).toEqual(as(2026, 10, 4, 19, 17));
    expect(n.title).toMatch(/^Hoje dá pra gastar até R\$ /);
    expect(n.extra).toMatchObject({ tipo: "dia2", rota: "/financas", em: as(2026, 10, 4, 19, 17).toISOString() });
    expect(eventos).toContainEqual(["lembrete_dia2_agendado", { ok: true, dia_da_semana_1a7: 7, modulo: "financas", hora: "19:17", tem_numero: true, dia_do_uso: 2, missao: false, origem_hora: "abertura" }]);
    // a 2ª abertura no mesmo dia, sem nada novo: não refaz (nem cancela, nem agenda, nem mede de novo)
    ln.schedule.mockClear(); ln.cancel.mockClear(); eventos.length = 0;
    vi.setSystemTime(as(2026, 10, 3, 21, 0));
    const r2 = await sincronizarLembreteDia2(dados, { criadoEm: "2026-10-03T13:00:00Z" });
    expect(r2.ok && r2.repetido).toBe(true);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos).toEqual([]);
  });

  it("abriu ANTES da hora no dia seguinte: o pendente de hoje é cancelado e o de amanhã nasce na hora nova (1 por dia)", async () => {
    ligarShell();
    vi.setSystemTime(as(2026, 10, 3, 19, 0));
    await sincronizarLembreteDia2(dados, { criadoEm: "2026-10-03T13:00:00Z" });
    ln.pendentes = [{ id: ID_DIA2, schedule: { at: as(2026, 10, 4, 19, 0) } }];
    ln.cancel.mockClear(); ln.schedule.mockClear();
    vi.setSystemTime(as(2026, 10, 4, 9, 5));
    const r = await sincronizarLembreteDia2(dados, { criadoEm: "2026-10-03T13:00:00Z" });
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: ID_DIA2 }] });
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    expect(r.ok && r.quando).toEqual(as(2026, 10, 5, 9, 5));
  });

  it("no 7º dia não agenda nada pro 8º (e cancela o que havia); 'sem aviso' da missão e a pref desligada também limpam", async () => {
    ligarShell();
    registrarAbertura(as(2026, 10, 3, 10, 0));
    ln.pendentes = [{ id: ID_DIA2, schedule: { at: as(2026, 10, 9, 10, 0) } }]; // o que o dia 6 deixou armado pro dia 7
    vi.setSystemTime(as(2026, 10, 9, 10, 0)); // dia 7 do uso
    const r = await sincronizarLembreteDia2(dados, {});
    expect(r).toEqual({ ok: false, motivo: "fim_da_semana" });
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: ID_DIA2 }] });
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos).toContainEqual(["lembrete_dia2_agendado", { ok: false, motivo: "fim_da_semana" }]);
    localStorage.clear(); ln.schedule.mockClear();
    vi.setSystemTime(as(2026, 10, 3, 10, 0));
    expect(await sincronizarLembreteDia2(dados, { ligado: false })).toEqual({ ok: false, motivo: "desligado" });
    combinarHora("sem");
    expect(await sincronizarLembreteDia2(dados, {})).toEqual({ ok: false, motivo: "sem_aviso" });
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it("sem permissão: nada agenda e NADA é pedido aqui (quem pede é a missão/pré-folha); o motivo vira evento uma vez só", async () => {
    ligarShell();
    ln.permissao = "prompt";
    expect(await sincronizarLembreteDia2(dados, {})).toEqual({ ok: false, motivo: "sem_permissao_prompt" });
    await sincronizarLembreteDia2(dados, {});
    expect(ln.pedidos).toBe(0);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos.filter(([n]) => n === "lembrete_dia2_agendado")).toHaveLength(1);
    ln.permissao = "denied";
    expect(await sincronizarLembreteDia2(dados, {})).toEqual({ ok: false, motivo: "sem_permissao_denied" });
  });

  it("não empilha com outro aviso nosso no mesmo minuto (rotina às 21h × abertura às 21h) — mede 'ja_tem_aviso'", async () => {
    ligarShell();
    ln.pendentes = [{ id: 301004, title: "Bora fechar o dia?", schedule: { at: as(2026, 10, 4, 21, 0) } }];
    vi.setSystemTime(as(2026, 10, 3, 21, 0));
    expect(await sincronizarLembreteDia2(dados, {})).toEqual({ ok: false, motivo: "ja_tem_aviso" });
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos).toContainEqual(["lembrete_dia2_agendado", { ok: false, motivo: "ja_tem_aviso", hora: "21:00" }]);
  });

  it("com a missão em doses pendente, a notificação é o passo de amanhã — e a hora combinada (20h) manda", async () => {
    ligarShell();
    vi.setSystemTime(as(2026, 10, 3, 10, 0));
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-03");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } }, lembrete: "20h" }));
    combinarHora("20h");
    const r = await sincronizarLembreteDia2(dados, { criadoEm: "2026-10-03T12:00:00Z" });
    expect(r.ok && r.title).toBe("🔥 Dia 2 da missão: 📅 Rotina");
    expect(agendado().schedule.at).toEqual(as(2026, 10, 4, 20, 0));
    expect(agendado().extra.rota).toBe("/rotina");
    expect(ln.schedule).toHaveBeenCalledTimes(1); // UMA notificação: nada de "dia 2" + "missão" separados
    expect(eventos).toContainEqual(["lembrete_dia2_agendado", expect.objectContaining({ ok: true, modulo: "missao", missao: true, hora: "20:00", origem_hora: "missao" })]);
  });

  it("fora do app da loja não faz nada", async () => {
    expect(await sincronizarLembreteDia2(dados, {})).toEqual({ ok: false, motivo: "sem_plugin" });
    expect(localStorage.getItem(CHAVE_DIA2)).toBeNull();
  });
});

/* ------------------------------------------------------------ a permissão */

describe("pedirPermissaoDia2 — uma vez, e não insiste", () => {
  it("pede, concede, mede; a 2ª chamada não pede de novo; negada = 'negou' e fica gravado", async () => {
    ligarShell();
    ln.permissao = "prompt";
    expect(await pedirPermissaoDia2("missao")).toBe("concedeu");
    expect(ln.pedidos).toBe(1);
    expect(eventos).toContainEqual(["lembrete_dia2_permissao", { resultado: "concedeu", origem: "missao" }]);
    expect(lerDia2()?.permissao).toMatchObject({ resultado: "concedeu", origem: "missao" });
    // o sistema agora diz granted
    ln.permissao = "granted";
    expect(await pedirPermissaoDia2("pre_folha")).toBe("ja_tinha");
    expect(ln.pedidos).toBe(1);
  });

  it("'Agora não' na pré-folha conta como a única vez: depois disso, nem a missão pede", async () => {
    ligarShell();
    ln.permissao = "prompt";
    adiarPermissaoDia2("pre_folha");
    expect(eventos).toContainEqual(["lembrete_dia2_permissao", { resultado: "agora_nao", origem: "pre_folha" }]);
    expect(await pedirPermissaoDia2("missao")).toBe("ja_pedida");
    expect(ln.pedidos).toBe(0);
  });

  it("negada no sistema: 'negou', sem pedir (o sistema não mostraria mesmo)", async () => {
    ligarShell();
    ln.permissao = "denied";
    expect(await pedirPermissaoDia2("missao")).toBe("negou");
    expect(ln.pedidos).toBe(0);
    expect(lerDia2()?.permissao?.resultado).toBe("negada_antes");
  });
});

/* ------------------------------------------------------------ a entrega */

describe("registrarEntregues — o que está na bandeja vira notif_entregue, uma vez cada", () => {
  it("conta cada notificação uma vez (id + em/título), com o tipo pela faixa ou pelo extra", async () => {
    ligarShell();
    ln.entregues = [
      { id: ID_DIA2, title: "Hoje dá pra gastar até R$ 64", extra: { tipo: "dia2", em: "2026-10-04T22:00:00.000Z", rota: "/financas" } },
      { id: 100905, title: "1 conta vence amanhã", extra: { rota: "/financas" } },
    ];
    expect(await registrarEntregues()).toBe(2);
    expect(eventos).toContainEqual(["notif_entregue", { id: ID_DIA2, tipo: "dia2", rota: "/financas", em: "2026-10-04T22:00:00.000Z" }]);
    expect(eventos).toContainEqual(["notif_entregue", { id: 100905, tipo: "contas", rota: "/financas", em: null }]);
    // a mesma bandeja na próxima abertura: nada novo
    expect(await registrarEntregues()).toBe(0);
    // o lembrete do dia seguinte (mesmo id, outro `em`) conta de novo
    ln.entregues.push({ id: ID_DIA2, title: "3 hábitos te esperando hoje", extra: { tipo: "dia2", em: "2026-10-05T22:00:00.000Z", rota: "/rotina" } });
    expect(await registrarEntregues()).toBe(1);
  });
});
