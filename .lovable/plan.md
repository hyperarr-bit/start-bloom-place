# Dark Mode Premium — Aba Mercado

## Objetivo
Refinar o dark mode da aba **Mercado** (componente `GroceryList`) com aparência premium tipo Notion/Linear: cores das categorias preservadas mas em tons fechados, corpo do card sempre escuro, contraste confortável.

## Escopo
- **Componente único**: `src/components/casa/GroceryList.tsx`
- **Estilos**: `src/index.css` (utilities novas, escopadas em `.dark`)
- **Light mode**: 100% intocado (todas as classes `bg-green-500` etc continuam ativas no light).
- **Estrutura, layout, espaçamentos, textos, ordem das categorias e funcionalidades**: nenhuma mudança.

## O que será alterado

### 1. `GroceryList.tsx` — adicionar classes wrapper (sem trocar JSX)
Acrescentar marcadores semânticos para permitir overrides no dark, sem alterar comportamento:

- Card da categoria: `className="grocery-card …"` + `data-color={cat.color}`
- Header colorido: `className="grocery-header bg-green-500 …"` (mantém a cor do light)
- Corpo: `className="grocery-body …"`
- Input "Adicionar...": `className="grocery-input …"`
- Botão `+`: `className="grocery-add-btn …"`
- Lixeira do header: `className="grocery-trash …"`

Nenhuma mudança em props, hooks, dados, ordem de elementos ou texto.

### 2. `index.css` — bloco novo de utilities `.dark` para mercado

**a) Headers de categoria — versões "fechadas" no dark**
Para cada cor existente (`bg-green-500`, `bg-red-500`, `bg-blue-600`, `bg-purple-500`, `bg-orange-500`, `bg-yellow-600`, `bg-cyan-500`, `bg-pink-500`, `bg-indigo-600`), regra:

```css
.dark .grocery-card[data-color="bg-green-500"] .grocery-header {
  background: hsl(142 45% 28%);
}
.dark .grocery-card[data-color="bg-green-500"] {
  border-bottom: 1px solid hsl(142 70% 50% / 0.20);
}
```

Mapeamento das cores fechadas:

| Cor original | Header dark (HSL) |
|---|---|
| `bg-green-500` | `142 45% 28%` |
| `bg-red-500` | `0 50% 32%` |
| `bg-blue-600` | `220 50% 32%` |
| `bg-purple-500` | `265 40% 32%` |
| `bg-orange-500` | `25 55% 30%` |
| `bg-yellow-600` | `40 55% 28%` |
| `bg-cyan-500` | `190 50% 28%` |
| `bg-pink-500` | `335 45% 32%` |
| `bg-indigo-600` | `240 40% 35%` |

Resultado: header colorido mas sóbrio, com linha sutil da cor viva (20% opacidade) separando do corpo.

**b) Corpo do card**
```css
.dark .grocery-card { background: hsl(222 14% 11%); border-color: hsl(222 12% 18%); }
.dark .grocery-body { background: hsl(222 16% 8%); } /* ligeiramente mais escuro */
```

**c) Input "Adicionar…"**
```css
.dark .grocery-input {
  background: hsl(222 18% 6%);          /* mais escuro que o card */
  border-color: hsl(222 12% 16%);
  color: hsl(0 0% 100%);
}
.dark .grocery-input::placeholder { color: hsl(222 8% 52%); } /* #6F7688 */
.dark .grocery-input:focus-visible { border-color: hsl(222 12% 24%); }
```

**d) Botão `+` com hover na cor da categoria**
```css
.dark .grocery-add-btn {
  background: hsl(222 14% 14%);
  color: hsl(0 0% 96%);
  border: 1px solid hsl(222 12% 18%);
}
.dark .grocery-card[data-color="bg-green-500"] .grocery-add-btn:hover {
  background: hsl(142 45% 22%);
  box-shadow: 0 0 0 1px hsl(142 70% 50% / 0.3);
}
/* …repete para cada cor… */
```

**e) Lixeira do header — neutra por padrão, vermelha só no hover**
```css
.dark .grocery-trash { opacity: 0.45; }
.dark .grocery-trash:hover { opacity: 1; }
.dark .grocery-trash:hover svg { color: hsl(0 75% 62%); }
```

**f) Card "Adicionar Categoria" e header da seção**
- O form usa `bg-card` e `border-border`, já herda os tokens premium aplicados no dark global anterior — **sem mudanças necessárias**.
- O `ModuleTip` (card de dicas) já é tematizado por tokens — **sem mudanças necessárias**.

## O que NÃO será alterado
- Light mode da aba Mercado.
- Cores das categorias no light (continuam vívidas).
- Estrutura JSX, ordem dos elementos, espaçamentos, fontes, textos, emojis.
- Lógica, hooks, persistência ou qualquer comportamento.
- Outras abas de Casa (Cleaning, Pantry, etc.).

## Detalhes técnicos
- Override por `data-color` evita duplicar classes no JSX e mantém o light mode usando as classes Tailwind brutas.
- Nenhum hex hardcoded em componente — apenas em `index.css` como utilities encapsuladas.
- Sem novas dependências.

## Resultado esperado
- Background grafite (#0F1115 herdado), cards escuros (#161A22), corpo dos itens em #141824.
- Headers de categoria com cores reconhecíveis mas em tons fechados — sem blocos vibrantes que cansam a vista.
- Linha de 1px sutil na cor viva da categoria separando header do corpo.
- Input mais escuro que o card, placeholder em cinza médio.
- Botão `+` neutro, ganha brilho sutil na cor da categoria no hover.
- Lixeira discreta, vermelha só no hover.
- Sensação Notion/Linear: organizado, silencioso, premium.
