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
 */
import { supabase } from "@/integrations/supabase/client";

export type LinhaDeAssinatura = {
  status?: string | null;
  current_period_end?: string | null;
  billing_period?: string | null;
  plan?: string | null;
  payment_method?: string | null;
};
export type TipoDeAcessoAnterior = "vitalicio" | "assinatura";

const STATUS_COM_ACESSO = ["active", "past_due", "cancel_scheduled"];

/** Decisão pura: o acesso que a conta já tinha FORA da App Store (null = nenhum). */
export function acessoAnteriorDaConta(linhas: LinhaDeAssinatura[] | null | undefined, agora: number = Date.now()): TipoDeAcessoAnterior | null {
  let achou: TipoDeAcessoAnterior | null = null;
  for (const l of linhas ?? []) {
    if (!l || !STATUS_COM_ACESSO.includes(String(l.status ?? ""))) continue;
    if (l.payment_method === "app_store") continue; // a compra desta folha (ou outra da Apple): a Apple não deixa 2 testes no grupo
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
      .select("status, current_period_end, billing_period, plan, payment_method")
      .eq("user_id", userId)
      .in("status", STATUS_COM_ACESSO);
    if (error) return null;
    return acessoAnteriorDaConta(data as LinhaDeAssinatura[]);
  } catch {
    return null;
  }
}

/** A tela de assinaturas da Apple (onde se cancela o teste). */
export const URL_ASSINATURAS_APPLE = "itms-apps://apps.apple.com/account/subscriptions";
