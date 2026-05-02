## Problema

Pediu um "estado de carregamento mínimo no WelcomeScreen". Mas a tela vazia que aparece nos primeiros frames acontece **antes** do React montar — quando só existe `<div id="root"></div>` no HTML. Qualquer loader dentro do componente `WelcomeScreen` (React) só renderiza depois do bundle baixar/parsear/montar, então não resolve a janela em branco.

A solução correta é colocar um placeholder estático **dentro do `#root` no `index.html`**, que é pintado instantaneamente pelo navegador no primeiro frame. Quando o React monta, ele substitui esse conteúdo pelo `WelcomeScreen` real.

## Mudanças

### 1. `index.html`
Colocar dentro de `<div id="root">` um placeholder mínimo que combine com o visual do WelcomeScreen:
- Fundo já está pintado (`--background` aplicado no `<html>` pelo script inline existente).
- Adicionar um spinner/loader centralizado discreto (CSS puro, sem JS), ou apenas o título "CORE" com fade sutil.
- Recomendo: pequeno spinner CSS centralizado + opacidade 60% para não competir visualmente com o WelcomeScreen quando ele aparecer.

```html
<div id="root">
  <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;">
    <div style="width:24px;height:24px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;opacity:.3;animation:core-spin .8s linear infinite;"></div>
  </div>
</div>
<style>@keyframes core-spin{to{transform:rotate(360deg)}}</style>
```

O React faz `createRoot(...).render(...)` que substitui completamente o conteúdo do `#root`, então o placeholder some automaticamente sem flicker quando o `WelcomeScreen` monta.

### 2. `src/components/ProtectedRoute.tsx` (opcional, mesma lógica)
Já tem placeholder vazio quando `loading=true`. Posso adicionar o mesmo mini-spinner para consistência, mas não é estritamente necessário porque o caminho do usuário não-logado redireciona pra `/auth` que mostra o WelcomeScreen.

## Resultado

- Frame 1: navegador pinta fundo creme + spinner discreto centralizado (instantâneo).
- Frame N (quando React monta, ~100-300ms): WelcomeScreen aparece estático, substituindo o spinner.
- Sem tela completamente vazia em momento algum.

Posso aplicar?