## O que fazer

Três ajustes na tela inicial (`WelcomeScreen`):

### 1. Remover faixa cinza restante no topo do mockup ✅ (já feito)

Identifiquei via análise de pixels uma faixa cinza (~RGB 215) entre y=145 e y=157 do PNG, presa entre dois bandas pretas — era um reflexo do bezel do iPhone que sobrava após a primeira limpeza. Já estendi o recorte transparente para começar em y=145 (antes era y=160). O PNG agora mostra apenas a moldura prateada com o "buraco" totalmente vazio no formato da tela.

### 2. Ajustar insets + aumentar tamanho do iPhone

**Arquivo:** `src/components/WelcomeScreen.tsx` (linhas 82-92)

```tsx
<div className="relative w-[240px] md:w-[290px]" style={{ aspectRatio: "593 / 1080" }}>
  <div
    className="absolute overflow-hidden bg-muted"
    style={{
      top: "13.4%",
      bottom: "13.4%",
      left: "19.6%",
      right: "19.6%",
      borderRadius: "9%",
    }}
  >
```

Mudanças:
- Largura: `200px → 240px` (mobile) e `240px → 290px` (desktop) — ~20% maior.
- `top`: `14.8% → 13.4%` (acompanha o novo recorte do PNG).
- `borderRadius`: `8% → 9%`.

### 3. Garantir autoplay do vídeo

O `<video>` já tem `autoPlay muted playsInline preload="auto"` — tecnicamente o browser deve tocar automaticamente. O usuário relata que está pausado. Suspeitas:
- O **poster (`<img>`)** sobreposto com `z-10` pode estar sendo percebido como "vídeo pausado", pois ele só some quando o estado vira `"playing"` (via `onPlaying`). Se o evento não disparar (ex: frame inicial demora), o usuário vê o poster estático.

Mitigações que vou aplicar:
- Adicionar `onCanPlay` e `onLoadedData` que também tentam `video.play()` e marcam estado como `"playing"`.
- Adicionar fallback: se após 1.5s o vídeo não estiver tocando, esconder o poster mesmo assim (pois ele está cobrindo o vídeo que pode estar tocando silenciosamente).

Trecho relevante:
```tsx
onCanPlay={() => attemptPlay()}
onLoadedData={() => attemptPlay()}
// useEffect adicional:
useEffect(() => {
  const t = setTimeout(() => {
    const v = videoRef.current;
    if (v && !v.paused) setVideoState("playing");
  }, 1500);
  return () => clearTimeout(t);
}, []);
```

## Resultado esperado

iPhone maior, sem nenhum cinza/borda dentro da moldura, vídeo tocando assim que carrega.