

# Previsão Fim do Mês — Cálculo Mais Inteligente

## Problema
Atualmente a previsão usa `totalExpenses / dia_atual` como taxa diária, o que é impreciso — se o aluguel cai no dia 5, parece que o usuário gasta R$3.000/dia nos primeiros dias. Precisa separar custos fixos (previsíveis) de variáveis (ritmo real).

## Nova Lógica

```text
Receita total
- Custos fixos (integral, sempre reservados)
- Contas pendentes (dueDays não pagas, estimativa)
- Gastos variáveis já feitos
- Projeção variável restante (taxa_variável × dias_restantes)
= Saldo projetado
```

Detalhes:
- **Taxa variável** = `totalExpenses_variáveis / dia_atual` (só despesas da tabela de variáveis, sem fixas)
- **Custos fixos** = soma integral das `fixedExpenses` (reservados, não projetados por dia)
- **Contas pendentes** = bills não pagas nos `dueDays`, estimadas pelo valor médio das fixas
- **Projeção restante** = só a parte variável × dias restantes

## Breakdown Exibido no Card

| Linha | Cor |
|-------|-----|
| Receita total | verde |
| Custos fixos reservados | vermelho |
| Contas pendentes | vermelho |
| Já gasto (variável, dia X) | laranja |
| Projeção variável restante | amarelo |
| **Saldo projetado** | verde/vermelho |

Mensagem explicativa: "Custos fixos reservados integralmente. Projeção baseada no ritmo de gastos variáveis."

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Refazer `forecast` useMemo separando fixas de variáveis; atualizar breakdown no card com linhas detalhadas |

