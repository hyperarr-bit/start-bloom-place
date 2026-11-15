/**
 * A ENTRADA FIXA DO PRESENTE (15/11, dono: "o usuário pode querer fazer isso depois, mas não encontra a opção").
 *
 * Uma linha PERMANENTE e discreta "🎁 Dar o CORE de presente" na página Você do SITE (as 2 caras da aba Você e o menu do avatar da
 * Home clássica) — nunca na Home, nunca um card novo no topo. Não é o aviso fechável (src/lib/presente-aviso.ts): não tem ×, não some,
 * não espera 5 dias. Abre /presente/dar (o token da própria conta), onde o SERVIDOR decide o preço: quem comprou a R$ 67,90 na
 * /oferta (Stripe) paga R$ 24,90 (cartão salvo = 1 toque, senão Pix); os demais, R$ 14,90 no Pix (o de sempre).
 *
 * Pra quem: vitalício pago na web (linha ativa, vitalícia, com valor, "pix" ou "stripe"). iPhone e Android da loja NUNCA (regras de
 * pagamento da Apple e da Play — igual ao aviso), nem com o QA.
 *
 * Chave PRESENTE_ENTRADA: "off" (padrão) | "web". Ligada, também liga a linha "Dá pra dar de presente depois…" no pago da /oferta
 * depois do "Agora não" do presente. QA: ?presente-entrada=on|off (guardado neste aparelho em `presente-entrada-force`;
 * ?presente-entrada=auto volta pra chave). Rollback: "off".
 */
import { plataformaApp, type PlataformaApp } from "@/lib/native-shell";

export type ModoEntradaPresente = "off" | "web";
export const PRESENTE_ENTRADA: ModoEntradaPresente = "off";

export const PARAM_QA_ENTRADA = "presente-entrada";
export const CHAVE_FORCA_ENTRADA = "presente-entrada-force";
export const TEXTO_ENTRADA = "Dar o CORE de presente";
/** a linha do pago da /oferta depois do "Agora não" (só com a entrada ligada: nunca mandar procurar o que não existe) */
export const NOTA_DEPOIS = "Dá pra dar de presente depois, pelo site: Você → Dar o CORE de presente.";

/** A força do QA (?presente-entrada=on|off|auto), lida da URL e guardada no aparelho. */
export function forcaDaEntrada(busca: string = typeof window === "undefined" ? "" : window.location.search): "on" | "off" | null {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get(PARAM_QA_ENTRADA); } catch { v = null; }
  try {
    if (v === "on" || v === "off") localStorage.setItem(CHAVE_FORCA_ENTRADA, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA_ENTRADA);
    const g = v === "on" || v === "off" ? v : localStorage.getItem(CHAVE_FORCA_ENTRADA);
    return g === "on" || g === "off" ? g : null;
  } catch {
    return v === "on" || v === "off" ? v : null;
  }
}

/** A entrada aparece NESTA plataforma? (só o site: iPhone e Android da loja nunca, nem com o QA) */
export function entradaLigadaAqui(a: { modo?: ModoEntradaPresente; plataforma?: PlataformaApp; forca?: "on" | "off" | null } = {}): boolean {
  const plataforma = a.plataforma ?? plataformaApp();
  if (plataforma !== "web") return false;
  const forca = a.forca === undefined ? forcaDaEntrada() : a.forca;
  if (forca === "off") return false;
  if (forca === "on") return true;
  return (a.modo ?? PRESENTE_ENTRADA) === "web";
}

export type LinhaDaEntrada = { status?: string | null; payment_method?: string | null; billing_period?: string | null; plan?: string | null; amount_cents?: number | null };
/** Vitalício pago na WEB (Pix ou Stripe)? O presente recebido ("presente") e a loja (play_store/RC) não contam. */
export function compraQueLiberaEntrada(linhas: LinhaDaEntrada[]): boolean {
  return linhas.some((l) => (l.payment_method === "pix" || l.payment_method === "stripe") && l.status === "active"
    && (l.billing_period === "lifetime" || l.plan === "lifetime") && Number(l.amount_cents) > 0);
}
