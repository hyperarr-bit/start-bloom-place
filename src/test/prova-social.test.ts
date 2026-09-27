/**
 * PROVA SOCIAL VIVA (27/09, funil ROI 2) — o número do paywall vem da edge
 * function `prova-social`. A regra que este teste trava: NUNCA mostrar 0 nem
 * número inventado. Falhou, veio 0, veio abaixo do piso → `null`, e a tela
 * cai no texto fixo de sempre. Uma chamada por carregamento (cache).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { buscarProvaSocial, _limparProvaSocial, formatarPessoas, PROVA_SOCIAL_MINIMO } from "@/lib/prova-social";

beforeEach(() => { _limparProvaSocial(); invoke.mockReset(); });

describe("prova social viva", () => {
  it("rede caiu → null (a tela fica com o texto fixo)", async () => {
    invoke.mockRejectedValue(new Error("Failed to fetch"));
    expect(await buscarProvaSocial()).toBeNull();
  });

  it("função respondeu erro → null", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await buscarProvaSocial()).toBeNull();
  });

  it("total 0 → null — nunca '0 pessoas' numa tela de venda", async () => {
    invoke.mockResolvedValue({ data: { total: 0, dia: 0 }, error: null });
    expect(await buscarProvaSocial()).toBeNull();
  });

  it("abaixo do piso (contradiz o '+1000' das outras telas) → null", async () => {
    invoke.mockResolvedValue({ data: { total: PROVA_SOCIAL_MINIMO - 1, dia: 3 }, error: null });
    expect(await buscarProvaSocial()).toBeNull();
  });

  it("lixo no corpo → null", async () => {
    invoke.mockResolvedValue({ data: { total: "muitas" }, error: null });
    expect(await buscarProvaSocial()).toBeNull();
    _limparProvaSocial();
    invoke.mockResolvedValue({ data: undefined, error: null });
    expect(await buscarProvaSocial()).toBeNull();
  });

  it("número real → devolve e formata em pt-BR", async () => {
    invoke.mockResolvedValue({ data: { total: 1382, dia: 32 }, error: null });
    expect(await buscarProvaSocial()).toEqual({ total: 1382, dia: 32 });
    expect(formatarPessoas(1382)).toBe("1.382");
    expect(formatarPessoas(2029)).toBe("2.029");
  });

  it("chama a função UMA vez: cache em memória e chamadas em paralelo compartilham o voo", async () => {
    invoke.mockResolvedValue({ data: { total: 1382, dia: 32 }, error: null });
    const [a, b] = await Promise.all([buscarProvaSocial(), buscarProvaSocial()]);
    expect(a).toEqual(b);
    expect(await buscarProvaSocial()).toEqual({ total: 1382, dia: 32 });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe("prova-social");
  });

  it("falha não fica presa no cache: a próxima chamada tenta de novo", async () => {
    invoke.mockRejectedValueOnce(new Error("rede"));
    expect(await buscarProvaSocial()).toBeNull();
    invoke.mockResolvedValue({ data: { total: 1400, dia: 1 }, error: null });
    expect(await buscarProvaSocial()).toEqual({ total: 1400, dia: 1 });
  });
});
