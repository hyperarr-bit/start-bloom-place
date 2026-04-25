# Corrigir bordas cinzas e bug do iPhone na WelcomeScreen

## Diagnóstico

Inspecionei o PNG `src/assets/iphone-mockup.png` e o screenshot. Dois problemas:

1. **Margem transparente externa no PNG**: o conteúdo visível do iPhone vai de (98,131) até (496,949) num canvas de 593×1080. Sobravam ~98px de transparência à esquerda, ~97px à direita, ~131px no topo e ~131px embaixo. Isso fazia o `aspectRatio: 593/1080` desperdiçar espaço e desalinhar com o container do vídeo.

2. **Tela interna mostrando faixas brancas/cinzas**: o container do vídeo usa `bg-muted` (cinza claro no light mode). Quando o vídeo (16:9 ou similar) é colocado num retângulo alto e estreito, sobram faixas — essas faixas aparecem cinzas. Também os insets antigos (~13.4%/19.6%) eram calculados sobre o canvas com margem, então não fechavam direito após o crop.

## Correções

### 1. Recortar o PNG para o bbox real (já executado)

PNG agora é 398×818 (sem margem transparente externa). Novos insets reais da área transparente da "tela":
- top/bottom: ~1.6%
- left/right: ~4.3%

### 2. Atualizar `src/components/WelcomeScreen.tsx`

- Trocar `aspectRatio: "593 / 1080"` por `"398 / 818"` (proporção real do PNG recortado).
- Ajustar os insets do container interno do vídeo para os novos valores reais:
  - Mobile: `top/bottom: 1.6%`, `left/right: 4.3%`, `borderRadius: 11%` (corner radius proporcional do iPhone agora que o quadro é menor)
  - Desktop: mesmos valores (não há mais necessidade de variação fina)
- Trocar `bg-muted` por `bg-black` no container do vídeo (qualquer faixa que sobrar fica preta como uma TV/iPhone real, não cinza claro chamativo).
- Adicionar `bg-black` também no `<video>` para evitar flash branco antes do primeiro frame.

### Resultado esperado

- iPhone preenche o espaço com proporção correta, sem sobras transparentes
- Sem faixas cinza/branca ao redor da tela do iPhone (top/bot/left/right)
- Vídeo encaixado exatamente dentro da moldura

## Arquivos afetados

- `src/assets/iphone-mockup.png` — já recortado (398×818)
- `src/components/WelcomeScreen.tsx` — atualizar `aspectRatio`, insets e cor de fundo
