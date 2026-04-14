
Plano direto para fazer o checkout funcionar de verdade

Problema realmente localizado
- O erro atual não é genérico: os logs da edge function mostram claramente `422` em `/v2/subscriptions/create` com `"Property 'items' is missing"`.
- A documentação v2 da AbacatePay confirma que assinaturas exigem payload com:
  - `items` contendo exatamente 1 item
  - `methods`
  - opcionalmente `customerId`
- O código atual envia `productId` no topo e um objeto `customer`, então a API rejeita a requisição.
- Existe um segundo problema provável no pós-pagamento: o webhook usa `upsert(..., { onConflict: "user_id" })`, mas a tabela `subscriptions` não tem constraint única em `user_id`. Isso pode impedir ativação correta da assinatura ou criar duplicidade.

O que vou corrigir
1. Corrigir a edge function `abacatepay-checkout`
- Trocar o payload de assinatura para o formato aceito pela v2:
  - `items: [{ id: productId, quantity: 1 }]`
  - `methods: ["CARD"]`
  - `externalId`
  - `returnUrl` e `completionUrl`
  - `customerId` quando disponível
- Remover o envio do `productId` no topo e do objeto `customer` dentro de `/subscriptions/create`.

2. Reusar/criar cliente AbacatePay corretamente
- Ler `abacatepay_customer_id` do `user_data` antes de abrir o checkout.
- Se não existir, criar cliente via `/v2/customers/create` com:
  - `email` obrigatório
  - `name`, `cellphone`, `taxId` quando existirem no perfil
- Salvar o `customerId` em `user_data` para reutilizar nos próximos checkouts.

3. Melhorar URLs de retorno
- Parar de fixar somente `https://coreaplicativo.lovable.app`.
- Usar a origem da requisição quando disponível, com fallback para a URL publicada.
- Isso evita confusão ao testar no preview.

4. Corrigir persistência da assinatura no webhook
- Ajustar `abacatepay-webhook` para não depender de `upsert` com conflito inexistente.
- Opção segura:
  - primeiro tentar `update` por `user_id`
  - se não houver linha, fazer `insert`
- Se necessário, complementar com migration para garantir unicidade por usuário em `subscriptions`.

5. Ajustar a UI para não prometer método errado
- A página `/planos` hoje diz `Pagamento via PIX e Cartão`.
- Pela doc de assinatura, o fluxo recorrente deve usar `CARD`.
- Vou alinhar a copy para não induzir erro de expectativa.

Validação após implementar
- Testar plano mensal e anual.
- Confirmar que a edge function retorna `url` válida.
- Confirmar que o checkout abre sem 422.
- Confirmar que o webhook grava/atualiza `subscriptions` corretamente.
- Confirmar que `check-subscription` passa a reconhecer a assinatura ativa após pagamento.
- Verificar logs da edge function depois do teste para garantir que o problema real foi eliminado, não apenas mascarado.

Arquivos que serão mexidos
- `supabase/functions/abacatepay-checkout/index.ts`
- `supabase/functions/abacatepay-webhook/index.ts`
- `src/pages/Planos.tsx`
- migration SQL em `supabase/migrations/`

Detalhes técnicos
- Payload correto da assinatura:
```text
{
  externalId,
  items: [{ id: productId, quantity: 1 }],
  methods: ["CARD"],
  customerId,
  returnUrl,
  completionUrl,
  metadata
}
```
- Cliente AbacatePay:
```text
POST /v2/customers/create
{
  email,
  name?,
  cellphone?,
  taxId?
}
```
- Se aparecer um erro seguinte sobre ciclo/frequency do produto, eu também ajusto a criação/recriação dos produtos para o formato exato que a v2 exige para produtos recorrentes. Mas o erro atual confirmado é o payload inválido da assinatura.
