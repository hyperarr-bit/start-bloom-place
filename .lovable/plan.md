# Corrigir header sumindo ao fechar tutorial

## Problema

Ao clicar em "Entendi" no modal de conclusão do tutorial, o header da página (DIETA, TREINO, etc.) desaparece por alguns instantes antes de reaparecer, deixando um espaço em branco no topo (visível no screenshot enviado).

## Causa

O modal de conclusão em `SpotlightOverlay.tsx` usa:
- `fixed inset-0` cobrindo a tela inteira
- `backdrop-blur-sm` (filtro de blur na backdrop)
- `z-[300]`, acima do header `sticky top-0 z-50`

No iOS Safari, a combinação `backdrop-filter: blur` + elemento `position: sticky` na mesma viewport causa um bug de repintura: ao desmontar o backdrop (animação de exit do `AnimatePresence`), o header sticky fica "perdido" por alguns frames até o Safari refazer o layout.

## Solução

Ajustar o modal de conclusão para não disparar o bug, sem mudar o comportamento visual percebido:

1. **Remover `backdrop-blur-sm`** da backdrop — manter só `bg-background/70` (escurece sem causar repinturas problemáticas em elementos sticky).
2. **Trocar o exit animation por algo instantâneo** — `exit={{ opacity: 0 }}` com `transition={{ duration: 0.15 }}` para não deixar o backdrop "pairando" sobre o header durante o fade-out.
3. **Garantir desmontagem limpa**: ao clicar em "Entendi", setar `showCompletion = false` e o `AnimatePresence` cuida do unmount rápido.

Esses três ajustes eliminam o gatilho do bug de repintura mantendo a aparência do modal idêntica enquanto está aberto.

## Arquivo afetado

- `src/components/onboarding/SpotlightOverlay.tsx` — apenas a JSX do `completionModal` (linhas ~186-220 aprox).

## Fora do escopo

- Não mexer no design do modal (já foi aprovado).
- Não mexer em outros módulos do tutorial — a correção é no componente compartilhado e se aplica a todos os 4 (finanças, rotina, dieta, treino) automaticamente.
- Não mexer no app padrão (modal só roda dentro do tutorial).
