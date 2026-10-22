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

/** Copiar no navegador do Instagram: clipboard API e, se negar, o textarea de sempre. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* plano B */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}
