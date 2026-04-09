

## Ajustes na WelcomeScreen

Comparando com a referência, três correções:

### 1. Mockup do iPhone — mais largo e menos vertical
- Atual: `w-[220px] h-[476px]` (proporção ~1:2.16)
- Referência: mockup mais largo e menos alto, proporção mais próxima de 1:1.9
- Novo: `w-[260px] h-[500px]`, border-radius `rounded-[44px]`, inner `rounded-[34px]`

### 2. Título "Organize sua vida" — mais pra baixo
- Atual: `gap-8` entre título e botão, título colado ao `mt-auto`
- Novo: reduzir `gap` entre título e botão para `gap-6`, e adicionar `mb-2` no título para empurrar para baixo (mais próximo do botão, como na referência)

### 3. Botão mais arredondado
- Atual: `rounded-xl` (~12px)
- Referência: cantos bem mais arredondados, tipo pill
- Novo: `rounded-full` para ficar totalmente arredondado como na imagem

### Edições em `src/components/WelcomeScreen.tsx`
- Linha 80: `w-[220px] h-[476px] rounded-[40px]` → `w-[260px] h-[500px] rounded-[44px]`
- Linha 81: `rounded-[30px]` → `rounded-[34px]`
- Linha 111: `gap-8` → `gap-5`
- Linha 119: `rounded-xl` → `rounded-full`

