-- Assinatura da Play Store (RevenueCat) na tabela subscriptions — 25/07.
--
-- Por que a coluna: o acesso da loja é gravado por DOIS caminhos que correm
-- em paralelo — o app chamando `revenuecat-sync` logo depois da compra e o
-- `revenuecat-webhook` reagindo ao evento do RevenueCat. No primeiro teste
-- real os dois inseriram linha (214 ms de diferença) e o assinante ficou com
-- duas assinaturas. Guardar o id da assinatura no RevenueCat dá chave natural
-- pra upsert: o Postgres resolve a corrida, não a aplicação.
--
-- Índice único NÃO parcial de propósito: no Postgres vários NULL convivem num
-- índice único, então todas as linhas antigas (Pix, Cakto, cortesia) seguem
-- intactas — e o PostgREST só consegue inferir ON CONFLICT em índice total.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_revenuecat_subscription_id_key
  ON public.subscriptions (revenuecat_subscription_id);
