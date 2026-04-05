

# Plano: Redesign da aba METAS — Estilo xtiles.app (Vida em Ordem)

## Design de referência (screenshots analisados)

Cada meta é uma **página vertical scrollável** com seções em cards grandes:
- **Imagem hero** no topo (foto de referência da meta)
- **PLANO DE AÇÃO** — card com header cinza/marrom + emoji 🚀, tarefas agrupadas por "etapas" (labels rosa/pink), checkboxes circulares, input inline "Adicionar uma tarefa..."
- **LINKS DE REFERÊNCIA** — card com header cinza + emoji 🔗, grid de imagens + URLs
- **VISÃO** — card com header cinza + emoji 🎯, campos: Meta, Objetivo, Tempo para bater a meta
- **PROBLEMAS E SOLUÇÕES** — card com header cinza + emoji 😅, pares problema (label rosa) + solução (texto)

Dropdown no topo para trocar entre metas ("Casamento →").

## Nova estrutura de dados

```typescript
interface GoalV2 {
  id: string;
  title: string;
  heroImage?: string; // base64 ou URL
  // PLANO DE AÇÃO
  actionGroups: { id: string; label: string; tasks: { id: string; text: string; done: boolean }[] }[];
  // LINKS DE REFERÊNCIA  
  referenceLinks: { id: string; url: string; title?: string }[];
  referenceImages: string[]; // base64
  // VISÃO
  vision: { meta: string; objetivo: string; tempo: string };
  // PROBLEMAS E SOLUÇÕES
  problems: { id: string; problem: string; solution: string }[];
}
```

## Layout dos cards (cada seção)

```text
┌─────────────────────────────┐
│  ░░░░░ header cinza ░░░░░  │ ← bg-muted/60, ~60px alto
│                        🚀  │ ← emoji grande no canto direito
│  PLANO DE AÇÃO              │ ← título bold grande
│                             │
│  ┃ Definir as bases:        │ ← label rosa (bg-pink-100, border-l-4 pink)
│  ☑ Data: Escolher uma...   │ ← checkbox circular + texto
│  ☑ Orçamento: Determinar   │
│  ○ Reservar espaço          │
│  ○ Adicionar uma tarefa...  │ ← input placeholder inline
│                             │
│  ┃ Estruturar o evento:     │ ← outro grupo
│  ○ Fotografia/filmagem     │
└─────────────────────────────┘
```

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/DesenvolvimentoPessoal.tsx` | (1) Substituir toda a `TabsContent value="metas"` pelo novo componente `<GoalsBoardV2 />`. (2) Remover estados antigos: `lifeGoals`, `newGoalText`, `newGoalDeadline`, `bucketList`, `newBucket`, `visionItems`, `newVisionText`, `newVisionCategory`. |
| `src/components/hiperfoco/GoalsBoardV2.tsx` | **Novo arquivo**. Componente completo com: (1) Dropdown de seleção de meta no topo + botão "Nova Meta". (2) Quando meta selecionada, scroll vertical com seções-card: Hero Image (upload via input file, convertido a base64), PLANO DE AÇÃO (grupos de tarefas com labels rosa, checkboxes circulares, input inline para adicionar tarefa), LINKS DE REFERÊNCIA (grid de imagens uploadadas + campo para adicionar URLs), VISÃO (3 campos: meta, objetivo, prazo), PROBLEMAS E SOLUÇÕES (pares com label rosa + texto). (3) Cada seção com header cinza (bg-muted/50) ~60px com emoji grande no canto. (4) Persistência via `usePersistedState("goals-board-v2")`. (5) Upload de imagens via `<input type="file" accept="image/*">` convertendo para base64 (hero + galeria de referência). |

Migração: dados antigos (`dp-life-goals`, `dp-bucket-list`, `dp-vision`) não são apagados, apenas deixam de ser usados. O novo formato é `goals-board-v2`.

