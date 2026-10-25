/**
 * 1.0.19 (SKAN): "Iniciar teste" pelo SDK da Meta no iPhone — 1x por transação, só quando a compra entrou em
 * TESTE agora, só no iOS nativo. Ver src/lib/meta-inicio-teste-ios.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const nativo = vi.hoisted(() => ({
  plataforma: "ios",
  ok: true,
  log: vi.fn(async (_o: unknown) => ({ ok: nativo.ok })),
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({ logInicioTeste: (o: unknown) => nativo.log(o) }),
}));
// a plataforma vem do global que o runtime injeta (lib/native-shell)
Object.defineProperty(window, "Capacitor", {
  configurable: true,
  get: () => ({ getPlatform: () => nativo.plataforma, isNativePlatform: () => nativo.plataforma !== "web" }),
});
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
}));

import {
  CHAVE_INICIO_TESTE_ENVIADO,
  decidirInicioDeTeste,
  registrarInicioDoTesteNoSdk,
} from "@/lib/meta-inicio-teste-ios";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";

const AGORA = Date.parse("2026-10-25T15:00:00Z");
const PRODUTO = { identifier: "core_anual_97", price: 97.9, currencyCode: "BRL" };
const compra = (o: { periodo?: string; tx?: string | null; quando?: number; semEntitlement?: boolean } = {}) => ({
  productIdentifier: "core_anual_97",
  customerInfo: {
    entitlements: {
      active: o.semEntitlement ? {} : { pro: { periodType: o.periodo ?? "TRIAL", latestPurchaseDateMillis: o.quando ?? AGORA - 5000, productIdentifier: "core_anual_97" } },
    },
  },
  transaction: o.tx === null ? null : {
    transactionIdentifier: o.tx ?? "2000000123456789",
    productIdentifier: "core_anual_97",
    purchaseDate: new Date(o.quando ?? AGORA - 5000).toISOString(),
  },
});

beforeEach(() => {
  localStorage.clear();
  // 26/10: o lib compara a data da compra com o relógio REAL (FRESCOR_MAXIMO_MS = 1 h) — com o fixture preso em
  // AGORA (25/10 15:00Z) o teste vencia sozinho um dia depois ("transacao_velha"). O relógio fica em AGORA.
  vi.spyOn(Date, "now").mockReturnValue(AGORA);
  nativo.plataforma = "ios";
  nativo.ok = true;
  nativo.log.mockClear();
  eventos.length = 0;
  vi.useRealTimers();
});

describe("decidirInicioDeTeste (pura)", () => {
  it("teste que acabou de começar: manda com valor/moeda do produto e o id da transação da Apple", () => {
    expect(decidirInicioDeTeste(compra(), PRODUTO, AGORA)).toEqual({
      mandar: true,
      evento: { transacao: "2000000123456789", produto: "core_anual_97", valor: 97.9, moeda: "BRL" },
    });
  });
  it("compra SEM teste (período NORMAL) ou sem entitlement: não manda", () => {
    expect(decidirInicioDeTeste(compra({ periodo: "NORMAL" }), PRODUTO, AGORA)).toEqual({ mandar: false, motivo: "sem_trial" });
    expect(decidirInicioDeTeste(compra({ semEntitlement: true }), PRODUTO, AGORA)).toEqual({ mandar: false, motivo: "sem_trial" });
  });
  it("sem id de transação: não manda (não dá pra garantir 1x nem juntar com o servidor)", () => {
    expect(decidirInicioDeTeste(compra({ tx: null }), PRODUTO, AGORA)).toEqual({ mandar: false, motivo: "sem_transacao" });
  });
  it("transação antiga (comprar de novo o que já está ativo devolve a transação velha): não manda", () => {
    expect(decidirInicioDeTeste(compra({ quando: AGORA - 2 * 3600_000 }), PRODUTO, AGORA)).toEqual({ mandar: false, motivo: "transacao_velha" });
  });
  it("presente 69,90 com teste: valor do produto do presente", () => {
    const d = decidirInicioDeTeste(compra({ tx: "2000000999" }), { identifier: "core_anual_69", price: 69.9, currencyCode: "BRL" }, AGORA);
    expect(d).toMatchObject({ mandar: true, evento: { valor: 69.9, transacao: "2000000999" } });
  });
});

describe("registrarInicioDoTesteNoSdk", () => {
  it("iPhone: chama MetaAds.logInicioTeste UMA vez; a mesma transação de novo (reabrir/repetir) não manda", async () => {
    expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "anual_ios")).toBe("enviado");
    expect(nativo.log).toHaveBeenCalledTimes(1);
    expect(nativo.log).toHaveBeenCalledWith({ transacao: "2000000123456789", produto: "core_anual_97", valor: 97.9, moeda: "BRL" });
    expect(JSON.parse(localStorage.getItem(CHAVE_INICIO_TESTE_ENVIADO)!)).toEqual(["2000000123456789"]);
    expect(eventos[0]).toEqual(["meta_sdk_inicio_teste", { ok: true, origem: "anual_ios", produto: "core_anual_97", valor: 97.9, tx: "2000000123456789" }]);

    expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "anual_ios")).toBe("ja_enviado");
    expect(nativo.log).toHaveBeenCalledTimes(1);
  });

  it("compra sem teste (mensal 19,90, anual sem oferta): nem chama o plugin, nem evento", async () => {
    expect(await registrarInicioDoTesteNoSdk(compra({ periodo: "NORMAL" }), PRODUTO, "anual_ios")).toBe("sem_trial");
    expect(nativo.log).not.toHaveBeenCalled();
    expect(eventos).toEqual([]);
  });

  it("web e Android: nada (Android fica pra depois)", async () => {
    for (const p of ["web", "android"]) {
      nativo.plataforma = p;
      expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "anual_ios")).toBe("nao_ios");
    }
    expect(nativo.log).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAVE_INICIO_TESTE_ENVIADO)).toBeNull();
  });

  it("build sem token da Meta (dev/simulador): o plugin responde ok:false — marcado mesmo assim (nunca 2x)", async () => {
    nativo.ok = false;
    expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "presente69")).toBe("sem_sdk");
    expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "presente69")).toBe("ja_enviado");
    expect(nativo.log).toHaveBeenCalledTimes(1);
  });

  it("plugin lança: não quebra a compra (devolve 'erro') e não repete depois", async () => {
    nativo.log.mockRejectedValueOnce(new Error("not implemented"));
    expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "anual_ios")).toBe("erro");
    expect(await registrarInicioDoTesteNoSdk(compra(), PRODUTO, "anual_ios")).toBe("ja_enviado");
  });

  it("outra transação (outro teste, outra conta Apple no mesmo aparelho): manda de novo", async () => {
    await registrarInicioDoTesteNoSdk(compra({ tx: "A1" }), PRODUTO, "anual_ios");
    await registrarInicioDoTesteNoSdk(compra({ tx: "B2" }), PRODUTO, "anual_ios");
    expect(nativo.log).toHaveBeenCalledTimes(2);
  });

  it("a guarda é do APARELHO: a vassoura do cache por conta não apaga", () => {
    expect(CHAVES_DO_APARELHO.has(CHAVE_INICIO_TESTE_ENVIADO)).toBe(true);
  });
});

describe("ligação nos caminhos de compra do iPhone (revenuecat.ts)", () => {
  it("anual do paywall e presente 69,90 chamam depois do sucesso da folha; mensal 19,90 (sem teste) não", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/revenuecat.ts", "utf8");
    const corpo = (nome: string) => {
      const i = src.indexOf(`export async function ${nome}(`);
      const j = src.indexOf("\nexport ", i + 10);
      return src.slice(i, j);
    };
    for (const nome of ["comprarAnualIos", "comprarPresente69"]) {
      const c = corpo(nome);
      expect(c).toMatch(/registrarResultadoDaFolha\("sucesso"[\s\S]*registrarInicioDoTesteNoSdk\(resultado,/);
      // sem await: um plugin travado nunca segura a compra
      expect(c).toMatch(/void registrarInicioDoTesteNoSdk/);
    }
    expect(corpo("comprarMensal19")).not.toMatch(/registrarInicioDoTesteNoSdk/);
    // restaurar compra nunca manda
    expect(corpo("restaurar")).not.toMatch(/registrarInicioDoTesteNoSdk/);
  });
});
