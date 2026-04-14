
Objetivo: corrigir o checkout da AbacatePay de forma definitiva. O erro atual já está localizado.

Problema real identificado
- O log mais recente não aponta mais para `items`: agora a API responde `Subscription checkout only accepts products with cycle defined`.
- No código atual, o produto é criado com `billingCycle`, mas a documentação v2 mostra que o campo correto é `cycle`.
- Resultado: os produtos criados pela edge function provavelmente foram salvos como produtos avulsos, sem ciclo de assinatura.
- Existe um agravante: `getOrCreateProduct()` reutiliza o `productId` salvo em `app_config`, então mesmo corrigindo o payload, o sistema continuará usando o produto antigo inválido até forçar recriação/recache.

O que vou implementar
1. Corrigir a criação do produto em `supabase/functions/abacatepay-checkout/index.ts`
- Trocar `billingCycle` por `cycle` no payload de `/products/create`.
- Manter `currency: "BRL"` e o restante do payload compatível com a doc v2.

2. Parar de confiar cegamente no cache do produto
- Ajustar `getOrCreateProduct()` para validar se o produto em cache tem `cycle` compatível com o plano antes de reutilizar.
- Se o produto salvo estiver sem `cycle` ou com ciclo errado:
  - ignorar o cache
  - criar ou localizar um produto válido
  - atualizar `app_config` com o novo `productId`

3. Evitar reaproveitar produtos antigos inválidos
- Alterar o `externalId` dos produtos recorrentes para uma nova chave estável/versionada, por exemplo:
  - `core-pro-monthly-v2`
  - `core-pro-annual-v2`
- Isso evita colisão com os produtos antigos criados sem ciclo.

4. Confirmar o payload da assinatura
- Manter `/subscriptions/create` com o formato correto que já estava no caminho certo:
  - `externalId`
  - `items: [{ id: productId, quantity: 1 }]`
  - `methods: ["CARD"]`
  - `customerId`
  - `returnUrl`
  - `completionUrl`
  - `metadata`

5. Preservar o restante do fluxo
- Manter a lógica de `customerId` em `user_data`, pois ela não é o erro atual.
- Manter o webhook com update/insert, porque isso melhora a persistência após o pagamento, embora não seja o bloqueio do checkout neste momento.

Validação que vou fazer depois de implementar
- Testar checkout mensal e anual.
- Confirmar nos logs que o produto usado possui `cycle: "MONTHLY"` ou `cycle: "ANNUALLY"`.
- Confirmar que `/subscriptions/create` devolve uma `url` válida em vez de erro 400.
- Verificar que o checkout abre normalmente no preview.
- Depois do pagamento, verificar se `abacatepay-webhook` grava a assinatura e se `check-subscription` passa a reconhecer o plano ativo.

Arquivos que serão ajustados
- `supabase/functions/abacatepay-checkout/index.ts`
- possivelmente uma migration leve em `supabase/migrations/` se eu decidir limpar/renovar cache de `app_config` com segurança

Detalhe técnico importante
```text
Hoje:
POST /products/create
{
  externalId,
  name,
  price,
  billingCycle,   <- errado
  currency: "BRL"
}

Correto:
POST /products/create
{
  externalId,
  name,
  price,
  currency: "BRL",
  cycle: "MONTHLY" | "ANNUALLY"
}
```

Resumo do diagnóstico
- Sim, agora eu sei qual é o problema.
- O checkout falha porque o produto enviado na assinatura não é um produto recorrente válido.
- Isso acontece por dois motivos combinados:
  1. campo errado ao criar o produto (`billingCycle` em vez de `cycle`)
  2. reaproveitamento de `productId` inválido salvo em cache
