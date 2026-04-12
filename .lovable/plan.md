

## Plano: Corrigir overlay de trial expirado

### Problema
O banner de trial expirado usa `bg-background/95` (95% opacidade), permitindo que o conteúdo da Home sangre por trás, criando a sobreposição visual visível na screenshot.

### Correção em `src/components/TrialBanner.tsx`

**Linha 44** — Trocar a opacidade do overlay:
- De: `bg-background/95 backdrop-blur-sm`
- Para: `bg-background` (100% opaco, sem blur necessário)

Isso faz o overlay cobrir completamente a tela, sem deixar o conteúdo aparecer por trás.

