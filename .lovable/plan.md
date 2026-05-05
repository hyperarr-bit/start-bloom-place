# QA completo do app — bugs encontrados e plano de correção

Testei manualmente o módulo **Finanças** (todas as 7 abas) e a entrada do módulo **Treino** com a conta `store.street.brasil@gmail.com`. Encontrei 6 bugs. Tem mais 13 módulos pra varrer (Dieta, Rotina, Dev. Pessoal, Saúde, Casa, Estudos, Biblioteca, Beleza, Viagens, Carreira, Mente, Relações, Pet, Detox).

## Bugs já identificados

### BUG #1 — Alerta falso "despesas > renda" (Finanças/Dashboard)
`src/components/Dashboard.tsx:268` — quando `totalIncome === 0` e `totalExpenses === 0`, `savingsRate = 0` cai no `else` e mostra warning falso.
**Fix:** condicionar o alerta a `totalExpenses > totalIncome` e ocultar quando ambos forem zero.

### BUG #2 — Labels em inglês (Finanças/Meu Financeiro)
Tabelas de Receitas/Despesas/Dívidas/Investimentos mostram **"+ New"** e placeholder de data **"mm/dd/yyyy"** em vez de PT-BR.
**Fix:** localizar o componente de tabela editável e trocar para "+ Novo" e formato `dd/mm/aaaa` (input type="date" com `lang="pt-BR"` ou máscara).

### BUG #3 — Alerta falso "saldo negativo" (Finanças/Desejos)
Mesmo padrão do bug #1: alerta "Previsão aponta saldo negativo no fim do mês" aparece com tudo zerado.
**Fix:** suprimir o alerta quando o usuário não tem nenhuma receita/despesa cadastrada.

### BUG #4 — Datas em formato inglês (Finanças/Viagem)
DATA DE IDA / DATA DE VOLTA mostram "mm/dd/yyyy".
**Fix:** mesma correção do #2.

### BUG #5 — Score Financeiro 25/100 com conta vazia (Finanças/Saúde Financeira)
Usuário novo sem dado nenhum recebe score 25/100 + "Precisa Melhorar" — desmotivante e enganoso.
**Fix:** quando `totalIncome === 0 && totalExpenses === 0 && totalInvestments === 0 && totalDebts === 0`, mostrar estado vazio "Cadastre seus dados financeiros para ver seu score" em vez de calcular.

### BUG #6 — Dia da semana errado (Treino/Hoje)
Hoje é terça (5/maio/2026) mas o card mostra "SEGUNDA ⬅️ HOJE".
**Fix:** verificar lógica de cálculo do dia atual no componente (provavelmente off-by-one no índice do array de dias ou timezone errado).

## Plano de execução

### Etapa 1 — Corrigir os 6 bugs já identificados
Editar os arquivos:
- `src/components/Dashboard.tsx` — bugs #1 e #5 (lógica de alertas/score com dados vazios).
- Componente de Desejos em `src/components/financas/` (a localizar) — bug #3.
- Componente de tabela editável em finanças — bugs #2 e #4 (i18n PT-BR).
- Componente "Hoje" do Treino — bug #6 (cálculo do dia).

### Etapa 2 — Varrer os 13 módulos restantes
Pra cada módulo, testar 3 coisas mínimas:
1. Carrega sem crash com conta zerada.
2. Cada aba do módulo abre.
3. Botão principal de cada aba (adicionar/criar) funciona ou abre form.

Documentar cada bug encontrado e corrigir na mesma rodada. Foco em padrões já vistos:
- Strings em inglês esquecidas
- Alertas/scores falsos com dados vazios
- Datas/dias da semana incorretos
- Valores hardcoded em vez de tokens de cor

### Etapa 3 — Re-teste rápido pós-fix
Voltar nos 6 bugs corrigidos pra confirmar que ficaram OK, e nos novos bugs achados na etapa 2.

## Observação

Esse trabalho é grande (talvez ~30+ bugs no total considerando o padrão visto em Finanças). Recomendo aprovar o plano para eu **entrar em modo build, corrigir os 6 bugs já mapeados e seguir varrendo módulo a módulo na sequência**, anotando e consertando tudo numa rodada só, em vez de pingar entre planos.
