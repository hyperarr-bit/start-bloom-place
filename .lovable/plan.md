

# Adicionar Locais para Conhecer + Imagem no Destino

Duas adições ao `TravelBudget.tsx`:

---

## 1. Imagem no Card de Destino

Adicionar campo de URL de imagem ao `TravelTrip` type e exibir no card de destino.

- **`types.ts`**: Adicionar `photoUrl?: string` ao tipo `TravelTrip`
- No card 📍 DESTINO, adicionar:
  - Input para colar URL da imagem
  - Se preenchido, exibir a imagem como banner no topo do card (rounded, aspect-video, object-cover)
  - Mesmo estilo xTiles dos outros cards

## 2. Seção Locais para Conhecer

Adicionar um novo card xTiles **📍 LOCAIS PARA CONHECER** ao final do `TravelBudget` (antes do Orçamento Total), com a mesma identidade visual dos cards de categoria.

- Header: `bg-emerald-300 dark:bg-emerald-700`, emoji 📍
- Body: `bg-emerald-50 dark:bg-emerald-950/20`
- Cada local tem: nome, categoria (dropdown: 🍕 Comida, 📸 Turístico, 🛍️ Compras, ☕ Café, 🍸 Bar), notas, link Google Maps
- Botão "+" para adicionar
- Cards compactos com nome, categoria badge, notas, link externo e botão deletar
- Status toggle: 📌 Quero ir / ✅ Já fui / ❤️ Favorito

### Dados

Adicionar ao `TravelTrip`:
```typescript
photoUrl?: string;
places?: TravelPlace[];
```

Novo tipo:
```typescript
type TravelPlace = {
  id: string;
  name: string;
  category: "comida" | "turistico" | "compras" | "cafe" | "bar";
  notes: string;
  mapsLink: string;
  status: "quero_ir" | "ja_fui" | "favorito";
};
```

---

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/components/travel/types.ts` | Adicionar `TravelPlace`, `photoUrl` e `places` ao `TravelTrip` |
| `src/components/travel/TravelBudget.tsx` | Adicionar imagem no destino + seção Locais para Conhecer |

Tudo integrado dentro do mesmo componente, sem criar arquivos novos. Reutiliza as constantes `PLACE_CATEGORIES` e `PLACE_STATUS` já existentes no `types.ts`.

