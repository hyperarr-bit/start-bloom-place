# Corrigir os vídeos da landing page

## O que está errado (análise técnica dos arquivos)

Analisei os dois arquivos de vídeo hospedados no CDN e encontrei problemas concretos:

1. **Vídeo da Rotina (15 MB)**: o índice do vídeo (`moov atom`) está no **final do arquivo**. Isso significa que o navegador precisa baixar praticamente os 15 MB inteiros antes de conseguir começar a reproduzir. Em rede móvel (Safari, Chrome, navegador do TikTok) isso aparece como vídeo "morto"/preto que nunca toca. No preview do desktop com internet rápida ele funciona — por isso parecia OK antes.
2. **Vídeo de Finanças**: usa perfil de cor `yuvj420p` (full-range) + profile High, que tem compatibilidade irregular em alguns players móveis (especialmente WebViews como o do TikTok).
3. **Peso**: 15 MB é pesado demais para um card de landing page mobile.

## O que vou fazer

1. **Re-encodar os dois vídeos** com configuração universalmente compatível:
   - H.264 profile Main, `yuv420p`, `+faststart` (índice no início → começa a tocar imediatamente, em streaming)
   - Compressão para reduzir o vídeo da Rotina de 15 MB para algo em torno de 3–5 MB sem perda visível
   - Remover faixa de áudio (os vídeos tocam mudos de qualquer forma — áudio bloqueia autoplay em WebViews)
2. **Re-upload para o CDN** e atualizar os dois `.asset.json`
3. **Ajustar as tags `<video>`** na landing page:
   - Adicionar `poster` (primeiro frame como imagem) para nunca aparecer um quadrado preto enquanto carrega
   - Manter `autoPlay + muted + playsInline + loop`
4. **Verificar no navegador** (preview mobile 430px) que ambos os vídeos carregam e tocam

## Detalhes técnicos

- Re-encode com ffmpeg: `-c:v libx264 -profile:v main -pix_fmt yuv420p -movflags +faststart -an -crf 26`
- Upload via `lovable-assets create`, sobrescrevendo os pointers `financas-preview.mp4.asset.json` e `rotina-preview.mp4.asset.json`
- Extrair o primeiro frame de cada vídeo como JPG para usar de `poster`
- Arquivo alterado: `src/pages/lp/LandingPage.tsx` (apenas os atributos das tags `<video>`)