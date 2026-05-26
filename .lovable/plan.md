Animação sutil no mockup da tela inicial + fallback de imagem

## Contexto
O `WelcomeScreen.tsx` exibe um mockup de app via imagem WebP (`financas-mockup.webp`). O componente `AnimatedAppMockup.tsx` já existe no projeto e renderiza um mockup animado em SVG/CSS com 3 telas (Home, Finanças, Dieta).

## Objetivo 1: Animação sutil no mockup
Adicionar um efeito de "float" sutil (movimento vertical suave) e leve scale-in na entrada do mockup, usando o framer-motion já importado.

- Aplicar `animate` com ciclo de `y: [0, -8, 0]` e `transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }` no container do mockup.
- Manter o `initial/animate` existente de fade-in (opacidade + y) para a entrada.

## Objetivo 2: Fallback caso a imagem não carregue
Criar um estado `imgError` com `useState`. No `<img>`, adicionar `onError={() => setImgError(true)}`. Se `imgError === true`, renderizar o `<AnimatedAppMockup />` no lugar da `<img>`. Isso reaproveita o componente SVG/CSS existente, que é leve e não depende de imagem externa.

## Arquivos modificados
- `src/components/WelcomeScreen.tsx` — animação no container + fallback
- `src/components/welcome/AnimatedAppMockup.tsx` — importado como fallback (sem alterações)

## Checklist
- [ ] Animação de float sutil aplicada ao mockup
- [ ] Estado de erro implementado no `<img>`
- [ ] Renderização condicional do AnimatedAppMockup como fallback
- [ ] Testar no preview para verificar fluidez da animação