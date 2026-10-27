/**
 * CONTA QUE JÁ TINHA ACESSO COMPRANDO O TESTE DO iPHONE (1.0.17, bug de produção 20/10).
 *
 * Caso real: cliente com o VITALÍCIO da web passou pelo funil do iPhone, começou o teste de 3 dias na App Store,
 * o cadastro respondeu "User already registered" e entrou na conta antiga. Ninguém conferia que a conta já tinha
 * acesso — no fim do teste a Apple cobra por cima do vitalício (chamado: "tenho a versão vitalícia e continua me
 * cobrando"). Aqui só se AVISA (nunca bloqueia): "cancele o teste na App Store".
 *
 * A leitura é direto na tabela `subscriptions` (RLS: a pessoa lê as dela), e não pelo check-subscription: assim que
 * a sessão entra, a reconciliação da loja pode gravar a linha NOVA da App Store, que passaria na frente da antiga.
 * Conta só o acesso que NÃO veio da App Store.
 *
 * 27/10 (raio-x da recusa): a linha da loja é gravada como "play_store" pras DUAS lojas (revenuecat-webhook/-sync —
 * nunca existiu "app_store" na tabela). O filtro só olhava "app_store", então a própria assinatura da Apple contava como
 * "acesso de fora": o cartão recusado via "Você já tem acesso… cancele na App Store" no lugar do card da recusa (20
 * pessoas desde 22/10, 0 com compra na web) e conta que já existia via o mesmo aviso no cadastro (8). Linha de loja
 * nunca conta.
 *
 * 27/10 (revisor da build 52): "linha de loja nunca conta" calava também a GOOGLE PLAY (o mesmo "play_store") — quem
 * assina no Android e começa o teste da Apple deixou de ser avisado. Agora só a linha da APPLE é ignorada, pelo
 * `revenuecat_subscription_id` (assinatura da App Store começa com "subAap", compra única com "otpA" — a mesma leitura
 * de pages/Planos). "play_store" SEM o id (linha antiga/incompleta: não dá pra saber a loja) segue ignorada, como no
 * conserto da manhã — na dúvida, o cartão recusado da Apple não vira "já tinha acesso".
 */
import { supabase } from "@/integrations/supabase/client";

export type LinhaDeAssinatura = {
  status?: string | null;
  current_period_end?: string | null;
  billing_period?: string | null;
  plan?: string | null;
  payment_method?: string | null;
  /** o id do RevenueCat (existe na tabela, não nos tipos gerados): "subAap…"/"otpA…" = App Store */
  revenuecat_subscription_id?: string | null;
};
export type TipoDeAcessoAnterior = "vitalicio" | "assinatura";

const STATUS_COM_ACESSO = ["active", "past_due", "cancel_scheduled"];
/** A linha é da APPLE (ou de loja sem como saber qual)? Só ela é ignorada; a da Google Play conta como acesso de fora. */
export function ehLinhaDaApple(l: LinhaDeAssinatura): boolean {
  const metodo = String(l.payment_method ?? "");
  if (metodo === "app_store") return true;
  if (metodo !== "play_store") return false;
  const id = String(l.revenuecat_subscription_id ?? "").trim();
  if (!id) return true; // sem o id não dá pra separar as lojas: na dúvida, não avisa
  return /^(subAap|otpA)/.test(id);
}

/** Decisão pura: o acesso que a conta já tinha FORA da App Store (null = nenhum). */
export function acessoAnteriorDaConta(linhas: LinhaDeAssinatura[] | null | undefined, agora: number = Date.now()): TipoDeAcessoAnterior | null {
  let achou: TipoDeAcessoAnterior | null = null;
  for (const l of linhas ?? []) {
    if (!l || !STATUS_COM_ACESSO.includes(String(l.status ?? ""))) continue;
    if (ehLinhaDaApple(l)) continue; // a compra desta folha (ou outra da Apple): a Apple não deixa 2 testes no grupo
    const vitalicio = l.billing_period === "lifetime" || l.plan === "lifetime";
    const fim = l.current_period_end ? new Date(l.current_period_end).getTime() : null;
    if (!vitalicio && fim != null && Number.isFinite(fim) && fim <= agora) continue;
    if (vitalicio) return "vitalicio";
    achou = "assinatura";
  }
  return achou;
}

/** Lê as assinaturas da conta logada. Nunca lança (falha = null = não avisa). */
export async function lerAcessoAnteriorDaConta(userId: string): Promise<TipoDeAcessoAnterior | null> {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, billing_period, plan, payment_method, revenuecat_subscription_id")
      .eq("user_id", userId)
      .in("status", STATUS_COM_ACESSO);
    if (error) return null;
    return acessoAnteriorDaConta(data as LinhaDeAssinatura[]);
  } catch {
    return null;
  }
}

/** A conta da sessão atual (o aviso de cobrança não tem o usuário à mão). Nunca lança. */
export async function acessoAnteriorDaSessao(): Promise<TipoDeAcessoAnterior | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    return uid ? await lerAcessoAnteriorDaConta(uid) : null;
  } catch {
    return null;
  }
}

/** A tela de assinaturas da Apple (onde se cancela o teste). */
export const URL_ASSINATURAS_APPLE = "itms-apps://apps.apple.com/account/subscriptions";
