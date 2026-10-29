/**
 * O escopo do service worker do aviso de venda (29/10). Arquivo mínimo de propósito: o main.tsx do app importa isto
 * pra NÃO desregistrar o SW do /vendas (e só ele) na limpeza de service workers antigos dos clientes.
 */
export const SW_VENDAS_URL = "/vendas/sw.js";
export const SW_VENDAS_ESCOPO = "/vendas";

/** true só pro registro cujo escopo é o /vendas (com ou sem barra) — nunca a raiz nem outra rota. */
export function ehSwDoAvisoDeVenda(escopo: string | null | undefined): boolean {
  try {
    const p = new URL(String(escopo ?? ""), "https://x.invalid").pathname;
    return p === "/vendas" || p === "/vendas/";
  } catch {
    return false;
  }
}
