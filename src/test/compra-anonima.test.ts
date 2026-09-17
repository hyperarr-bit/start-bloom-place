/**
 * Compra órfã (17/09): quem paga na sessão anônima e depois entra em OUTRA
 * conta (Google, senha, link, código) não pode perder o Pix. O cliente guarda
 * a sessão anônima antes da troca e pede ao servidor pra mover a compra.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const getSession = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: (...a: unknown[]) => getSession(...a) }, functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import { guardarCompraAnonima, vincularCompraAnonima, limparCompraAnonima } from "@/lib/sessao-anonima";

const CHAVE = "core-compra-anonima";
const sessao = (uid: string) => ({ data: { session: { user: { id: uid }, access_token: `tok-${uid}`, refresh_token: `ref-${uid}` } } });

beforeEach(() => { localStorage.clear(); getSession.mockReset(); invoke.mockReset(); });

describe("guardarCompraAnonima", () => {
  it("guarda uid, token e refresh da sessão atual", async () => {
    getSession.mockResolvedValue(sessao("anon-1"));
    await guardarCompraAnonima();
    const g = JSON.parse(localStorage.getItem(CHAVE)!);
    expect(g).toMatchObject({ uid: "anon-1", token: "tok-anon-1", refresh: "ref-anon-1" });
    expect(typeof g.em).toBe("number");
  });

  it("sem sessão não guarda nada", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await guardarCompraAnonima();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});

describe("vincularCompraAnonima", () => {
  it("sem guarda: não chama o servidor", async () => {
    expect(await vincularCompraAnonima("conta-nova", true)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("mesma conta da guarda: não chama o servidor", async () => {
    getSession.mockResolvedValue(sessao("anon-1"));
    await guardarCompraAnonima();
    expect(await vincularCompraAnonima("anon-1", true)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("conta diferente: manda os tokens, e quando o servidor move, limpa a guarda", async () => {
    getSession.mockResolvedValue(sessao("anon-1"));
    await guardarCompraAnonima();
    invoke.mockResolvedValue({ data: { ok: true, plan: "lifetime" }, error: null });
    expect(await vincularCompraAnonima("conta-nova", true)).toBe(true);
    expect(invoke).toHaveBeenCalledWith("pix-vincular", { body: { tokenAnonimo: "tok-anon-1", refreshAnonimo: "ref-anon-1" } });
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("origem ainda sem Pix: mantém a guarda pra tentar de novo (pagou depois de trocar)", async () => {
    getSession.mockResolvedValue(sessao("anon-1"));
    await guardarCompraAnonima();
    invoke.mockResolvedValue({ data: { ok: false, motivo: "origem_sem_pix" }, error: null });
    expect(await vincularCompraAnonima("conta-nova", true)).toBe(false);
    expect(localStorage.getItem(CHAVE)).not.toBeNull();
  });

  it("veredito definitivo (já assinante / token inválido): limpa a guarda", async () => {
    getSession.mockResolvedValue(sessao("anon-1"));
    await guardarCompraAnonima();
    invoke.mockResolvedValue({ data: { ok: false, motivo: "destino_ja_tem_assinatura" }, error: null });
    expect(await vincularCompraAnonima("conta-nova", true)).toBe(false);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("erro de rede: mantém a guarda", async () => {
    getSession.mockResolvedValue(sessao("anon-1"));
    await guardarCompraAnonima();
    invoke.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    expect(await vincularCompraAnonima("conta-nova", true)).toBe(false);
    expect(localStorage.getItem(CHAVE)).not.toBeNull();
    limparCompraAnonima();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});
