

# Plano: Analytics completo + drill-down por abas de cada módulo

## Problema
O analytics atual mostra apenas dados básicos (usuários, sessões, tempo por módulo). Falta:
1. Métricas mais úteis (retenção, usuários ativos por dia, horários de pico, sessão média)
2. Drill-down: clicar num módulo e ver quais **abas** dentro dele são mais usadas

## Solução

### Parte 1: Tracking de abas (DB + hook)

**Nova coluna `tab_id`** na tabela `module_analytics` (nullable, para não quebrar dados existentes):
```sql
ALTER TABLE module_analytics ADD COLUMN tab_id text;
```

**Atualizar `useModuleTracker`** para aceitar `tabId` opcional:
```typescript
useModuleTracker("financas", activeTab) // "dashboard", "investimentos", etc.
```
Quando `tabId` muda, faz flush do anterior e inicia novo tracking.

**Atualizar cada página de módulo** para passar o `activeTab` atual ao tracker. Exemplo no Index.tsx (Finanças):
- Trocar `<TrackedModule moduleId="financas">` por usar `useModuleTracker` direto dentro do componente, passando `activeTab`.

### Parte 2: Analytics mais completo

Adicionar ao painel:

1. **Card "Sessão média"** — tempo médio por sessão (totalSeconds / totalSessions)
2. **Card "Hoje"** — sessões e usuários apenas de hoje
3. **Gráfico de atividade diária** — LineChart mostrando sessões por dia nos últimos 7/30 dias
4. **Horários de pico** — gráfico de barras com sessões por hora do dia (0h-23h)
5. **Retenção simplificada** — quantos usuários voltaram em mais de 1 dia distinto no período

### Parte 3: Drill-down por módulo

No ranking, cada módulo vira **clicável**. Ao clicar:
- Abre uma view de detalhe (estado `selectedModule`) mostrando:
  - Tempo total e sessões naquele módulo
  - **Ranking de abas** (tab_id): quais abas dentro do módulo são mais usadas, com sessões e tempo
  - Lista de usuários que usaram (user_id truncado) com tempo total de cada um
  - Botão voltar para a lista geral

## Alterações

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Adicionar coluna `tab_id text` à tabela `module_analytics` |
| `src/hooks/use-module-tracker.ts` | Aceitar `tabId?` como segundo param. Fazer flush e re-iniciar tracking quando tabId muda. Incluir `tab_id` no insert. |
| `src/components/TrackedModule.tsx` | Adicionar prop `tabId?` e passar ao hook. |
| `src/pages/Index.tsx` | Usar `useModuleTracker("financas", activeTab)` diretamente (remover TrackedModule wrapper no App.tsx para este módulo, ou passar tabId via context). |
| Demais páginas de módulo (Rotina, Saude, Casa, etc.) | Adicionar `useModuleTracker(moduleId, activeTab)` passando a aba ativa. |
| `src/pages/AdminAnalytics.tsx` | (1) Adicionar cards: sessão média, atividade hoje. (2) Gráfico LineChart de atividade diária. (3) Gráfico de horários de pico. (4) Card de retenção. (5) Ranking clicável → view de detalhe com ranking de `tab_id` por módulo. (6) Selecionar `tab_id` na query. |

