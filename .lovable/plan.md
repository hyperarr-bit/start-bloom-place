

# Plano: Remover abas Calorias e Mercado + Adicionar aba útil

## Remover
1. **Aba CALORIAS** — Remover TabsTrigger, TabsContent (linhas ~241, 443-627), e estados/variáveis relacionados (`calorieGoal`, `dailyMeals`, `foodSearch`, `protGoal`, `carbGoal`, `fatGoal`, `FOOD_DATABASE`, etc.)
2. **Aba MERCADO** — Remover TabsTrigger, TabsContent (linhas ~244, 930-986), e estados relacionados (`groceryItems`, `newGroceryItem`, `groceryCategory`, `groceryCategories`, `groceryEmoji`)
3. Limpar imports não usados

## Sugestão de aba útil: 📊 DIÁRIO

Uma aba que o módulo de dieta realmente precisa: **registro diário do que o usuário comeu de verdade** (não o que planejou). Diferente do cardápio (que é planejamento), o diário é o que aconteceu.

**Por que é útil:**
- O cardápio é o plano, o diário é a realidade
- O usuário pode ver se seguiu o plano ou não
- Comparação rápida: "Planejei X, comi Y"
- Histórico por data — pode voltar e ver dias anteriores

**Como funciona:**
- Seletor de data no topo
- Lista simples: botão "+ Adicionar" abre campo de texto livre (ex: "2 ovos + café com leite")
- Cada entrada tem horário automático e botão deletar
- Badge visual no topo: "Seguiu o cardápio? ✅ / ❌" (toggle manual)
- Resumo: total de entradas do dia

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | (1) Remover TabsTrigger e TabsContent de "calorias" e "mercado". (2) Remover estados e variáveis órfãos. (3) Adicionar aba 📊 DIÁRIO com registro diário por data, campo de texto livre, horário automático, toggle "seguiu o cardápio", e histórico por data. (4) Limpar imports. |

Resultado: 3 abas focadas — 🍽️ CARDÁPIO | ⏱️ JEJUM | 👩‍🍳 RECEITAS | 📊 DIÁRIO

