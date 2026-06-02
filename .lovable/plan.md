## Problemas

1. No passo "Adicione um item da sua lista de desejos" (e o equivalente de investimentos), o alvo é o botão "Adicionar Desejo"/"Adicionar Investimento". Quando o usuário clica e o formulário abre logo abaixo, o balão fica posicionado entre o botão e o formulário, cobrindo o card.
2. Usuário relata que no passo da aba (INVESTIMENTOS/DESEJOS) o link "Pular este passo" não aparece — no código atual `tab-investimentos` e `tab-itens` já têm `skippable: true`, mas vamos garantir que o botão "Pular" seja visível nos passos das abas e ficar consistente.
3. O botão "Pular este passo →" usa uma seta, e já existe seta no balão apontando pro alvo. Trocar por um ícone diferente (X) pra não duplicar o visual de seta.

## Mudanças

### `src/components/onboarding/SpotlightOverlay.tsx`

1. Adicionar campo opcional `placement?: "auto" | "above" | "below"` em `SpotlightStep`. Quando definido, sobrescreve a heurística automática de `labelBelow`.
2. Trocar o "→" do botão Pular por um ícone `X` do lucide-react (e remover a seta textual). Mantém o destaque atual (borda/bg primary).

### `src/pages/Index.tsx`

Nos passos `add-wish` e `add-investment`, adicionar `placement: "above"` para forçar o balão a ficar acima do botão "Adicionar", evitando que ele cubra o formulário que abre logo abaixo.

Nenhum outro arquivo é tocado.

&nbsp;

irmão você não entendeu o tópico 2 

Exemplo 

Quando a seta apontar para a aba de investimentos a opção de pular o passo NÃO DEVE APARECER

ela só deve aparecer quando o usuário tiver clicado e entrado na aba e a seta tiver apontando para o card em si

a mesma coisa para o desejos 