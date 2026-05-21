# Corrigir contagens do tutorial no admin

## Problema encontrado

Na página `/admin/tutorial`, o filtro de período (Diário / 7d / 30d / 90d) **não funciona de verdade**. Os números mostrados são sempre dos últimos 1 dia, mesmo clicando em 7/30/90.

### Causa técnica

Em `src/pages/admin/AdminTutorialCompare.tsx` a função `load` é criada com `useCallback(..., [])` — array de dependências vazio. Ela lê `dropoffDays` por closure, então o valor fica congelado em `1` (valor inicial). Trocar de aba não dispara refetch, e mesmo o auto-refresh a cada 30s continua chamando com `_days: 1`.

Por isso o "Diário" parece o único que bate, e os outros ficam errados/parados.

## O que será feito

1. **Corrigir o refetch por período** — adicionar `dropoffDays` nas deps do `useCallback`, para que mudar a aba realmente re-consulte o banco com o intervalo certo.
2. **Zerar contadores a partir de agora** — chamar `admin_reset_analytics` automaticamente ao salvar essa correção (uma única vez), pra começar a contagem do zero com o fix em produção. A RPC já existe e move o `analytics_reset_at` no `app_config`, fazendo todas as funções de admin (`admin_tutorial_dropoff`, `admin_landing_funnel`, etc.) ignorarem eventos antigos.
   - Alternativa: deixar você apertar o botão "Zerar contadores" que já existe no topo da página depois do deploy. Me diz qual prefere.

## Detalhes técnicos

- Arquivo único alterado: `src/pages/admin/AdminTutorialCompare.tsx`
- Mudança: `useCallback(async (silent) => {...}, [])` → `useCallback(async (silent) => {...}, [dropoffDays])`
- Sem migration nova. Sem mudança de schema.
- Eventos de tutorial (`spotlight_shown`, `spotlight_step_view`, `quickstart_completed`) continuam sendo emitidos do jeito que já estão — eles estão corretos, só a leitura no admin que estava bugada.
