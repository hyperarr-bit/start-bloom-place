

# Plano: Página inicial METAS — cópia 1:1 do xtiles.app

## O que as fotos mostram (página inicial)

A página inicial de METAS é uma scroll vertical com cards fixos nesta ordem:

1. **"MINHAS METAS ∨"** — título com dropdown no topo
2. **Card PLANO DE AÇÃO PARA CADA META** — header marrom/bege com 🎯 centralizado, body bege claro listando metas como links ("Casamento →", "Nova meta →") com ícone de documento à direita
3. **Card de frase motivacional** — fundo cinza/marrom, texto cursivo branco centralizado "Eu crio a minha realidade."
4. **Card 6 MESES** — header amarelo (#FDE68A), emoji relógio ⏱ centralizado no header, título "6 MESES" bold grande, checkboxes circulares azuis com itens, área de imagem abaixo
5. **Card 1 ANO** — header lilás (#C4B5FD), mesmo layout
6. **Card 3 ANOS** — header verde (#86EFAC), mesmo layout
7. **Card 5 ANOS** — header laranja (#FDBA74), mesmo layout
8. **MURAL DOS SONHOS** — seção no final

Cada card de tempo (6M, 1A, 3A, 5A) tem:
- Header colorido ~80px com emoji relógio centralizado
- Título bold centralizado abaixo do header
- Lista de checkboxes circulares (azul = done, cinza = undone)
- Input inline para adicionar item
- Área para upload de imagem inspiracional full-width

Ao clicar num item do "PLANO DE AÇÃO" (ex: "Casamento →"), abre a view detalhada (o GoalsBoardV2 atual).

## Estrutura técnica

O GoalsBoardV2 será dividido em duas views:
- **View "home"** (default) — a página inicial das fotos
- **View "detail"** — a view atual (plano de ação, visão, problemas de uma meta específica)

### Dados novos (persistidos)

```typescript
interface TimelineGoals {
  "6meses": { items: { id: string; text: string; done: boolean }[]; image?: string };
  "1ano": { items: ...; image?: string };
  "3anos": { items: ...; image?: string };
  "5anos": { items: ...; image?: string };
}
quote: string; // frase motivacional editável
dreamBoard: string[]; // imagens do mural dos sonhos
```

### Layout dos cards de tempo (1:1)

```text
┌─────────────────────────────┐
│  ██████ AMARELO ██████████  │ ← header colorido ~80px
│          ⏱                  │ ← emoji relógio centralizado
├─────────────────────────────┤
│        6 MESES              │ ← título bold centralizado
│                             │
│  ✅ Viajar pra Bariloche    │ ← checkbox azul + texto
│  ✅ Começar no Crossfit     │
│  ○  Perder 5kg              │
│  ○  Adicionar...            │ ← input placeholder
│                             │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │   IMAGEM UPLOAD     │    │ ← foto inspiracional
│  │                     │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/hiperfoco/GoalsBoardV2.tsx` | Reescrever completamente. (1) Estado `view`: "home" ou "detail". (2) View "home": título "MINHAS METAS ∨", card PLANO DE AÇÃO com lista de metas como links (→), card de frase motivacional editável (bg cinza/marrom, texto branco cursivo), 4 cards de timeline (6M/1A/3A/5A) cada um com header colorido, emoji relógio centralizado, título bold, checkboxes circulares azuis, input inline, upload de imagem. Seção MURAL DOS SONHOS com grid de imagens. (3) View "detail": o conteúdo atual (plano de ação, visão, problemas) acessado ao clicar numa meta. (4) Persistência: `usePersistedState("goals-timeline")` para os 4 períodos + quote + mural. Goals individuais continuam em `goals-board-v2`. |

