## Objetivo

Adicionar a opção de pagar com **Pix avulso** (não recorrente) na página `/planos`, ao lado da assinatura recorrente (CARD). O Pix paga 1 mês ou 1 ano de acesso. Quando vence, o usuário tem **3 dias de carência** com aviso antes do bloqueio total.

## Como vai funcionar para o usuário

Na tela de Planos, dentro do card do plano selecionado (Mensal ou Anual), aparecem dois botões:

1. **Assinar com Cartão** — fluxo recorrente atual (renova sozinho)
2. **Pagar com Pix** — gera QR Code, pagamento único; precisa repetir manualmente quando vencer

Após o vencimento do Pix:
- Dia 0–3 após vencer → acesso liberado + banner amarelo "Sua assinatura via Pix venceu. Renove em X dias para evitar bloqueio."
- Dia 4+ → bloqueio total, igual a quem nunca assinou

## Mudanças

### 1. Edge function `abacatepay-checkout`
Aceitar novo parâmetro `method: "card" | "pix"`. 

- Se `card` (padrão): comportamento atual (`/subscriptions/create`, methods `["CARD"]`).
- Se `pix`: chama `/checkouts/create` (cobrança avulsa, não assinatura) com `methods: ["PIX"]`, item sendo o produto do plano escolhido. Retorna a `url` do checkout AbacatePay onde o usuário paga o Pix.

### 2. Edge function `abacatepay-webhook`
Diferenciar Pix avulso de assinatura recorrente pelo metadata `payment_type: "pix" | "card"`. Quando `billing.paid` chega para Pix, gravar em `subscriptions`:
- `status = "active"`
- `plan = "core-pro"`
- `billing_period = "monthly" | "annual"`
- `current_period_end` = agora + 30 dias (mensal) ou +365 (anual)
- novo campo `payment_method = "pix"` para diferenciar

### 3. Edge function `check-subscription` (lógica de carência)
Quando há subscription com `payment_method = "pix"` e `current_period_end` já passou:
- Se passou ≤ 3 dias → retornar `subscribed: true` + `grace_period: true` + `days_left: N`
- Se passou > 3 dias → retornar `subscribed: false` (bloqueio normal)

Para `card`, comportamento atual (renovação automática via webhook).

### 4. Schema (migração)
Adicionar coluna `payment_method TEXT DEFAULT 'card'` em `subscriptions`.

### 5. UI `src/pages/Planos.tsx`
Adicionar segundo botão **"Pagar com Pix"** abaixo do "Assinar CORE PRO". Texto explicativo curto: "Pagamento único, válido por 1 mês/ano. Você renova manualmente."

### 6. Banner de carência
Novo componente exibido no Home (e em outras telas chave) quando `check-subscription` retornar `grace_period: true`: "Sua assinatura Pix venceu. Renove em X dias para manter o acesso." Botão "Renovar" → `/planos`.

### 7. `useAuth` hook
Expor `gracePeriod` e `daysLeft` vindos da resposta de `check-subscription`.

## Detalhes técnicos

- Pix usa endpoint `POST /checkouts/create` (não `/subscriptions/create`) com `methods: ["PIX"]` e `frequency: "ONE_TIME"` (padrão).
- Metadata enviado: `{ user_id, billing_period, payment_type: "pix" }`.
- Webhook AbacatePay envia `event: "billing.paid"` para Pix avulso.
- Carência calculada em `check-subscription`: `(now - current_period_end) <= 3 dias`.
- Para Pix, NÃO chamar `subscription.cancelled` nem `subscription.overdue` (não existem em pagamento avulso).

## Fora de escopo

- Notificações por email/push antes do vencimento (apenas banner in-app).
- Renovação automática de Pix (por design é manual).
- Histórico de pagamentos Pix.
