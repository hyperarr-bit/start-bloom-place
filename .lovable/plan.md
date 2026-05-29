# Painel de uso de Finanças + jornada do trial

Foco: só módulo `financas` (resto fica de fora, como você pediu).

## 1. Banco — 3 RPCs novas (security definer, só admin)

**a) `admin_finance_tab_usage(_from timestamptz, _to timestamptz)`**
Lê `module_analytics` onde `module_id='financas'`. Retorna por `tab_id`:
- `sessions` (linhas), `unique_users`, `total_seconds`, `avg_seconds`, `last_used`.
Ordena por `total_seconds DESC`. Exclui test users.

**b) `admin_finance_card_usage(_from timestamptz, _to timestamptz)`**
Lê `analytics_events` onde `event_name IN ('finance_card_view','finance_card_interact')`. Retorna por `card_key` (vindo de `event_data->>'card'`):
- `views`, `interactions`, `unique_users`, `last_used`.

**c) `admin_user_trial_journey(_user_id uuid)`**
Para um usuário:
- Linha por `trial_day` (0..N, baseado em `auth.users.created_at`):
  - segundos totais em finanças, abas usadas (array de `{tab, seconds}`), cards interagidos (array de `{card, count}`), activations completadas no dia (`user_activations.action_key`).
- Resumo: `signup_at`, `last_active_at`, `last_active_day`, `first_inactive_day`, `total_days_active`, status atual da subscription.

## 2. Tracking de cards em Finanças (`src/pages/Index.tsx`)

Componente novo `src/components/admin/TrackedCard.tsx`:
- Props: `cardKey: string`, `children`.
- `IntersectionObserver`: dispara `trackEvent('finance_card_view', { card: cardKey, tab: activeTab })` 1x por sessão+card (dedup em `sessionStorage`).
- `onClick` no wrapper: dispara `trackEvent('finance_card_interact', { card: cardKey, tab: activeTab })` (com throttle de 2s pra não floodar).

Em `Index.tsx`, envolver os cards principais com `<TrackedCard cardKey="...">`:
- Aba financeiro: `month-turnover`, `summary`, `incomes`, `fixed-expenses`, `expenses`, `notes`, `bills-due`, `installments`, `annual-budget`, `monthly-budget`, `calculator`.
- Demais abas: `dashboard`, `investimentos`, `wishlist`, `viagem`, `simuladores`, `category-budgets`, `relatorios`, `financial-health`.

Sem mudar layout/CSS — `TrackedCard` é um `<div>` transparente (`contents`/`display: contents`) com ref no primeiro filho.

## 3. Admin UI

**a) Novo item no menu (`AdminLayout.tsx`)**: "Uso" → `/admin/uso`, ícone `BarChart3`.

**b) Nova página `src/pages/admin/AdminUso.tsx`** (rota em `App.tsx`):
- Filtro de período (hoje / 7d / 30d / tudo).
- Card 1: **Ranking de abas** — tabela `aba | sessões | usuários | tempo total | tempo médio | último uso`.
- Card 2: **Ranking de cards** — tabela `card | views | interações | usuários | último uso`.

**c) Jornada do trial em `AdminTrials.tsx`**:
- Botão "Ver jornada" em cada linha → abre `<Sheet>` (já tem shadcn) à direita.
- Conteúdo: cabeçalho com email + signup + status + dia atual.
- Timeline vertical por trial day (D0, D1, D2...): badge "ativo/inativo", segundos em finanças, lista de abas com tempo, lista de cards interagidos, activations marcadas no dia.
- Resumo no topo: "Saiu no dia X" (= `first_inactive_day`), "Último ativo: D{n}".

Sem mexer em outras páginas admin.

## Arquivos

```text
NOVO  supabase/migrations/<ts>_admin_finance_usage.sql
NOVO  src/components/admin/TrackedCard.tsx
NOVO  src/pages/admin/AdminUso.tsx
EDIT  src/pages/Index.tsx               (envolver cards com TrackedCard)
EDIT  src/pages/admin/AdminLayout.tsx   (nav item "Uso")
EDIT  src/pages/admin/AdminTrials.tsx   (botão "Ver jornada" + Sheet)
EDIT  src/App.tsx                       (rota /admin/uso)
```

## Fora do escopo

- Tracking de cards fora de Finanças.
- Backfill de dados antigos (cards só começam a contar depois do deploy).
- Alterações visuais nos cards do app (só wrapper invisível).
