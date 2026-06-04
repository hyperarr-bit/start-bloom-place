## Mudanças em `src/components/AccessGateUI.tsx`

### 1. Diminuir o título "CORE"
- Reduzir de `text-[64px]` para algo como `text-5xl` (48px) para caber bem em telas pequenas (iPhone SE/Mini) sem quebrar.

### 2. Substituir a seta curva pelo botão circular (estilo da referência)
- Remover o SVG atual da seta curva amarela.
- Colocar no canto superior direito (`absolute top-3 right-3`):
  - Um **halo verde claro** (círculo grande translúcido tipo `bg-green-100`) saindo levemente pra fora da tela (parcialmente cortado, como na imagem de referência).
  - Por cima, um **botão circular verde escuro** (`bg-green-700` ou similar) contendo um ícone `ArrowUp` branco, apontando exatamente pros 3 pontinhos do TikTok que ficam acima dele.
  - Sutil `animate-pulse` no botão para chamar atenção.
- Ajustar o `pt-` do container para o conteúdo não colidir com o halo.

Nada mais é alterado (cards, instrução, CTA, microcopy permanecem iguais).