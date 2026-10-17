/**
 * O AVISO DO TESTE GRÁTIS DO iPHONE (920001) — 1.0.16 (desenho 8, seção 4.6; defeitos 11 e 12).
 *
 * O paywall promete "Dia 2 (DD/MM) · a gente te avisa" e "Nada é cobrado sem aviso". ESTE é o aviso:
 *   · cai NO DIA que o paywall mostrou (PaywallIOS.diaDoAviso = o dia da compra + N − 2), na hora DELA
 *     (a combinada no "Plano de amanhã", senão a 1ª abertura do dia em que foi armado — e ela não muda
 *     depois), entre 09:00 e 20:30, nunca menos de 6 h depois do início nem menos de 24 h antes do fim;
 *   · já marcado, nunca vira "daqui a 10 min"; já tocou, nunca é refeito (nada de 2º aviso no mesmo dia);
 *   · com o lembrete da sequência ligado (à noite), o aviso do dia não empilha com ele: vai pra hora de uso;
 *   · texto: "Seu teste grátis termina amanhã" + "Seu plano anual começa sozinho e tudo que você montou
 *     fica com você." + a dose de hoje da missão nova (ou "Hoje dá pra gastar até R$ X") — sem cancelar,
 *     sem cobrança, sem preço do plano, sem "24 h", sem "sem cartão" (regra do dono: o problema nunca foi
 *     falar do teste, e sim empurrar a saída);
 *   · o toque abre o módulo da dose (ou a Home), NUNCA /planos;
 *   · armado quando a permissão chega, reagendado com o fim real da loja, DESARMADO se cancelar/assinar;
 *   · no dia em que ele sai, o lembrete diário (930001) cede: 1 notificação de teste por dia.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  pendentes: [] as Array<{ id: number; title?: string; schedule?: { at?: Date } }>,
  schedule: vi.fn(async (x: { notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra?: { rota?: string } }> }) => {
    for (const n of x.notifications) ln.pendentes.push({ id: n.id, title: n.title, schedule: n.schedule });
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
  quandoLembrarDoTeste, copyDoLembreteDoTeste, pedirLembreteDoTeste, armarLembreteDoTesteSePuder, diaDoAvisoDoTeste,
  sincronizarLembreteDoTeste, cancelarLembreteDoTeste, pedidoDeLembreteDoTeste, FAIXAS_AVULSAS, BASES_LEMBRETES, sincronizarLembreteDia2,
  horaSemEmpilhar, avisoDoTesteNoDia,
} from "@/lib/notificacoes";
import { diaDoAviso } from "@/pages/funis/ios/PaywallIOS";
import { combinarHora, conteudoDaMissao, registrarAbertura } from "@/lib/lembrete-dia2";
import { localDayKey } from "@/lib/utils";

const H = 3600e3;
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const PROIBIDO = /cancel|cobr|R\$ ?97|pre[cç]o|24 ?h|sem cart[aã]o|vitalíc|pra sempre/i;
const missaoA = (feitos: Record<number, { dia: string; rotulo: string }>, extra: Record<string, unknown> = {}) =>
  localStorage.setItem("missao-doses", JSON.stringify({ v: 1, inicio: "2026-10-01", modulos: ["financas", "rotina", "saude"], feitos, boasVindas: true, braco: "A", ...extra }));

beforeEach(() => {
  localStorage.clear();
  ln.permissao = "granted";
  ln.pendentes = [];
  ln.schedule.mockClear();
  ln.cancel.mockClear();
  eventos.length = 0;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  vi.stubEnv("VITE_V14_LOJA", "1");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 1, 15, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("quandoLembrarDoTeste — o dia que o paywall prometeu", () => {
  it("início às 08h, 14h, 20h e 23h30 (teste de 3 dias): o aviso cai em diaDoAviso() do paywall, ≥ 6 h depois do início e ≥ 24 h antes do fim", () => {
    for (const [hh, mm] of [[8, 0], [14, 0], [20, 0], [23, 30]]) {
      const inicio = new Date(2026, 9, 1, hh, mm, 0);
      const fim = inicio.getTime() + 3 * 24 * H;
      const alvo = quandoLembrarDoTeste(fim, inicio.getTime(), { inicioMs: inicio.getTime() })!;
      expect(alvo, `${hh}:${mm}`).not.toBeNull();
      expect(ddmm(localDayKey(alvo)), `${hh}:${mm}`).toBe(diaDoAviso(3, inicio));
      expect(alvo.getTime() - inicio.getTime(), `${hh}:${mm}`).toBeGreaterThanOrEqual(6 * H);
      expect(fim - alvo.getTime(), `${hh}:${mm}`).toBeGreaterThanOrEqual(24 * H);
    }
  });

  it("qualquer hora de início, 3 ou 7 dias, qualquer hora dela: sempre no dia prometido, das 9h às 20h30", () => {
    for (const dias of [3, 7]) {
      for (let hora = 0; hora < 24; hora++) {
        for (const pessoa of [null, 7 * 60, 12 * 60, 22 * 60]) {
          const inicio = new Date(2026, 9, 1, hora, 17, 0);
          const fim = inicio.getTime() + dias * 24 * H;
          const alvo = quandoLembrarDoTeste(fim, inicio.getTime(), { horaMin: pessoa, inicioMs: inicio.getTime() });
          const rotulo = `dias=${dias} hora=${hora} pessoa=${pessoa}`;
          expect(alvo, rotulo).not.toBeNull();
          expect(ddmm(localDayKey(alvo!)), rotulo).toBe(diaDoAviso(dias, inicio));
          const min = alvo!.getHours() * 60 + alvo!.getMinutes();
          expect(min, rotulo).toBeGreaterThanOrEqual(9 * 60);
          expect(min, rotulo).toBeLessThanOrEqual(20 * 60 + 30);
          expect(fim - alvo!.getTime(), rotulo).toBeGreaterThanOrEqual(24 * H);
        }
      }
    }
  });

  it("a hora é a DELA: combinou 20h → 20h; 8h → puxado pras 9h; sem hora → 12h", () => {
    const inicio = new Date(2026, 9, 1, 15, 0, 0);
    const fim = inicio.getTime() + 3 * 24 * H;
    expect(quandoLembrarDoTeste(fim, inicio.getTime(), { horaMin: 20 * 60, inicioMs: inicio.getTime() })).toEqual(new Date(2026, 9, 2, 20, 0));
    expect(quandoLembrarDoTeste(fim, inicio.getTime(), { horaMin: 8 * 60, inicioMs: inicio.getTime() })).toEqual(new Date(2026, 9, 2, 9, 0));
    expect(quandoLembrarDoTeste(fim, inicio.getTime(), { inicioMs: inicio.getTime() })).toEqual(new Date(2026, 9, 2, 12, 0));
    expect(diaDoAvisoDoTeste(fim)).toBe("2026-10-02");
  });

  it("armado tarde: ainda no dia prometido → em 10 min; passou o dia (ou a faixa) → nenhum aviso (não promete 'amanhã' mentindo)", () => {
    const fim = new Date(2026, 9, 4, 15, 0, 0).getTime(); // início 01/10 15h → aviso 02/10
    const tarde = new Date(2026, 9, 2, 16, 0, 0).getTime();
    expect(quandoLembrarDoTeste(fim, tarde, { horaMin: 9 * 60 })!.getTime()).toBe(tarde + 10 * 60e3);
    expect(quandoLembrarDoTeste(fim, new Date(2026, 9, 2, 20, 45).getTime())).toBeNull();
    expect(quandoLembrarDoTeste(fim, new Date(2026, 9, 3, 10, 0).getTime())).toBeNull();
    expect(quandoLembrarDoTeste(fim, new Date(2026, 9, 2, 3, 0).getTime(), { horaMin: 7 * 60 })!.getHours()).toBe(9);
  });
});

describe("o texto do aviso", () => {
  it("'Seu teste grátis termina amanhã' + o plano começa sozinho e o que montou fica; com a dose de hoje, ou o R$/dia, ou nada", () => {
    expect(copyDoLembreteDoTeste()).toEqual({ title: "Seu teste grátis termina amanhã", body: "Seu plano anual começa sozinho e tudo que você montou fica com você." });
    expect(copyDoLembreteDoTeste({ modulo: "rotina" }).body).toBe("Seu plano anual começa sozinho e tudo que você montou fica com você. Hoje: 📅 Rotina — 1 hábito, 20 s.");
    expect(copyDoLembreteDoTeste({ porDia: 46 }).body).toBe("Seu plano anual começa sozinho e tudo que você montou fica com você. Hoje dá pra gastar até R$ 46.");
    for (const c of [copyDoLembreteDoTeste(), copyDoLembreteDoTeste({ modulo: "saude" }), copyDoLembreteDoTeste({ modulo: "financas" }), copyDoLembreteDoTeste({ porDia: 1234 })]) {
      const tudo = `${c.title} ${c.body}`;
      expect(tudo).toMatch(/termina amanhã/);
      expect(tudo).not.toMatch(PROIBIDO);
    }
  });
});

describe("faixa de ids", () => {
  it("o aviso mora em 920000; nenhuma faixa (avulsas + lembretes) se sobrepõe a outra", () => {
    expect(FAIXAS_AVULSAS.lembreteTeste).toBe(920000);
    expect(FAIXAS_AVULSAS.missaoAntiga).toBe(910000);
    const todas = [...Object.entries(FAIXAS_AVULSAS), ...Object.entries(BASES_LEMBRETES)] as Array<[string, number]>;
    for (let i = 0; i < todas.length; i++) {
      for (let j = i + 1; j < todas.length; j++) {
        const [na, a] = todas[i]; const [nb, b] = todas[j];
        expect(a < b + 10000 && b < a + 10000, `${na}=${a} × ${nb}=${b}`).toBe(false);
      }
    }
  });
});

describe("pedido na compra → armado quando a permissão chega", () => {
  const pedido = { fimMs: new Date(2026, 9, 4, 15, 0, 0).getTime(), precoAno: "R$ 97,90" };

  it("permissão já dada: arma na hora, no id 920001, pra 02/10 (o dia do paywall) ao meio-dia, tocando abre a Home (nunca /planos)", async () => {
    expect(await pedirLembreteDoTeste(pedido)).toBe("armado");
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    const n = ln.schedule.mock.calls[0][0].notifications[0];
    expect(n.id).toBe(920001);
    expect(n.title).toBe("Seu teste grátis termina amanhã");
    expect(`${n.title} ${n.body}`).not.toMatch(PROIBIDO);
    expect(n.schedule.at).toEqual(new Date(2026, 9, 2, 12, 0, 0));
    expect(n.extra?.rota).toBe("/home");
    expect(eventos).toContainEqual(["trial_aviso", { acao: "ja_permitido" }]);
    expect(eventos.find((e) => e[0] === "notif_lembrete_teste_armada")?.[1]).toMatchObject({ ok: true, dia_cal: 2 });
    expect(pedidoDeLembreteDoTeste()).toMatchObject({ ...pedido, inicioMs: Date.now() });
  });

  it("missão NOVA no braço A com a dose 2 pra amanhã: 'Hoje: 📅 Rotina — 1 hábito, 20 s' e o toque abre /rotina", async () => {
    missaoA({ 1: { dia: "2026-10-01", rotulo: "Café · R$ 12" } });
    await pedirLembreteDoTeste(pedido);
    const n = ln.schedule.mock.calls[0][0].notifications[0];
    expect(n.body).toBe("Seu plano anual começa sozinho e tudo que você montou fica com você. Hoje: 📅 Rotina — 1 hábito, 20 s.");
    expect(n.extra?.rota).toBe("/rotina");
  });

  it("a Missão ANTIGA (core-missao) não manda mais no toque; sem dose, com Finanças montada (get): 'Hoje dá pra gastar até R$ X'", async () => {
    localStorage.setItem("core-missao", JSON.stringify({ inicio: Date.now(), area: "dinheiro", d1: false, d2: false, d3: false, vista: false, holofote: "pendente" }));
    ln.permissao = "prompt";
    await pedirLembreteDoTeste(pedido);
    ln.permissao = "granted";
    const dados: Record<string, unknown> = { "finance-incomes": [{ id: 1, value: 3100, date: "2026-10-01" }] };
    await armarLembreteDoTesteSePuder(<T,>(k: string, f: T) => (k in dados ? (dados[k] as T) : f));
    const n = ln.schedule.mock.calls[0][0].notifications[0];
    expect(n.body).toMatch(/^Seu plano anual começa sozinho e tudo que você montou fica com você\. Hoje dá pra gastar até R\$ \d/);
    expect(n.extra?.rota).toBe("/home");
  });

  it("a hora combinada no Plano de amanhã (20h) vale pro aviso", async () => {
    combinarHora("20h", new Date(2026, 9, 1, 15, 0));
    await pedirLembreteDoTeste(pedido);
    expect(ln.schedule.mock.calls[0][0].notifications[0].schedule.at).toEqual(new Date(2026, 9, 2, 20, 0, 0));
  });

  it("permissão nunca pedida: guarda o pedido SEM abrir diálogo; arma quando a permissão chega", async () => {
    ln.permissao = "prompt";
    expect(await pedirLembreteDoTeste(pedido)).toBe("pendente");
    expect(ln.schedule).not.toHaveBeenCalled();
    ln.permissao = "granted";
    expect(await armarLembreteDoTesteSePuder()).toBe(true);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    expect(ln.schedule.mock.calls[0][0].notifications[0].id).toBe(920001);
  });

  it("permissão negada: nada agendado, e armar depois não força", async () => {
    ln.permissao = "denied";
    expect(await pedirLembreteDoTeste(pedido)).toBe("sem_permissao");
    expect(await armarLembreteDoTesteSePuder()).toBe(false);
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it("rearmar a cada abertura não duplica nem re-agenda igual: um 920001 só, um schedule só", async () => {
    await pedirLembreteDoTeste(pedido);
    await armarLembreteDoTesteSePuder();
    await armarLembreteDoTesteSePuder();
    expect(ln.pendentes.filter((n) => n.id === 920001)).toHaveLength(1);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
  });

  it("sem pedido guardado (compra numa build antiga), nada é inventado", async () => {
    expect(await armarLembreteDoTesteSePuder()).toBe(false);
    await sincronizarLembreteDoTeste({ emTeste: true, vaiRenovar: true, fimMs: pedido.fimMs });
    expect(ln.schedule).not.toHaveBeenCalled();
  });
});

describe("1 notificação de teste por dia", () => {
  it("o lembrete diário (930001) cede o dia do 920001 — e volta no dia seguinte", async () => {
    const pedido = { fimMs: new Date(2026, 9, 4, 15, 0, 0).getTime(), precoAno: "R$ 97,90" };
    await pedirLembreteDoTeste(pedido);
    const get = <T,>(_k: string, f: T) => f;
    const r = await sincronizarLembreteDia2(get, { criadoEm: new Date(2026, 9, 1, 14, 0).toISOString(), agora: new Date(2026, 9, 1, 15, 0) });
    expect(r).toEqual({ ok: false, motivo: "pulado_por_920" });
    expect(ln.pendentes.filter((n) => n.id >= 930000 && n.id < 940000)).toHaveLength(0);
    expect(eventos).toContainEqual(["lembrete_dia2_agendado", expect.objectContaining({ ok: false, motivo: "pulado_por_920", pulado_por_920: true })]);
    // no dia 2 (abriu), o de amanhã (dia 3) sai normal
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
    const r2 = await sincronizarLembreteDia2(get, { criadoEm: new Date(2026, 9, 1, 14, 0).toISOString(), agora: new Date(2026, 9, 2, 10, 0) });
    expect(r2.ok).toBe(true);
    const porDia = new Map<string, number>();
    for (const n of ln.pendentes) { const d = localDayKey(new Date(n.schedule!.at!)); porDia.set(d, (porDia.get(d) ?? 0) + 1); }
    for (const [d, q] of porDia) expect(q, d).toBe(1);
  });
});

describe("sincronização com a loja (boot)", () => {
  const pedido = { fimMs: new Date(2026, 9, 4, 15, 0, 0).getTime(), precoAno: "R$ 97,90" };

  it("fim REAL diferente do estimado: reagenda com a data da loja", async () => {
    await pedirLembreteDoTeste(pedido);
    const fimReal = new Date(2026, 9, 4, 15, 7, 0).getTime();
    await sincronizarLembreteDoTeste({ emTeste: true, vaiRenovar: true, fimMs: fimReal });
    expect(pedidoDeLembreteDoTeste()?.fimMs).toBe(fimReal);
    expect(ln.pendentes.filter((n) => n.id === 920001)).toHaveLength(1);
    expect(ln.schedule).toHaveBeenCalledTimes(2); // data nova = aviso refeito
  });

  it("cancelou o teste (willRenew false): o aviso é DESARMADO e o pedido some", async () => {
    await pedirLembreteDoTeste(pedido);
    expect(ln.pendentes).toHaveLength(1);
    await sincronizarLembreteDoTeste({ emTeste: true, vaiRenovar: false, fimMs: pedido.fimMs });
    expect(ln.pendentes).toHaveLength(0);
    expect(pedidoDeLembreteDoTeste()).toBeNull();
  });

  it("já virou cobrança (sem TRIAL ativo): desarma também", async () => {
    await pedirLembreteDoTeste(pedido);
    await sincronizarLembreteDoTeste({ emTeste: false, vaiRenovar: true, fimMs: null });
    expect(ln.pendentes).toHaveLength(0);
  });

  it("cancelarLembreteDoTeste limpa só a faixa 920000 — os outros avisos ficam", async () => {
    ln.pendentes.push({ id: 900001, title: "Dia 2 da sua missão 🔥" }, { id: 100005, title: "conta" });
    await pedirLembreteDoTeste(pedido);
    await cancelarLembreteDoTeste();
    expect(ln.pendentes.map((n) => n.id).sort()).toEqual([100005, 900001]);
  });
});

describe("1.0.16 — o aviso marcado não muda de hora, nunca vira 'daqui a 10 min' e não sai duas vezes", () => {
  const pedido = { fimMs: new Date(2026, 9, 4, 15, 0, 0).getTime(), precoAno: "R$ 97,90" };

  it("o dia prometido conta do INÍCIO e dos dias inteiros: fim da loja 30 s antes das 72 h (compra 00:00:10) continua no dia 2", () => {
    const inicio = new Date(2026, 9, 1, 0, 0, 10).getTime();
    const fim = inicio + 3 * 24 * H - 30e3;
    expect(diaDoAvisoDoTeste(fim, inicio)).toBe("2026-10-02");
    expect(ddmm(diaDoAvisoDoTeste(fim, inicio))).toBe(diaDoAviso(3, new Date(inicio)));
    expect(localDayKey(quandoLembrarDoTeste(fim, inicio, { inicioMs: inicio })!)).toBe("2026-10-02");
    // sem o início (pedido de build antiga): o de sempre, fim − 48 h
    expect(diaDoAvisoDoTeste(pedido.fimMs)).toBe("2026-10-02");
  });

  it("armado no dia 1 (abriu às 15h) → dia 2 às 15h; reabrir no dia 2 às 9h não muda a hora nem re-agenda; depois que tocou, reabrir não faz um 2º aviso", async () => {
    registrarAbertura(new Date(2026, 9, 1, 15, 0));
    await pedirLembreteDoTeste(pedido);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    expect(ln.schedule.mock.calls[0][0].notifications[0].schedule.at).toEqual(new Date(2026, 9, 2, 15, 0));
    // dia 2, 9h: a 1ª abertura do dia é 9h — o aviso continua às 15h (antes: "agora + 10 min")
    vi.setSystemTime(new Date(2026, 9, 2, 9, 0));
    registrarAbertura(new Date(2026, 9, 2, 9, 0));
    expect(await armarLembreteDoTesteSePuder()).toBe(true);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    expect(avisoDoTesteNoDia("2026-10-02")).toBe(true);
    // a dose de hoje feita antes do aviso: o TEXTO é refeito, a hora fica
    missaoA({ 1: { dia: "2026-10-01", rotulo: "Pode gastar R$ 61 por dia" } });
    await armarLembreteDoTesteSePuder();
    expect(ln.schedule).toHaveBeenCalledTimes(2);
    expect(ln.schedule.mock.calls[1][0].notifications[0].schedule.at).toEqual(new Date(2026, 9, 2, 15, 0));
    expect(ln.schedule.mock.calls[1][0].notifications[0].body).toBe("Seu plano anual começa sozinho e tudo que você montou fica com você. Hoje: 📅 Rotina — 1 hábito, 20 s.");
    // 16h: o aviso já tocou — abrir o app de novo não marca outro
    vi.setSystemTime(new Date(2026, 9, 2, 16, 0));
    expect(await armarLembreteDoTesteSePuder()).toBe(true);
    expect(ln.schedule).toHaveBeenCalledTimes(2);
  });

  it("a escolha NOVA no Plano de amanhã (20h) move o aviso já marcado — ainda no dia prometido", async () => {
    registrarAbertura(new Date(2026, 9, 1, 15, 0));
    await pedirLembreteDoTeste(pedido);
    combinarHora("20h", new Date(2026, 9, 1, 15, 30));
    await armarLembreteDoTesteSePuder();
    expect(ln.schedule.mock.calls.at(-1)![0].notifications[0].schedule.at).toEqual(new Date(2026, 9, 2, 20, 0));
    expect(ln.pendentes.filter((n) => n.id === 920001)).toHaveLength(1);
  });

  it("um pedido NOVO (compra nova) não herda nada do velho (início, hora, marcação)", async () => {
    localStorage.setItem("core-lembrete-teste", JSON.stringify({ ...pedido, inicioMs: new Date(2026, 8, 1).getTime(), hora: 600, agendadoPara: new Date(2026, 8, 2, 10, 0).toISOString(), ass: "x" }));
    await pedirLembreteDoTeste(pedido);
    expect(pedidoDeLembreteDoTeste()).toMatchObject({ inicioMs: Date.now(), hora: 12 * 60, agendadoPara: new Date(2026, 9, 2, 12, 0).toISOString() });
  });
});

describe("1.0.16 — não empilhar com o lembrete da sequência (opt-in, à noite)", () => {
  const prefsSequencia = { "notif-prefs": { sequencia: true, horaSequencia: 20 } } as Record<string, unknown>;
  const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T) => (k in dados ? (dados[k] as T) : f);

  it("horaSemEmpilhar: à noite junto da sequência → a hora de uso (ou meio-dia); de dia ou sem sequência → a de sempre", () => {
    const s = (horaDeUso: number | null, ligada = true, hora = 20) => ({ ligada, hora, horaDeUso });
    expect(horaSemEmpilhar(20 * 60, s(9 * 60 + 40))).toBe(9 * 60 + 40);
    expect(horaSemEmpilhar(20 * 60, s(19 * 60 + 30))).toBe(12 * 60); // a hora de uso também é à noite
    expect(horaSemEmpilhar(18 * 60 + 30, s(null))).toBe(12 * 60);
    expect(horaSemEmpilhar(12 * 60, s(9 * 60))).toBe(12 * 60); // de dia: não empilha
    expect(horaSemEmpilhar(20 * 60, s(9 * 60, false))).toBe(20 * 60); // sequência desligada
    expect(horaSemEmpilhar(8 * 60, s(13 * 60, true, 8))).toBe(13 * 60); // a sequência dela é de manhã: sai de perto dela
    expect(horaSemEmpilhar(null, s(null, false))).toBeNull();
  });

  it("combinou 20h e a sequência está ligada às 20h: o aviso do teste vai pra hora de uso (15h) — e quem rearma sem o dado da conta (o boot da loja) não desfaz", async () => {
    registrarAbertura(new Date(2026, 9, 1, 15, 0));
    combinarHora("20h", new Date(2026, 9, 1, 15, 0));
    await pedirLembreteDoTeste(pedido());
    await sincronizarLembreteDia2(leitor(prefsSequencia), { criadoEm: new Date(2026, 9, 1, 14, 0).toISOString(), agora: new Date(2026, 9, 1, 15, 5) });
    const aviso = ln.pendentes.filter((n) => n.id === 920001);
    expect(aviso).toHaveLength(1);
    expect(aviso[0].schedule!.at).toEqual(new Date(2026, 9, 2, 15, 0));
    await sincronizarLembreteDoTeste({ emTeste: true, vaiRenovar: true, fimMs: pedido().fimMs });
    expect(ln.pendentes.find((n) => n.id === 920001)!.schedule!.at).toEqual(new Date(2026, 9, 2, 15, 0));
  });

  it("o lembrete diário (930001) também sai da noite quando a sequência está ligada", async () => {
    combinarHora("20h", new Date(2026, 9, 2, 10, 0));
    registrarAbertura(new Date(2026, 9, 2, 10, 0), new Date(2026, 9, 1, 14, 0).toISOString());
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
    const r = await sincronizarLembreteDia2(leitor(prefsSequencia), { criadoEm: new Date(2026, 9, 1, 14, 0).toISOString(), agora: new Date(2026, 9, 2, 10, 0) });
    expect(r.ok).toBe(true);
    const n = ln.pendentes.find((x) => x.id === 930001)!;
    expect(new Date(n.schedule!.at!).getHours()).toBe(10);
    // sem a sequência ligada, a hora combinada (20h) vale
    ln.pendentes = []; localStorage.removeItem("core-dia2");
    combinarHora("20h", new Date(2026, 9, 2, 10, 0));
    await sincronizarLembreteDia2(leitor({}), { criadoEm: new Date(2026, 9, 1, 14, 0).toISOString(), agora: new Date(2026, 9, 2, 10, 0) });
    expect(new Date(ln.pendentes.find((x) => x.id === 930001)!.schedule!.at!).getHours()).toBe(20);
  });

  const pedido = () => ({ fimMs: new Date(2026, 9, 4, 15, 0, 0).getTime(), precoAno: "R$ 97,90" });
});

describe("1.0.16 — palavras proibidas em TODO texto de teste (920001, 930001 dos dois braços, 900002)", () => {
  it("nenhum fala em cancelar, cobrança, preço, 24 h ou 'sem cartão'; o 920001 sempre diz 'termina amanhã'", () => {
    const hoje = "2026-10-02";
    const base = { v: 1 as const, inicio: "2026-10-01", modulos: ["financas", "rotina", "saude"] as ["financas", "rotina", "saude"], boasVindas: true };
    const comFinancas = <T,>(k: string, f: T) => (k === "finance-incomes" ? ([{ id: 1, value: 3100, date: "2026-10-01" }] as unknown as T) : f);
    const textos: string[] = [];
    for (const braco of ["A", "B", undefined] as const) {
      for (const feitos of [{}, { 1: { dia: "2026-10-01", rotulo: "Café · R$ 12" } }, { 1: { dia: "2026-10-01", rotulo: "x" }, 2: { dia: hoje, rotulo: "y" } }]) {
        for (const get of [undefined, comFinancas]) {
          const c = conteudoDaMissao({ ...base, feitos, ...(braco ? { braco } : {}) }, hoje, get);
          if (c) textos.push(`${c.title} ${c.body}`);
        }
      }
    }
    for (const c of [copyDoLembreteDoTeste(), copyDoLembreteDoTeste({ modulo: "rotina" }), copyDoLembreteDoTeste({ modulo: "saude" }), copyDoLembreteDoTeste({ porDia: 46 })]) {
      expect(`${c.title} ${c.body}`).toMatch(/termina amanhã/);
      textos.push(`${c.title} ${c.body}`);
    }
    textos.push("Sua próxima dose de 20 s está pronta 💰 Finanças: toca em 1 gasto de hoje — e a dose 2 de 3 fica feita.");
    expect(textos.length).toBeGreaterThan(8);
    for (const t of textos) expect(t, t).not.toMatch(PROIBIDO);
  });
});
