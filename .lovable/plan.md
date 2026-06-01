## Objetivo

Criar uma página dedicada **Pagantes** no admin que mostra todos os usuários que pagaram (assinatura `status = 'active'` ou `'canceled'` paga) e, pra cada um, um funil completo do trial até a conversão — quantos dias usaram, quais abas tocaram, quais cards preencheram, qual módulo foi o mais usado, qual o gap entre signup e pagamento.

**Sem mexer em mais nada do app** (espaçamentos, cards, tela do gate, etc.). Só rotas/admin.

## Por que é necessário

- A nova assinante (`marinasilveriobusch@gmail.com`, paga hoje 01/06) já está no banco mas só aparece misturada na lista geral de Usuários, sem destaque.
- Hoje não dá pra responder rápido: "ela usou o app no trial? quais abas? o que a fez converter?"

## Mudanças

### 1. Backend — 2 RPCs novas (migration)

**`admin_paying_users()`** — retorna 1 linha por assinante pago:
- `user_id`, `email`, `plan`, `billing_period`, `status` (active/canceled), `subscribed_at`, `current_period_end`, `payment_method`
- `signup_at`, `days_trial_to_paid` (dias entre signup e assinatura)
- `trial_days_active` (dias com sessão > 30s)
- `total_sessions`, `total_seconds_in_app`
- `top_module` (módulo mais usado no trial)
- `tabs_visited_count`, `cards_filled_count`

Ordenada por `subscribed_at DESC`. Inclui também canceladas que já pagaram pelo menos uma vez.

**`admin_paying_user_funnel(_user_id uuid)`** — funil detalhado de 1 assinante:
- Resumo: signup, primeira sessão, dia que assinou, plano, valor
- **Etapas do funil** (com timestamps + bool atingido):
  1. Cadastrou
  2. Abriu o app (primeira sessão)
  3. Usou trial (sessão > 30s)
  4. Voltou no D2 / D3 / D7
  5. Preencheu primeiro card (`first_bill`, etc — usa `user_activations`)
  6. Atingiu activation completa (3+ ativações)
  7. Iniciou checkout
  8. Pagou
- **Abas usadas** (lista ordenada por tempo): `tab_id`, `module_id`, `seconds`, `visits`
- **Cards preenchidos**: `action_key`, `completed_at`
- **Timeline diária** (D0–D7): segundos, abas tocadas, ativações

### 2. Frontend — nova página `AdminPaying.tsx`

Rota: `/admin/pagantes` (adicionada no `App.tsx` + item no `AdminLayout` nav, com ícone `CreditCard`, posicionado logo abaixo de "Funil").

**Topo — KPIs em cards** (mesma estética dos outros admins, sem mudar tokens):
- Total pagantes ativos
- MRR estimado (soma de planos ativos)
- Conversão trial → pago (% do total de signups)
- Tempo médio trial → pago

**Tabela de pagantes** (mesma estética da `AdminUsers`):
- Colunas: Email · Plano · Período · Status · Pagou em · Dias até pagar · Sessões no trial · Top módulo · Ver
- Clique abre **drawer/sheet** lateral com o funil completo (reutiliza padrão do `TrialJourneySheet`).

**Sheet de funil** (`PayingUserFunnelSheet.tsx`):
- Resumo (plano, valor, signup, pagamento, dias de gap)
- Lista vertical das **etapas do funil** com check verde / cinza, timestamp por etapa
- Seção **"Abas que usou no trial"** — chips com `tab_id` + tempo
- Seção **"Cards preenchidos"** — chips com `action_key`
- **Timeline D0–D7** (mesmo padrão visual do `TrialJourneySheet` atual)

### 3. Pequenos ajustes

- `AdminLayout.tsx`: adicionar entry `{ to: "/admin/pagantes", label: "Pagantes", Icon: CreditCard }`.
- `App.tsx`: registrar a rota.
- **Nada mais é tocado.**

## Detalhes técnicos

- Critério de "pagante": `subscriptions.status = 'active'` **ou** (`status = 'canceled'` com `current_period_end` no passado, ou seja, já pagou) — exclui registros que nunca tiveram pagamento.
- Cálculos de funil usam `module_analytics` (tempo/abas), `user_activations` (cards), `auth.users.created_at` (signup), `subscriptions.created_at` (pagamento).
- RPCs com `SECURITY DEFINER` + check `has_role(auth.uid(),'admin')` no início (padrão das outras admin RPCs).
- Grants: `GRANT EXECUTE ... TO authenticated`.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` (novas RPCs)
- `src/pages/admin/AdminPaying.tsx` (novo)
- `src/components/admin/PayingUserFunnelSheet.tsx` (novo)
- `src/pages/admin/AdminLayout.tsx` (1 linha no array de nav)
- `src/App.tsx` (1 rota)

Nenhum arquivo do app principal (gate, cards, finance, etc.) é tocado.
