## Objetivo

Aplicar as duas mudanças discutidas no onboarding do módulo Finanças, sem mexer em mais nada:

1. **Remover o Passo 1** (tela "Aqui é o seu Meu Financeiro…") — passa a começar direto em "Adicione sua receita".
2. **Pré-preencher o form de receita** com um exemplo (`Salário` / `3000`) enquanto o tutorial está no passo da receita e o usuário ainda não tem receita cadastrada, com microcopy "você pode editar antes de salvar".

## Mudanças

### 1) `src/pages/Index.tsx` — remover Passo 1
Apagar a linha do step `data-spotlight="financeiro"` no array de steps de Finanças (linha 138). O tutorial passa a iniciar diretamente no step `add-income`.

Nada mais no array muda — os demais steps continuam idênticos, na mesma ordem.

### 2) `src/components/IncomeTable.tsx` — pré-preenchimento do exemplo

- Aceitar uma nova prop opcional `prefillExample?: boolean`.
- Quando `prefillExample` for `true` E `incomes.length === 0` E o usuário ainda não digitou nada (`description` e `value` vazios no mount), inicializar `newIncome` com `{ description: "Salário", value: "3000", date: "" }`.
- Renderizar uma linha discreta de microcopy abaixo do form **somente quando o exemplo estiver ativo**:
  > "Exemplo pré-preenchido — você pode editar antes de salvar."
  Estilo: `text-[10px] text-muted-foreground` (consistente com microcopy existente nas linhas 88-89).
- Ao clicar em Adicionar com o exemplo intocado, o item é salvo normalmente (mesmo fluxo atual) — isso satisfaz `advanceOnAction: "first_income"` e avança o tutorial.

### 3) `src/pages/Index.tsx` — passar a prop

Passar `prefillExample={true}` para o `<IncomeTable>` apenas quando: o tutorial de Finanças está ativo E o step corrente é `add-income`. Reaproveitar o estado de spotlight já existente (mesma fonte usada para `data-spotlight`). Quando o tutorial não está ativo, a prop fica `false` e o comportamento do form é exatamente o de hoje.

## Fora de escopo (não vou tocar)

- Outros passos do tutorial (custo fixo, conta, anotação, etc.)
- Layout/estilo do `SpotlightOverlay`, botões "Pular", contagem de passos.
- `AdminFinanceFunnel` e qualquer telemetria.
- Form de receita fora do contexto do tutorial.

## Validação

- Abrir trial novo → tutorial inicia direto em "Adicione sua receita" (sem a tela de boas-vindas do financeiro).
- Form de receita já aparece com "Salário / 3000" + microcopy.
- Clicar em + salva o item, tutorial avança para Passo 3 (custo fixo).
- Editar antes de salvar funciona normalmente.
- Usuário com receita já cadastrada (fora do tutorial): form continua vazio como hoje.
