## Problema observado no vídeo

No iPhone real (430×697), ao abrir/recarregar a tela inicial:
1. **Bug do texto solto no topo**: por uma fração de segundo, o texto "Organize sua vida em um só lugar" + os botões aparecem encostados no topo da tela, sem o iPhone, antes do layout finalizar.
2. **iPhone ficou menor e com borda mais grossa** do que estava antes da última alteração.

## Causa

Na última edição introduzimos no mobile:
- `max-width: min(78vw, 250px)` no `.iphone-frame` (antes era `78vw` sem cap → ~335px no iPhone Pro). Isso encolheu o mockup e visualmente "engrossou" a borda relativa.
- Grid `grid-rows-[minmax(0,1fr)_auto]` com a célula do iPhone usando `h-full` + `clamp(300px, 54svh, 600px)`. Combinado com a regra `!important` no CSS de `height: min(54svh, 430px)`, em alguns frames iniciais (antes do `svh` resolver / video poster carregar) a célula colapsa e o texto sobe.
- A regra `@media (max-width: 767px) .iphone-frame { ... !important }` está sobrescrevendo o estilo inline do componente, criando inconsistência entre o que o JSX pede e o que renderiza.

## O que vou fazer

### 1. `src/index.css` — remover overrides agressivos do iPhone

Remover o bloco de media query que encolhe o frame e o cap de 250px:

```text
remover:
@media (max-width: 767px) {
  .iphone-frame {
    height: min(54svh, 430px) !important;
    max-width: min(78vw, 250px) !important;
  }
}
```

Manter as melhorias de clipping (`contain: paint`, `isolation`, `mask-image`, `border-radius: inherit` no video/img) que resolvem o "branco na borda" no PC.

### 2. `src/components/WelcomeScreen.tsx` — voltar dimensões originais do iPhone

Reverter os valores inline para os de antes:

```text
height:  "min(60vh, 600px)"   (antes era 60vh, não 54svh)
maxWidth: "78vw"              (sem cap de 360px)
```

### 3. Corrigir o "texto pulando para o topo" sem reintroduzir o bug do iPhone sumido

Causa real do flash: o container externo é `justify-between` num `flex flex-col`, então enquanto o filho intermediário (grid com iPhone) ainda não tem altura medida, o segundo bloco sobe.

Solução:
- Trocar `justify-between` por `justify-center` no wrapper externo (`fixed inset-0 ... flex flex-col`), já que só há um filho de conteúdo.
- Garantir que o grid mobile reserve espaço para o iPhone com `grid-rows-[1fr_auto]` (sem `minmax(0,1fr)` que permite colapso a 0) e a célula do iPhone com `min-height: 0` mas `align-self: stretch`.
- Manter `initial={false}` nas animações (já está) para que tudo apareça junto no primeiro frame, sem fade-in escalonado que acentua o "pulo".

### 4. Validação

- Testar em 430×697 (iPhone Pro Max) e 375×812 (iPhone padrão): iPhone deve aparecer no mesmo tamanho de antes (mais largo, borda relativa fina), texto e botões abaixo, sem flash do texto no topo.
- Confirmar que o clipping arredondado do vídeo continua perfeito no desktop (sem branco nas bordas).

## Arquivos alterados

- `src/components/WelcomeScreen.tsx`
- `src/index.css`
