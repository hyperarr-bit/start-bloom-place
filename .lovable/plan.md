# Dark Mode Premium — Aba Financeiro

## Objetivo
Aplicar um dark mode sofisticado e sóbrio (estilo Notion/Linear/Stripe) na aba Financeiro, mantendo 100% da estrutura, hierarquia e funcionalidades. Apenas cores, contrastes, bordas e sombras mudam.

## Escopo
- **Light mode**: intocado.
- **Identidade Receitas / Despesas / Dívidas / Investimentos**: mantida, apenas ajustada para tons profundos e dessaturados.
- **Componentes afetados (visualmente)**: `FinancialSummary`, `ExpenseTable`, `IncomeTable`, `FixedExpensesTable`, `InstallmentTracker`, `InvestmentsTracker`, `BillsDueCards`, `Calculator`, `Notes`, `Dashboard` (cards/listas), tabelas em geral. Nenhuma alteração em props, JSX, lógica ou ordem dos elementos.

## O que será alterado

### 1. Tokens globais do tema escuro (`src/index.css`, bloco `.dark`)
Substituir os HSL atuais pelos tons premium pedidos:

| Token | Valor (HSL) | Hex aprox. |
|---|---|---|
| `--background` | `222 16% 7%` | #0F1115 |
| `--card` | `222 14% 11%` | #161A22 |
| `--popover` | `222 14% 11%` | #161A22 |
| `--secondary` / `--muted` | `222 14% 14%` | #1B2030 |
| `--foreground` / `--card-foreground` | `0 0% 100%` | #FFFFFF |
| `--muted-foreground` | `220 8% 67%` | #A1A7B3 |
| `--border` / `--input` | `222 12% 18%` | #2A3042 |
| `--ring` | `220 8% 70%` | cinza claro |

Texto auxiliar (`#8A90A0`) fica disponível via `text-muted-foreground/80` quando necessário, sem novo token.

### 2. Identidade financeira (cards de resumo)
Reescrever as 4 famílias em `.dark` com tons profundos e baixa saturação:

| Card | Fundo | Borda (~20% opac) | Texto/ícone |
|---|---|---|---|
| Receitas (dourado escuro) | `38 35% 12%` | `38 55% 32%` | `42 75% 70%` |
| Despesas (roxo profundo) | `258 22% 14%` | `258 35% 32%` | `258 60% 78%` |
| Dívidas (vermelho vinho) | `350 28% 13%` | `350 40% 32%` | `350 70% 76%` |
| Investimentos (verde petróleo) | `175 35% 11%` | `175 40% 28%` | `170 50% 70%` |

Também ajustar `--income` / `--expense` para acompanharem (mesma família, tom escuro).

### 3. Tabelas (`.table-cell`, `.table-header-dark`)
- Linhas alternadas: criar utility nova `.dark .table-row-alt` baseada em `hsl(var(--card)/0.55)` para zebra discreto sem brancos.
- Hover: `hover:bg-muted/60` (já presente em vários lugares — apenas garantir o token novo).
- Bordas das células passam a usar o novo `--border` mais sutil (#2A3042).
- Nenhuma mudança de markup nas tabelas; só os tokens já consumidos por elas.

### 4. Calculadora (`Calculator.tsx`)
Adicionar overrides via classes existentes (sem trocar JSX), através de novas regras CSS escopadas:
- `.dark .calc-shell` → fundo `#0B0D12` (mais escuro que o app).
- `.dark .calc-key` → relevo suave (gradiente sutil + sombra interna 1px).
- `.dark .calc-key-action` (=, AC) → usar `--accent` em tom dourado escuro `38 70% 48%`.
- `.dark .calc-display` → sombra interna `inset 0 2px 8px rgba(0,0,0,.5)`.

Se as classes acima ainda não existirem no Calculator, serão adicionadas em `className` apenas (sem alterar estrutura, props ou lógica).

### 5. Notas (`Notes.tsx`)
- `.dark .notes-shell` → fundo grafite com leve viés rosa: `340 12% 10%`.
- Header/ícone permanecem com acento rosa em `--accent`, mas saturação reduzida no dark.
- Remover qualquer rosa claro presente apenas no dark.

### 6. Vencimentos (`BillsDueCards.tsx`)
- Aplicar a mesma lógica dos cards de resumo: fundo escuro tingido + número do dia em `text-foreground` (branco) + textos secundários em `text-muted-foreground`.
- Ajustes feitos via tokens já consumidos (`--card-*`), portanto não precisa tocar no componente.

### 7. Sombras e profundidade
Adicionar utilities em `@layer components`:
- `.shadow-premium` → `0 1px 0 hsl(0 0% 100% / 0.04) inset, 0 8px 24px -12px rgba(0,0,0,.6)`
- Aplicar somente onde já existe `shadow-sm` em cards financeiros (substituição direta por `dark:shadow-premium`).

## O que NÃO será alterado
- Layout, grids, posições, espaçamentos, fontes, ícones e textos.
- Comportamento dos componentes, hooks, dados, queries e estado.
- Light mode (todos os tokens light permanecem como estão).
- Outras abas (Saúde, Rotina, Casa, etc.) — só herdam os ajustes globais de `--background`/`--card`/`--border`/`--foreground` no dark, que já melhoram a leitura sem mudar identidade.

## Detalhes técnicos
- Tudo via CSS variables HSL já consumidas pelo Tailwind config — nenhum hex hardcoded em componentes.
- Mudanças concentradas em: `src/index.css` (bloco `.dark` + novas utilities). Toques mínimos em `Calculator.tsx` e `Notes.tsx` somente para adicionar classes wrapper (`calc-shell`, `notes-shell`) caso ainda não existam.
- Os 4 paletas alternativos (`midnight`, `ocean`, `rose`, `forest`) continuam sobrescrevendo tokens via `paletteVars` — para manter consistência, esta refatoração aplica-se à paleta `default` (a que o usuário usa). As outras paletas seguem como estão.

## Resultado esperado
- Background grafite confortável, sem preto puro nem brancos agressivos.
- Cards financeiros com identidade preservada, porém escuros e elegantes.
- Tabelas legíveis com zebra sutil e sem linhas brancas.
- Calculadora com profundidade e teclas de ação destacadas.
- Notas em tom escuro com acento rosa controlado.
- Aparência de produto pago premium, alinhada a Notion/Linear/Stripe.
