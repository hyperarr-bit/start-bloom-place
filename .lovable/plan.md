## Objetivo

Estender o comportamento padronizado de header (safe-area do notch + glassmorphism + scroll dinâmico) para:

1. **Página Home** (`src/pages/Home.tsx`) — hoje não tem `<header sticky>`, então não pega o tratamento global.
2. **PWA standalone (iOS/Android instalado)** — validar que o notch fica coberto e o scroll dinâmico funciona.

## Mudanças

### 1. `src/pages/Home.tsx`

Envolver o `GreetingHeader` (linha 178) num `<header className="sticky top-0 z-40">` para automaticamente herdar:
- Padding-top de safe-area (cobre o notch)
- Fundo glassmorphism (`bg-card/78` + blur)
- Comportamento de scroll dinâmico (título colapsa ao descer)

Estrutura:
```tsx
<header className="border-b border-border bg-card sticky top-0 z-40">
  <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-3">
    <GreetingHeader ... />
  </div>
  {/* sem 2º filho (sem abas) → CSS não impacta */}
</header>
```

Ajustar o container externo (`max-w-lg ... py-5`) para remover o `py-5` superior (o header agora tem seu próprio padding) — manter só `pt-4` no conteúdo abaixo.

### 2. `src/index.css`

Garantir que o seletor cobre headers sem segundo filho (tabs). Já cobre — o CSS atual age sobre `> div:first-child` e isso vai colapsar o GreetingHeader inteiro ao descer. Isso é o comportamento desejado pelo usuário: "Título some, [Abas se houver] ficam, e tudo volta no Scroll Up".

Ajuste pequeno: aumentar `max-height` do primeiro filho de `4rem` para `6rem`, porque o GreetingHeader tem 2 linhas (saudação + mensagem contextual). Sem isso o título da Home apareceria cortado.

### 3. Validação PWA

Já foi adicionado:
- `body { padding-top: env(safe-area-inset-top) }` em standalone mode.
- `header.sticky.top-0 { margin-top: calc(-1 * env(safe-area-inset-top)) }` para puxar o header pra cima e cobrir o notch.
- `apple-mobile-web-app-status-bar-style="black-translucent"` no `index.html`.

Verificar visualmente:
- Abrir Preview em viewport mobile.
- Confirmar Home + um módulo (Finanças) com header coberto pelo blur ao scroll.

## Não inclui

- Não mexer nas demais 16 páginas (já funcionam pelo CSS global).
- Não adicionar libs novas.
- Não tocar em conteúdo/lógica da Home.
