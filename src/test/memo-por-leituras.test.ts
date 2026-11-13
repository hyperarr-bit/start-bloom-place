import { describe, expect, it, vi } from "vitest";
import { memoPorLeituras, novoCacheDeLeituras, type LeitorMemo } from "@/lib/memo-por-leituras";
import { gravarPeso } from "@/lib/acoes-rapidas";

/* 07/11 (desempenho): o memo fora do React usado nos blocos caros das conquistas — devolve o guardado enquanto
 * nenhuma chave lida mudou (e o dia é o mesmo), e refaz quando uma muda, aparece ou some. */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const leitorDe = (store: Record<string, unknown>): LeitorMemo =>
  (<T,>(chave: string, padrao: T): T => (chave in store ? (store[chave] as T) : padrao));

describe("memoPorLeituras", () => {
  const conta = () => {
    const cache = novoCacheDeLeituras<number>();
    let vezes = 0;
    const rodar = (store: Record<string, unknown>, dia = "2026-11-07") =>
      memoPorLeituras(cache, leitorDe(store), dia, (ler) => { vezes++; return ler("a", [] as number[]).length + ler("z", 0); });
    return { rodar, vezes: () => vezes };
  };

  it("chave NÃO lida mudou: devolve o guardado sem calcular", () => {
    const a = [1, 2];
    const c = conta();
    expect(c.rodar({ a, outra: 1 })).toBe(2);
    expect(c.rodar({ a, outra: 2 })).toBe(2);
    expect(c.vezes()).toBe(1);
  });

  it("chave lida mudou, apareceu ou sumiu: refaz", () => {
    const a = [1, 2];
    const c = conta();
    c.rodar({ a });
    expect(c.rodar({ a: [1, 2, 3] })).toBe(3);
    expect(c.rodar({ a: [1, 2, 3], z: 10 })).toBe(13);
    expect(c.rodar({})).toBe(0);
    expect(c.vezes()).toBe(4);
  });

  it("o dia mudou: refaz mesmo com as chaves iguais", () => {
    const a = [1];
    const c = conta();
    c.rodar({ a }, "2026-11-07");
    c.rodar({ a }, "2026-11-08");
    expect(c.vezes()).toBe(2);
  });

  it("outra conta (outros objetos) nunca recebe o resultado guardado da anterior", () => {
    const c = conta();
    expect(c.rodar({ a: [1, 2, 3] })).toBe(3);
    expect(c.rodar({ a: [1] })).toBe(1);
  });

  it("aninhado num leitor que anota: acerto no cache de dentro ainda anota as chaves no de fora", () => {
    const cache = novoCacheDeLeituras<number>();
    const store = { a: 1 };
    const calcular = (ler: LeitorMemo) => ler("a", 0);
    memoPorLeituras(cache, leitorDe(store), "d", calcular);
    const lidas: string[] = [];
    const fora: LeitorMemo = <T,>(chave: string, padrao: T): T => { lidas.push(chave); return leitorDe(store)(chave, padrao); };
    expect(memoPorLeituras(cache, fora, "d", calcular)).toBe(1);
    expect(lidas).toEqual(["a"]);
  });
});

describe("gravarPeso", () => {
  it("grava uma lista NOVA: quem compara por referência enxerga a pesagem", () => {
    const antes = [{ date: "2026-11-01", weight: 70, id: "x" }];
    const set = vi.fn();
    const ctx = { get: <T,>() => antes as unknown as T, set } as unknown as Parameters<typeof gravarPeso>[0];
    expect(gravarPeso(ctx, { pesoTexto: "71,5" })).toBe(true);
    const [chave, gravada] = set.mock.calls[0];
    expect(chave).toBe("core-saude-measures");
    expect(gravada).not.toBe(antes);
    expect(gravada).toHaveLength(2);
    expect(antes).toHaveLength(1);
  });
});
