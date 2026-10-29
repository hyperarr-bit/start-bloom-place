/**
 * O PIX DE VERDADE DA LANDING NOVA (/organizar) — só baixa quando a pessoa toca em pagar (import dinâmico do
 * ./landing.ts). É o MESMO cano do /hoje (que está no ar e já teve compra real de teste, 18/10):
 *
 *   gerar     sessão ANÔNIMA (sem CPF, sem e-mail) → asaas-pix `create` {offer, fbp, fbc, sourceUrl} → QR estático.
 *             O `pix_order_created` (user_id da anônima + utm da URL do anúncio + fbp/fbc + IP/UA) é o elo pagamento↔conta
 *             e a atribuição POR PEDIDO (o Instagram zera o storage; a URL e o _fbc não).
 *   conferir  asaas-pix `check` a cada 3 s e na volta da aba; asaas-webhook e pix-reconcile são as redes.
 *             Purchase: CAPI no servidor (event_id = id do QR) + pixel pelo firePixPurchaseOnce (mesmo id).
 *   e-mail    opcional na tela do QR: e-mail livre → entra na própria anônima; e-mail com conta → `email_pedido`
 *             (o servidor leva a compra pra essa conta quando o Pix cair e manda o acesso).
 *   depois    o e-mail (se ainda não deu) → conta pronta (updateUser na MESMA conta; e-mail com conta → código do
 *             e-mail + pix-vincular) → boas-vindas 1x por pedido (com as lojas) → "Abrir meu CORE".
 *
 * As ofertas LN_* NÃO existem nas funções no ar: sem o deploy (ver _shared/ofertas-landing.ts) o `create` volta erro.
 * Por isso a landing só chama este arquivo com PIX_REAL ligado (./landing.ts); no protótipo o Pix é simulado.
 */
import { supabase } from "@/integrations/supabase/client";
import { firePixPurchaseOnce, markPixPurchasePending } from "@/lib/purchase-tracking";
import { cookiesDaMeta } from "@/pages/venda/rastreio";
import { abrirSessaoParaPagar, emailAtual, gravarAtribuicao, pedirBoasVindas, salvarEmailDaCompra, sessaoViva, trazerCompraParaConta } from "@/pages/hoje/conta";
import type { OfertaLanding, PixLanding } from "./regras";

/** 29/10: o servidor recusou o Pix porque esta pessoa JÁ tem o CORE pra sempre (a página mostra "Você já tem o CORE"). */
export type JaTem = { jaTem: true; via: string };

export async function gerarPix(oferta: OfertaLanding, sourceUrl: string, emailConhecido: string | null = null): Promise<PixLanding | JaTem | { erro: string; onde: string }> {
  const s = await abrirSessaoParaPagar();
  if (s === "indisponivel") return { erro: "Não consegui abrir o pagamento agora. Tenta de novo em alguns segundos.", onde: "sessao" };
  const c = cookiesDaMeta();
  const { data, error } = await supabase.functions.invoke("asaas-pix", {
    body: { action: "create", offer: oferta, fbp: c.fbp, fbc: c.fbc, sourceUrl: sourceUrl.slice(0, 300), ...(emailConhecido ? { email: emailConhecido } : {}) },
  });
  if ((data as { ja_tem?: boolean } | null)?.ja_tem) return { jaTem: true, via: String((data as { via?: string }).via ?? "servidor") };
  const d = data as { orderId?: string; qrCode?: string; qrCodeBase64?: string | null; expiresAt?: string | null } | null;
  if (error || !d?.orderId || !d?.qrCode) {
    return { erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(error?.message || (data as { error?: string } | null)?.error || "sem_qr").slice(0, 160) };
  }
  const pix: PixLanding = { orderId: d.orderId, qrCode: d.qrCode, qrCodeBase64: d.qrCodeBase64 ?? null, expiresAt: d.expiresAt ?? null, criadoEm: Date.now(), oferta };
  markPixPurchasePending({ offer: oferta, orderId: pix.orderId });
  return pix;
}

/** Uma conferência. true = pago (dispara o Purchase do navegador 1x, mesmo id da CAPI). */
export async function conferirPix(pix: PixLanding, sourceUrl: string): Promise<boolean> {
  await sessaoViva();
  const c = cookiesDaMeta();
  const { data } = await supabase.functions.invoke("asaas-pix", {
    body: { action: "check", id: pix.orderId, offer: pix.oferta, fbp: c.fbp, fbc: c.fbc, sourceUrl: sourceUrl.slice(0, 300) },
  });
  if ((data as { paid?: boolean } | null)?.paid) {
    void firePixPurchaseOnce("checkout");
    return true;
  }
  return false;
}

/** O e-mail OPCIONAL da tela do QR. "conta" = gravado na própria compra; "destino" = e-mail que já tinha conta. */
export async function salvarEmailDoPix(pix: PixLanding, email: string): Promise<{ via: "conta" | "destino" } | JaTem | { erro: string }> {
  const limpo = email.trim().toLowerCase();
  try {
    const r = await salvarEmailDaCompra(limpo);
    if (r.ok === true) return { via: "conta" };
    if ("existe" in r) {
      await sessaoViva();
      const { data } = await supabase.functions.invoke("asaas-pix", { body: { action: "email_pedido", id: pix.orderId, email: limpo } });
      if ((data as { ok?: boolean } | null)?.ok) return { via: "destino" };
      if ((data as { ja_tem?: boolean } | null)?.ja_tem) return { jaTem: true, via: "email_pix" };
      return { erro: "Não consegui salvar agora. Pode seguir — o e-mail também pode ir depois do pagamento." };
    }
    return { erro: r.erro };
  } catch {
    return { erro: "Não consegui salvar agora. Pode seguir — o e-mail também pode ir depois do pagamento." };
  }
}

/** Já tem e-mail na sessão (pagou logada, ou deu o e-mail na tela do QR)? */
export async function emailDaSessaoAtual(): Promise<string | null> {
  await sessaoViva();
  return emailAtual();
}

export type ResultadoConta = { ok: true } | { ok: false; existe: true } | { ok: false; erro: string };

/** Depois de pagar: o e-mail entra na conta que pagou. */
export async function criarConta(email: string): Promise<ResultadoConta> {
  const r = await salvarEmailDaCompra(email);
  if (r.ok === true) return { ok: true };
  if ("existe" in r) return { ok: false, existe: true };
  return { ok: false, erro: r.erro };
}

/** E-mail que já tinha conta: manda o código (só login, nunca cria 2ª conta). */
export async function pedirCodigo(email: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
  return !error;
}

/** Entrou com o código: a compra da sessão anônima vem pra esta conta (pix-vincular). */
export async function entrarComCodigo(email: string, codigo: string): Promise<{ ok: boolean; aviso?: string }> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: "email" });
  if (error) return { ok: false };
  const t = await trazerCompraParaConta();
  if (t === "nao_moveu") return { ok: true, aviso: "Sua conta já tinha o CORE ativo, então a compra de agora ficou guardada à parte. Fale com a gente em contato@coreaplicativo.com.br pra devolvermos o valor." };
  return { ok: true };
}

/** A conta final está pronta: atribuição + boas-vindas (1x por pedido, com as lojas). Nunca lança. */
export async function finalizarConta(pedido: string, atrib: Record<string, unknown>): Promise<void> {
  try { await gravarAtribuicao({ v: 1, landing: true, ...atrib, em: new Date().toISOString() }); } catch { /* noop */ }
  void pedirBoasVindas(pedido);
}
