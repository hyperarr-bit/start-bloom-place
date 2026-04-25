## Objetivo

Substituir os dois botões ("Cartão" e "Pix") por **um único botão** que leva o usuário ao checkout da AbacatePay, onde **ele escolhe** Pix ou Cartão na própria tela do gateway.

## Por que mudar a abordagem

A API `/subscriptions/create` (recorrente) **só aceita CARD**. Para oferecer Pix + Cartão na mesma tela é necessário usar `/billing/create` (cobrança avulsa AbacatePay), que aceita `methods: ["PIX", "CARD"]` simultaneamente. Como Pix não tem recorrência nativa, o fluxo passa a ser **pagamento avulso para os dois métodos** — com renovação manual e os 3 dias de carência já implementados aplicando-se a ambos.

Esse é o trade-off: ganhamos a UX unificada que você quer, perdemos a recorrência automática do cartão. O usuário no cartão vai precisar pagar de novo todo mês/ano (mesma lógica do Pix). Se isso for inaceitável, a alternativa é manter dois botões.

## Mudanças

### 1. `abacatepay-checkout` (edge function)
- Remover parâmetro `method`. Sempre criar uma cobrança única via `POST /billing/create` com:
  - `methods: ["PIX", "CARD"]`
  - `frequency: "ONE_TIME"`
  - `products: [{ externalId, name, quantity: 1, price }]` (preço em centavos do plano)
  - `customer: { id: customerId }` ou dados inline
  - `returnUrl` / `completionUrl` apontando para `/planos`
  - `metadata: { user_id, billing_period, payment_type: "one_time" }`
- Remover toda a lógica de `getOrCreateProduct` + `/subscriptions/create` (não precisa mais criar produto recorrente — manda os items inline).
- Retornar `{ url }` da cobrança.

### 2. `abacatepay-webhook` (edge function)
- Tratar evento `billing.paid` para gravar/renovar `subscriptions`:
  - `status = "active"`, `plan = "core-pro"`, `payment_method` ← do payload (PIX ou CARD)
  - `current_period_end` = agora + 30 dias (mensal) ou +365 (anual), lido do `metadata.billing_period`
- A coluna `payment_method` já existe; passa a refletir o método real escolhido pelo usuário no checkout.

### 3. `check-subscription` (edge function)
- Manter a lógica de carência de 3 dias **para qualquer pagamento** (não só Pix), já que agora cartão também é avulso.
- Banner `PixGraceBanner` continua funcionando — talvez renomear o texto para "Sua assinatura venceu" (sem mencionar Pix).

### 4. `src/pages/Planos.tsx`
- Voltar a ter **um único botão** "Assinar CORE PRO".
- Texto abaixo: "Você escolhe Pix ou Cartão na próxima tela. Pagamento válido por 1 mês/ano."
- Remover a chamada com `method` no `invoke`.

### 5. `src/components/PixGraceBanner.tsx`
- Texto ajustado para "Sua assinatura venceu. Renove em X dias para manter o acesso." (genérico).

## Diagrama do fluxo

```text
Planos → [Assinar CORE PRO]
   ↓
edge: abacatepay-checkout
   ↓ POST /billing/create methods=[PIX, CARD]
AbacatePay Checkout
   ↓ usuário escolhe PIX ou CARD e paga
webhook billing.paid
   ↓ grava subscription com payment_method real
   ↓ current_period_end = +30d ou +365d
Acesso liberado · após vencer: 3 dias de carência · depois bloqueia
```

## Confirmar antes de implementar

Você está ok em **perder a renovação automática do cartão** em troca da tela unificada? Se quiser manter recorrência no cartão, a única forma é continuar com dois botões (recorrente vs. avulso) — diga e eu ajusto o plano.
