## Mudanças

### 1. Investimento — tom suave + opção de pular

`src/pages/Index.tsx` (passo 6, linha 146):
- Label atual: `'Cadastre seu primeiro aporte.'`
- Novo: `'Tem investimento? Cadastre seu primeiro aporte (ou pule se ainda não tem).'`
- Marcar o passo como `optional: true`.

`src/components/onboarding/SpotlightOverlay.tsx`:
- Adicionar campo `optional?: boolean` na interface `SpotlightStep`.
- Quando `optional` for `true`, renderizar um botão discreto "Pular este passo" abaixo do label do tooltip (e também no fallback card). Ao clicar, avança pro próximo passo (não encerra o tutorial).

### 2. Limites — tutorial abre a aba sozinho

`src/pages/Index.tsx`:
- Remover o passo `tab-limites` (linha 149: `'Toque em LIMITES embaixo.'`).
- O passo seguinte (`add-limit`, linha 150) já tem `onEnter: () => setActiveTab("limites")`, então o tutorial muda a aba automaticamente sem pedir clique do usuário.

## Por que

Dados do funil mostram:
- Passo 4→5 (anotação → investimento): –40% (30→18 usuários). Soa "avançado" e intimidador.
- Passo 8→9 (add-wish → tab-limites): –41% (17→10). Pedir pro usuário navegar quebra o fluxo.

Suavizar o tom + permitir pular resolve o medo do investimento sem perder quem quer cadastrar. Remover o passo de navegação manual de Limites elimina a fricção mais comum em tutoriais que apontam pra abas.

## Fora do escopo

Não vou mexer em outros passos, copy de outros módulos, ou no SpotlightOverlay além de adicionar `optional`.
