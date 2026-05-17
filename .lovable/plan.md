## Mudança

Substituir o card de conclusão de tutorial (overlay com backdrop + seta animada) por um **toast discreto via sonner**, que aparece logo abaixo do header e não bloqueia a seta de voltar real.

## Comportamento

Quando o último passo do tutorial é concluído (`finish("completed")`):

1. Gravar `spotlight-done-{module}` e limpar `quickstart-target-module` (igual hoje).
2. Disparar:
   ```ts
   toast.success("Tutorial concluído! 🎉", {
     description: "Toque na seta ← no topo para explorar outro módulo.",
     duration: 6000,
   });
   ```
3. `setActive(false)` imediatamente — sem overlay, sem backdrop, sem seta animada. A seta de voltar real continua visível e clicável.

## Onde mexer

- `src/components/onboarding/SpotlightOverlay.tsx`
  - Remover estado `showCompletion` e todo o bloco JSX do card de conclusão (incluindo `ArrowUpLeft`, `CheckCircle2`, `Button` se não forem mais usados).
  - No callback `finish`, no ramo `"completed"`: chamar `toast.success(...)` (importar de `sonner`) e `setActive(false)`.
  - Limpar imports não usados.

Sem mudanças em outros arquivos — `<Toaster />` do sonner já está montado no root.