-- CONTEÚDO PAGO SÓ PELO SERVIDOR (21/10/2026) — NÃO APLICADA. Aplicar com ok do dono, DEPOIS do deploy de asaas-pix,
-- asaas-webhook e pix-reconcile do release-2110 (são elas que passam a gravar o kit do order bump; antes disso a
-- página ainda gravava pelo cliente).
--
-- O "Seu 2027" (oferta u2027, R$ 19,90) e o Kit / plano de 30 dias (bump h279k/h149k e oferta pk99, R$ 9,90) são
-- liberados por uma chave da CONTA em user_data: `core-pacote-2027` e `core-kit-primeiro-mes`. As policies do
-- user_data deixam o dono gravar QUALQUER chave → qualquer conta liberava o conteúdo pago sem pagar (revisão de
-- segurança 21/10). Agora o cliente (anon/authenticated) não insere, não altera e não apaga essas duas chaves; o
-- service_role (as funções) continua gravando (BYPASSRLS). A leitura do dono continua igual (o app lê pelo useUserData).
--
-- Policies RESTRITIVAS: valem em AND com as permissivas que já existem ("Users can … own data"), sem depender do nome
-- delas no banco de produção. O DELETE também fica de fora de propósito: o "Começar do zero" do app apaga o user_data
-- inteiro da pessoa e levava junto o que ela pagou — agora o que foi pago fica.
--
-- As chaves de PROGRESSO (core-kit-primeiro-mes-progresso, core-kit-dividas, core-pacote-2027-plano,
-- core-pacote-2027-cofrinho, core-tip-seen-pacote-2027) continuam do cliente: o filtro é por chave EXATA.
--
-- Teste: src/test/seguranca/rls-seguranca.test.ts (PGlite com todas as migrações).

DROP POLICY IF EXISTS "Conteudo pago: cliente nao insere" ON public.user_data;
CREATE POLICY "Conteudo pago: cliente nao insere"
  ON public.user_data AS RESTRICTIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (key <> ALL (ARRAY['core-pacote-2027', 'core-kit-primeiro-mes']::text[]));

DROP POLICY IF EXISTS "Conteudo pago: cliente nao altera" ON public.user_data;
CREATE POLICY "Conteudo pago: cliente nao altera"
  ON public.user_data AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated
  USING (key <> ALL (ARRAY['core-pacote-2027', 'core-kit-primeiro-mes']::text[]))
  WITH CHECK (key <> ALL (ARRAY['core-pacote-2027', 'core-kit-primeiro-mes']::text[]));

DROP POLICY IF EXISTS "Conteudo pago: cliente nao apaga" ON public.user_data;
CREATE POLICY "Conteudo pago: cliente nao apaga"
  ON public.user_data AS RESTRICTIVE FOR DELETE
  TO anon, authenticated
  USING (key <> ALL (ARRAY['core-pacote-2027', 'core-kit-primeiro-mes']::text[]));
