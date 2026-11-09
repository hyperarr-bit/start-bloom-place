import { afterEach, describe, expect, it, vi } from "vitest";
import { criarCarregadorCompartilhado, CHAVE_RECARGA } from "@/landing/carregar";
import { estadoQueVolta, ESTADO_VAZIO } from "@/landing/regras";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(() => { sessionStorage.clear(); });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }

describe("pagamento compartilhado entre preload e clique", () => {
  it("clique durante o preload que falha promove a recuperação; outro preload não desfaz o clique", async () => {
    const pausa = deferred(); const recarregarPagina = vi.fn(); const aoFalhar = vi.fn();
    let marcado = false;
    const importar = vi.fn(async () => { throw new TypeError("text/html is not JavaScript"); });
    const pg = criarCarregadorCompartilhado(importar, { espera: () => pausa.promise, recarregarPagina, jaRecarregou: () => marcado, marcarRecarga: () => { marcado = true; }, aoFalhar });
    const preload = pg(false); const resultado = preload.catch(e => e);
    await Promise.resolve();
    expect(pg(true)).toBe(preload); expect(pg(false)).toBe(preload);
    pausa.resolve(); await resultado;
    expect(importar).toHaveBeenCalledTimes(2);
    expect(recarregarPagina).toHaveBeenCalledTimes(1);
    expect(aoFalhar.mock.calls.map(c => c[0])).toEqual([1, 2, "recarga"]);
    await expect(pg()).rejects.toThrow();
    expect(recarregarPagina).toHaveBeenCalledTimes(1); // sem loop
  });
  it("preload sozinho nunca recarrega; clique após falha tenta novamente e pode recuperar", async () => {
    const recarregarPagina = vi.fn();
    const pg = criarCarregadorCompartilhado(async () => { throw new Error("rede"); }, { espera: async () => {}, recarregarPagina, jaRecarregou: () => false, marcarRecarga: () => {} });
    await expect(pg(false)).rejects.toThrow("rede"); expect(recarregarPagina).not.toHaveBeenCalled();
    await expect(pg()).rejects.toThrow("rede"); expect(recarregarPagina).toHaveBeenCalledTimes(1);
  });
  it("rede transitória recupera sem recarga; download bem-sucedido é reutilizado", async () => {
    const importar = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ pronto: true });
    const recarregarPagina = vi.fn(); sessionStorage.setItem(CHAVE_RECARGA, "1");
    const pg = criarCarregadorCompartilhado(importar, { espera: async () => {}, recarregarPagina });
    const p = pg(false); expect(pg()).toBe(p);
    await expect(p).resolves.toEqual({ pronto: true }); expect(pg()).toBe(p);
    expect(importar).toHaveBeenCalledTimes(2); expect(recarregarPagina).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CHAVE_RECARGA)).toBeNull();
  });
  it("recarga no carregamento preserva o email e volta à oferta; um Pix existente continua sendo o mesmo", () => {
    const agora = Date.now(); const base = { ...ESTADO_VAZIO, fase: "gerando", emailPix: "cliente@example.com", salvoEm: agora };
    expect(estadoQueVolta(base, agora)).toMatchObject({ fase: "oferta", emailPix: "cliente@example.com", pix: null });
    const pix = { orderId: "pedido-existente", expiresAt: new Date(agora + 60000).toISOString(), criadoEm: agora, oferta: "LN_sempre279", qrCode: "pix" };
    expect(estadoQueVolta({ ...base, pix }, agora)).toMatchObject({ fase: "qr", emailPix: "cliente@example.com", pix: { orderId: "pedido-existente" } });
  });
  it("fallback SPA não responde por assets ausentes, mas mantém as rotas do app", () => {
    const config = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8"));
    const fallback = config.rewrites.find((r: { destination: string }) => r.destination === "/index.html");
    const matcher = new RegExp(`^${fallback.source}$`);
    for (const p of ["/assets", "/assets/pagamento-antigo.js", "/assets/app.css"]) expect(matcher.test(p)).toBe(false);
    for (const p of ["/", "/financas", "/organizar/demo", "/entrar"]) expect(matcher.test(p)).toBe(true);
  });
});
