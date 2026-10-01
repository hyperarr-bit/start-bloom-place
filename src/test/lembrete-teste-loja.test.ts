/**
 * LEMBRETE "ACABA AMANHÃ" do teste grátis do iPhone (01/10, de volta).
 * A Apple não avisa antes de cobrar e exige cancelar 24 h antes do fim — o
 * aviso tem que cair DEPOIS de 24 h do começo e ANTES de 48 h do fim, numa
 * hora acordada, no fuso do aparelho. E a promessa do paywall só vale se o
 * pedido guardado na compra for armado quando a permissão chega (Missão B1),
 * reagendado com o fim real da loja e DESARMADO se a pessoa cancelar/assinar.
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
  quandoLembrarDoTeste, copyDoLembreteDoTeste, pedirLembreteDoTeste, armarLembreteDoTesteSePuder,
  sincronizarLembreteDoTeste, cancelarLembreteDoTeste, pedidoDeLembreteDoTeste, FAIXAS_AVULSAS, BASES_LEMBRETES,
} from "@/lib/notificacoes";

const H = 3600e3;
const h = (a: Date, b: Date) => (b.getTime() - a.getTime()) / H;

beforeEach(() => {
  localStorage.clear();
  ln.permissao = "granted";
  ln.pendentes = [];
  ln.schedule.mockClear();
  ln.cancel.mockClear();
  eventos.length = 0;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 1, 15, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("quandoLembrarDoTeste — hora do aviso", () => {
  it("compra às 15h, teste de 3 dias: avisa no dia 3 às 9h — 42 h depois, 30 h antes de cobrar", () => {
    const inicio = new Date(2026, 8, 21, 15, 0, 0);
    const alvo = quandoLembrarDoTeste(inicio.getTime() + 3 * 24 * H, inicio.getTime())!;
    expect(alvo.getDate()).toBe(23);
    expect(alvo.getHours()).toBe(9);
    expect(h(inicio, alvo)).toBe(42);
  });

  it("compra às 22h: 36 h antes do fim cai às 10h, fica como está", () => {
    const inicio = new Date(2026, 8, 21, 22, 0, 0);
    const alvo = quandoLembrarDoTeste(inicio.getTime() + 3 * 24 * H, inicio.getTime())!;
    expect(alvo.getDate()).toBe(23);
    expect(alvo.getHours()).toBe(10);
    expect(h(inicio, alvo)).toBe(36);
  });

  it("compra às 9h30: 36 h antes seria 21h30 — recua pra 20h30 do mesmo dia (nunca de madrugada)", () => {
    const inicio = new Date(2026, 8, 21, 9, 30, 0);
    const alvo = quandoLembrarDoTeste(inicio.getTime() + 3 * 24 * H, inicio.getTime())!;
    expect(alvo.getDate()).toBe(22);
    expect(alvo.getHours()).toBe(20);
    expect(alvo.getMinutes()).toBe(30);
  });

  it("qualquer hora de compra, 3 ou 7 dias: aviso entre 24 h e 48 h antes do fim, das 9h às 20h30", () => {
    for (const dias of [3, 7]) {
      for (let hora = 0; hora < 24; hora++) {
        for (const min of [0, 17, 31, 59]) {
          const inicio = new Date(2026, 8, 21, hora, min, 0);
          const fim = new Date(inicio.getTime() + dias * 24 * H);
          const alvo = quandoLembrarDoTeste(fim.getTime(), inicio.getTime());
          expect(alvo, `dias=${dias} hora=${hora}:${min}`).not.toBeNull();
          const antesDoFim = h(alvo!, fim);
          expect(antesDoFim, `dias=${dias} hora=${hora}:${min}`).toBeGreaterThanOrEqual(24);
          expect(antesDoFim, `dias=${dias} hora=${hora}:${min}`).toBeLessThanOrEqual(48);
          const minutos = alvo!.getHours() * 60 + alvo!.getMinutes();
          expect(minutos, `dias=${dias} hora=${hora}:${min}`).toBeGreaterThanOrEqual(9 * 60);
          expect(minutos, `dias=${dias} hora=${hora}:${min}`).toBeLessThanOrEqual(20 * 60 + 30);
          expect(alvo!.getTime()).toBeGreaterThan(inicio.getTime());
        }
      }
    }
  });

  it("armado tarde (permissão só no dia 2 à tarde): sai em 10 min se ainda faltam ≥ 24 h; com < 24 h, nenhum aviso (não promete 'amanhã' mentindo)", () => {
    const fim = new Date(2026, 9, 4, 15, 0, 0).getTime(); // compra 01/10 15h
    // dia 3 às 11h (fim − 28 h): já passou das 9h do dia 3 → 10 min depois
    const tarde = new Date(2026, 9, 3, 11, 0, 0).getTime();
    const alvo = quandoLembrarDoTeste(fim, tarde)!;
    expect(alvo.getTime()).toBe(tarde + 10 * 60e3);
    // dia 3 às 16h (fim − 23 h): tarde demais
    expect(quandoLembrarDoTeste(fim, new Date(2026, 9, 3, 16, 0, 0).getTime())).toBeNull();
    // de madrugada do dia 3 (fim − 36 h já passou? não: 3h da manhã é fim − 36 h exato → 9h do mesmo dia)
    const madrugada = new Date(2026, 9, 3, 3, 0, 0).getTime();
    expect(quandoLembrarDoTeste(fim, madrugada)!.getHours()).toBe(9);
  });

  it("copy diz o preço do ano, que o que montou fica, onde cancelar — e nada de vitalício", () => {
    const c = copyDoLembreteDoTeste("R$ 97,90");
    expect(c.title).toBe("Seu teste grátis do CORE acaba amanhã");
    expect(c.body).toMatch(/R\$ 97,90 pelo ano inteiro/);
    expect(c.body).toMatch(/tudo que você montou fica/);
    expect(c.body).toMatch(/Ajustes › Assinaturas/);
    expect(c.body).not.toMatch(/vitalíc|pra sempre/i);
    // o preço vem da loja: 69,90 no braço B do experimento
    expect(copyDoLembreteDoTeste("R$ 69,90").body).toMatch(/R\$ 69,90 pelo ano inteiro/);
  });
});

describe("faixa de ids", () => {
  it("o lembrete mora em 920000 (910000 segue reservada) e nenhum tipo de lembrete invade", () => {
    expect(FAIXAS_AVULSAS.lembreteTeste).toBe(920000);
    expect(FAIXAS_AVULSAS.missaoAntiga).toBe(910000);
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) {
      expect(base < 920000 && base + 10000 > 920000, tipo).toBe(false);
      expect(base >= 920000 && base < 930000, tipo).toBe(false);
    }
  });
});

describe("pedido na compra → armado quando a permissão chega", () => {
  const pedido = { fimMs: new Date(2026, 9, 4, 15, 0, 0).getTime(), precoAno: "R$ 97,90" };

  it("permissão já dada: arma na hora, no id 920001, pra 03/10 às 9h, tocando abre /planos", async () => {
    expect(await pedirLembreteDoTeste(pedido)).toBe("armado");
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    const n = ln.schedule.mock.calls[0][0].notifications[0];
    expect(n.id).toBe(920001);
    expect(n.title).toBe("Seu teste grátis do CORE acaba amanhã");
    expect(n.schedule.at).toEqual(new Date(2026, 9, 3, 9, 0, 0));
    expect(n.extra?.rota).toBe("/planos");
    expect(eventos).toContainEqual(["trial_aviso", { acao: "ja_permitido" }]);
    expect(eventos.find((e) => e[0] === "notif_lembrete_teste_armada")?.[1]).toMatchObject({ ok: true, em_h: 42, antes_do_fim_h: 30 });
    expect(pedidoDeLembreteDoTeste()).toEqual(pedido);
  });

  it("permissão nunca pedida: guarda o pedido SEM abrir diálogo; a Missão arma depois", async () => {
    ln.permissao = "prompt";
    expect(await pedirLembreteDoTeste(pedido)).toBe("pendente");
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(pedidoDeLembreteDoTeste()).toEqual(pedido);
    // ... a pessoa aceita a permissão no B1 da Missão
    ln.permissao = "granted";
    expect(await armarLembreteDoTesteSePuder()).toBe(true);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    expect(ln.schedule.mock.calls[0][0].notifications[0].id).toBe(920001);
  });

  it("permissão negada: nada agendado, evento diz sem_permissao, e armar depois não força", async () => {
    ln.permissao = "denied";
    expect(await pedirLembreteDoTeste(pedido)).toBe("sem_permissao");
    expect(await armarLembreteDoTesteSePuder()).toBe(false);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(eventos).toContainEqual(["trial_aviso", { acao: "sem_permissao" }]);
  });

  it("rearmar substitui (nunca duplica): só um 920001 pendente", async () => {
    await pedirLembreteDoTeste(pedido);
    await armarLembreteDoTesteSePuder();
    await armarLembreteDoTesteSePuder();
    expect(ln.pendentes.filter((n) => n.id === 920001)).toHaveLength(1);
  });

  it("sem pedido guardado (compra numa build antiga), nada é inventado", async () => {
    expect(await armarLembreteDoTesteSePuder()).toBe(false);
    await sincronizarLembreteDoTeste({ emTeste: true, vaiRenovar: true, fimMs: pedido.fimMs });
    expect(ln.schedule).not.toHaveBeenCalled();
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
    expect(ln.schedule).toHaveBeenCalledTimes(2);
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
