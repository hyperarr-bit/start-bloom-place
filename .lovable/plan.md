## O que aconteceu

Eu populei a sua conta com dados de demo, mas em algumas chaves botei o **formato errado** (objeto onde o app espera array). Isso causou os crashes:

- `saude-workout-log` → era pra ser `["2026-04-30", "2026-05-01", ...]`, eu botei `{ "2026-04-30": {done, duration}, ... }` → crash no Home (já corrigido na última migration).
- `dieta-meals-config` → era pra ser `["Café da Manhã", "Almoço", ...]`, eu botei `{ calorieGoal, proteinGoal, ... }` → crash atual no Dieta.
- Possivelmente outras chaves estão no formato errado também.

**Nenhum arquivo .ts/.tsx foi alterado.** Só dados.

## O que vou fazer

1. **Auditar todas as 119 chaves que inseri**: pra cada uma, ler rapidamente o componente que consome ela e checar se o `jsonb_typeof` bate com o que o código espera (`array` vs `object` vs `string` vs `number`).
2. **Corrigir em uma única migration de UPDATE**: pra cada chave com formato errado, sobrescrever com o shape correto (mantendo dados realistas — salário, hábitos, treinos, etc.).
3. **Chaves que não consigo arrumar com confiança serão removidas** (DELETE) pra deixar o app cair no fallback default em vez de crashar.
4. **Não mexer em nenhum arquivo de código.**

## Chaves suspeitas que já identifiquei e como vão ficar

| Chave | Formato esperado | Ação |
|---|---|---|
| `dieta-meals-config` | `string[]` | Vira `["Café da Manhã","Almoço","Lanche","Janta"]` |
| `saude-workout-log` | `string[]` (datas) | Já corrigido na última migration |
| `core-rotina-habits` | `array de objetos {id,name,...}` | Confirmar formato |
| Outras | A verificar | Auditar antes de aplicar |

## O que NÃO vou fazer

- Não vou editar nenhum componente React.
- Não vou criar tabela nova.
- Não vou mexer em auth, subscription, profile.
- Se em alguma chave eu não tiver certeza do shape, **deleto a chave** (volta pro estado vazio, sem dado de demo, mas sem crash) em vez de chutar.

## Resultado esperado

App abre em todos os módulos sem erro, com os dados de demo realistas que você queria pra gravar o criativo. Se algum módulo voltar vazio, é porque eu preferi deletar a chave a arriscar quebrar de novo — você me avisa e eu preencho aquele módulo específico depois com cuidado.

Posso aplicar?