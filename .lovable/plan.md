## Problema

A roleta de winback está aparecendo cedo demais. Hoje, em `src/hooks/use-winback-trigger.ts`, o `useEffect` que dispara automaticamente abre a roleta sempre que:

- a URL contém `?canceled=true` (volta do checkout cancelado), **ou**
- existe um "intent recente" salvo em `sessionStorage` (clicou em Assinar nos últimos 10 min)

Isso roda mesmo durante o trial ativo, então usuários que só clicaram em Assinar (ou voltaram do checkout) veem a roleta antes da hora.

## Regra desejada

A roleta só pode abrir quando o **trial realmente expirou** — ou seja, no mesmo momento em que o `TrialBanner` mostra a tela de "trial acabou". Antes disso, nunca.

O `useAuth()` já expõe a flag correta: `trialExpired: boolean` (vinda da edge function `check-subscription` via `data.trial_expired`). É essa a única fonte de verdade que devemos usar.

## Mudança

Em `src/hooks/use-winback-trigger.ts`:

1. Importar `useAuth` e ler `trialExpired` (e `isSubscribed`, para sair cedo se já é assinante).
2. No `useEffect` de auto-trigger, adicionar guard: **se `!trialExpired`, retornar sem fazer nada** (não abre, não consome `?canceled=true`, não toca em `sessionStorage`).
3. Em `triggerNow`, adicionar a mesma guarda no início: se `!trialExpired`, retornar `false`. Isso protege qualquer chamada manual futura de também respeitar a regra.
4. Manter intacto: cooldown de 30 dias, checagem de assinatura ativa, criação do registro em `winback_attempts`, limpeza do `sessionStorage` e do `?canceled=true` na URL — tudo isso continua, só passa a só rodar quando o trial expirou.

`markIntent()` continua existindo (usado por `TrialBanner`/`Planos` para marcar a intenção quando o usuário clica em Assinar), mas só vira gatilho real depois do trial expirar.

## Resultado esperado

- Durante o trial (dia 1 a 7, com tempo restante): clicar em Assinar e voltar com `?canceled=true` **não** abre a roleta.
- No momento em que `trialExpired === true` (a tela "seu trial acabou" do `TrialBanner` aparece): a roleta dispara conforme as regras de cooldown já existentes.
- Assinantes ativos (`isSubscribed`) continuam nunca vendo a roleta (já garantido pela checagem de `subscriptions` dentro de `triggerNow`).

## Arquivos alterados

- `src/hooks/use-winback-trigger.ts` (única mudança)

Nenhuma migração de banco, nenhuma edge function, nenhum outro componente precisa mudar. `GlobalWinback` e `WinbackFlow` continuam iguais.