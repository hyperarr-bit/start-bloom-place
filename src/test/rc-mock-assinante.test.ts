/**
 * ASSINANTE DO MOCK DA LOJA (10/10, lib/rc-mock) — só no build de TESTE (RC_MOCK=1 → `__RC_MOCK__` true).
 *
 *  · SEM a constante (qualquer build que não seja o de mock; o vitest também não a define):
 *    `assinaturaDoMock()` é SEMPRE null — mesmo com a marca gravada no localStorage.
 *  · COM a constante true + `__rc_mock_assinante = "1"`: assinante, anual em teste de 3 dias
 *    a partir da compra (dia 1 no dia da compra; horas até o fim), mensal sem teste.
 *  · o preparar-loja.mjs barra RC_MOCK em build de produção e confere que a marca não sobrou no JS.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assinaturaDoMock, buildDeMock, diasDoTesteDoMock, CHAVE_MOCK_ASSINANTE, CHAVE_MOCK_PRODUTO, CHAVE_MOCK_COMPRA_EM } from "@/lib/rc-mock";

const marcar = (produto = "core_anual_97", compraEm = Date.now()) => {
  localStorage.setItem(CHAVE_MOCK_ASSINANTE, "1");
  localStorage.setItem(CHAVE_MOCK_PRODUTO, produto);
  localStorage.setItem(CHAVE_MOCK_COMPRA_EM, String(compraEm));
};

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("sem a constante do build de mock: nada muda", () => {
  it("buildDeMock() é false e assinaturaDoMock() é null, com ou sem a marca no localStorage", () => {
    expect(typeof (globalThis as { __RC_MOCK__?: unknown }).__RC_MOCK__).toBe("undefined");
    expect(buildDeMock()).toBe(false);
    expect(assinaturaDoMock()).toBeNull();
    marcar();
    expect(assinaturaDoMock()).toBeNull();
    vi.stubGlobal("__RC_MOCK__", false);
    expect(buildDeMock()).toBe(false);
    expect(assinaturaDoMock()).toBeNull();
    vi.stubGlobal("__RC_MOCK__", "1"); // só o booleano true vale
    expect(assinaturaDoMock()).toBeNull();
  });
});

describe("no build de mock (__RC_MOCK__ true)", () => {
  beforeEach(() => vi.stubGlobal("__RC_MOCK__", true));

  it("sem a marca: null; com a marca: anual em teste de 3 dias a partir da compra", () => {
    expect(buildDeMock()).toBe(true);
    expect(assinaturaDoMock()).toBeNull();
    const compraEm = new Date(2026, 9, 10, 20, 0).getTime();
    marcar("core_anual_97", compraEm);
    const a = assinaturaDoMock(compraEm + 3_600_000);
    expect(a).toMatchObject({ produto: "core_anual_97", compraEm, emTeste: true, billingPeriod: "annual", fimMs: compraEm + 3 * 86_400_000 });
    expect(diasDoTesteDoMock(a!, compraEm + 3_600_000)).toEqual({ trialDay: 1, trialHoursLeft: 71 });
    expect(diasDoTesteDoMock(a!, compraEm + 30 * 3_600_000)).toEqual({ trialDay: 2, trialHoursLeft: 42 });
    expect(diasDoTesteDoMock(a!, compraEm + 4 * 86_400_000).trialHoursLeft).toBe(0);
  });

  it("mensal: sem teste, 30 dias; o 69,90 também é anual em teste; sem produto gravado assume o anual", () => {
    marcar("core_mensal", 1_000);
    expect(assinaturaDoMock(2_000)).toMatchObject({ emTeste: false, billingPeriod: "monthly", fimMs: 1_000 + 30 * 86_400_000 });
    marcar("core_anual_69", 1_000);
    expect(assinaturaDoMock(2_000)).toMatchObject({ emTeste: true, billingPeriod: "annual" });
    localStorage.setItem(CHAVE_MOCK_ASSINANTE, "1");
    localStorage.removeItem(CHAVE_MOCK_PRODUTO);
    localStorage.removeItem(CHAVE_MOCK_COMPRA_EM);
    expect(assinaturaDoMock(5_000)).toMatchObject({ produto: "core_anual_97", compraEm: 5_000, emTeste: true });
    localStorage.setItem(CHAVE_MOCK_ASSINANTE, "0");
    expect(assinaturaDoMock()).toBeNull();
  });
});

describe("as travas do build", () => {
  it("vite.config define __RC_MOCK__ a partir de RC_MOCK; preparar-loja barra RC_MOCK em produção e confere a marca no JS; o mock grava a marca", () => {
    const vite = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(vite).toMatch(/__RC_MOCK__: JSON\.stringify\(process\.env\.RC_MOCK === "1"\)/);
    const loja = readFileSync(resolve(process.cwd(), "scripts/preparar-loja.mjs"), "utf8");
    expect(loja).toMatch(/if \(!teste && process\.env\.RC_MOCK === "1"\)/);
    expect(loja).toMatch(/__rc_mock_assinante/);
    const mock = readFileSync(resolve(process.cwd(), "src/dev/rc-plugin-mock.ts"), "utf8");
    expect(mock).toMatch(/localStorage\.setItem\("__rc_mock_assinante", "1"\)/);
    expect(mock).toMatch(/periodType: trial \? "TRIAL" : "NORMAL"/);
    const auth = readFileSync(resolve(process.cwd(), "src/hooks/use-auth.tsx"), "utf8");
    expect(auth).toMatch(/const mock = assinaturaDoMock\(\);/);
  });
});
