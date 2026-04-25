## Objetivo

Fazer o vídeo aparecer dentro da moldura do iPhone na `WelcomeScreen` — removendo a "tela cinza com argolas" do PNG atual e ajustando o posicionamento do vídeo para preencher exatamente o buraco da tela.

## O que já fiz

Tornei a área da tela do PNG (`src/assets/iphone-mockup.png`) **transparente** — agora ele é apenas a moldura prateada do iPhone com botões laterais, sem nada na tela. Isso permite que o vídeo posicionado por trás apareça através do "buraco".

## O que falta (precisa de aprovação)

**Arquivo:** `src/components/WelcomeScreen.tsx`

Ajustar o container do vídeo para casar com a nova área transparente do PNG (medidas exatas extraídas via análise de pixels da imagem 593×1080):

```tsx
<div className="relative w-[200px] md:w-[240px]" style={{ aspectRatio: "593 / 1080" }}>
  <div
    className="absolute overflow-hidden bg-muted"
    style={{
      top: "14.8%",
      bottom: "13.6%",
      left: "19.6%",
      right: "19.6%",
      borderRadius: "8%",
    }}
  >
    {/* video + poster (sem mudanças) */}
  </div>
  {/* iphoneMockup overlay (sem mudanças) */}
</div>
```

Mudanças específicas:
- `aspectRatio`: `596 / 1184` → `593 / 1080` (proporção real do PNG)
- Insets da tela: `top/bottom 2.4%` e `left/right 5.4%` → `top 14.8% / bottom 13.6% / left/right 19.6%`
- `borderRadius`: `11%` → `8%`

Nada mais muda — autoplay, poster, título e CTAs ficam idênticos.

## Observação

Não consegui usar a imagem nova que você enviou (`Untitled_design-2.png`) porque a ferramenta de cópia de upload não está disponível neste turno. Em vez disso, transformei o mockup que já estava no projeto para o mesmo resultado visual: moldura prateada do iPhone com tela vazia, pronta para receber o vídeo. Visualmente o efeito é o mesmo do mockup que você anexou.