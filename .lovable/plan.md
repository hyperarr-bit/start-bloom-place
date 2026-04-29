## Bug identificado

Olhando frame a frame do vídeo em câmera lenta:

- **Frames 1–6**: tela completamente vazia (cor creme), só a barra de URL embaixo.
- **Frames 7–17**: o título "em um só lugar" e o **topo** do iPhone aparecem **bem no alto** e vão **deslizando de cima para baixo**.
- **Frame 21+**: tudo finalmente chega na posição correta.

Ou seja, a tela `/auth` (que renderiza o `WelcomeScreen`) está envolvida pelo `PageTransition` no `App.tsx`, que aplica `initial={{ opacity: 0, y: 12 }}`. Em condições normais isso é um slide curto e sutil de 300ms, mas combinado com:
1. O fundo creme já pintado pelo `index.html` antes do React montar
2. O delay até o JS processar e renderizar o componente

…cria a sensação de que a tela "carrega vazia e depois desce do topo".

## Correção

**`src/App.tsx`** — não envolver a rota `/auth` no `PageTransition`. Renderizar `<Auth />` direto, sem o wrapper de slide. As outras rotas continuam com o efeito normal.

```tsx
// antes
<Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />

// depois
<Route path="/auth" element={<Auth />} />
```

Resultado: o `WelcomeScreen` aparece de uma vez, sem nenhum slide nem fade. A tela creme inicial continua existindo (é normal — é o tempo do React montar), mas não vai mais "descer". Posso aplicar?