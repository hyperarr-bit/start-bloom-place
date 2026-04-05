

# Plano: Tornar a aba Calorias mais útil

## Problema atual
A aba é basicamente um formulário manual com 5 campos para digitar. Ninguém vai preencher kcal/P/C/G na mão pra cada refeição. Falta praticidade.

## Melhorias

### 1. Banco de alimentos rápidos
- Lista de ~50 alimentos comuns brasileiros com calorias/macros pré-preenchidos (arroz, feijão, frango, ovo, banana, pão, etc.)
- Campo de busca: usuário digita "frango" e aparece "Frango grelhado 100g — 165kcal, 31P, 0C, 3.6G"
- Clicou, adicionou. Sem precisar digitar números

### 2. Metas de macros (não só calorias)
- Além da meta de kcal, adicionar metas de proteína, carbo e gordura
- Barras de progresso individuais para cada macro
- Sugestão automática: baseado na meta calórica, calcular split padrão (ex: 30% prot, 40% carb, 30% gordura)

### 3. Resumo visual melhor
- Trocar os 4 cards estáticos por um anel/donut mostrando distribuição de macros
- Card de "Restante do dia": "Faltam 800kcal, 45g prot"
- Indicador de cor: verde (dentro da meta), amarelo (perto), vermelho (passou)

### 4. Integração com o Cardápio
- Botão "Importar do Cardápio de Hoje": puxa o que o usuário planejou no cardápio semanal como base, aí ele só ajusta as quantidades
- Evita ter que digitar tudo duas vezes

### 5. Mover IMC para a aba Saúde (módulo Saúde)
- A calculadora de IMC não tem a ver com o dia-a-dia de calorias, faz mais sentido no módulo Saúde junto com evolução corporal

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | (1) Criar array `FOOD_DATABASE` com ~50 alimentos brasileiros comuns + macros. (2) Adicionar campo de busca com autocomplete que filtra o banco. (3) Adicionar metas de macros (`protGoal`, `carbGoal`, `fatGoal`) com cálculo automático a partir da meta calórica. (4) Substituir os 4 cards por donut de macros + card "Restante". (5) Adicionar botão "Importar do Cardápio" que puxa refeições do dia atual do `mealPlan`. (6) Remover seção IMC da aba. |
| `src/pages/Saude.tsx` | Adicionar calculadora IMC (mesmo código, movido pra cá) como card na tela principal. |

