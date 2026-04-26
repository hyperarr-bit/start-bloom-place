## Funil "Win-back" estilo Cal AI quando o usuário desiste de assinar

Quando o usuário clica em **"Assinar CORE PRO"** e em vez de finalizar o checkout volta/fecha (sinal de desistência), disparamos uma sequência de 2 telas estilo Cal AI **adaptada à nossa identidade visual** (Notion-like minimal, design tokens semânticos) com a oferta de **80% OFF no plano anual** (regra: oferta só vale anual).

---

### Trigger: como detectar "clicou em assinar e desistiu"

Quando o usuário clica em "Assinar CORE PRO":

1. Marca em `sessionStorage` que ele iniciou o intent (`subscribe_intent_at = timestamp`).
2. O AbacatePay abre em nova aba/redirect; quando ele volta para `/planos?canceled=true` (URL de retorno já existente), OU se ele aperta o back/fecha a aba e volta dentro de ~10 minutos sem ter completado, dispara o funil win-back.

Garantias:

- Só dispara **uma vez por usuário não-assinante** (registra em `winback_offers` que já viu, evita virar spam).
- Não dispara se já é assinante.
- Não dispara se ele já viu a oferta nos últimos 30 dias.

---

### Tela 1: Roleta "Win exclusive offers"

Layout adaptado ao tema do app (fundo escuro `bg-background`, fonte e tokens semânticos, sem gradientes berrantes do Cal AI):

```text
┌────────────────────────────────────────┐
│  Ofertas exclusivas                    │
│  Garanta seu desconto permanente       │
│                                        │
│         ╭────────────────╮             │
│        │ 50%   No luck   │             │
│       │  ╭──────────╮  70%│            │
│       │  │   🎁     │     │            │
│       │  ╰──────────╯  90%│            │
│        │ 30%   🎁        │             │
│         ╰────────────────╯             │
│                                        │
│      [    Girar a roleta    ]          │
└────────────────────────────────────────┘
```

- Roleta com 6 fatias: `50%`, `No luck`, `70%`, `90%`, `30%`, `🎁` (presente).
- Animação de spin com **framer-motion** (`rotate` de várias voltas, easing customizado, ~4s).
- **Sempre para no 80%** (a fatia "🎁" mascara como "surpresa" e revela 80% — exatamente como no vídeo).
- Cores das fatias usando tokens: `primary`, `accent`, `muted`, `destructive` para não quebrar identidade.
- Botão "Continuar" só aparece após o spin terminar.

Tracking: `winback_wheel_shown`, `winback_wheel_spun`, `winback_wheel_continued`.

---

### Tela 2: "Sua oferta única — 80% OFF FOREVER"

Card centrado, hero com badge gigante:

```text
┌────────────────────────────────────────┐
│  ✕                                     │
│                                        │
│      Sua oferta única                  │
│                                        │
│        ╭──────────────╮                │
│       ✦│  80% OFF     │✦               │
│        │  PARA SEMPRE │                │
│        ╰──────────────╯                │
│                                        │
│      ̶R̶$̶ ̶1̶4̶,̶9̶0̶  R$ 2,98/mês             │
│                                        │
│  Só vale agora — uma vez fechada,      │
│  a oferta vai embora.                  │
│  Disponível só no plano ANUAL.         │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ ANUAL · 12 meses · R$ 35,76    │    │
│  │ Plano Anual         R$ 2,98/mês│    │
│  └────────────────────────────────┘    │
│                                        │
│  [    Garantir 80% OFF agora    ]      │
│  ✓ Sem compromisso — cancele quando    │
│    quiser                              │
└────────────────────────────────────────┘
```

**Cálculo do preço (80% off no anual):**

- Anual cheio hoje: R$ 19,90/mês × 12 = **R$ 238,80/ano**
- Com 80% off: R$ 47,76/ano = **R$ 3,98/mês**
- Mostrar preço riscado de R$ 14,90 e novo preço de R$ 3,98/mês (essa é a comparação que cria o impacto)

**Visual fiel ao vídeo mas com nossa identidade:**

- Badge preto/escuro com sparkles (lucide `Sparkles`) ao redor — usando `bg-foreground text-background`
- Tipografia bold grande (mantém o estilo Notion-minimal, sem gradient pink/blue do Cal AI)
- Card de plano anual com borda `border-primary` destacada
- Toggle "Trial grátis" REMOVIDO (não temos trial pago hoje, evita confusão)

CTA chama o checkout anual com `coupon: "WINBACK80"` no body — backend valida e aplica.

---

### Mudanças no backend

`**supabase/functions/abacatepay-checkout/index.ts`:**

- Aceita campo opcional `coupon: "WINBACK80"` no body.
- Quando presente E `billing === "annual"` E o usuário ainda não consumiu esse cupom (checa `retention_offers_used` por `offer_type='winback80'`):
  - Cria o checkout com `discount` no payload do AbacatePay (`discount: { type: "PERCENTAGE", value: 80 }` — convenção padrão da API; se a API rejeitar, fallback é criar um produto temporário com preço já descontado).
  - Registra em `retention_offers_used` (`offer_type='winback80'`, `status='active'`) para o `apply-pending-discounts` aplicar nas renovações também.
- Se o cupom for inválido, ignora silenciosamente e cobra preço cheio (defesa contra manipulação).

> A API do AbacatePay para discount em checkout é assumida pelo padrão — se ela rejeitar o campo, o edge function cai num fallback de criar um produto "promocional" com preço já calculado (R$ 35,76/ano) e usar esse productId no checkout. Logs avisam qual caminho foi usado.

---

### Tracking analítico

Adiciona estes eventos para medir o funil:

- `winback_triggered` — funil disparou
- `winback_wheel_shown` / `winback_wheel_spun` / `winback_wheel_continued`
- `winback_offer_shown` — chegou na tela 2
- `winback_offer_dismissed` — fechou no X
- `winback_offer_accepted` — clicou no CTA
- `winback_offer_converted` — completou o pagamento (disparado pelo webhook)

Esses eventos vão direto pra `analytics_events` que o painel `/admin/retention` já consome.

---

### Database (migration necessária)

Tabela nova `winback_attempts` para garantir "uma vez por usuário":

- `user_id` (uuid)
- `triggered_at` (timestamptz)
- `wheel_shown`, `offer_shown`, `accepted`, `converted` (booleans + timestamps)
- RLS: usuário lê/insere o próprio; service_role acesso total; admin lê todos.

E na tabela existente `retention_offers_used`, o tipo `'winback80'` passa a ser um valor válido (já é `text`, sem CHECK constraint, então só convenção).

---

### Arquivos

**Novos:**

- `src/components/retention/WinbackFlow.tsx` — orquestrador (tela 1 → tela 2)
- `src/components/retention/WinbackWheel.tsx` — roleta animada
- `src/components/retention/WinbackOffer.tsx` — tela da oferta 80% off
- `src/hooks/use-winback-trigger.ts` — detecta intent + canceled e abre o flow

**Editados:**

- `src/pages/Planos.tsx` — registra intent ao clicar Assinar; renderiza `<WinbackFlow />`
- `supabase/functions/abacatepay-checkout/index.ts` — aceita `coupon`, aplica desconto, registra em `retention_offers_used`

**Migration:**

- Cria tabela `winback_attempts` com RLS.

---

### Out of scope (não vou fazer)

- Não vou colocar preços diferentes em outras telas — o desconto só aparece neste funil.
- Não vou reativar a oferta para usuários que já recusaram (regra anti-spam).
- Não vou tocar na lógica de mensal — oferta é exclusiva anual conforme você pediu.