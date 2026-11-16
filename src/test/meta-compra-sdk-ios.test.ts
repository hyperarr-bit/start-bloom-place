/**
 * 14/11: "Comprar" pelo SDK da Meta no iPhone — compra PAGA do paywall sem teste, 1x por transação, só no iOS nativo,
 * atrás da chave `meta_compra_sdk` (padrão on). Ver src/lib/meta-compra-sdk-ios.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const nativo = vi.hoisted(() => ({
  plataforma: "ios",
  ok: true,
  log: vi.fn(async (_o: unknown) => ({ ok: nativo.ok })),
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({ logCompra: (o: unknown) => nativo.log(o) }),
}));
Object.defineProperty(window, "Capacitor", {
  configurable: true,
  get: () => ({ getPlatform: () => nativo.plataforma, isNativePlatform: () => nativo.plataforma !== "web" }),
});
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
}));

import {
  CHAVE_FORCA_META_COMPRA_SDK, CHAVE_META_COMPRA_ENVIADA, CHAVE_META_COMPRA_SDK_APARELHO,
  _zerarMetaCompraSdk, decidirCompraNoSdk, guardarForcaMetaCompraSdk, lerMetaCompraSdkRemoto, metaCompraSdkLigado,
  registrarCompraNoSdk, registrarMetaCompraSdkRemoto,
} from "@/lib/meta-compra-sdk-ios";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";

const AGORA = Date.parse("2026-11-14T15:00:00Z");
const PRODUTO = { identifier: "core_vitalicio_97", price: 97.9, currencyCode: "BRL" };
const compra = (o: { periodo?: string; tx?: string | null; quando?: number } = {}) => ({
  productIdentifier: "core_vitalicio_97",
  customerInfo: { entitlements: { active: { pro: { periodType: o.periodo ?? "NORMAL", latestPurchaseDateMillis: o.quando ?? AGORA - 5000 } } } },
  transaction: o.tx === null ? null : {
    transactionIdentifier: o.tx ?? "2000000999888777",
    productIdentifier: "core_vitalicio_97",
    purchaseDate: new Date(o.quando ?? AGORA - 5000).toISOString(),
  },
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Date, "now").mockReturnValue(AGORA);
  nativo.plataforma = "ios";
  nativo.ok = true;
  nativo.log.mockClear();
  eventos.length = 0;
  _zerarMetaCompraSdk();
});

describe("decisão pura", () => {
  it("compra paga, nova, com valor → manda com o valor REAL e o id da transação da Apple", () => {
    expect(decidirCompraNoSdk(compra(), PRODUTO, AGORA)).toEqual({
      mandar: true,
      evento: { valor: 97.9, moeda: "BRL", produto: "core_vitalicio_97", pedido: "2000000999888777" },
    });
  });
  it("entrou em teste → não manda (o teste tem o StartTrial dele; nunca 'compra de R$ 0')", () => {
    expect(decidirCompraNoSdk(compra({ periodo: "TRIAL" }), PRODUTO, AGORA)).toEqual({ mandar: false, motivo: "em_teste" });
  });
  it("sem transação, transação velha (> 1 h), valor zero → não manda", () => {
    expect(decidirCompraNoSdk(compra({ tx: null }), PRODUTO, AGORA)).toMatchObject({ motivo: "sem_transacao" });
    expect(decidirCompraNoSdk(compra({ quando: AGORA - 2 * 3600e3 }), PRODUTO, AGORA)).toMatchObject({ motivo: "transacao_velha" });
    expect(decidirCompraNoSdk(compra(), { ...PRODUTO, price: 0 }, AGORA)).toMatchObject({ motivo: "sem_valor" });
  });
});

describe("envio pelo SDK", () => {
  it("iPhone, chave no padrão (on): manda 1x; a mesma transação de novo não repete", async () => {
    expect(await registrarCompraNoSdk(compra(), PRODUTO, "sem_teste_vitalicio")).toBe("enviado");
    expect(nativo.log).toHaveBeenCalledTimes(1);
    expect(nativo.log.mock.calls[0][0]).toEqual({ valor: 97.9, moeda: "BRL", produto: "core_vitalicio_97", pedido: "2000000999888777" });
    expect(JSON.parse(localStorage.getItem(CHAVE_META_COMPRA_ENVIADA)!)).toEqual(["2000000999888777"]);
    expect(await registrarCompraNoSdk(compra(), PRODUTO, "sem_teste_vitalicio")).toBe("ja_enviado");
    expect(nativo.log).toHaveBeenCalledTimes(1);
  });
  it("Android e site: nada", async () => {
    nativo.plataforma = "android";
    expect(await registrarCompraNoSdk(compra(), PRODUTO, "x")).toBe("nao_ios");
    nativo.plataforma = "web";
    expect(await registrarCompraNoSdk(compra(), PRODUTO, "x")).toBe("nao_ios");
    expect(nativo.log).not.toHaveBeenCalled();
  });
  it("teste no iPhone: não chama o SDK", async () => {
    expect(await registrarCompraNoSdk(compra({ periodo: "TRIAL" }), PRODUTO, "x")).toBe("em_teste");
    expect(nativo.log).not.toHaveBeenCalled();
  });
});

describe("chave remota meta_compra_sdk", () => {
  it("padrão sem a chave = ligado; 'off' na metadata desliga e fica gravado no aparelho", async () => {
    expect(metaCompraSdkLigado()).toBe(true);
    registrarMetaCompraSdkRemoto({ current: { metadata: { meta_compra_sdk: "off" } }, all: {} });
    expect(metaCompraSdkLigado()).toBe(false);
    expect(localStorage.getItem(CHAVE_META_COMPRA_SDK_APARELHO)).toBe("off");
    expect(await registrarCompraNoSdk(compra(), PRODUTO, "x")).toBe("desligado");
    expect(nativo.log).not.toHaveBeenCalled();
    _zerarMetaCompraSdk();
    expect(metaCompraSdkLigado()).toBe(false); // a última resposta do aparelho vale até o RevenueCat responder de novo
    registrarMetaCompraSdkRemoto({ current: { metadata: {} }, all: {} });
    expect(metaCompraSdkLigado()).toBe(true); // a chave sumiu → volta pro padrão e apaga a cópia do aparelho
    expect(localStorage.getItem(CHAVE_META_COMPRA_SDK_APARELHO)).toBeNull();
  });
  it("a `current` vence as outras offerings; lixo = ninguém disse", () => {
    const cur = { metadata: { meta_compra_sdk: "on" } };
    expect(lerMetaCompraSdkRemoto({ current: cur, all: { a: { metadata: { meta_compra_sdk: "off" } }, cur } })).toBe("on");
    expect(lerMetaCompraSdkRemoto({ current: { metadata: { meta_compra_sdk: "talvez" } }, all: {} })).toBeNull();
  });
  it("QA: ?meta-compra-sdk=off força desligado, auto apaga a força", () => {
    guardarForcaMetaCompraSdk("?meta-compra-sdk=off");
    expect(localStorage.getItem(CHAVE_FORCA_META_COMPRA_SDK)).toBe("off");
    expect(metaCompraSdkLigado()).toBe(false);
    guardarForcaMetaCompraSdk("?meta-compra-sdk=auto");
    expect(metaCompraSdkLigado()).toBe(true);
  });
});

describe("ligações", () => {
  it("as 2 chaves novas do aparelho estão na lista das chaves do aparelho", () => {
    expect(CHAVES_DO_APARELHO.has("core-meta-compra-sdk")).toBe(true);
    expect(CHAVES_DO_APARELHO.has("core-meta-compra-enviada")).toBe(true);
  });
  it("o comprarSemTeste chama o registro depois da folha com sucesso; a chave remota é registrada; o main guarda a força de QA", () => {
    const rc = readFileSync(resolve(__dirname, "../lib/revenuecat.ts"), "utf8");
    const corpo = rc.slice(rc.indexOf("export async function comprarSemTeste"), rc.indexOf("export const comprarMensalAndroid"));
    expect(corpo.indexOf('registrarResultadoDaFolha("sucesso", alvo)')).toBeLessThan(corpo.indexOf("registrarCompraNoSdk(resultado"));
    expect(rc).toMatch(/registrarMetaCompraSdkRemoto,/);
    expect(readFileSync(resolve(__dirname, "../main.tsx"), "utf8")).toMatch(/guardarForcaMetaCompraSdk\(\);/);
  });
});
