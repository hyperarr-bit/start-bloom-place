

# Ajustes no Dashboard

## 3 mudanças:

### 1. Top 5 — Voltar cores por categoria
Restaurar as cores baseadas na categoria de cada despesa (usando `categoryBarColors` e `categoryTextColors` que já existem no arquivo, linhas 329-354) no lugar dos tons de vermelho (`redShades`).

### 2. Mover cards Previsão + Quanto Posso Gastar para o final
Mover o bloco do grid com os dois cards (linhas 441-513) para logo antes de "Últimas Transações" (que é o penúltimo, seguido do Top 5 como último — ou seja, os 2 novos cards ficam como os dois últimos do Dashboard).

Ordem final:
1. Quick Stats
2. Alertas
3. Gastos por Categoria + Receitas vs Despesas
4. Evolução do Patrimônio
5. Progresso do Mês
6. Gasto por Método
7. Fixos vs Variáveis
8. Top 5 Maiores Gastos
9. Últimas Transações
10. **Previsão Fim do Mês + Quanto Posso Gastar Hoje** (últimos)

### 3. Melhorar cálculo do "Quanto Posso Gastar Hoje"
Atualmente faz: `disponível = receita - já gasto`, ignorando despesas fixas futuras.

Nova lógica:
- `custos_fixos_restantes` = soma das despesas fixas (reservar o valor integral, pois são obrigatórias)
- `contas_a_vencer` = contas não pagas nos `dueDays` (estimar valor médio das fixas se não tiver valor)
- `projeção_restante` = usar o `forecast.dailyVariableRate * remainingDays`
- `disponível_real` = receita - já gasto - custos fixos restantes
- `por_dia` = disponível_real / dias restantes
- Se `disponível_real <= 0`: mostrar mensagem "Você não pode gastar — suas contas futuras consomem todo o saldo restante. Guarde o que puder."
- Exibir breakdown: saldo atual, contas pendentes reservadas, disponível livre

## Arquivo alterado
| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Restaurar cores por categoria no Top 5, mover cards de previsão/diário para o final, refazer cálculo do dailyBudget descontando despesas fixas e contas pendentes |

