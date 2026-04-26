## Diagnóstico

Há dois bugs no fluxo de voltar em `/planos`:

**1. Voltar exige 2 cliques e cai na tela "trial acabou" em vez da roleta**
O `triggerNow` no `useWinbackTrigger` aplica um cooldown de 30 dias consultando `winback_attempts`. Confirmei no banco que o usuário atual já tem uma tentativa registrada (em 26/04). Resultado: ao clicar voltar, `triggerNow` retorna `false` (bloqueado pelo cooldown), o `handleBack` então faz `navigate(-1)` → vai para `/`, onde aparece o `TrialBanner` de trial expirado. Como o `popstate` também é assíncrono e re-empurra o sentinel antes de decidir, o usuário percebe como "precisei clicar 2 vezes".

**2. A roleta não aparece após sair**
O `GlobalWinback` montado dentro do `TrialBanner` só dispara automaticamente se houver `?canceled=true` ou `subscribe_intent_at` recente no sessionStorage. Sair de `/planos` não seta nada disso, então mesmo se a roleta pudesse abrir na home, ela não dispara.

## Solução

### 1. Permitir bypass do cooldown para a saída de `/planos`

Em `src/hooks/use-winback-trigger.ts`:

- Adicionar parâmetro opcional `{ bypassCooldown?: boolean }` em `triggerNow`.
- Quando `true`, pula a checagem de `winback_attempts` (mantém checagens de auth, assinatura ativa, `alreadyShown` e lock).
- Mantém checagem de assinatura ativa (não vamos importunar quem já pagou).

Isso garante que o usuário sempre veja a roleta ao tentar abandonar `/planos`, mesmo que já tenha visto antes.

### 2. Voltar com 1 clique e ir para a roleta na home

Em `src/pages/Planos.tsx`:

- Em `handleBack` e no listener de `popstate`, chamar `triggerNow("abandon_planos", { bypassCooldown: true })`.
- Antes de qualquer `navigate(-1)` "fallback" (caso `triggerNow` ainda retorne false por outro motivo), chamar `winback.markIntent()`. Assim, o `GlobalWinback` da próxima rota detecta o intent recente e abre a roleta automaticamente.
- Em `handleWinbackClose`: além de `navigate(-1)`, garantir que o intent seja limpo para a roleta não reabrir na home (o `triggerNow` já remove `INTENT_KEY` ao abrir; aqui só precisa não re-marcar).

### 3. Pequeno ajuste no `popstate`

O handler atual re-empurra o sentinel **antes** de saber se a roleta vai abrir. Se `triggerNow` retorna false, ele faz `navigate(-1)` — mas com o sentinel re-empurrado, isso consome o sentinel e não sai da página, exigindo um segundo clique. Ajuste: só re-empurrar o sentinel quando `triggerNow` retornar `true` (roleta abriu). Quando retornar `false`, marcar intent e deixar o `popstate` original prosseguir naturalmente (já consumiu uma entrada do histórico, então `navigate(-1)` adicional não é necessário).

## Arquivos alterados

- `src/hooks/use-winback-trigger.ts` — assinatura `triggerNow(source, opts?)` com `bypassCooldown`.
- `src/pages/Planos.tsx` — usar `bypassCooldown: true` na saída, marcar intent como fallback, ajustar lógica do `popstate` para não exigir 2 cliques.

## Resultado esperado

- 1 clique na seta voltar → roleta abre imediatamente sobre `/planos` (sem ir para a tela de trial expirado).
- Se por algum motivo a roleta não puder abrir (ex: usuário já é assinante), o fallback navega e o `GlobalWinback` na home dispara via intent recente.
- Após fechar a roleta, `navigate(-1)` leva à rota anterior sem reabrir o modal.
