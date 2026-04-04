

# Plano: Refeições customizáveis com reordenação e nomes livres

## Problema atual
1. O usuário só pode escolher refeições de uma lista fixa (`availableMeals`). Não pode criar nomes personalizados (ex: "Lanche da Tarde", "Pré-Treino Leve").
2. Não pode reordenar as refeições — se adicionar "Pré-Treino", ele vai pro final da lista em vez de ficar entre Almoço e Lanche.

## Solução

### 1. Refeições com nomes livres
- Adicionar um campo `Input` no painel de config para o usuário digitar qualquer nome de refeição
- Manter o `Select` com sugestões pré-definidas como atalho, mas permitir texto livre também
- Emoji padrão 🍽️ para refeições customizadas

### 2. Reordenação por drag (setas)
- Adicionar botões ↑/↓ em cada refeição no painel de config para mover a ordem
- A ordem do array `meals` define a ordem de exibição no cardápio semanal

### 3. Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | (1) No painel `showMealConfig`: adicionar Input de texto livre + botão "Adicionar" para criar refeição com nome customizado. (2) Manter Select como sugestões rápidas. (3) Adicionar botões ↑↓ em cada chip de refeição para reordenar. (4) Usar `ArrowUp`/`ArrowDown` icons do Lucide. |

Nenhum arquivo novo. Apenas edição do painel de configuração de refeições que já existe.

