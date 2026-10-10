/**
 * FICHA DO APARELHO EM TODO EVENTO (10/10, 1.0.14) — ver lib/aparelho.
 * device_id estável entre sessões e logouts; turma em BRT; versão/plataforma;
 * app_primeira_abertura 1× por aparelho; e o payload antigo intacto (só soma).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const inseridos = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
    from: () => ({
      insert: (linha: Record<string, unknown>) => { inseridos.push(linha); return { then: (f?: () => void) => f?.() }; },
    }),
  },
}));
vi.mock("@capacitor/app", () => ({ App: { getInfo: async () => ({ version: "1.0.14", build: "36", id: "br.com.coreaplicativo.app" }) } }));

const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const ultimo = () => inseridos[inseridos.length - 1] as { event_name: string; event_data: Record<string, unknown> };
const noApp = (plataforma: "ios" | "android") => {
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => plataforma };
};
/** o que o signOut faz: apaga as chaves `core-`, `u:`, … (use-auth.tsx) — as `core_` ficam */
const logout = () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("core-") || k.startsWith("u:")) localStorage.removeItem(k);
};

beforeEach(() => {
  vi.resetModules();
  inseridos.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("propriedades comuns no payload", () => {
  it("web: device_id, plataforma web, turma e app_versao 'web' — e o data do evento continua lá", async () => {
    const { trackEvent } = await import("@/lib/analytics");
    trackEvent("funnel_view", { step: "start", utm_source: "x" });
    await esvaziar();
    const d = ultimo().event_data;
    expect(d.step).toBe("start");
    expect(d.utm_source).toBe("x"); // o payload antigo não muda
    expect(String(d.device_id)).toMatch(/^[0-9a-f-]{36}$/i);
    expect(d.plataforma).toBe("web");
    expect(d.app_versao).toBe("web");
    expect(d.turma).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.att).toBeUndefined();
    expect(Object.keys(d)).not.toContain("email");
  });

  it("o data do evento vence a propriedade comum quando repete a chave (app_device_info manda plataforma)", async () => {
    const { trackEvent } = await import("@/lib/analytics");
    trackEvent("x", { plataforma: "forcada" });
    await esvaziar();
    expect(ultimo().event_data.plataforma).toBe("forcada");
  });

  it("no iPhone: versão e build do App.getInfo (depois do boot), e o att quando já lido", async () => {
    noApp("ios");
    localStorage.setItem("core-att-status", "authorized");
    const { trackEvent, iniciarMedicaoDoAparelho } = await import("@/lib/analytics");
    await iniciarMedicaoDoAparelho();
    trackEvent("x", {});
    await esvaziar();
    expect(ultimo().event_data).toMatchObject({ plataforma: "ios", app_versao: "1.0.14", app_build: "36", att: "authorized" });
  });

  it("o beacon leva as mesmas propriedades", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn((_u: string, init: { body: string }) => { posts.push(init.body); return Promise.resolve({ ok: true }); }));
    const { trackEventBeacon } = await import("@/lib/analytics");
    trackEventBeacon("saida", { a: 1 });
    await new Promise((r) => setTimeout(r, 80));
    const corpo = JSON.parse(posts[0]) as { event_data: Record<string, unknown> };
    expect(corpo.event_data.a).toBe(1);
    expect(String(corpo.event_data.device_id)).toMatch(/^[0-9a-f-]{36}$/i);
    expect(corpo.event_data.turma).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    vi.unstubAllGlobals();
  });
});

describe("device_id estável", () => {
  it("o mesmo id em outra sessão (módulos novos), e depois do logout (chaves core- apagadas)", async () => {
    const a = (await import("@/lib/aparelho")).deviceId();
    vi.resetModules();
    const b = (await import("@/lib/aparelho")).deviceId();
    expect(b).toBe(a);
    logout();
    vi.resetModules();
    const c = (await import("@/lib/aparelho")).deviceId();
    expect(c).toBe(a);
    expect(localStorage.getItem("core_device_id")).toBe(a);
  });

  it("storage zerado com a página viva: a memória re-semeia o mesmo id", async () => {
    const m = await import("@/lib/aparelho");
    const a = m.deviceId();
    localStorage.clear();
    expect(m.deviceId()).toBe(a);
    expect(localStorage.getItem("core_device_id")).toBe(a);
  });
});

describe("turma e app_primeira_abertura", () => {
  it("a turma é a data em BRT (23h30 de Brasília = o mesmo dia, mesmo que o UTC já tenha virado)", async () => {
    const { diaBRT } = await import("@/lib/aparelho");
    expect(diaBRT(new Date("2026-10-11T02:30:00Z"))).toBe("2026-10-10"); // 23:30 em Brasília
    expect(diaBRT(new Date("2026-10-11T03:30:00Z"))).toBe("2026-10-11"); // 00:30 em Brasília
  });

  it("aparelho novo no app: turma de hoje e UM app_primeira_abertura {nova: true}; no boot seguinte, nada", async () => {
    noApp("android");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    let a = await import("@/lib/analytics");
    await a.iniciarMedicaoDoAparelho();
    await esvaziar();
    const primeiras = inseridos.filter((e) => e.event_name === "app_primeira_abertura");
    expect(primeiras).toHaveLength(1);
    expect((primeiras[0].event_data as Record<string, unknown>)).toMatchObject({ nova: true, turma: "2026-10-12", plataforma: "android" });
    expect(localStorage.getItem("core_turma")).toBe("2026-10-12");
    // boot seguinte (e logout no meio): mesma turma, sem evento novo
    logout();
    vi.resetModules();
    a = await import("@/lib/analytics");
    await a.iniciarMedicaoDoAparelho();
    await esvaziar();
    expect(inseridos.filter((e) => e.event_name === "app_primeira_abertura")).toHaveLength(1);
    expect(localStorage.getItem("core_turma")).toBe("2026-10-12");
  });

  it("aparelho que JÁ usava o app (atualizou pra 1.0.14): turma = 1º dia de uso conhecido e nova: false", async () => {
    noApp("ios");
    localStorage.setItem("core-dias-de-uso", JSON.stringify(["2026-09-20", "2026-09-18", "2026-10-01"]));
    const a = await import("@/lib/analytics");
    await a.iniciarMedicaoDoAparelho();
    await esvaziar();
    const e = inseridos.find((x) => x.event_name === "app_primeira_abertura")!;
    expect(e.event_data).toMatchObject({ nova: false, turma: "2026-09-18" });
  });

  it("na web não emite app_primeira_abertura (a turma existe mesmo assim)", async () => {
    const a = await import("@/lib/analytics");
    await a.iniciarMedicaoDoAparelho();
    await esvaziar();
    expect(inseridos.find((x) => x.event_name === "app_primeira_abertura")).toBeUndefined();
    expect(localStorage.getItem("core_turma")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
