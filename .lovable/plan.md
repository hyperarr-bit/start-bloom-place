
## Problema

Na seção **Vencimentos das contas** (Finanças), no modo escuro:
- Os cards ficam com fundo claro (`bg-yellow-50`, `bg-slate-50`, etc.) e o texto branco em cima fica ilegível.
- Os cabeçalhos coloridos (amarelo/cinza claro) ficam estourados, criando contraste agressivo num tema escuro.
- O input "Adicionar conta" e o nome das contas ficam quase invisíveis.

A causa é que `BillsDueCards.tsx` usa uma `colorPalette` totalmente hardcoded só com tons claros, sem variantes `dark:`.

## Solução

Editar **apenas** `src/components/BillsDueCards.tsx` para que cada entrada da paleta tenha equivalente em dark mode, mantendo a "cor temática" do dia mas com:

- **Fundo do card**: tom escuro saturado e baixo (ex.: `dark:bg-yellow-950/30`) com **borda visível** mas sutil (`dark:border-yellow-900/50`).
- **Header do dia**: tom mais escuro/profundo da mesma cor (ex.: `dark:bg-yellow-700/40`) com **texto claro** (`dark:text-yellow-100`) — sem amarelo neon.
- **Texto das contas**: herdará `text-foreground` (já adapta), mas confirmar que itens pagos usem `text-muted-foreground` (já está).
- **Input "Adicionar conta..."**: trocar `text-muted-foreground` fixo por classe que respeita o tema (já é, mas com placeholder `placeholder:text-muted-foreground` explícito para garantir).
- **Contador "0/3"** no header: usar `opacity-80` em vez de `opacity-75` para legibilidade no dark.

A estrutura, layout, ícones, lógica de edição, adição e remoção permanecem **intactos**. Nenhum outro arquivo é alterado.

## Paleta proposta (8 cores, light + dark)

| Cor       | Card (light)                  | Card (dark)                              | Header (light)                | Header (dark)                                  |
|-----------|-------------------------------|------------------------------------------|-------------------------------|------------------------------------------------|
| Amarelo   | `bg-yellow-50 border-yellow-200` | `dark:bg-yellow-950/30 dark:border-yellow-900/50` | `bg-yellow-300 text-yellow-900` | `dark:bg-yellow-800/50 dark:text-yellow-100`   |
| Slate     | `bg-slate-50 border-slate-200`   | `dark:bg-slate-900/40 dark:border-slate-800`      | `bg-slate-400 text-slate-50`    | `dark:bg-slate-700/60 dark:text-slate-100`     |
| Indigo    | `bg-indigo-50 border-indigo-200` | `dark:bg-indigo-950/30 dark:border-indigo-900/50` | `bg-indigo-400 text-indigo-50`  | `dark:bg-indigo-800/50 dark:text-indigo-100`   |
| Esmeralda | `bg-emerald-50 border-emerald-200` | `dark:bg-emerald-950/30 dark:border-emerald-900/50` | `bg-emerald-400 text-emerald-50` | `dark:bg-emerald-800/50 dark:text-emerald-100` |
| Rosa      | `bg-rose-50 border-rose-200`     | `dark:bg-rose-950/30 dark:border-rose-900/50`     | `bg-rose-400 text-rose-50`      | `dark:bg-rose-800/50 dark:text-rose-100`       |
| Ciano     | `bg-cyan-50 border-cyan-200`     | `dark:bg-cyan-950/30 dark:border-cyan-900/50`     | `bg-cyan-400 text-cyan-50`      | `dark:bg-cyan-800/50 dark:text-cyan-100`       |
| Laranja   | `bg-orange-50 border-orange-200` | `dark:bg-orange-950/30 dark:border-orange-900/50` | `bg-orange-400 text-orange-50`  | `dark:bg-orange-800/50 dark:text-orange-100`   |
| Roxo      | `bg-purple-50 border-purple-200` | `dark:bg-purple-950/30 dark:border-purple-900/50` | `bg-purple-400 text-purple-50`  | `dark:bg-purple-800/50 dark:text-purple-100`   |

Resultado: cada dia mantém sua identidade visual (amarelo, rosa, verde…), mas no escuro vira um card escuro com **leve tinta** da cor + header mais saturado e texto claro — alinhado ao princípio "hierarquia + contraste controlado, nada de branco em branco".

## Arquivos alterados

- `src/components/BillsDueCards.tsx` — atualizar `colorPalette` e ajustes mínimos de contraste no header/input.
