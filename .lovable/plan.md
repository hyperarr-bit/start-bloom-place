

# Corrigir layout para desktop

## Problemas identificados

### 1. WelcomeScreen: botões invisíveis no desktop
- O layout usa `justify-start` com `pt-8` e o frame do iPhone ocupa 476px de altura fixa
- No desktop, o conteúdo (frame + título + botões) ultrapassa a viewport e os botões ficam abaixo do fold
- A tela não se adapta a viewports maiores

### 2. Home: conteúdo muito estreito no desktop
- Usa `max-w-lg` (512px), desperdiçando espaço lateral em telas maiores
- Widgets, módulos e ações ficam comprimidos

### 3. Módulos com `max-w-2xl` (672px) muito estreitos no desktop
Páginas afetadas: **Beleza, Detox, Relacionamentos, Biblioteca, Hiperfoco, Pet, Planos, AdminAnalytics**

### 4. Módulos com `max-w-5xl` (1024px) - aceitáveis
Páginas: **Viagens, Treino, Estudos, Carreira, Dev. Pessoal** -- estes estão OK.

### 5. Finanças já usa `max-w-7xl` -- OK

---

## O que vou implementar

### WelcomeScreen (`src/components/WelcomeScreen.tsx`)
- Mudar layout para `justify-center` no desktop (em vez de `justify-start`)
- Reduzir o tamanho do frame do iPhone em telas menores ou usar layout side-by-side no desktop (frame à esquerda, texto + botões à direita)
- Alternativa mais simples: escalar o frame proporcionalmente com `max-h` e garantir que botões fiquem sempre visíveis

### Home (`src/pages/Home.tsx`)
- Trocar `max-w-lg` por `max-w-lg md:max-w-4xl` para usar mais espaço no desktop
- Opcionalmente: grid de 2 colunas para widgets no desktop

### 8 páginas de módulos: `max-w-2xl` → `max-w-5xl`
Arquivos a alterar (substituição simples):
- `src/pages/Beleza.tsx`
- `src/pages/Detox.tsx`
- `src/pages/Relacionamentos.tsx`
- `src/pages/Biblioteca.tsx`
- `src/pages/Hiperfoco.tsx`
- `src/pages/Pet.tsx`
- `src/pages/Planos.tsx`
- `src/pages/AdminAnalytics.tsx`

Em cada um, trocar todas as ocorrências de `max-w-2xl` por `max-w-5xl`.

---

## Arquivos alterados
- `src/components/WelcomeScreen.tsx` -- layout responsivo desktop
- `src/pages/Home.tsx` -- largura do container
- 8 páginas de módulos -- `max-w-2xl` → `max-w-5xl`

Total: 10 arquivos, alterações simples e consistentes.

