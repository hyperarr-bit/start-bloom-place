## Bug

Na rota `/inicio` em iPhone (Safari iOS), o mockup + textos ficam comprimidos no topo e há uma faixa grande de fundo claro entre o botão "Começar" e a barra de URL do Safari. A landing parece "quebrada".

## Causa

`src/components/WelcomeScreen.tsx`:
- Container usa `fixed inset-0` → ocupa o **small viewport** do Safari iOS (com address bar visível).
- Mockup do iPhone usa `height: min(60vh, 600px)` → `vh` no iOS refere o **large viewport** (sem address bar). Resultado: o mockup é menor do que o esperado pra área disponível, e o `flex justify-between` + `flex-1` deixa sobra visível embaixo.
- Faltam paddings respeitando safe-area do iOS.

## Correção (apenas `src/components/WelcomeScreen.tsx`)

1. Trocar a unidade do mockup de `vh` para `dvh` (dynamic viewport height — coincide com o `fixed inset-0`):
   - `height: "min(60dvh, 600px)"` em vez de `min(60vh, 600px)`.
2. No container raiz:
   - Adicionar `min-h-[100dvh]` como fallback e usar `style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))", paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}` para respeitar a notch/home indicator.
3. Ajustar a estrutura interna: trocar `justify-between` por `justify-center` no wrapper externo (já que só há um filho `flex-1`), evitando layout estranho quando a altura disponível muda dinamicamente conforme o Safari mostra/esconde a barra de URL.
4. Aumentar levemente o tamanho mínimo do mockup em telas estreitas: usar `height: "min(62dvh, 620px)"` e `maxWidth: "82vw"` para ocupar melhor a área visível em iPhones.

Nada muda em `/auth`, no resto do app, nem nos assets do vídeo.

## Resultado

- `/inicio` no iOS Safari: mockup + título + CTA centralizados verticalmente sem faixa morta embaixo, mesmo quando a barra de URL aparece/some.
- Nenhum impacto em desktop ou em `/auth`.

Posso aplicar?