
## Diagnóstico

Após mapear o projeto, o problema de contraste no dark mode tem **3 causas distintas** — cada uma exige um tratamento diferente:

### 1. Cores Tailwind hardcoded sem variantes `dark:` (causa principal)
Mais de **190 ocorrências** só nas 7 páginas principais (Rotina, Biblioteca, Estudos, Dieta, Carreira, Treino, Desenvolvimento Pessoal) usam trios do tipo:

```tsx
className="bg-blue-100 text-blue-700 border-blue-200"
```

No dark mode esses fundos claros + texto escuro saturado quebram (claro-em-claro ou texto ilegível). Componentes afetados em larga escala:

- **Páginas**: Rotina, Biblioteca, Estudos, Dieta, Carreira, Treino, DesenvolvimentoPessoal, Casa, Saúde, Beleza, Pet, Detox, Hiperfoco, Viagens, Relacionamentos.
- **Componentes finanças** (parcial — alguns já têm `dark:`): ExpenseTable, FixedExpensesTable, InstallmentTracker, FinancialGoals, WishlistItems.
- **Subcomponentes**: casa/*, saude/*, beleza/*, travel/*, pet/*, hiperfoco/*, relacionamentos/*, detox/*.

### 2. Uso de `bg-foreground` / `text-background` (inversão total)
Padrão `.notion-tab-active` original — já corrigi na mensagem anterior, mas a busca encontrou casos parecidos a verificar (`table-header-dark`, alguns headers de seção).

### 3. Fundos brancos puros e bordas claras demais nos cards
Tokens já estão razoáveis (`--card: 220 10% 9%`, `--border: 220 8% 16%`), mas alguns componentes ignoram tokens e usam `bg-white`, `border-gray-200` direto.

## Estratégia

Em vez de fazer 190 edits frágeis (cada um com `dark:bg-X-950/30 dark:text-X-300 dark:border-X-900/50`), vou criar **utilitários semânticos centralizados** em `src/index.css` que encapsulam o conjunto fundo+borda+texto com light **e** dark equilibrados — e depois substituir os trios nos arquivos.

### Etapa A — Criar paleta de "tinted surfaces" no `src/index.css`

Adicionar 12 classes utilitárias (uma por matiz comum), cada uma com contraste calibrado para os 2 temas:

```css
@layer components {
  /* fundo levemente tingido + borda + texto, ambos os temas */
  .tint-blue    { @apply bg-blue-100/70 text-blue-800 border-blue-200
                         dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20; }
  .tint-green   { @apply bg-green-100/70 text-green-800 border-green-200
                         dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20; }
  .tint-emerald { ... }
  .tint-red     { ... }
  .tint-orange  { ... }
  .tint-amber   { ... }
  .tint-yellow  { ... }
  .tint-purple  { ... }
  .tint-pink    { ... }
  .tint-rose    { ... }
  .tint-indigo  { ... }
  .tint-cyan    { ... }
  .tint-slate   { ... }
}
```

Princípios aplicados:
- **Light**: fundo `-100/70` (sutil), texto `-800` (legível, AA), borda `-200`.
- **Dark**: fundo `cor/10` (tinta sobre o card escuro, sem virar bloco saturado), texto `-300` (claro mas não branco neon), borda `cor/20`.

Isso elimina o "branco demais" e o "amarelo neon demais" simultaneamente — segue o princípio "hierarquia + contraste controlado" da memória de design.

### Etapa B — Substituir nos componentes de maior impacto

Substituir trios `bg-X-100 text-X-700 border-X-200` por `tint-X` nas seguintes ondas (ordem por impacto):

**Onda 1 — páginas com mais ofensores:**
- `src/pages/Rotina.tsx` (61 fundos claros)
- `src/pages/Estudos.tsx` (43)
- `src/pages/Biblioteca.tsx` (39)
- `src/pages/Carreira.tsx` (27)
- `src/pages/DesenvolvimentoPessoal.tsx` (27)
- `src/pages/Dieta.tsx` (25)
- `src/pages/Treino.tsx` (22)

**Onda 2 — componentes de finanças sem dark:**
- `ExpenseTable.tsx`, `FixedExpensesTable.tsx`, `InstallmentTracker.tsx`, `WishlistItems.tsx`, `FinancialGoals.tsx`, `CategoryBudgets.tsx` (revisar — já tem `dark:`, mas validar contraste).

**Onda 3 — subcomponentes de módulos:**
- `casa/*`, `saude/*`, `beleza/*`, `travel/*`, `pet/*`, `hiperfoco/*`, `relacionamentos/*`, `detox/*`.

### Etapa C — Limpeza pontual de outros vazamentos

- Trocar `bg-white` / `bg-black` / `text-white` / `text-black` hardcoded por tokens (`bg-card`, `text-foreground`).
- Revisar cabeçalhos de tabela coloridos (`bg-yellow-300` etc.) que não têm variante dark.
- Garantir que **placeholders** de inputs em todos os formulários usem `placeholder:text-muted-foreground`.

### Etapa D — Verificação visual

- Após cada onda, abrir a página no preview em dark mode.
- Validar: nenhum bloco branco/quase-branco; nenhum texto ilegível; transições entre cards e fundos suaves; cor temática preservada (azul ainda parece azul, etc.).

## Escopo desta iteração

Por **tamanho real** desta refatoração (centenas de substituições + verificação visual), proponho dividir:

**Iteração atual (esta aprovação)** → Etapa A (criar utilitários) + Onda 1 (7 páginas mais críticas) + limpeza de `bg-white`/`bg-black` órfãos.

**Próximas iterações** (você pede quando quiser) → Onda 2 (finanças), Onda 3 (subcomponentes), validação final.

Isso entrega o maior salto de qualidade visual possível em uma única passada, sem inflar uma única alteração gigante e arriscada.

## Arquivos alterados nesta iteração

- `src/index.css` — adicionar 13 classes `.tint-*`.
- `src/pages/Rotina.tsx`
- `src/pages/Estudos.tsx`
- `src/pages/Biblioteca.tsx`
- `src/pages/Carreira.tsx`
- `src/pages/DesenvolvimentoPessoal.tsx`
- `src/pages/Dieta.tsx`
- `src/pages/Treino.tsx`
- Ajustes pontuais onde houver `bg-white`/`text-white` hardcoded fora de gradientes.

Nenhuma lógica/estrutura é alterada — apenas classes de cor.
