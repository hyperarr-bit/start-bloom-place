-- FUNIL APP WEB (/funil-app, 14/11/2026) — NÃO APLICADA. Aplicar só com ok do dono, ANTES do deploy do stripe-criar/stripe-webhook novos.
-- O mensal R$ 34,90 do funil app web é uma assinatura da Stripe; os eventos dela são só do servidor:
--   stripe_assinatura_criada  (o stripe-criar grava ref → assinatura; é o que impede 2 assinaturas pra mesma ref)
--   stripe_assinatura_renovou / stripe_assinatura_falhou / stripe_assinatura_cancelada (o stripe-webhook)
-- Uma sessão logada não pode gravar esses nomes (senão gravaria uma ref de outra pessoa apontando pra assinatura dela).
-- As 2 policies de insert de analytics_events são recriadas IGUAIS às da 20261106120000_stripe_oferta_servidor.sql, com os 4
-- nomes a mais. Idempotente (DROP/CREATE). Nenhuma tabela nova: a linha do mensal mora em public.subscriptions
-- (plan/billing_period "monthly", payment_method "stripe", abacatepay_billing_id = id da assinatura sub_…).
--
-- Índice pra o stripe-criar achar a assinatura da ref (à mão, CONCURRENTLY, fora de transação, antes do deploy):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_events_stripe_sub_ref_idx ON public.analytics_events ((event_data->>'ref')) WHERE event_name = 'stripe_assinatura_criada';
-- (o stripe_order_created por ref já usa o mesmo filtro; se a consulta ficar lenta, o índice análogo:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_events_stripe_ref_idx ON public.analytics_events ((event_data->>'ref')) WHERE event_name = 'stripe_order_created';)

DROP POLICY IF EXISTS "Users insert own events" ON public.analytics_events;
CREATE POLICY "Users insert own events"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id OR user_id IS NULL)
    AND NOT (event_name = ANY (ARRAY[
      'pix_order_created', 'hotmart_order_created', 'pix_reconciled', 'compra_vinculada', 'compra_avista',
      'presente_resgatado_servidor', 'codigo_resgatado', 'referral_reward', 'hoje_casal_liberado',
      'cakto_falha', 'cakto_falha_adiantado', 'cakto_disjuntor_aberto',
      'porta_capi_cr', 'porta_capi_trial', 'porta_capi_pago', 'porta_email_enviado', 'porta_lembrete_enviado',
      'pix_pendente_email_enviado', 'meta_capi_app_enviado', 'recovery_email_sent', 'trial_email_sent',
      'welcome_email_sent', 'app_winback_email', 'email_livre_enviado',
      'subscription_started', 'trial_converted', 'subscription_expired_no_payment',
      'retention_discount_applied', 'retention_offer_accepted', 'retention_offers_shown',
      'cancel_confirmed', 'cancel_loja_bloqueado', 'support_ticket_answered', 'support_ticket_created',
      'hotmart_venda_ignorada', 'hotmart_email_falhou', 'hotmart_conta_divergente', 'hotmart_venda',
      'stripe_order_created', 'stripe_venda', 'stripe_venda_ignorada', 'stripe_email_falhou', 'stripe_conta_divergente',
      'stripe_assinatura_criada', 'stripe_assinatura_renovou', 'stripe_assinatura_falhou', 'stripe_assinatura_cancelada'
    ]::text[]))
  );

DROP POLICY IF EXISTS "Anon insert anonymous events" ON public.analytics_events;
CREATE POLICY "Anon insert anonymous events"
  ON public.analytics_events FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND NOT (event_name = ANY (ARRAY[
      'pix_order_created', 'hotmart_order_created', 'pix_reconciled', 'compra_vinculada', 'compra_avista',
      'presente_resgatado_servidor', 'codigo_resgatado', 'referral_reward', 'hoje_casal_liberado',
      'cakto_falha', 'cakto_falha_adiantado', 'cakto_disjuntor_aberto',
      'porta_capi_cr', 'porta_capi_trial', 'porta_capi_pago', 'porta_email_enviado', 'porta_lembrete_enviado',
      'pix_pendente_email_enviado', 'meta_capi_app_enviado', 'recovery_email_sent', 'trial_email_sent',
      'welcome_email_sent', 'app_winback_email', 'email_livre_enviado',
      'subscription_started', 'trial_converted', 'subscription_expired_no_payment',
      'retention_discount_applied', 'retention_offer_accepted', 'retention_offers_shown',
      'cancel_confirmed', 'cancel_loja_bloqueado', 'support_ticket_answered', 'support_ticket_created',
      'hotmart_venda_ignorada', 'hotmart_email_falhou', 'hotmart_conta_divergente', 'hotmart_venda',
      'stripe_order_created', 'stripe_venda', 'stripe_venda_ignorada', 'stripe_email_falhou', 'stripe_conta_divergente',
      'stripe_assinatura_criada', 'stripe_assinatura_renovou', 'stripe_assinatura_falhou', 'stripe_assinatura_cancelada'
    ]::text[]))
  );
