

# Plano: Limpar página Casa — remover aba Limpeza + adotar estilo de abas do Rotina

## Mudanças

### 1. Remover aba "Limpeza" (radar)
Remover `{ v: "radar", l: "Limpeza", icon: Droplets }` do array `tabs` e o `<TabsContent value="radar">` correspondente. O import do `CleaningRadar` também sai.

### 2. Remover stat cards e quick stats
Eliminar todo o bloco dos 4 cards coloridos (linhas 77-98: Tarefas/Urgentes/Comprar/Vida) e o bloco "Quick Stats" (linhas 100-106). Remover os `usePersistedState` que alimentavam esses cards (`cleaningTasks`, `pantryItems`, `plants`, `shoppingList`) e as variáveis calculadas (`urgentTasks`, `lowStock`).

### 3. Adotar estilo de abas do Rotina
Trocar o sistema de `<Tabs>/<TabsList>/<TabsTrigger>` (shadcn) por abas manuais com `useState("comodos")` + botões com classe `notion-tab` / `notion-tab-active`, igual ao Rotina. As abas ficam dentro do header, abaixo do título, com scroll horizontal e emoji + label.

### Layout final do header (como Rotina)
```text
┌─────────────────────────────────┐
│ ← ≡  CASA                      │
│ 🚪Cômodos 🍎Mercado 🧴Rotina...│
└─────────────────────────────────┘
```

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Casa.tsx` | (1) Remover import CleaningRadar e Droplets. (2) Remover usePersistedState dos stats. (3) Remover stat cards + quick stats. (4) Trocar Tabs/TabsList/TabsTrigger por useState + notion-tab buttons no header. (5) Remover aba radar/Limpeza e seu TabsContent. (6) Renderizar conteúdo com `{activeTab === "comodos" && <RoomManager />}` etc. |

