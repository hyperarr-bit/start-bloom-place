

# Plano: Lista Inteligente + Diário baseado no Cardápio

## 1. Aba 🛒 LISTA INTELIGENTE

Nova aba no módulo Dieta que gera lista de compras automaticamente a partir do cardápio semanal e das receitas, e sincroniza com o módulo Casa (GroceryList).

**Como funciona:**
- Botão "Gerar lista da semana" — varre `mealPlan` e extrai todos os itens preenchidos nos 7 dias
- Botão "Gerar das receitas favoritas" — puxa ingredientes das receitas marcadas como favoritas
- Os itens gerados aparecem numa lista com checkboxes para marcar como comprado
- Botão "Enviar para Mercado (Casa)" — copia os itens para o estado `casa-grocery-categories` que o `GroceryList.tsx` do módulo Casa usa, assim aparece lá automaticamente
- O usuário pode adicionar itens manuais também
- Badge mostrando quantos itens faltam comprar

**Compartilhamento com Casa:**
- A lista inteligente lê e escreve no mesmo key `casa-grocery-categories` do `usePersistedState` que o `GroceryList.tsx` usa
- Isso garante que quando o usuário vai no módulo Casa > Mercado, os itens já estão lá

## 2. Aba 📊 DIÁRIO — Redesign

Trocar o formato atual (input de texto livre) por um formato baseado no cardápio planejado.

**Nova estrutura:**
- Puxa automaticamente as refeições do dia (do `mealPlan` baseado no dia da semana)
- Cada refeição aparece como um card com:
  - Nome da refeição + o que estava planejado
  - Botão ✅ (comeu) ou ❌ (não comeu)
  - Se ❌: campo de texto aparece para "Por que não comeu?"
- Seção extra no final: **"Comeu algo fora da dieta?"**
  - Toggle Sim/Não
  - Se Sim: campo de texto para descrever (ex: "comi um bolo na festa")
- Manter o streak de aderência dos 7 dias
- Manter a navegação por data

**Dados:**
- Novo formato de estado: `dieta-diary-v2` com estrutura por data:
```text
{
  "2026-04-05": {
    meals: { "Café da Manhã": { followed: true, note: "" }, ... },
    extraFood: { had: false, description: "" }
  }
}
```

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | (1) Adicionar aba 🛒 LISTA com geração automática a partir do cardápio e receitas, checkboxes, e botão "Enviar para Casa". (2) Redesenhar aba DIÁRIO: puxar refeições do cardápio, mostrar ✅/❌ por refeição, campo de observação quando ❌, seção "comeu fora da dieta". (3) Substituir estados antigos do diário (`diaryEntries`, `newDiaryEntry`) por novo formato `dieta-diary-v2`. (4) Adicionar import de ícones necessários (`ShoppingCart`, `Send`). |

Resultado: 5 abas — 🍽️ CARDÁPIO | ⏱️ JEJUM | 👩‍🍳 RECEITAS | 🛒 LISTA | 📊 DIÁRIO

