

# Corrigir campo de Rentabilidade nos Investimentos

## Problema
O campo "Retorno esperado (% a.a.)" no formulário de criação mostra o valor default (10) em vez de ficar vazio com placeholder explicativo. O mesmo ocorre no campo inline de edição — mostra só o número sem contexto.

## Solução

### Formulário de criação (linha 247-252)
- Mudar `value={newInvestment.expectedReturn ?? ""}` para não mostrar o default
- Usar placeholder descritivo: `"Rentabilidade esperada (% a.a.)"`
- Só preencher o value quando o usuário digitar; manter o default 10 apenas no submit se ficar vazio

### Campo inline de edição (linha 338-344)
- Mudar placeholder de `"% a.a."` para `"Rent. esperada (% a.a.)"`
- Manter `defaultValue` com o valor real do investimento (correto)
- Aumentar largura do campo de `w-16` para `w-24` para caber o placeholder

## Arquivo alterado
| Arquivo | Mudança |
|---------|---------|
| `src/components/InvestmentsTracker.tsx` | Ajustar value/placeholder do campo expectedReturn no form e no inline edit |

