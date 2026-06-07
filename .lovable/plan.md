## Plano

Auditoria completou: a maior parte já foi removida no turno anterior (viewport sem `user-scalable=no`/`maximum-scale`, listeners de `gesturestart/change/end`, `wheel` ctrl, atalhos de zoom, e `html { touch-action: pan-x pan-y }`).

Restam apenas duas regras `touch-action: manipulation` em `src/index.css`:

- linha 243 → na classe `.notion-tab`
- linha 582 → no seletor `input, textarea, select, button, a, [role="button"], label`

Tecnicamente `manipulation` ainda permite pinch-zoom (ele só desativa double-tap zoom), mas como você pediu para remover qualquer `touch-action: manipulation`, vou tirar as duas. Assim o padrão fica `touch-action: auto` em tudo.

### Mudanças

1. `src/index.css` linha ~243 — remover `touch-action: manipulation;` da `.notion-tab`.
2. `src/index.css` linha ~582 — remover o bloco inteiro de `touch-action: manipulation` aplicado a `input, textarea, select, button, a, [role="button"], label`.

### Não vou mexer

- Layout, design, cores, componentes, fluxo, textos.
- `overflow: hidden` da linha 522 (escopo de classe utilitária, não global em `html/body`).
- Nenhum bloqueador de touch global resta no JS — `src/main.tsx` já está limpo.
- Viewport do `index.html` já está correta: `width=device-width, initial-scale=1.0, viewport-fit=cover`.

Resultado: pinça funciona em qualquer ponto da tela, inclusive no meio, em Safari iOS, Chrome iOS/Android e web normal.