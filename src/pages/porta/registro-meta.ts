/**
 * CompleteRegistration da Porta, UMA vez por conta nova.
 *
 * O pixel (index.html, 998037194527241) recebe
 *   fbq('track', 'CompleteRegistration', {content_name, status}, {eventID})
 * via fireMetaEvent. A função porta-capi manda o mesmo evento com o mesmo
 * event_id. A Meta junta os dois. Sem o event_id, os dois contariam.
 *
 * Não dispara em page view: quem chama é o `concluir` da Porta, e só quando
 * a conta acabou de nascer (`existente === false`).
 */
import { supabase } from "@/integrations/supabase/client";
import { fireMetaEvent } from "@/lib/meta-pixel";

const CHAVE = "porta-cr-disparado";
const disparados = new Set<string>();

/** Código da aba Test Events (?meta_teste=TEST12345). Fora isso, o evento é real. */
export function codigoTesteDaPagina(search?: string): string | null {
  try {
    const q = new URLSearchParams(search ?? (typeof window !== "undefined" ? window.location.search : ""));
    const c = q.get("meta_teste") ?? "";
    return /^TEST\d{4,8}$/.test(c) ? c : null;
  } catch {
    return null;
  }
}

export function registroJaDisparado(eventId: string): boolean {
  if (disparados.has(eventId)) return true;
  try {
    if (sessionStorage.getItem(CHAVE) === eventId) {
      disparados.add(eventId);
      return true;
    }
  } catch { /* storage bloqueado: a memória da página ainda segura */ }
  return false;
}

function marcar(eventId: string): void {
  disparados.add(eventId);
  try { sessionStorage.setItem(CHAVE, eventId); } catch { /* a memória basta nesta página */ }
}

/** só pros testes */
export function _zerarRegistroMeta(): void {
  disparados.clear();
  try { sessionStorage.removeItem(CHAVE); } catch { /* noop */ }
}

/**
 * Pixel + CAPI. A CAPI não pode derrubar o cadastro: se a função não
 * estiver no ar, o pixel do navegador ainda sai.
 */
export function dispararCompleteRegistration(args: {
  eventId: string;
  fbp?: string | null;
  fbc?: string | null;
  sourceUrl?: string | null;
}): void {
  if (!args.eventId || registroJaDisparado(args.eventId)) return;
  marcar(args.eventId);
  fireMetaEvent("CompleteRegistration", { content_name: "porta_iphone", status: true }, args.eventId);
  const teste = codigoTesteDaPagina();
  try {
    void supabase.functions.invoke("porta-capi", {
      body: {
        event_id: args.eventId,
        fbp: args.fbp || null,
        fbc: args.fbc || null,
        source_url: (args.sourceUrl || "").slice(0, 400) || null,
        ...(teste ? { test_event_code: teste } : {}),
      },
    }).catch(() => { /* a conta já existe; o pixel cobre se a rede da CAPI falhar */ });
  } catch { /* cliente sem functions (teste) */ }
}
