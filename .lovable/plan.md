Vou ajustar somente `src/components/WelcomeScreen.tsx`, focando no slide de desejos/objetivos que aparece como tela 3/4 no onboarding.

Plano:

1. Recriar o mock `SlideFourMock` com a mesma estrutura da referência:
   - Card externo “Meu desejo” com borda clara, raio maior e padding proporcional.
   - Card interno do produto separado, com imagem centralizada no topo, coração à direita, título, chip, divisória, valores e barra.
   - Grid inferior de dois cards exatamente abaixo do card do produto.
   - Caixa verde de feedback fora do card “Meu desejo”, como na imagem.

2. Corrigir as cores para baterem com a referência:
   - Guardado em verde suave.
   - Falta em rosa/vermelho suave.
   - Barra de progresso rosa forte com trilho cinza claro.
   - Chip “Tecnologia” lilás claro.
   - Caixa de feedback verde muito claro com borda verde clara.
   - Bordas e divisórias em cinza bem claro.
   - Textos primários pretos e textos secundários cinza.

3. Corrigir proporção e espaçamento:
   - Aumentar a largura útil do mock para se aproximar da referência.
   - Ajustar tamanhos de fonte, paddings, alturas, gap entre blocos e raio dos cards.
   - Reduzir o efeito de “card genérico” atual e aproximar da composição vertical da imagem.
   - Manter o footer existente com Voltar, dots e Continuar sem alterar lógica.

4. Melhorar carregamento do iPad sem trocar a imagem:
   - Manter `loading="eager"`, `fetchPriority="high"`, `decoding="async"`, largura/altura fixas e `object-contain`.
   - Ajustar o tamanho exibido para ficar igual à referência sem aumentar peso.

Não vou mexer em rotas, autenticação, outros slides, lógica do onboarding, banco, Supabase ou qualquer outra tela.