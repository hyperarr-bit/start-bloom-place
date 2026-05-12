## O que adicionar

Ao terminar o tutorial guiado de qualquer módulo (Finanças, Rotina, Dieta, Treino), exibir um card de conclusão por cima da tela explicando que o usuário deve clicar na seta de voltar (no topo da página) para escolher outro módulo.

## Comportamento

1. Quando o último passo do `SpotlightOverlay` for concluído (caminho `completed`, não `dismissed`), em vez de simplesmente sumir, mostrar um card centralizado com:
   - Ícone de check / celebração
   - Título: "Tutorial concluído! 🎉"
   - Texto curto: "Agora toque na seta ← no canto superior esquerdo para voltar ao início e explorar outro módulo."
   - Uma seta animada apontando para o canto superior esquerdo (onde fica o botão de voltar das páginas de módulo).
   - Botão "Entendi" que fecha o card.
2. O flag `spotlight-done-{module}` continua sendo gravado imediatamente (o tutorial não reaparece). Só a UI do card permanece visível até o usuário fechar.
3. Fechar também ao clicar no backdrop semi-transparente.

## Onde mexer

- `src/components/onboarding/SpotlightOverlay.tsx`
  - Novo estado `showCompletion`.
  - No `finish("completed")`: gravar flags como hoje, mas em vez de `setActive(false)` direto, ativar `showCompletion` e esconder o spotlight (rect/bubble).
  - Renderizar overlay de conclusão (card + seta animada apontando para o topo-esquerdo) usando os mesmos tokens do design system (`bg-card`, `border-border`, `text-primary`, etc.).
  - `dismissed` (caso futuro) continua fechando direto.

Sem mudanças em `Home.tsx`, `Index.tsx`, `Rotina.tsx`, `Dieta.tsx`, `Treino.tsx` — todos já usam o componente `SpotlightOverlay` e herdam o novo comportamento automaticamente.