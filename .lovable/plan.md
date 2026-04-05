

# Plano: Garantir que o Analytics novo funcione (problema de cache)

## Diagnóstico

O codigo do AdminAnalytics.tsx **ja esta completo** com todas as features:
- Cards: usuarios, sessoes, tempo total, sessao media
- Card "Hoje": sessoes e usuarios do dia + retencao
- Grafico de atividade diaria (LineChart)
- Grafico de horarios de pico (BarChart)
- Ranking de modulos **clicavel** -> drill-down mostrando:
  - Ranking de abas (tab_id) com sessoes, tempo e usuarios
  - Lista de usuarios do modulo

O tracking de `tab_id` tambem ja esta implementado em todos os 16 modulos. Cada modulo reporta sua aba ativa via `useSetTrackedTab` ou `useTabReporter`.

A coluna `tab_id` ja foi adicionada na tabela `module_analytics`.

## Problema real

O browser esta servindo o bundle JS antigo (cache). As network requests mostram a query antiga sem `tab_id`.

## Solucao

Forcando uma mudanca minima no arquivo para invalidar o cache do build:

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/AdminAnalytics.tsx` | Adicionar um comentario de versao no topo (`// v2 - analytics completo`) para forcar rebuild e invalidacao de cache. |

Isso vai gerar um novo hash no bundle, forcando o browser a baixar a versao nova.

## Nota

Se mesmo apos o rebuild o browser continuar com cache, voce precisa fazer **Ctrl+Shift+R** (hard refresh) ou abrir em aba anonima.

