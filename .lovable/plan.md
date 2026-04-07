

# Plano: Confirmacao de recaida + check-in diario no Detox

## Situacao atual
O botao de recaida (RotateCcw) reseta o streak imediatamente sem confirmacao. O streak e automatico baseado em `differenceInDays` desde a ultima recaida — nao existe check-in diario.

## Decisao de design

O streak **continua automatico** (melhor UX — nao obriga o usuario a entrar todo dia). Mas adicionamos:

1. **AlertDialog de confirmacao** antes de resetar o streak — "Tem certeza? Seu streak de X dias sera reiniciado"
2. **Botao "Estou limpo hoje" (check-in opcional)** — um botao verde que marca o dia como confirmado. Nao e obrigatorio, mas da satisfacao visual. Dias confirmados ganham destaque no calendario (verde mais forte vs verde claro para dias nao confirmados)

## Mudancas

### DetoxTracker.tsx

1. Adicionar state `confirmRelapseId` para controlar qual habito esta pedindo confirmacao
2. Botao RotateCcw agora so abre o AlertDialog em vez de chamar `relapse()` direto
3. AlertDialog com texto "Tem certeza que recaiu? Seu streak de {streak} dias sera reiniciado." + botoes Cancelar/Confirmar
4. Adicionar campo `checkins: string[]` na interface DetoxHabit
5. Botao "Estou limpo hoje ✓" no card expandido — marca `todayStr` no array `checkins`
6. No calendario, dias com check-in confirmado ficam `bg-green-500/50` (mais forte) vs `bg-green-500/20` (automatico sem check-in)
7. Legenda atualizada: Confirmado / Automatico / Recaida
8. Import `AlertDialog` do shadcn

| Arquivo | Mudanca |
|---------|---------|
| `src/components/detox/DetoxTracker.tsx` | AlertDialog confirmacao + checkins[] + botao check-in diario + legenda 3 cores |

