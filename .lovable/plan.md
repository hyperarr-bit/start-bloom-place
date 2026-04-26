## Objetivo

Duas frentes complementares:
1. **Variantes dinâmicas D1-D7**: cada e-mail escolhe uma de 2-3 versões com base no que o usuário já fez (registrou transação? iniciou hábito? logou treino?), focando em fechar a próxima lacuna de ativação.
2. **Eventos de analytics**: medir cliques no banner de trial, conclusão de ações-chave por dia do trial, e conversão D6/D7 — tudo visível no `/admin`.

---

## 1. Variantes dinâmicas D1-D7

### 1.1 Tabela de "ações-chave" (key activation events)

Nova tabela `user_activations` (uma linha por user × ação) com:
- `user_id`, `action_key` (ex: `first_transaction`, `first_habit`, `first_workout`, `first_meal`, `first_task`, `first_water_log`, `first_note`)
- `completed_at`, `metadata jsonb`

Preenchida de duas formas:
- **Backfill via SQL**: detecta a partir de `user_data` chaves existentes (`financas_transactions`, `habits`, `treino_sessions`, etc.) — uma única migration roda uma vez para popular.
- **Tempo real via frontend**: helper `markActivation(actionKey)` chamado nos pontos de criação (ex: ao salvar primeira transação). Idempotente (`ON CONFLICT DO NOTHING`).

### 1.2 Mapa de variantes por dia

Para cada `email_key` D1-D7, defino 2-3 variantes no `dispatch-trial-emails`:

| Dia | Variante padrão | Variante se já fez X |
|-----|-----------------|----------------------|
| D1 `first-action` | "Comece pela Rotina" | Se já criou tarefa → "Que tal anotar uma transação agora?" |
| D2 `finance` | "Adicione 1 transação" | Se já tem transação → "Veja o resumo do mês no Painel" |
| D3 `habit` | "Crie 1 hábito" | Se já tem hábito → "Mantenha sua sequência hoje" |
| D4 `progress` | Recap genérico | Recap personalizado com módulos mais usados |
| D5 `value` | "Veja seu painel" | Se baixo engajamento → "Que tal explorar [módulo X]?" |
| D6 `convert` | CTA padrão | Se alto engajamento → "Você usou X módulos. Continue." |
| D7 `last-call` | Urgência padrão | Se assinatura iminente provável → reforço de valor |

**Lógica**: a edge function `dispatch-trial-emails` calcula `variant_key` por usuário antes de chamar `send-transactional-email`, passando-o como `templateData.variant` + dados ricos (`templateData.modulesUsed`, `templateData.transactionsCount`, etc.). Os templates React Email (criados quando o domínio for configurado) ramificam pela variant.

### 1.3 Persistência da variante escolhida

`trial_email_schedule` ganha uma coluna `variant_key text` populada no momento do dispatch — assim conseguimos medir no admin qual variante converte mais.

---

## 2. Eventos de analytics

### 2.1 Tabela `analytics_events`

Genérica para qualquer evento custom:
- `user_id`, `event_name`, `event_data jsonb`, `created_at`, `trial_day` (calculado), `session_id`

Eventos rastreados:
- `trial_banner_view` — quando o banner aparece (uma vez por sessão por fase)
- `trial_banner_click` — clique no CTA "Assinar"/"Garantir acesso"
- `trial_email_sent` — quando dispatch envia (com `email_key`, `variant_key`)
- `key_action_completed` — ao chamar `markActivation` (mesma chave)
- `subscription_started` — quando subscription vira `active` (já existe no webhook AbacatePay; só adicionamos `trial_day` no momento)
- `paywall_view` — quando tela bloqueante D7+ aparece
- `planos_view` — quando entra em `/planos`

### 2.2 Helper frontend

`src/lib/analytics.ts` exportando `trackEvent(name, data)`:
- Insere em `analytics_events`
- Calcula `trial_day` a partir de `useAuth().trialDay`
- Não-bloqueante (fire-and-forget)

Pontos de integração:
- `TrialBanner.tsx`: dispara `trial_banner_view` no mount + `trial_banner_click` no botão.
- `Planos.tsx`: `planos_view` no mount.
- `markActivation` helper já dispara `key_action_completed`.
- `abacatepay-webhook` (edge function): adiciona `subscription_started` ao confirmar pagamento.

