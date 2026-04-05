

# Plano: Receitas estilo cards visuais (inspirado nas referências)

## Problema atual
A aba Receitas é uma lista simples com texto corrido — nome, badge de categoria, ingredientes e modo de preparo tudo espremido num bloco cinza. Sem visual atrativo, sem organização por categorias, sem destaque.

## Inspiração (screenshots)
Os cards de referência têm: header colorido por categoria, título bold grande, lista de ingredientes com checkboxes, modo de preparo numerado, e visual de "ficha de receita".

## Nova estrutura

### 1. Cards de receita estilo ficha
- Header colorido por categoria (cores diferentes: amarelo para café, rosa para doce, verde para salada, etc.)
- Título grande e bold
- Ingredientes com checkboxes (para riscar enquanto cozinha)
- Modo de preparo com passos numerados
- Badges de tempo e porções
- Botão favoritar e deletar

### 2. Filtro por categoria
- Chips horizontais no topo: Todas | Café | Almoço | Janta | Lanche | Doce | Fitness
- Filtro rápido visual

### 3. Formulário melhorado
- Mesmo formulário, mas com preview da cor da categoria selecionada
- Placeholder mais descritivo nos campos de ingredientes ("1 banana madura\n2 ovos\n3 col aveia...")

### 4. Cores por categoria

```text
Café da Manhã  → bg-amber-100/border-l-amber-400
Almoço         → bg-green-100/border-l-green-400
Janta          → bg-blue-100/border-l-blue-400
Lanche         → bg-orange-100/border-l-orange-400
Doce Fit       → bg-pink-100/border-l-pink-400
Fitness        → bg-purple-100/border-l-purple-400
Salgado        → bg-red-100/border-l-red-400
```
(Em dark mode: versões escuras com opacidade, ex: `dark:bg-amber-950/30`)

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | (1) Adicionar mapa de cores por categoria (`categoryColors`). (2) Adicionar filtro por categoria com chips horizontais. (3) Redesenhar cards de receita: header colorido, título grande, ingredientes com checkboxes (split por `\n`), modo de preparo com `ol` numerado. (4) Adicionar mais opções de categoria no form: "Doce Fit", "Salgado", "Fitness", "Receita Rápida". (5) Estado `checkedIngredients` por receita para riscar ingredientes. (6) Melhorar placeholders do formulário. |

Nenhum arquivo novo.

