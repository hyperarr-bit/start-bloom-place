-- REVISÃO DE SEGURANÇA (21/10/2026) — NÃO APLICADA. Aplicar só com ok do dono (db push), depois do deploy das
-- funções do ramo seguranca-1018 (elas já funcionam com ou sem esta migração).
--
-- 1) analytics_events: o cliente (anon e logado) deixa de gravar os eventos que SÓ O SERVIDOR escreve.
--    Antes as policies de insert aceitavam qualquer event_name. Vários desses eventos são lidos pelo servidor como
--    fonte da verdade:
--      · pix_order_created = o ÚNICO elo pedido↔conta do Pix (asaas-webhook, asaas-pix check, pix-reconcile,
--        cakto-webhook). Os ids da Asaas são quase sequenciais: uma linha forjada podia levar o Pix de outra pessoa.
--      · cakto_falha / cakto_disjuntor_aberto = o disjuntor da Cakto (forjar desligava o checkout).
--      · porta_* / *_email_enviado / meta_capi_app_enviado / recovery_email_sent = travas de "1x por conta".
--    O app e o site não mandam nenhum destes nomes (conferido: trackEvent/trackEventBeacon/missao/leve.ts); um insert
--    recusado é engolido em silêncio pelo trackEvent (fire-and-forget, 1 evento por insert).
--    O service_role (as funções) continua gravando tudo (policy própria / BYPASSRLS).
--
-- 2) pending_discount_for_user(uuid): SECURITY DEFINER que devolve a oferta de retenção de QUALQUER usuário — estava
--    executável por anon/authenticated (padrão do Supabase). Só as funções (service_role) usam.
--
-- 3) storage: a policy antiga "Public can view skin photos" (anon lê o bucket skin-photos inteiro) foi criada na
--    1ª migração (15/03) e nunca removida — a de 30/03 removeu outra ("Public can view photos"). Se ela existir no
--    banco, as fotos de pele (Beleza) ficam legíveis por qualquer um com a anon key. DROP IF EXISTS: sem efeito se
--    já não existe.
--
-- Teste: src/test/seguranca/rls-seguranca.test.ts (PGlite com todas as migrações).

-- 1) ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert own events" ON public.analytics_events;
CREATE POLICY "Users insert own events"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id OR user_id IS NULL)
    AND NOT (event_name = ANY (ARRAY[
      'pix_order_created', 'pix_reconciled', 'compra_vinculada', 'compra_avista',
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
      'pix_order_created', 'pix_reconciled', 'compra_vinculada', 'compra_avista',
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

-- 2) ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.pending_discount_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_discount_for_user(uuid) TO service_role;

-- 3) ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view skin photos" ON storage.objects;
