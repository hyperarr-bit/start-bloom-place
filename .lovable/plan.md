## Save Flow de Cancelamento (Anti-Churn)

### Problema atual
Hoje em `Planos.tsx` existe apenas o texto "Para cancelar, entre em contato pelo email suporte@coreaplicativo.com". Não há fluxo in-app, nenhuma tentativa de retenção, nenhum dado sobre por que as pessoas cancelam.

### Objetivo
Quando o assinante clicar em **Cancelar assinatura**, abrir um fluxo guiado em 4 etapas que:
1. Captura o motivo (insight de produto)
2. Oferece a solução certa pro motivo
3. Oferece desconto + pausar (último argumento)
4. Confirma cancelamento se tudo falhar

---

### Fluxo proposto

```text
[Botão "Cancelar assinatura" em /planos]
        │
        ▼
┌─────────────────────────────┐
│ Etapa 1: Por que cancelar?  │ ← captura motivo
│ ○ Tá caro                   │
│ ○ Não usei o suficiente     │
│ ○ Faltou um recurso         │
│ ○ Problema técnico          │
│ ○ Outro motivo              │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ Etapa 2: Resposta segmentada│
│ - "caro" → pula pra Etapa 3 │
│ - "não usei" → tour rápido  │
│   + "experimente mais 1 mês │
│   grátis"                   │
│ - "faltou recurso" → form   │
│   de feedback + "vou avisar │
│   quando lançar"            │
│ - "técnico" → link suporte  │
│ - "outro" → pula pra Etapa 3│
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ Etapa 3: Ofertas (escolha)  │
│ ┌─────────────────────────┐ │
│ │ 🎁 50% off por 2 meses  │ │ ← cupom Stripe
│ │ [Aceitar oferta]        │ │
│ ├─────────────────────────┤ │
│ │ ⏸  Pausar 1, 2 ou 3 mês │ │ ← pause Stripe
│ │ [Pausar]                │ │
│ ├─────────────────────────┤ │
│ │ Cancelar mesmo assim    │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
        │ (se "cancelar mesmo assim")
        ▼
┌─────────────────────────────┐
│ Etapa 4: Confirmação final  │
│ "Sua assinatura fica ativa  │
│ até DD/MM. Tem certeza?"    │
│ [Voltar] [Confirmar]        │
└─────────────────────────────┘
```

Limite: o desconto e a pausa podem ser usados **1x a cada 365 dias** por usuário (anti-abuso leve, ainda permissivo).

---

### Mudanças técnicas

#### 1. Banco (migração)
Tabela `cancel_attempts` para registrar cada tentativa de cancelamento + motivo + outcome (saved-by-discount, saved-by-pause, saved-by-feedback, churned). RLS: usuário insere/lê os próprios; admin lê todos.

Tabela `retention_offers_used` (`user_id`, `offer_type`, `used_at`) para enforcar limite 1x/ano por tipo (`discount` | `pause`).

#### 2. Edge Functions novas
- **`cancel-subscription-flow`** — Recebe `{ action, reason?, offerAccepted? }`. Orquestra:
  - `action: "log_reason"` → grava motivo em `cancel_attempts`
  - `action: "apply_discount"` → cria/aplica cupom Stripe de 50% por 2 ciclos via `subscriptions.update` com `discounts: [{ coupon }]`, registra em `retention_offers_used`
  - `action: "pause_subscription"` → usa `subscriptions.update` com `pause_collection: { behavior: "void", resumes_at }` por 1/2/3 meses
  - `action: "confirm_cancel"` → cancela no fim do período (`cancel_at_period_end: true`), atualiza `cancel_attempts.outcome = 'churned'`
  - Valida via Zod, idempotente, retorna estado atualizado

- **`get-retention-eligibility`** — Retorna `{ canUseDiscount, canUsePause, currentPeriodEnd }` consultando `retention_offers_used`.

> Nota: hoje o app usa AbacatePay como gateway (webhook `abacatepay-webhook`), mas há `STRIPE_SECRET_KEY` configurado. **Preciso confirmar com você qual gateway as assinaturas estão de fato passando** antes de codar — ver "Pergunta antes de implementar" abaixo.

#### 3. Frontend
- **`src/components/retention/CancelFlowDialog.tsx`** — Dialog stepper com as 4 etapas (shadcn `Dialog` + state machine simples com `useState<Step>`).
- **`src/components/retention/steps/`** — `ReasonStep.tsx`, `SegmentedResponseStep.tsx`, `OffersStep.tsx`, `ConfirmStep.tsx`.
- **`src/hooks/use-cancel-flow.ts`** — Hook que invoca as edge functions, gerencia loading, toasts.
- **`src/pages/Planos.tsx`** — Substitui o texto atual por botão `Cancelar assinatura` que abre o `CancelFlowDialog`.

#### 4. Analytics
Eventos novos em `analytics_events`:
- `cancel_flow_opened`
- `cancel_reason_selected` (com `reason`)
- `retention_offer_shown` (com tipo)
- `retention_offer_accepted` (com tipo)
- `cancel_confirmed`

#### 5. Admin
Nova página `src/pages/admin/AdminRetention.tsx` com:
- Top motivos de cancelamento (últimos 30d)
- Save rate: % de tentativas que aceitaram desconto/pausa
- Funil: opened → reason_selected → offer_shown → offer_accepted | churned
- RPC `admin_retention_stats()` agregando `cancel_attempts`

---

### Pergunta antes de implementar
Vejo que o webhook `abacatepay-webhook` é quem move status de assinatura hoje, mas a chave do Stripe também está nos secrets. **Preciso confirmar**: as assinaturas ativas hoje rodam no **AbacatePay** ou no **Stripe**? A resposta muda quais APIs eu chamo (Stripe tem `coupons` e `pause_collection` nativos; AbacatePay precisaria de uma alternativa — possivelmente cancelar e recriar com novo preço, ou contatar suporte deles para ver se suportam pause/coupon).

Se for AbacatePay, sugiro alternativas:
- **Desconto**: cancelar a assinatura atual e abrir um novo billing com 50% off por 2 meses, depois reverter para o preço cheio.
- **Pausar**: cancelar a assinatura mantendo `current_period_end`, e enviar email de retorno antes do prazo.

Confirma qual gateway está em produção pra eu finalizar o plano técnico?