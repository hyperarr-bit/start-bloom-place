# Refinamentos no Funil — Finanças

## 1. Reset dos dados "a partir de agora"

- Adicionar o botão `ResetAnalyticsButton` (já existe em `src/components/admin/`) no topo da página `AdminFinanceFunnel.tsx`, do lado do botão "Atualizar".
- Ele chama a RPC `admin_reset_analytics` que grava `analytics_reset_at` em `app_config`. As duas RPCs do funil (`admin_landing_funnel` e `admin_tutorial_dropoff`) já respeitam esse cutoff, então os passos antigos 13/14 (que não existem mais no tutorial) somem na hora.
- Após reset, recarrega a página automaticamente.

## 2. Novas etapas no funil de aquisição

Hoje o funil termina em "Criaram conta". Vou inserir duas etapas que o usuário pediu, deixando assim:

```text
Viram a landing
Clicaram em "Começar grátis"
Iniciaram o tutorial pré-cadastro
Terminaram o tutorial pré-cadastro
Preencheram os dados de cadastro      ← NOVA (evento quicksignup_completed)
Criaram a conta                        ← signups (auth.users)
Aceitaram o teste grátis               ← NOVA (evento trial_started, já é disparado em handle_new_user)
```

Isso exige adicionar dois campos na RPC `admin_landing_funnel`:
- `quicksignup_submitted` — `COUNT(DISTINCT session_id)` de `quicksignup_completed`
- `trial_started` — `COUNT(*)` de `analytics_events` onde `event_name = 'trial_started'` (já existe e é disparado pelo trigger `handle_new_user` em todo signup)

## 3. Filtro detalhado de período

Substituir os três botões fixos (7d / 30d / 90d) por um seletor mais rico no topo:

- **Presets rápidos**: Última hora • Hoje • 24h • 7d • 30d • 90d • Tudo
- **Custom range**: dois date-time pickers (de / até) que aparecem ao escolher "Personalizado"

Para suportar isso, as duas RPCs ganham assinatura nova:

```sql
admin_landing_funnel(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
admin_tutorial_dropoff(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
```

Comportamento:
- Se `_from` for nulo, usa `analytics_reset_at` (igual hoje).
- Se `_to` for nulo, usa `now()`.
- Mantém o filtro por `is_test_user` e o cutoff de reset (cutoff = `GREATEST(_from, reset_at)`).

As versões antigas com `_days` continuam funcionando (overload) pra não quebrar nada.

## 4. Passos 13 / 14 do tutorial

Aparecem porque ficaram dados antigos no banco. O reset do item 1 já resolve. Não preciso mexer no código do tutorial.

## Arquivos tocados

- `src/pages/admin/AdminFinanceFunnel.tsx` — novo seletor de período, novas linhas no funil, botão de reset.
- Migration SQL — sobrescrever `admin_landing_funnel` e `admin_tutorial_dropoff` aceitando `_from`/`_to` e retornando os dois campos novos.

Sem mudanças visuais fora do que foi pedido.
