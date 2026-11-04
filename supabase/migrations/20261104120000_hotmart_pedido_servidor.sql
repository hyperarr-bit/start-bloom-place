-- HOTMART /vida (04/11/2026) — NÃO APLICADA. Aplicar só com ok do dono (db push), junto do deploy do hotmart-iniciar /
-- hotmart-webhook. Sem ela a venda funciona igual; ela fecha uma porta:
--
-- `hotmart_order_created` é o elo pedido(ref do sck)↔conta da venda pela Hotmart (o hotmart-webhook lê). Como o
-- `pix_order_created`, só o servidor pode gravar esse nome — senão uma sessão logada gravaria uma linha com a PRÓPRIA
-- conta e a ref de outra pessoa. (A ref é um uuid aleatório que só a página de quem comprou conhece, e o webhook ainda
-- exige que as linhas com conta concordem — esta é a 3ª trava.)
--
-- As 2 policies de insert de analytics_events são recriadas IGUAIS às da 20261022120000_seguranca_eventos_servidor.sql,
-- com 'hotmart_order_created' a mais na lista. Se aquela migração ainda não estiver aplicada, esta a substitui no item 1.

-- ---------------------------------------------------------------------------------------------------------------
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
      'cancel_confirmed', 'cancel_loja_bloqueado', 'support_ticket_answered', 'support_ticket_created'
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
      'cancel_confirmed', 'cancel_loja_bloqueado', 'support_ticket_answered', 'support_ticket_created'
    ]::text[]))
  );
