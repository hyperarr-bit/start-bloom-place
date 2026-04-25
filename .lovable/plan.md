## Objetivo

Substituir o mockup CSS atual do iPhone na `WelcomeScreen` por um mockup PNG realista (com botões laterais, Dynamic Island, bordas finas e moldura prateada estilo iPhone 15 Pro), mantendo o vídeo `app-preview.mp4` tocando dentro da tela.

## O que muda

**Arquivo:** `src/components/WelcomeScreen.tsx`

A estrutura visual atual é apenas uma `div` arredondada preta (`#1a1a1a`) com padding — não tem botões, nem Dynamic Island, e o raio é genérico. Vou trocar por um **frame PNG transparente** sobreposto, com o vídeo posicionado por trás na área da tela.

## Implementação

1. **Salvar a imagem anexada** como asset do projeto:
   - `src/assets/iphone-mockup.png` (importada via ES6 module)

2. **Refatorar o frame no `WelcomeScreen.tsx`**:
   - Container externo com a proporção da imagem (≈ 596×1184 → aspect ratio ~1:1.99).
   - Camada 1 (fundo, z-0): `<video>` posicionado absolutamente na **área interna da tela** do mockup (insets calculados em %, aprox. `top: 2.4%`, `bottom: 2.4%`, `left: 5.4%`, `right: 5.4%`, com `border-radius` ~12% para acompanhar o canto da tela do iPhone).
   - Camada 2 (frente, z-10): `<img src={iphoneMockup}>` cobrindo 100% do container, `pointer-events-none`, fornecendo a moldura, botões laterais e Dynamic Island.
   - Poster da `<video>` continua aparecendo até o vídeo começar a tocar (mantém a lógica de `videoState`).

3. **Tamanhos responsivos** (mantém o layout atual):
   - Mobile: `w-[200px]` (altura proporcional ~398px)
   - Desktop (`md:`): `w-[240px]` (altura ~478px)
   - Removidas as classes `bg-[#1a1a1a]`, `p-[10px]`, `rounded-[40px]` e a barra inferior simulada — tudo isso passa a vir da imagem PNG.

4. **Sem mudanças** em: lógica de autoplay, fallback de poster, props (`onComplete`, `onLogin`), título e CTAs ao lado.

## Detalhes técnicos

- A imagem anexada tem fundo branco/transparente em volta do iPhone — vou copiá-la como está; se o fundo aparecer não-transparente no preview, removo o branco com um filtro/edição posterior.
- Os insets exatos da área da tela serão ajustados após render visual (faço QA via screenshot do preview e refino os percentuais se necessário).
- Não mexe em nenhum outro arquivo do projeto.