## Objetivo

Trocar o foco da estratégia de trial: **comunicação fica dentro do app** via tour guiado contextual por dia. Emails D1-D7 ficam pausados (infra preservada). Analytics ganha novos eventos para medir o tour.

Domínio segue 100% no Supabase — nada de Lovable Emails será tocado.

## 1. Pausar emails do trial (sem deletar código)

- Adicionar coluna `app_config.value` com chave `trial_emails_enabled = false`.
- Ajustar `dispatch-trial-emails/index.ts`: ler essa flag no início e sair com `{ paused: true }` se desabilitada. Mantém todo o código existente (variantes, schedule) intacto para reativar no futuro.
- O cron continua rodando, mas não envia nada. Linhas em `trial_email_schedule` permanecem `pending`.

## 2. Tour guiado por dia (D1-D7) — dinâmico

### Componente novo: `src/components/onboarding/DailyNudge.tsx`

Bottom-sheet (mobile-first, 430px) que aparece **uma vez por dia** quando o usuário abre o app durante o trial. Estrutura:

- Ícone + título contextual ("Dia 2 de 7 — Comece pelo dinheiro")
- 1 ação-chave sugerida (botão CTA leva direto ao módulo)
- Link "agora não" (fecha e marca dismiss do dia)
- Botão X no canto

Regras de exibição:
- Só aparece se `user && !isSubscribed && !trialExpired`
- Marca `dismissed_day_N` em localStorage + envia evento analytics
- Não reaparece no mesmo dia após dismiss/CTA

### Lógica de seleção dinâmica: `src/lib/dailyNudge.ts`

Função `pickDailyNudge(trialDay, activations)` retorna `{ key, title, description, ctaLabel, ctaRoute, actionKey }`.

Mesma filosofia do `pickVariant` do edge function, mas para UI. Exemplo:

```ts
// D2 — finanças
if (trialDay === 2) {
  if (activations.has("first_transaction")) {
    return { key: "d2-finance-summary", ctaRoute: "/financas", 
             title: "Veja onde seu dinheiro está indo", ... };
  }
  return { key: "d2-finance-first", ctaRoute: "/financas",
           title: "Registre sua primeira transação", ... };
}
```

Mapa completo (8 dias, 2-3 variantes cada):

| Dia | Sem ativação | Com ativação relevante |
|-----|---|---|
| D0 boas-vindas | Tour inicial: escolha um módulo | — |
| D1 primeira ação | Crie sua 1ª tarefa | Já criou tarefa? Adicione transação |
| D2 finanças | Registre 1ª transação | Veja resumo do mês |
| D3 hábitos | Crie 1º hábito | Acompanhe streak |
| D4 progresso | Explore 1 novo módulo | Veja seu recap |
| D5 valor | Por que assinar | (engajado) Compare planos |
| D6 conversão | Garantir acesso | (engajado) Oferta destacada |
| D7 last call | Última chance | (engajado) CTA final |

### Hook: `src/hooks/use-daily-nudge.ts`

- Usa `useAuth()` e `useTrialActivations()`
- Calcula chave do dia: `nudge-${userId}-day-${trialDay}`
- Lê localStorage para checar dismiss
- Expõe `{ nudge, show, dismiss, complete }`

### Integração

Montar `<DailyNudge />` em `src/pages/Home.tsx` (logo abaixo do `TrialBanner`). Aparece com delay de 1.5s após o load para não atropelar a primeira impressão.

## 3. Analytics — novos eventos

Adicionar em `src/lib/analytics.ts` (já existe). Novos eventos a serem registrados via `trackEvent`:

- `daily_nudge_shown` — `{ trial_day, nudge_key, has_activation }`
- `daily_nudge_clicked` — `{ trial_day, nudge_key, cta_route }`
- `daily_nudge_dismissed` — `{ trial_day, nudge_key, method: "x" | "later" }`
- `onboarding_step_completed` — disparado quando a `actionKey` do nudge é ativada (ex: usuário clicou no CTA do D2 e registrou a transação dentro de 24h)

### Nova RPC admin: `admin_nudge_stats()`

Retorna por `trial_day` + `nudge_key`:
- shown, clicked, dismissed
- CTR (clicked/shown)
- completion rate (step_completed em 24h após shown)
- conversion rate (subscriptions ativas em 48h após shown)

### Página admin nova: `src/pages/admin/AdminOnboarding.tsx`

Tabela com performance de cada nudge. Adicionar link no `AdminLayout`.

## 4. Migração de banco

```sql
-- 1. App config para a flag
INSERT INTO app_config (key, value)
VALUES ('trial_emails_enabled', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

-- 2. RPC nova
CREATE FUNCTION admin_nudge_stats() RETURNS TABLE(...) ...;
```

Sem alteração estrutural em tabelas existentes — `analytics_events` já comporta os novos eventos.

## 5. Arquivos

**Novos:**
- `src/components/onboarding/DailyNudge.tsx`
- `src/hooks/use-daily-nudge.ts`
- `src/lib/dailyNudge.ts`
- `src/pages/admin/AdminOnboarding.tsx`
- `supabase/migrations/<timestamp>_pause_emails_and_nudge_rpc.sql`

**Modificados:**
- `src/pages/Home.tsx` (montar DailyNudge)
- `src/lib/analytics.ts` (helpers tipados pros novos eventos)
- `src/App.tsx` + `src/pages/admin/AdminLayout.tsx` (rota admin)
- `supabase/functions/dispatch-trial-emails/index.ts` (checar flag e abortar)

## Fora do escopo

- Não mexer em domínio (segue Supabase, nada de Lovable Emails).
- Não criar templates de email novos.
- Não remover infraestrutura de email existente — só pausar.
