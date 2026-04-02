

# Redesign do Card Top 5 Maiores Gastos

Tornar o card visualmente mais interessante com cores variadas por posição (medalha), ícones de ranking e barras coloridas distintas.

---

## Design

Cada item terá uma cor diferente baseada na posição:
- 1º: dourado (`amber-400`) com emoji 🥇
- 2º: cinza claro (`slate-300`) com emoji 🥈
- 3º: bronze (`orange-400`) com emoji 🥉
- 4º e 5º: cores neutras (`blue-400`, `purple-400`)

As barras de progresso acompanham a cor de cada posição. O valor fica com a mesma cor da barra ao invés de tudo vermelho.

Cada item ganha um card sutil com `bg-secondary/30 rounded-lg px-3 py-2` para dar mais destaque e separação visual.

```text
┌─────────────────────────────────┐
│ 🏆 TOP 5 MAIORES GASTOS        │
│                                 │
│ ┌─ bg-secondary/30 ──────────┐ │
│ │ 🥇 Aluguel     R$ 2.500   │ │
│ │ ████████████████████ amber │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ 🥈 Mercado      R$ 1.800  │ │
│ │ ██████████████ slate       │ │
│ └────────────────────────────┘ │
│ ...                            │
└─────────────────────────────────┘
```

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Substituir bloco Top 5 (linhas 528-553) com novo design usando array de cores por posição, emojis de medalha, barras e valores coloridos individualmente |

