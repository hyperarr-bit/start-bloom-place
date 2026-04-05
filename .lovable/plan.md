

# Plano: Metas como planilha pré-montada (1:1 com as fotos)

## Problema
Atualmente o componente começa vazio com botão "Criar primeira meta". O conceito é planilha: o usuário abre e já está tudo lá, vazio, pronto pra preencher.

## Mudanças no GoalsBoardV2.tsx

### 1. Remover empty state
Eliminar o bloco `if (goals.length === 0)` que mostra "Nenhuma meta criada ainda". Em vez disso, inicializar o `usePersistedState` com **uma meta vazia já criada** (título "Minha Meta", tudo em branco).

### 2. Template vazio (não pré-preenchido)
O `emptyGoal()` volta a ter tudo VAZIO — sem tarefas de exemplo, sem texto placeholder nas tasks. Apenas a ESTRUTURA está lá:
- 2 grupos de ação vazios (labels "Definir as bases:" e "Estruturar o plano:") com 0 tarefas, só o input "Adicionar uma tarefa..."
- Visão com 3 campos vazios
- 1 par problema/solução vazio
- Hero image placeholder

### 3. Visual 1:1 com as fotos
- **Header dos cards**: bg cinza/marrom (`bg-[#8B7D6B]/30` dark, `bg-[#C4B5A4]/40` light) — não cinza genérico. Altura ~80px. Emoji grande (text-4xl) no canto direito inferior do header.
- **Título da seção**: Texto preto bold grande (`text-lg font-black`) abaixo do header colorido, dentro do body do card.
- **Labels rosa**: `bg-pink-100 dark:bg-pink-500/15` com `border-l-4 border-pink-400`, texto bold.
- **Checkboxes**: Circulares. Checked = azul preenchido com checkmark branco (como nas fotos, não verde). Unchecked = borda cinza fina.
- **Visão**: Campos inline tipo "**Meta:** texto editável" e "**Objetivo:** texto editável" e "**Tempo para bater a meta:** texto editável" — sem labels separados, tudo numa mesma área com separador `<hr>` embaixo.
- **Links de referência**: Grid de imagens 3 colunas no topo, depois cards de link com thumbnail + URL.

### 4. Título editável no topo
Em vez de `<select>`, mostrar o título da meta como texto grande editável ("Casamento →") com dropdown chevron ao lado para trocar entre metas.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/hiperfoco/GoalsBoardV2.tsx` | (1) Inicializar com 1 meta vazia por default. (2) `emptyGoal()` retorna estrutura vazia (grupos sem tarefas, visão em branco, 1 problema vazio). (3) Remover empty state. (4) Visual dos headers: bg marrom/bege, emoji 4xl no canto direito, título grande no body. (5) Checkboxes azuis (não verdes). (6) Visão como campos inline ("**Meta:** editable", "**Objetivo:** editable", "**Tempo:** editable") com hr. (7) Título editável no topo tipo "Casamento → ∨". |

