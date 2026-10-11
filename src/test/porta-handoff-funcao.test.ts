/**
 * PORTA → APP JÁ LOGADO (10/10): as partes puras da função porta-handoff
 * (supabase/functions/_shared/porta-handoff.ts) — o código e o limite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALFABETO, LIMITE_ERROS_POR_HORA, TAMANHO_CODIGO, codigoValido, dentroDoLimite, gerarCodigo, hashCodigo,
  ipDoPedido, linkDoCodigo, normalizarCodigo,
} from "../../supabase/functions/_shared/porta-handoff";

const cab = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("código do handoff", () => {
  it("alfabeto de 32, sem os ambíguos I, O, 0 e 1", () => {
    expect(ALFABETO).toHaveLength(32);
    expect(new Set(ALFABETO).size).toBe(32);
    expect(ALFABETO).not.toMatch(/[IO01]/);
  });

  it("gera 10 caracteres do alfabeto, válidos, e diferentes a cada vez", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = gerarCodigo();
      expect(c).toHaveLength(TAMANHO_CODIGO);
      expect([...c].every((x) => ALFABETO.includes(x))).toBe(true);
      expect(codigoValido(c)).toBe(true);
      vistos.add(c);
    }
    expect(vistos.size).toBe(500);
  });

  it("bytes fixos → código determinístico (byte % 32, sem viés)", () => {
    expect(gerarCodigo(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 31]))).toBe("ABCDEFGHJ9");
    expect(gerarCodigo(new Uint8Array([32, 64, 96, 128, 160, 192, 224, 255, 33, 63]))).toBe("AAAAAAA9B9");
    expect(() => gerarCodigo(new Uint8Array(3))).toThrow();
  });

  it("normaliza (minúscula, espaço, hífen) e recusa formato torto", () => {
    expect(normalizarCodigo(" abcd-efgh 23 ")).toBe("ABCDEFGH23");
    expect(codigoValido("abcdefgh23")).toBe(true);
    expect(codigoValido("ABCDEFGH2")).toBe(false);     // 9
    expect(codigoValido("ABCDEFGH234")).toBe(false);   // 11
    expect(codigoValido("ABCDEFGHI2")).toBe(false);    // I é ambíguo
    expect(codigoValido("ABCDEFGH01")).toBe(false);    // 0 e 1 também
    expect(codigoValido(null)).toBe(false);
    expect(codigoValido("TESTE")).toBe(false);
  });

  it("hash = SHA-256 hex do código normalizado (o banco nunca vê o código)", async () => {
    const h = await hashCodigo("ABCDEFGH23");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashCodigo("abcd efgh23")).toBe(h);
    expect(await hashCodigo("ABCDEFGH24")).not.toBe(h);
  });

  it("o link que o site copia e o app reconhece", () => {
    expect(linkDoCodigo("ABCDEFGH23")).toBe("https://coreaplicativo.com.br/p/ABCDEFGH23");
  });
});

describe("limite contra força bruta", () => {
  it(`até ${LIMITE_ERROS_POR_HORA - 1} erros na hora passa; ${LIMITE_ERROS_POR_HORA} barra`, () => {
    expect(dentroDoLimite(0)).toBe(true);
    expect(dentroDoLimite(LIMITE_ERROS_POR_HORA - 1)).toBe(true);
    expect(dentroDoLimite(LIMITE_ERROS_POR_HORA)).toBe(false);
  });

  it("IP: o 1º do x-forwarded-for; senão cf-connecting-ip / x-real-ip", () => {
    expect(ipDoPedido(cab({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(ipDoPedido(cab({ "cf-connecting-ip": "200.9.9.9" }))).toBe("200.9.9.9");
    expect(ipDoPedido(cab({}))).toBe("sem-ip");
  });
});

describe("a função e a migração", () => {
  const raiz = process.cwd();
  const fn = readFileSync(join(raiz, "supabase/functions/porta-handoff/index.ts"), "utf8");
  const sql = readFileSync(join(raiz, "supabase/migrations/20261011010000_porta_handoff.sql"), "utf8");
  const cfg = readFileSync(join(raiz, "supabase/config.toml"), "utf8");

  it("resgate marca usado só se não usado e não vencido (atômico) e erra sempre igual", () => {
    expect(fn).toMatch(/\.is\("usado_em", null\)\s*\n\s*\.gt\("expira_em", agora\)/);
    expect(fn).toContain('generateLink({ type: "magiclink", email })');
    expect(fn).toContain("hashed_token");
    // um só erro pra código ruim, nunca "vencido"/"usado"/"inexistente" na resposta
    expect(fn).not.toMatch(/json\(\{ erro: "(vencido|usado|inexistente)"/);
  });

  it("tabelas com RLS ligada e SEM política (só a service role)", () => {
    expect(sql).toMatch(/ALTER TABLE public\.porta_handoff ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.porta_handoff_erros ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(/REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/porta_handoff_user_id_idx/);
  });

  it("verify_jwt desligado (o app resgata sem sessão; o criar confere o JWT dentro)", () => {
    expect(cfg).toMatch(/\[functions\.porta-handoff\]\s*\nverify_jwt = false/);
    expect(fn).toContain("anon.auth.getUser(token)");
  });
});
