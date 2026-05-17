## Objetivo
Tornar o header **fixo** (sempre visível) na home inicial e em todos os módulos, removendo o comportamento de colapso ao rolar.

## Mudanças

### 1. `src/index.css`
Remover o bloco de header colapsável que faz o `translateY` quando `body[data-scroll-dir="down"]`. Manter apenas:
- `header.sticky.top-0` com `position: sticky; top: var(--app-safe-top); z-index: 40;` (sem `transform`, sem `transition`).
- Remover a regra `body[data-scroll-dir="down"] header.sticky.top-0 { transform: ... }`.
- Remover a regra `prefers-reduced-motion` associada.

### 2. `src/App.tsx`
- Remover `useScrollDirection()` do `AppShell` (não é mais necessário).
- Remover import de `useScrollDirection`.

### 3. `src/hooks/use-scroll-direction.ts`
- Excluir o arquivo (sem outros consumidores).

## Resultado
- Header permanece sempre visível, ancorado logo abaixo da safe-area do topo (notch/horário/bateria).
- Funciona igual em Web, PWA, iPhone e Android.
- Safe-area global preservada (sem mudanças no guard nem no `app-safe-shell`).