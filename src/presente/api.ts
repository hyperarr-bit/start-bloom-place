/**
 * As chamadas da função `presente-resgatar` (supabase/functions/presente-resgatar). Nunca lançam: erro de rede vira
 * `null` / `{ ok: false, motivo: "erro" }` e a tela decide.
 */
import { supabase } from "@/integrations/supabase/client";

type Resp = Record<string, unknown> | null;
async function chamar(body: Record<string, unknown>): Promise<Resp> {
  try {
    const { data } = await supabase.functions.invoke("presente-resgatar", { body });
    return (data as Resp) ?? null;
  } catch {
    return null;
  }
}

export type EstadoDoCodigo = "livre" | "usado" | "nao_existe";
export async function verPresente(codigo: string): Promise<{ estado: EstadoDoCodigo; de: string | null } | null> {
  const d = await chamar({ action: "ver", codigo });
  if (!d?.ok) return null;
  return { estado: (d.estado as EstadoDoCodigo) ?? "nao_existe", de: (d.de as string | null) ?? null };
}

export async function meuPresente(pedido: string): Promise<{ codigo: string; de: string | null; resgatado: boolean } | null> {
  const d = await chamar({ action: "meu", pedido });
  if (!d?.ok || typeof d.codigo !== "string") return null;
  return { codigo: d.codigo, de: (d.de as string | null) ?? null, resgatado: d.resgatado === true };
}

export async function gravarNomeDoPresente(pedido: string, nome: string): Promise<boolean> {
  const d = await chamar({ action: "nome", pedido, nome });
  return d?.ok === true;
}

export async function pedirEmailDoPresente(pedido: string): Promise<boolean> {
  const d = await chamar({ action: "email", pedido });
  return d?.ok === true;
}

export type MotivoResgate = "ok" | "ja_e_seu" | "usado" | "proprio" | "ja_tem" | "sem_email" | "nao_existe" | "sem_login" | "erro";
export async function resgatar(codigo: string): Promise<{ motivo: MotivoResgate; de: string | null }> {
  const d = await chamar({ action: "resgatar", codigo });
  if (!d) return { motivo: "erro", de: null };
  const de = (d.de as string | null) ?? null;
  if (d.ok) return { motivo: d.r === "ja_e_seu" ? "ja_e_seu" : "ok", de };
  return { motivo: ((d.motivo as MotivoResgate) ?? "erro"), de };
}

/* ───────── 31/10: o presente do DIA 3 (/presente/dar) — pelo TOKEN do e-mail, sem login (_shared/presente-dia3.ts) ───────── */

export type PixDia3 = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string };
export type EstadoDia3 =
  | { ok: false; motivo: "token" | "sem_acesso" | "pix" | "rede" }
  | { ok: true; pago: true; pedido: string; codigo: string; de: string | null; resgatado: boolean }
  | { ok: true; pago: false; pix: PixDia3 | null };

/** O estado da página: o Pix (gerado agora com `gerar`) ou pago + o código. `pedido` = o QR que está na tela. */
export async function estadoDia3(t: string, opts: { pedido?: string | null; gerar?: boolean; conferir?: boolean } = {}): Promise<EstadoDia3> {
  const d = await chamar({ action: "dia3", t, ...(opts.pedido ? { pedido: opts.pedido } : {}), ...(opts.gerar ? { gerar: true } : {}), ...(opts.conferir ? { conferir: true } : {}) });
  if (!d) return { ok: false, motivo: "rede" };
  if (d.ok !== true) return { ok: false, motivo: (["token", "sem_acesso", "pix"].includes(String(d.motivo)) ? d.motivo : "pix") as "token" | "sem_acesso" | "pix" };
  if (d.pago === true && typeof d.codigo === "string") {
    return { ok: true, pago: true, pedido: String(d.pedido ?? ""), codigo: d.codigo, de: (d.de as string | null) ?? null, resgatado: d.resgatado === true };
  }
  const p = d.pix as PixDia3 | null | undefined;
  return { ok: true, pago: false, pix: p && typeof p.orderId === "string" && typeof p.qrCode === "string" ? p : null };
}

export async function nomeDia3(t: string, pedido: string, nome: string): Promise<boolean> {
  const d = await chamar({ action: "dia3_nome", t, pedido, nome });
  return d?.ok === true;
}

/** Com login (o aviso da página Você): o token da própria conta. null = sem acesso pra sempre ou erro. */
export async function tokenDia3(): Promise<string | null> {
  const d = await chamar({ action: "dia3_token" });
  return d?.ok === true && typeof d.t === "string" ? d.t : null;
}

/** Copiar no navegador do Instagram: clipboard API e, se negar, o textarea de sempre. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* plano B */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}
