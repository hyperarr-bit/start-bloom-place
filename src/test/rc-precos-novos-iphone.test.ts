/**
 * PREÇOS NOVOS DO IPHONE (17/10): core_mensal_19 (R$ 19,90, assinatura) e
 * core_anual_119 (R$ 119,90). Sem linha própria no mapa, o startsWith casava
 * "core_mensal"/"core_anual" e gravava 24,90 / 159,90 — dinheiro errado no
 * banco e evento errado na Meta.
 *
 * As functions são autocontidas (Deno, imports por URL), então o teste lê o
 * FONTE: tira o mapa PRODUTOS + infoProduto e o bloco PRECOS/VITALICIOS/
 * MENSAIS → porPlano de cada uma e roda aqui, igual ao que roda lá.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brutoCents } from "../../supabase/functions/_shared/afiliados";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");
const semTipos = (js: string) =>
  js.replace(/:\s*Record<[^=]*>\s*=/g, " =").replace(/ as number \| null/g, "").replace(/\(storeId: string \| null \| undefined\)/, "(storeId)");

type Info = { billing: string; cents: number | null };
function infoProdutoDe(f: string): (id: string) => Info {
  const s = fonte(f);
  const mapa = s.match(/const PRODUTOS: Record<string, \{ billing: string; cents: number \}> = \{[\s\S]*?\n\};/)?.[0];
  const info = s.match(/const infoProduto = \(storeId[\s\S]*?\n\};/)?.[0];
  if (!mapa || !info) throw new Error(`mapa/infoProduto não achados em ${f}`);
  return new Function(`${semTipos(mapa)}\n${semTipos(info)}\nreturn infoProduto;`)() as (id: string) => Info;
}

type Plano = { evento: string; sufixo: string; junto?: { evento: string; sufixo: string } } | null;
function porPlanoDe(f: string): (cents: number, billing: string | null) => Plano {
  const s = fonte(f);
  const bloco = s.match(/const MENSAL_GERAL = [\s\S]*?const porPlano = [^\n]*\n/)?.[0];
  if (!bloco) throw new Error(`bloco PRECOS não achado em ${f}`);
  return new Function("cents", "billing", `${semTipos(bloco)}\nreturn porPlano;`) as (c: number, b: string | null) => Plano;
}

const COM_MAPA = ["revenuecat-webhook/index.ts", "revenuecat-sync/index.ts"];
const COM_EVENTOS = [...COM_MAPA, "meta-backfill-app/index.ts"];

describe.each(COM_MAPA)("%s: mapa de produtos", (f) => {
  const info = infoProdutoDe(f);
  it("produtos novos com o preço certo", () => {
    expect(info("core_mensal_19")).toEqual({ billing: "monthly", cents: 1990 });
    expect(info("core_anual_119")).toEqual({ billing: "annual", cents: 11990 });
  });
  it("os antigos não mudam", () => {
    expect(info("core_mensal")).toEqual({ billing: "monthly", cents: 2490 });
    expect(info("core_mensal:coremensalpix")).toEqual({ billing: "monthly_prepaid", cents: 1990 });
    expect(info("core_mensal:coremensalvista")).toEqual({ billing: "monthly_prepaid", cents: 2490 });
    expect(info("core_anual")).toEqual({ billing: "annual", cents: 15990 });
    expect(info("core_anual_97")).toEqual({ billing: "annual", cents: 9790 });
    expect(info("core_anual_69")).toEqual({ billing: "annual", cents: 6990 });
    expect(info("core_anual:coreanual97")).toEqual({ billing: "annual_prepaid", cents: 9790 });
    expect(info("core_vitalicio_19")).toEqual({ billing: "lifetime", cents: 1990 });
    expect(info("core_vitalicio_97")).toEqual({ billing: "lifetime", cents: 9790 });
    expect(info("xyz").cents).toBeNull();
  });
});

describe.each(COM_EVENTOS)("%s: evento por plano na Meta", (f) => {
  const plano = porPlanoDe(f);
  it("mensal 19,90 do iPhone tem evento próprio (+ compra_mensal_geral)", () => {
    expect(plano(1990, "monthly")).toMatchObject({ evento: "compra_mensal_19", sufixo: "m19", junto: { evento: "compra_mensal_geral", sufixo: "mg" } });
  });
  it("anual 119,90 do iPhone", () => {
    expect(plano(11990, "annual")).toMatchObject({ evento: "compra_anual_119", sufixo: "a119" });
    expect(plano(11990, "annual")?.junto).toBeUndefined();
  });
  it("Pix pré-pago, vitalício 19,90 e os outros continuam iguais", () => {
    expect(plano(1990, "monthly_prepaid")).toMatchObject({ evento: "compra_mensal_pix", sufixo: "mp" });
    expect(plano(1990, "lifetime")).toBeNull();
    expect(plano(2490, "monthly")).toMatchObject({ evento: "compra_mensal", sufixo: "m" });
    expect(plano(2490, "monthly_prepaid")).toMatchObject({ evento: "compra_mensal" });
    expect(plano(6990, "annual")).toMatchObject({ evento: "compra_anual_69" });
    expect(plano(9790, "annual")).toMatchObject({ evento: "compra_anual_97" });
    expect(plano(9790, "lifetime")).toMatchObject({ evento: "compra_vitalicio_97" });
    expect(plano(15990, "annual")).toMatchObject({ evento: "compra_anual" });
    expect(plano(1990, null)).toBeNull();
  });
  it("sufixos de event_id não colidem", () => {
    const s = fonte(f);
    const bloco = s.match(/const MENSAL_GERAL = [\s\S]*?const porPlano/)?.[0] ?? "";
    const sufixos = [...bloco.matchAll(/sufixo: "([a-z0-9]+)"/g)].map((m) => m[1]);
    expect(new Set(sufixos).size).toBe(sufixos.length);
    expect(sufixos).not.toContain("av"); // compra_avista
  });
});

describe("afiliados: bruto pelo produto quando o evento não traz BRL", () => {
  it("core_anual_119 e core_mensal_19", () => {
    expect(brutoCents({ product_id: "core_anual_119" })).toBe(11990);
    expect(brutoCents({ product_id: "core_mensal_19" })).toBe(1990);
    expect(brutoCents({ product_id: "core_anual_97" })).toBe(9790);
  });
});

/* 12/11 (paywall SEM teste, 1.0.26 / Android 138): sem linha própria, core_anual_99 casava "core_anual" (159,90) e
 * core_mensal_34 casava "core_mensal" (24,90). Cada compra grava o preço certo, no iPhone e no Android (produto:plano_base). */
