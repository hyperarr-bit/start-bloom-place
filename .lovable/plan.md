# Correção dos bugs do tutorial guiado (spotlight)

## Bugs encontrados na varredura

**1. Saúde — passo 1 quebrado (sua screenshot)**
O passo 1 procura o elemento `add-water`, mas esse marcador só existe no módulo Rotina — no módulo Saúde ele não existe. Por isso aparece o card "Não estou encontrando este item na tela".

**2. Card do tutorial cortado fora da tela (sua screenshot)**
O card de fallback (e o botão "Role pra baixo/cima") usa centralização via classe CSS, mas a animação do framer-motion sobrescreve o transform — o card fica colado à direita e cortado. Bug visual em todos os módulos.

**3. Passo 1 manda clicar na aba que já está ativa**
Acontece em 10 módulos: Hiperfoco, Beleza, Biblioteca, Casa, Detox, Pet, Relacionamentos, Viagens, Carreira e Estudos — o primeiro passo aponta pra aba padrão que já está aberta.

**4. Módulo concluído não sai da lista**
Para usuário recém-cadastrado (flag de novo usuário), TODA vez que a Home abre ela reseta todos os marcadores `spotlight-done-*`. Então você termina o tutorial de um módulo, volta pra Home, e o progresso é apagado — o módulo nunca sai da lista.

## Correções

**SpotlightOverlay.tsx**
- Corrigir a centralização do card de fallback e do botão "Role pra baixo/cima" usando o transform do próprio framer-motion (`x: "-50%"`), eliminando o corte fora da tela.

**Home.tsx**
- Resetar o progresso do tutorial apenas UMA vez quando a flag de novo usuário é ativada (chave de controle), em vez de a cada abertura da Home. Assim módulos concluídos saem da lista corretamente.

**Saúde**
- Adicionar o marcador `add-water` no botão "+250ml" do HydrationTracker, fazendo o passo 1 destacar o botão certo.

**Passo 1 dos 10 módulos com aba já ativa**
- Apontar o passo 1 para o elemento principal do conteúdo da aba padrão (ex.: campo de captura de pensamento no Hiperfoco, cadastro de pet no Pet, adicionar pessoa em Relacionamentos, etc.), adicionando `data-spotlight` nesses elementos e ajustando o texto do passo. O passo avança quando o usuário interage com o elemento.

## Detalhes técnicos

- `SpotlightOverlay.tsx`: trocar `-translate-x-1/2` por `x: "-50%"` nas props do motion (fallback card + botão off-screen).
- `Home.tsx`: gate do reset por chave única (ex.: `force-new-user-reset-done`), limpa junto com a flag.
- Adição de `data-spotlight` em ~10 componentes filhos (input/botão principal da aba padrão) + atualização dos arrays `steps` nas páginas correspondentes.
- Nenhuma mudança de backend, paleta ou outras seções.
