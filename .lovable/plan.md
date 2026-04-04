

# Plano: Copiar cardápio de um dia para outros dias

## O que muda
Cada card de dia no cardápio semanal ganha um botão "Copiar para..." que abre um mini-painel com checkboxes dos outros 6 dias + opção "Todos". Ao confirmar, as refeições daquele dia são copiadas para os dias selecionados.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | (1) Adicionar estado `copyFromDay` (string ou null) e `copyTargetDays` (string[]). (2) No header de cada card de dia (linha ~272), adicionar botão `Copy` do Lucide. (3) Quando clicado, abre um popover/mini-painel inline com checkboxes para cada dia (exceto o próprio) + checkbox "Todos". (4) Botão "Copiar" que executa `setMealPlan` copiando `mealPlan[sourceDay]` para cada dia selecionado. (5) Importar `Copy` do Lucide. |

## Fluxo do usuário
1. Preenche o cardápio de Segunda
2. Clica no ícone 📋 no card de Segunda
3. Aparece lista com checkboxes: ☐ Terça, ☐ Quarta... ☐ Todos
4. Marca "Todos" ou seleciona dias específicos
5. Clica "Copiar" → refeições de Segunda são copiadas para os dias marcados
6. Painel fecha automaticamente

