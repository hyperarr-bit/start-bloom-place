/**
 * 1.0.21 — a chave `fluxo_enxuto` (lib/fluxo-enxuto): padrão por plataforma, metadata do RevenueCat, "ab" 50/50 gravado,
 * força de QA, as allowlists do aparelho, os eventos — e cada peça que ela desliga.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CHAVE_BRACO_FLUXO_ENXUTO, CHAVE_FLUXO_ENXUTO_APARELHO, CHAVE_FORCA_FLUXO_ENXUTO, _zerarFluxoEnxuto, bracoFluxoEnxuto, camposFluxoEnxuto,
  fluxoEnxutoLigado, guardarForcaFluxoEnxuto, lerFluxoEnxutoRemoto, modoFluxoEnxuto, registrarFluxoEnxutoRemoto, sortearBracoFluxoEnxuto,
} from "@/lib/fluxo-enxuto";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { montarFinancasLigado } from "@/lib/montar-financas";
import { montarRotinaLigado } from "@/lib/montar-rotina";
import { introLigada } from "@/lib/intro-modulo";
import { cartoesLigados, tourHomeLigado } from "@/lib/tour-home";
import { dicaDoDiaDevida, doseCurta, iniciarMissao, introEhADoseDoDia2, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";

const G = globalThis as { __FLUXO_ENXUTO_PADRAO_APP__?: string };
let padraoDaSuite: string | undefined;
const fingir = (plataforma: "ios" | "android" | null) => {
  if (!plataforma) { delete (window as { Capacitor?: unknown }).Capacitor; return; }
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => plataforma, isNativePlatform: () => true };
};
const offerings = (v: unknown, outra?: unknown) => ({
  current: { identifier: "default", metadata: { fluxo_enxuto: v } },
  all: { default: {}, outra: { metadata: { fluxo_enxuto: outra } } },
});

beforeEach(() => {
  localStorage.clear();
  _zerarFluxoEnxuto();
  padraoDaSuite = G.__FLUXO_ENXUTO_PADRAO_APP__;
  delete G.__FLUXO_ENXUTO_PADRAO_APP__; // o padrão de VERDADE
});
afterEach(() => { G.__FLUXO_ENXUTO_PADRAO_APP__ = padraoDaSuite; fingir(null); });

describe("o padrão por plataforma", () => {
  it("iPhone (app da loja): ligado pra todo mundo, sem resposta do RevenueCat", () => {
    fingir("ios");
    expect(modoFluxoEnxuto()).toBe("on");
    expect(fluxoEnxutoLigado()).toBe(true);
  });
  it("site e Android: desligado (nada muda lá) — e a metadata não liga no Android (é a mesma das duas lojas)", () => {
    expect(fluxoEnxutoLigado()).toBe(false);
    fingir("android");
    expect(fluxoEnxutoLigado()).toBe(false);
    registrarFluxoEnxutoRemoto(offerings("on"));
    expect(fluxoEnxutoLigado()).toBe(false);
    expect(localStorage.getItem(CHAVE_FLUXO_ENXUTO_APARELHO)).toBeNull();
  });
});

describe("a metadata do RevenueCat (só no iPhone)", () => {
  beforeEach(() => fingir("ios"));
  it("lê a chave em qualquer offering, a current vence; valor estranho = não disse nada", () => {
    expect(lerFluxoEnxutoRemoto(offerings("off"))).toBe("off");
    expect(lerFluxoEnxutoRemoto(offerings(undefined, "ab"))).toBe("ab");
    expect(lerFluxoEnxutoRemoto(offerings("talvez"))).toBeNull();
    expect(lerFluxoEnxutoRemoto(null)).toBeNull();
  });
  it("'off' desliga (rollback) e fica guardado no aparelho pra próxima abertura; chave ausente não derruba o guardado", () => {
    registrarFluxoEnxutoRemoto(offerings("off"));
    expect(fluxoEnxutoLigado()).toBe(false);
    expect(localStorage.getItem(CHAVE_FLUXO_ENXUTO_APARELHO)).toBe("off");
    _zerarFluxoEnxuto(); // nova abertura, antes do getOfferings responder
    expect(fluxoEnxutoLigado()).toBe(false);
    registrarFluxoEnxutoRemoto({ current: { metadata: {} }, all: {} });
    expect(fluxoEnxutoLigado()).toBe(false);
    registrarFluxoEnxutoRemoto(offerings("on"));
    expect(fluxoEnxutoLigado()).toBe(true);
  });
  it("'ab': 50/50 pelo id do aparelho, sal próprio, sorteado 1x e GRAVADO (estável entre aberturas)", () => {
    localStorage.setItem("core-device-id", "aparelho-123");
    registrarFluxoEnxutoRemoto(offerings("ab"));
    const b = bracoFluxoEnxuto();
    expect(b).toBe(sortearBracoFluxoEnxuto("aparelho-123"));
    expect(localStorage.getItem(CHAVE_BRACO_FLUXO_ENXUTO)).toBe(b);
    expect(fluxoEnxutoLigado()).toBe(b === "enxuto");
    // trocar o id depois não muda o braço gravado
    localStorage.setItem("core-device-id", "outro");
    _zerarFluxoEnxuto();
    expect(bracoFluxoEnxuto()).toBe(b);
    // o sorteio divide de verdade
    const n = Array.from({ length: 400 }, (_, i) => sortearBracoFluxoEnxuto(`id-${i}`)).filter((x) => x === "enxuto").length;
    expect(n).toBeGreaterThan(160);
    expect(n).toBeLessThan(240);
  });
});

describe("os eventos levam o braço", () => {
  it("'on' → fluxo_enxuto: 'enxuto'; 'ab' → o braço; 'off' → nada (eventos idênticos aos de hoje)", () => {
    fingir("ios");
    expect(camposFluxoEnxuto()).toEqual({ fluxo_enxuto: "enxuto" });
    localStorage.setItem(CHAVE_BRACO_FLUXO_ENXUTO, "atual");
    registrarFluxoEnxutoRemoto(offerings("ab"));
    expect(camposFluxoEnxuto()).toEqual({ fluxo_enxuto: "atual" });
    registrarFluxoEnxutoRemoto(offerings("off"));
    expect(camposFluxoEnxuto()).toEqual({});
    fingir(null);
    _zerarFluxoEnxuto();
    expect(camposFluxoEnxuto()).toEqual({});
  });
  it("o trackEvent junta os campos em TODO evento (funil e Home)", async () => {
    vi.resetModules();
    const inserts: unknown[] = [];
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }) },
        from: () => ({ insert: (linha: unknown) => { inserts.push(linha); return { then: () => {} }; } }),
      },
    }));
    fingir("ios");
    const { trackEvent } = await import("@/lib/analytics");
    trackEvent("parabens_view", { funil: "ios" });
    await new Promise((r) => setTimeout(r, 0));
    expect((inserts[0] as { event_data: Record<string, unknown> }).event_data).toMatchObject({ funil: "ios", fluxo_enxuto: "enxuto" });
    vi.doUnmock("@/integrations/supabase/client");
  });
});

describe("a força de QA (?fluxo-enxuto=)", () => {
  it("on|off|ab gravam, auto desfaz — vale no site também (pra QA)", () => {
    guardarForcaFluxoEnxuto("?fluxo-enxuto=on");
    expect(localStorage.getItem(CHAVE_FORCA_FLUXO_ENXUTO)).toBe("on");
    expect(fluxoEnxutoLigado()).toBe(true);
    guardarForcaFluxoEnxuto("?fluxo-enxuto=off");
    expect(fluxoEnxutoLigado()).toBe(false);
    guardarForcaFluxoEnxuto("?fluxo-enxuto=auto");
    expect(localStorage.getItem(CHAVE_FORCA_FLUXO_ENXUTO)).toBeNull();
    guardarForcaFluxoEnxuto("?outra=1");
    expect(localStorage.getItem(CHAVE_FORCA_FLUXO_ENXUTO)).toBeNull();
  });
  it("a força vence a metadata no iPhone", () => {
    fingir("ios");
    registrarFluxoEnxutoRemoto(offerings("on"));
    guardarForcaFluxoEnxuto("?fluxo-enxuto=off");
    expect(fluxoEnxutoLigado()).toBe(false);
  });
});

describe("as chaves do aparelho (bug da tela repetida da 1.0.14: chave esquecida das allowlists)", () => {
  it("a resposta guardada, o braço e o contador das festas sobrevivem às vassouras; a força de QA está fora dos prefixos", () => {
    for (const k of [CHAVE_FLUXO_ENXUTO_APARELHO, CHAVE_BRACO_FLUXO_ENXUTO, "core-festas-calma"]) {
      expect(ehChaveDoAparelho(k), k).toBe(true);
      expect(vassouraLeva(k), k).toBe(false);
    }
    expect(vassouraLeva(CHAVE_FORCA_FLUXO_ENXUTO)).toBe(false);
  });
});

describe("o que o enxuto desliga (iPhone, padrão)", () => {
  const hoje = localDayKey();
  it("ligado: sem montar Finanças/Rotina, sem intro, sem cartões, sem tour da Home antiga, sem Dica do dia; a dose 2 escolhida é a dose simples", () => {
    fingir("ios");
    expect(montarFinancasLigado()).toBe(false);
    expect(montarRotinaLigado()).toBe(false);
    expect(introLigada()).toBe(false);
    expect(cartoesLigados()).toBe(false);
    expect(tourHomeLigado("on")).toBe(false);
    // dose 1 de Finanças/Rotina sem o Montar = o pedido da dose guiada simples
    expect(doseCurta("financas", 1).texto).toBe("1 gasto, 10 s");
    expect(doseCurta("rotina", 1).texto).not.toMatch(/monte/);
    const m: EstadoMissaoDoses = { ...iniciarMissao(["financas", "casa", "rotina"], hoje, undefined, "A"), boasVindas: true, feitos: { 2: { dia: hoje, rotulo: "x" } }, dicas: {} };
    expect(dicaDoDiaDevida(m, hoje)).toBeNull();
    const comEscolha = { ...m, feitos: {}, escolha2: { modulo: "casa" as const, dia: hoje, via: "comecar" as const, de: "rotina" as const } } as EstadoMissaoDoses;
    expect(introEhADoseDoDia2(comEscolha, "casa")).toBe(false);
  });
  it("desligado (?fluxo-enxuto=off): tudo como na 1.0.20 — Montar, intro do app ligados", () => {
    fingir("ios");
    guardarForcaFluxoEnxuto("?fluxo-enxuto=off");
    expect(montarFinancasLigado()).toBe(true);
    expect(montarRotinaLigado()).toBe(true);
    expect(introLigada()).toBe(true);
    expect(doseCurta("financas", 1).texto).toMatch(/monte/);
  });
});
