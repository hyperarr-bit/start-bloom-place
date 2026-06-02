Vou ajustar só o tour do onboarding financeiro:

1. Corrigir a posição do balão
- Fazer o balão respeitar melhor o espaço disponível na tela.
- Quando o alvo estiver perto do topo, manter o balão abaixo do alvo.
- Quando estiver perto do meio/baixo, evitar que ele fique em cima do formulário/card destacado.
- Limitar a posição vertical para não passar do viewport no mobile.

2. Mostrar “Pular este passo” nas abas
- Garantir que as etapas que apontam para as abas de Investimentos e Desejos exibam o botão de pular.
- Manter o pular também nos cards de investimento e desejos.

3. Trocar o símbolo do botão de pular
- Remover a seta “→” do texto “Pular este passo”.
- Trocar por um ícone discreto que não pareça mais uma seta de orientação do tour, por exemplo um X pequeno do Lucide.

Arquivos previstos:
- `src/components/onboarding/SpotlightOverlay.tsx`
- `src/pages/Index.tsx`