describe.each(COM_MAPA)("%s: produtos do paywall sem teste", (f) => {
  const info = infoProdutoDe(f);
  it("anual 99,90 · mensal 34,90 · presente 69,90 direto (iPhone)", () => {
    expect(info("core_anual_99")).toEqual({ billing: "annual", cents: 9990 });
    expect(info("core_mensal_34")).toEqual({ billing: "monthly", cents: 3490 });
    expect(info("core_anual_69_direto")).toEqual({ billing: "annual", cents: 6990 });
  });
  it("os mesmos no formato do Android (produto:plano_base)", () => {
    expect(info("core_anual_99:coreanual99")).toEqual({ billing: "annual", cents: 9990 });
    expect(info("core_mensal_34:coremensal34")).toEqual({ billing: "monthly", cents: 3490 });
    expect(info("core_anual_69_direto:coreanual69direto")).toEqual({ billing: "annual", cents: 6990 });
  });
  it("o 69,90 de hoje (com teste) segue igual", () => {
    expect(info("core_anual_69")).toEqual({ billing: "annual", cents: 6990 });
  });
  it("12/11 noite: o anual SEM teste do iPhone é core_anual_97_direto = 97,90 (linha própria, não o core_anual_97 com teste)", () => {
    expect(info("core_anual_97_direto")).toEqual({ billing: "annual", cents: 9790 });
    expect(info("core_anual_97")).toEqual({ billing: "annual", cents: 9790 });
    const s = fonte(f);
    expect(s).toMatch(/\n\s*core_anual_97_direto: \{ billing: "annual", cents: 9790 \}/);
  });
});

describe("afiliados: bruto dos produtos sem teste", () => {
  it("iPhone e Android", () => {
    expect(brutoCents({ product_id: "core_anual_99" })).toBe(9990);
    expect(brutoCents({ product_id: "core_mensal_34:coremensal34" })).toBe(3490);
    expect(brutoCents({ product_id: "core_anual_69_direto" })).toBe(6990);
    expect(brutoCents({ product_id: "core_anual_97_direto" })).toBe(9790);
  });
});
