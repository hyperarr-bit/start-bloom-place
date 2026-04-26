## Win-back v2: pricing correto + métricas no admin

Reconstruir o funil win-back com o pricing correto e adicionar dashboard de métricas dedicado no admin.

### 1. Pricing correto (referência mensal R$ 19,90)

| Item | Valor |
|---|---|
| Mensal cheio | R$ 19,90/mês |
| Anual cheio (referência percebida) | ~R$ 238,80/ano (12 × 19,90) |
| **Oferta win-back: 80% OFF anual** | **R$ 47,76/ano → R$ 3,98/mês** |
| Economia comunicada | R$ 191,04/ano |

A tela da oferta vai mostrar: `De R$ 19,90/mês (R$ 238,80/ano) → por R$ 3,98/mês (R$ 47,76/ano)` com badge "80% OFF" e selo "só hoje, na assinatura anual".

### 2. Componentes do win-back (recriar)

Os arquivos não estão no disco — recriar:

- `src/hooks/use-winback-trigger.ts` — detecta abandono via `sessionStorage('subscribe_intent_at')` ou `?canceled=true`. Verifica `winback_attempts` (cooldown 30d, 1x por usuário). Insere `triggered_at`.
- `src/components/retention/WinbackWheel.tsx` — roleta animada com framer-motion, sempre cai no prêmio "80% OFF Anual". Atualiza `wheel_spun_at`.
- `src/components/retention/WinbackOffer.tsx` — card com pricing acima, contador 10min, CTA "Garantir 80% OFF". Atualiza `offer_shown_at` ao montar e `accepted_at` no clique. Chama `abacatepay-checkout` com `{ billing: "annual", coupon: "WINBACK80" }`.
- `src/components/retention/WinbackFlow.tsx` — orquestra wheel → offer dentro de um `Dialog` fullscreen mobile-first.
- Integrar em `src/pages/Planos.tsx` (montar quando hook dispara).

Visual: tokens semânticos do projeto, gradiente sutil, sem emojis fora dos lugares já permitidos.

### 3. Edge function `abacatepay-checkout`

- Aceitar `coupon: "WINBACK80"` no body (Zod opcional).
- Quando válido + billing=annual: aplicar `discount: { type: "PERCENTAGE", value: 80 }` no checkoutBody e gravar em `retention_offers_used` (`offer_type='winback80'`, `metadata={ discount_pct:80, billing:'annual', monthly_equiv:3.98, annual_total:47.76 }`).
- Atualizar `winback_attempts.converted_at` via webhook `abacatepay-webhook` quando a subscription correspondente ativar (lookup por `user_id` + offer recente).

### 4. Métricas no Admin (NOVO)

#### 4a. RPC `admin_winback_stats()` (SECURITY DEFINER, has_role admin)

Retorna jsonb:

```json
{
  "triggered": 0,           // total de funis iniciados
  "wheel_spun": 0,          // giraram a roleta
  "offer_shown": 0,         // viram a tela de oferta
  "accepted": 0,            // clicaram em "garantir"
  "converted": 0,           // pagamento confirmado
  "dismissed": 0,
  "spin_rate_pct": 0,       // wheel_spun / triggered
  "offer_view_rate_pct": 0, // offer_shown / wheel_spun
  "accept_rate_pct": 0,     // accepted / offer_shown
  "conversion_rate_pct": 0, // converted / offer_shown (KPI principal)
  "global_conversion_pct": 0, // converted / triggered
  "revenue_recovered_brl": 0, // converted * 47.76
  "last_30d": { ...mesmos campos... },
  "last_7d": { ...mesmos campos... },
  "by_day": [ { "date": "...", "triggered": n, "converted": n } ]  // últimos 30d
}
```

#### 4b. Card no dashboard `AdminRetention.tsx`

Nova seção "Win-back 80% OFF (Anual)" com:
- 6 cards: Disparados / Roleta girada / Oferta vista / Aceitaram / **Converteram** / Receita recuperada
- Tabela funil com taxa entre etapas (drop-off destacado)
- Mini-gráfico (sparkline simples com divs) dos últimos 30 dias
- Indicadores: "1 a cada X usuários que viram a oferta converteu"

### 5. Migration

Apenas a RPC nova. A tabela `winback_attempts` já existe.

### Arquivos

**Novos:**
- `src/hooks/use-winback-trigger.ts`
- `src/components/retention/WinbackWheel.tsx`
- `src/components/retention/WinbackOffer.tsx`
- `src/components/retention/WinbackFlow.tsx`
- `src/hooks/use-winback-stats.ts`
- `supabase/migrations/<ts>_winback_stats.sql`

**Editados:**
- `src/pages/Planos.tsx` — montar `<WinbackFlow/>`
- `src/pages/admin/AdminRetention.tsx` — nova seção win-back
- `supabase/functions/abacatepay-checkout/index.ts` — coupon WINBACK80
- `supabase/functions/abacatepay-webhook/index.ts` — marcar `converted_at`
