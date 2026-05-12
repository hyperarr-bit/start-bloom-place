## Problema

No modo PWA (instalado), o conteúdo fica embaixo do Dynamic Island/notch porque o `index.html` usa `apple-mobile-web-app-status-bar-style = black-translucent` — isso diz ao iOS para deixar a webview ocupar a tela inteira, sem reservar espaço. No navegador (web) o iOS já reserva o espaço da barra, por isso fica certo.

A correção é fazer o app respeitar a área segura (`env(safe-area-inset-*)`) para que os headers fixos (sticky) e o topo da página não fiquem cobertos pela ilha dinâmica.

## Mudanças

1. **`index.html`**
   - Trocar `apple-mobile-web-app-status-bar-style` de `black-translucent` para `default` — assim, mesmo em PWA, o iOS reserva o espaço da status bar / Dynamic Island (igual ao web).
   - Manter `viewport-fit=cover` (já está).

2. **`src/index.css`** (fallback global)
   - Adicionar padding de safe-area no `body` (top/left/right/bottom) usando `env(safe-area-inset-*)` para garantir que nada fique sob a ilha mesmo se o iOS interpretar diferente.
   - Como alternativa mais segura: aplicar `padding-top: env(safe-area-inset-top)` apenas em headers `sticky top-0` via uma utilitária `.safe-top`, sem alterar o body (evita quebrar layouts internos).

3. **Headers fixos (`sticky top-0`)** — Index.tsx (Finanças) e demais páginas
   - Adicionar a classe `safe-top` no header sticky para que a barra colorida desça abaixo da ilha dinâmica no PWA. Aplicar nos headers de páginas principais que usam `sticky top-0` (Finanças, Home, etc.).

## Resultado esperado

- No PWA instalado, o header e o conteúdo iniciam abaixo do Dynamic Island/notch (mesmo comportamento da imagem 2 — versão web).
- Sem mudança visível no navegador comum.

## Arquivos a modificar

- `index.html` — meta tag status-bar-style
- `src/index.css` — utility `.safe-top` (e opcional safe-area no body)
- `src/pages/Index.tsx` (Finanças) + outras páginas com `sticky top-0` no header — adicionar classe `safe-top`
