## Problema

Ao clicar em "Meu Financeiro" estando em "Dashboard", a aba pisca rapidamente assim:
1. mostra Financeiro (clique aplica)
2. volta pra Dashboard (flash)
3. vai pra Financeiro

Isso só acontece com o tutorial (SpotlightOverlay) ativo — usuários convidados/novos.

## Causa raiz

Em `src/components/onboarding/SpotlightOverlay.tsx`, o `useEffect` que dispara `onEnter` do passo atual (linhas 61–72) tem `steps` no array de dependências:

```ts
useEffect(() => {
  // ...
  try { cur.onEnter?.(); } catch {}
}, [active, stepIdx, steps, moduleKey]);
```

O array `steps` é recriado a cada render do `Index` (literal inline em `<SpotlightOverlay steps={[...]} />`). Quando o usuário clica na tab "Meu Financeiro":

1. `setActiveTab("financeiro")` → render do Index → nova referência de `steps` → `Index` re-renderiza.
2. O `useEffect` do Spotlight reexecuta porque `steps` mudou de referência, mesmo com `stepIdx` igual a 0.
3. O `onEnter` do passo 0 (`() => setActiveTab("dashboard")`) dispara novamente → volta pra Dashboard (flash).
4. 250 ms depois, o listener de clique do overlay chama `advance()` → `stepIdx` vira 1 → roda `onEnter` do passo 1 (`setActiveTab("financeiro")`) → vai pra Financeiro.

## Correção

Em `src/components/onboarding/SpotlightOverlay.tsx`, fazer o efeito que executa `onEnter` depender apenas de `active` e `stepIdx`, lendo o passo via `stepsRef.current` (já existe). Assim o `onEnter` roda exatamente uma vez quando o passo muda, não a cada re-render do pai.

```ts
useEffect(() => {
  if (!active) return;
  const cur = stepsRef.current[stepIdx];
  if (!cur) return;
  trackEvent("spotlight_step_view", { module: moduleKey, step: stepIdx, total: stepsRef.current.length, label: cur.label });
  try { cur.onEnter?.(); } catch {}
}, [active, stepIdx, moduleKey]);
```

Nenhuma outra mudança necessária. Não toco em `Index.tsx`.
