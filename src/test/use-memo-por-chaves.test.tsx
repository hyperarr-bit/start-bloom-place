import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMemoPorChaves, type LeitorDeChaves } from "@/hooks/use-memo-por-chaves";

/* 07/11 (desempenho): o memo pelas chaves LIDAS — só refaz a conta quando o valor de uma chave lida muda
 * (ou `deps`), nunca só porque o `get` do store trocou de identidade. */

const leitorDe = (store: Record<string, unknown>): LeitorDeChaves =>
  (<T,>(chave: string, padrao: T): T => (chave in store ? (store[chave] as T) : padrao));

describe("useMemoPorChaves", () => {
  it("devolve o cache quando o get muda de identidade mas as chaves lidas não", () => {
    const store = { a: [1, 2], b: "x", c: { n: 1 } };
    let vezes = 0;
    const calc = (ler: LeitorDeChaves) => { vezes++; return `${(ler("a", [] as number[])).length}-${ler("b", "")}-${ler("z", "padrao")}`; };
    const { result, rerender } = renderHook(({ get }) => useMemoPorChaves(get, calc), { initialProps: { get: leitorDe(store) } });
    expect(result.current).toBe("2-x-padrao");
    expect(vezes).toBe(1);
    rerender({ get: leitorDe({ ...store, c: { n: 2 } }) }); // get novo, chave NÃO lida mudou
    expect(result.current).toBe("2-x-padrao");
    expect(vezes).toBe(1);
  });

  it("refaz quando uma chave lida muda — inclusive uma que estava ausente e apareceu", () => {
    let vezes = 0;
    const calc = (ler: LeitorDeChaves) => { vezes++; return `${ler("a", 0)}|${ler("z", "sem")}`; };
    const { result, rerender } = renderHook(({ get }) => useMemoPorChaves(get, calc), { initialProps: { get: leitorDe({ a: 1 }) } });
    expect(result.current).toBe("1|sem");
    rerender({ get: leitorDe({ a: 2 }) });
    expect(result.current).toBe("2|sem");
    expect(vezes).toBe(2);
    rerender({ get: leitorDe({ a: 2, z: "veio" }) });
    expect(result.current).toBe("2|veio");
    expect(vezes).toBe(3);
  });

  it("referência nova com o mesmo conteúdo não refaz (chave desserializada de novo pelo get)", () => {
    let vezes = 0;
    const calc = (ler: LeitorDeChaves) => { vezes++; return (ler("lista", [] as number[])).length; };
    const { result, rerender } = renderHook(({ get }) => useMemoPorChaves(get, calc), { initialProps: { get: leitorDe({ lista: [1, 2, 3] }) } });
    expect(result.current).toBe(3);
    rerender({ get: leitorDe({ lista: [1, 2, 3] }) }); // outro array, mesmo conteúdo
    expect(vezes).toBe(1);
    rerender({ get: leitorDe({ lista: [1, 2, 3, 4] }) });
    expect(result.current).toBe(4);
    expect(vezes).toBe(2);
  });

  it("deps mudando refaz; null presente no store não vira o padrão", () => {
    let vezes = 0;
    const calc = (ler: LeitorDeChaves) => { vezes++; return ler("n", "padrao"); };
    const { result, rerender } = renderHook(({ get, dia }) => useMemoPorChaves(get, calc, [dia]), { initialProps: { get: leitorDe({ n: null }), dia: "2026-11-07" } });
    expect(result.current).toBeNull();
    rerender({ get: leitorDe({ n: null }), dia: "2026-11-07" });
    expect(vezes).toBe(1);
    rerender({ get: leitorDe({ n: null }), dia: "2026-11-08" });
    expect(vezes).toBe(2);
  });
});
