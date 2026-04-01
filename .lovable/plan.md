

## Plano: Ativar cópia de receitas + adicionar mais opções úteis

### O que muda

1. **Receitas** — transformar de item desabilitado para checkbox ativo (como custos fixos e vencimentos). Estado inicial `false` mas o usuário pode marcar.

2. **Parcelas/Dívidas (Installments)** — copiar parcelas em andamento faz sentido, pois dívidas continuam entre meses. As parcelas pagas não mudam, mas o registro das parcelas ativas deve seguir.

3. **Notas** — o usuário pode ter anotações financeiras que quer manter no novo mês (lembretes, observações).

### Alterações no arquivo `src/components/MonthTurnover.tsx`

- Adicionar estados `copyIncomes` (default `false`), `copyInstallments` (default `true`), `copyNotes` (default `false`)
- No wizard de cópia (step "copy"), substituir o bloco desabilitado de receitas por um checkbox funcional com descrição "Salário, freelance, etc. — valores podem variar"
- Adicionar checkbox para "Copiar parcelas/dívidas" com descrição "Parcelas em andamento continuam no novo mês"
- Adicionar checkbox para "Copiar notas" com descrição "Anotações e lembretes financeiros"
- Atualizar `copyToMonth` para suportar `incomes`, `installments` e `notes`
- Atualizar `handleCopy` para passar as novas opções
- Atualizar a condição `disabled` do botão para considerar todas as opções
- Contar itens de receitas, parcelas e notas do mês anterior para mostrar no wizard