### 2.3 Novas views no /admin

Duas páginas novas em `src/pages/admin/`:
- **AdminActivation.tsx** — tabela: por dia do trial, % de usuários que completou cada `action_key`. Funil de ativação.
- **AdminEmailVariants.tsx** — por `email_key` × `variant_key`: enviados, cliques no banner subsequente, conversões em 48h. CTR e taxa de conversão.

E enriquecimentos:
- **AdminConversion.tsx** existente: gráfico de conversões por `trial_day` (D6 vs D7 vs antes).
- **AdminDashboard.tsx**: cards "CTR banner trial" e "Top variant convertendo".

Funções RPC novas (SECURITY DEFINER + checagem `has_role admin`):
- `admin_activation_funnel()` — retorna (action_key, completed_count, total_users, pct).
- `admin_email_variant_stats()` — retorna (email_key, variant_key, sent, clicks_after, conversions_48h).
- `admin_conversion_by_trial_day()` — retorna (trial_day, conversions).

---

## 3. Integração com trial-banner já existente

O `TrialBanner.tsx` ganha:
- `useEffect` que dispara `trackEvent('trial_banner_view', { phase, trial_day })` por fase.
- `onClick` do botão dispara `trackEvent('trial_banner_click', { phase, trial_day })` antes do `navigate`.

---

## 4. Pontos de `markActivation` no código

Adicionar chamadas onde o usuário cria/registra pela primeira vez:
- `Rotina.tsx` (criar tarefa) → `first_task`
- componentes financeiros (criar transação) → `first_transaction`
- `Saude.tsx`/hábitos (criar hábito) → `first_habit`
- `Treino.tsx` (logar sessão) → `first_workout`
- `Dieta.tsx` (registrar refeição) → `first_meal`
- `HydrationTracker.tsx` (primeiro registro) → `first_water_log`
- `Notes.tsx` (criar nota) → `first_note`

Helper é idempotente — chamar várias vezes não polui dados.

---

## 5. Mudanças no banco (1 migração)

1. `user_activations` (user_id, action_key, completed_at, metadata) + RLS (user lê próprias; admin lê todas).
2. `analytics_events` (user_id, event_name, event_data, trial_day, created_at, session_id) + RLS (user insere próprias; admin lê todas).
3. Coluna `variant_key text` em `trial_email_schedule`.
4. Backfill de `user_activations` a partir de `user_data` existente.
5. Funções `admin_activation_funnel`, `admin_email_variant_stats`, `admin_conversion_by_trial_day`.

---

## 6. Arquivos

**Novos**
- `src/lib/analytics.ts` — `trackEvent`, `markActivation`
- `src/hooks/use-trial-activations.ts` — leitura das ativações no frontend
- `src/pages/admin/AdminActivation.tsx`
- `src/pages/admin/AdminEmailVariants.tsx`

**Editados**
- `supabase/functions/dispatch-trial-emails/index.ts` — calcula variante por usuário, grava `variant_key`, dispara `trial_email_sent`
- `supabase/functions/abacatepay-webhook/index.ts` — adiciona `subscription_started` event
- `src/components/TrialBanner.tsx` — view + click events
- `src/pages/Planos.tsx` — view event
- `src/pages/admin/AdminLayout.tsx` — links para novas abas
- `src/pages/admin/AdminDashboard.tsx` — cards extras
- `src/pages/admin/AdminConversion.tsx` — gráfico por trial_day
- Vários componentes/módulos: chamadas a `markActivation` nos pontos de criação

---

## Resultado esperado

- Cada e-mail D1-D7 fala exatamente da próxima ação que falta para o usuário ativar — não recomenda algo que ele já fez.
- Tudo o que o usuário faz com o banner (ver, clicar) e com o trial (ações-chave, conversão D6/D7) vai parar em `analytics_events`.
- Duas páginas novas no `/admin` mostram funil de ativação e qual variante de e-mail converte melhor.
- Dashboard ganha cards de CTR e variante vencedora.
- Quando o domínio de e-mail for configurado, os templates já consomem `templateData.variant` automaticamente — zero retrabalho.
