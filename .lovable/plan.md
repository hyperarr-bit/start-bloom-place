

# Plano: Implementar Assinaturas Recorrentes com AbacatePay API v2

## Situação atual
A edge function `abacatepay-checkout` apenas retorna links estáticos pré-criados no dashboard. Não há criação dinâmica de cobrança nem recorrência real via API.

## O que muda

### 1. Criar produtos na AbacatePay via API
Antes de tudo, a edge function vai criar (ou reutilizar) dois produtos na AbacatePay com o campo `cycle`:
- **Produto Mensal**: `cycle: "MONTHLY"`, preço R$19,90 (1990 centavos)
- **Produto Anual**: `cycle: "ANNUALLY"`, preço R$178,80 (17880 centavos = R$14,90 x 12)

Os IDs dos produtos serão armazenados na tabela `app_config` para não recriar toda vez.

### 2. Reescrever `abacatepay-checkout` edge function
Em vez de retornar links estáticos, a function vai:
1. Autenticar o usuário (já faz)
2. Buscar o email/nome do usuário no perfil
3. Chamar `POST https://api.abacatepay.com/v2/subscriptions/create` com:
   - O produto correto (mensal ou anual)
   - `returnUrl` e `completionUrl` apontando para `/planos?success=true`
   - Dados do cliente (email, nome)
   - `metadata` com `user_id` e `billing_period`
4. Retornar a `url` do checkout de assinatura

### 3. Atualizar `abacatepay-webhook` edge function
Adicionar tratamento para novos eventos de subscription:
- `subscription.paid` — renovação automática processada
- `subscription.cancelled` — marcar status como `canceled` na tabela `subscriptions`
- `subscription.overdue` — marcar como `past_due`

### 4. Atualizar o secret `ABACATEPAY_API_KEY`
Confirmar que o secret já existente contém a chave v2. Se a chave mudou, será necessário atualizar.

## Detalhes técnicos

**Edge function `abacatepay-checkout`** — chamada à API v2:
```
POST https://api.abacatepay.com/v2/subscriptions/create
Authorization: Bearer {ABACATEPAY_API_KEY}
Body: { productId, returnUrl, completionUrl, metadata, customer }
```

**Webhook** — novos eventos tratados: `subscription.paid`, `subscription.cancelled`, `subscription.overdue`

**Tabela `subscriptions`** — adicionar coluna `abacatepay_subscription_id` (text, nullable) via migration para rastrear o ID da subscription na AbacatePay.

**Nenhuma mudança no frontend** — a página `/planos` continua funcionando igual, só o checkout agora gera cobrança recorrente real.

## Arquivos alterados
- `supabase/functions/abacatepay-checkout/index.ts` — reescrita completa
- `supabase/functions/abacatepay-webhook/index.ts` — novos eventos
- Migration SQL — adicionar coluna `abacatepay_subscription_id`

