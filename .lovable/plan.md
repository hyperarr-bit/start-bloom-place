

# Redesign do TravelBudget — Estilo xTiles

Substituir o componente `TravelBudget.tsx` por um layout inspirado nas imagens de referência: cards por categoria com tabelas de Valor Estimado vs Valor Real, header colorido com emoji, e resumo total no final.

---

## Estrutura Visual (baseada nas imagens)

```text
┌─────────────────────────────────┐
│ 📍 DESTINO: Nova York           │
│ Data de Ida: 22/12/2025         │
│ Data de Volta: 05/01/2026       │
│ Quantos dias: 14 noites         │
└─────────────────────────────────┘

┌─ PASSAGENS AÉREAS ──────────────┐
│ ✈️  (header roxo/lilás)         │
│ Descrição | Val.Estimado | Real │
│ Ida       | 5000         | 6700 │
│ Volta     |              |      │
│ Valor Total: R$ X              │
└─────────────────────────────────┘

┌─ HOTEL ─────────────────────────┐
│ 🏨  (header teal/verde)         │
│ ... mesma tabela ...            │
└─────────────────────────────────┘

... Passeios, Alimentação, Transporte, Compras ...

┌─ ORÇAMENTO TOTAL ───────────────┐
│ 💰 (header cinza/marrom)        │
│ Passagens  | Est. | Real        │
│ Hotel      | Est. | Real        │
│ ...                             │
│ TOTAL      | Est. | Real        │
└─────────────────────────────────┘
```

---

## Categorias (conforme imagens)

| Categoria | Emoji | Cor Header | Cor Body |
|-----------|-------|-----------|----------|
| Passagens Aéreas | ✈️ | `bg-violet-300` | `bg-violet-50` |
| Hotel | 🏨 | `bg-teal-300` | `bg-teal-50` |
| Passeios/Turismo | 🎡 | `bg-sky-200` | `bg-sky-50` |
| Alimentação | 🍲 | `bg-pink-300` | `bg-pink-50` |
| Transporte | 🚕 | `bg-amber-200` | `bg-amber-50` |
| Compras | 🛍️ | `bg-rose-300` | `bg-rose-50` |

---

## Dados / Estado

Novo tipo de dados para suportar Valor Estimado + Valor Real por item:

```typescript
type TravelCostItem = {
  id: string;
  description: string;
  estimated: number;
  actual: number;
};

type TravelTrip = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  categories: Record<string, TravelCostItem[]>;
};
```

Persistido com `usePersistedState("travel-budget-v2", ...)`.

---

## Funcionalidades por Card de Categoria

- Header colorido com emoji centralizado + nome bold
- Tabela com 3 colunas: Descrição, Valor Estimado, Valor Real
- Inputs inline editáveis (tap para editar)
- Botão "+" para adicionar nova linha
- "Valor Total" no rodapé com barra lateral colorida (como na imagem)
- Botão de deletar linha (hover/swipe)

## Card de Destino (topo)

- Inputs para: nome do destino, data ida, data volta
- Cálculo automático de dias/noites
- Sem fotos (não temos upload neste contexto)

## Card Orçamento Total (final)

- Header cinza/marrom escuro com emoji 💰
- Tabela resumo: cada categoria como linha, com soma de Estimado e Real
- Linha final TOTAL em bold
- Cores: header `bg-stone-400 dark:bg-stone-700`, body `bg-stone-50 dark:bg-stone-950/20`

---

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/components/travel/TravelBudget.tsx` | Reescrita completa |
| `src/components/travel/types.ts` | Adicionar tipos `TravelCostItem` e `TravelTrip` |

Nenhum outro arquivo muda. A aba "Budget" no `Viagens.tsx` já renderiza `<TravelBudget />`.

