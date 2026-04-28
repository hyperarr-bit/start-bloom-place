## O que aconteceu (diagnóstico)

Reproduzi o bug lendo o código. Os dados do usuário antigo (`jv20101958`) "vazaram" para a nova conta (`store.street.brasil`) por causa de **três falhas combinadas** no `useUserData` + `useAuth`:

### Falha 1 — `signOut` não limpa o localStorage
`src/hooks/use-auth.tsx` (linha ~95) só chama `supabase.auth.signOut()`. Não apaga nada do `localStorage`.

### Falha 2 — `useUserData` espelha tudo no localStorage **sem prefixar por usuário**
`src/hooks/use-user-data.tsx` (linhas 73 e 124):
```ts
localStorage.setItem(row.key, JSON.stringify(row.value));
```
Salva chaves cruas (`finance-incomes`, `home-name`, etc.) — mesmas chaves para qualquer usuário.

### Falha 3 — `get()` lê do localStorage como fallback antes do Supabase carregar
`src/hooks/use-user-data.tsx` linha 113-118:
```ts
const get = (key, fallback) => {
  if (key in store) return store[key];
  const raw = localStorage.getItem(key);  // ← lê o lixo do usuário anterior
  return raw ? JSON.parse(raw) : fallback;
};
```

### Sequência do bug
1. Você logou no `jv20101958` → todos os dados (financeiro, nome, etc.) foram gravados em `localStorage` com chaves globais.
2. Logout → `localStorage` permaneceu intacto.
3. Login no `store.street.brasil` → antes do `useUserData` terminar de buscar do Supabase, todos os componentes chamaram `usePersistedState` / `get()`, que retornaram os valores do `jv20101958` do `localStorage`.
4. Conforme você navegava, qualquer escrita (`set()`) gravava no Supabase **da conta nova** com os valores **da conta antiga** → contaminação permanente no banco.

Por isso o nome, finanças, etc. apareceram na conta nova — e provavelmente já foram persistidos no Supabase do `store.street.brasil`.

---

## Plano de correção

### 1. Prefixar todas as chaves do localStorage por `user_id`
Em `src/hooks/use-user-data.tsx`, criar helper `lsKey(userId, key) => `u:${userId}:${key}`` e usar em **todas** as leituras/escritas locais. Sem `userId`, não lê nem escreve no localStorage (apenas memória).

Resultado: dados de um usuário ficam fisicamente isolados dos de outro no navegador.

### 2. Limpar localStorage no logout e na troca de usuário
- No `signOut` (`use-auth.tsx`): remover todas as chaves `u:*` e chaves legadas conhecidas (`finance-*`, `home-*`, `core-welcome-done`, etc.). Manter só preferências neutras como tema.
- No `onAuthStateChange`, quando o `user.id` mudar (de A para B, ou de logado para deslogado), limpar o `store` em memória do `UserDataProvider` e o cache local do usuário anterior.

### 3. Não usar localStorage como fallback antes do Supabase carregar
Em `useUserData.get()`: se `loaded === false` e a chave não está no `store`, retornar o `fallback` direto (sem ler localStorage). Só ler localStorage quando ele já estiver corretamente prefixado pelo usuário atual.

`usePersistedState` já tem o flag `hydratedRef` — vai re-hidratar com os dados certos do Supabase quando `loaded` virar `true`.

### 4. Migração das chaves antigas (não-prefixadas) → descartar
Na primeira vez que um usuário logar após o fix, apagar do localStorage todas as chaves não-prefixadas conhecidas (`finance-*`, `home-*`, `core-*`, etc.) — elas são lixo da conta anterior. O Supabase é a fonte da verdade, então nenhum dado real é perdido.

### 5. Limpeza dos dados contaminados no Supabase da conta `store.street.brasil`
Esse fix **previne novos vazamentos**, mas o banco do `store.street.brasil` já recebeu dados do `jv`. Vou precisar:
- Listar com você o que está contaminado (rodar um SELECT em `user_data` filtrando pelo `user_id` do `store.street.brasil`).
- Você decide o que apagar (provavelmente quase tudo, já que a conta era nova).

Faço isso depois do fix de código, num passo separado.

---

## Detalhes técnicos

**Arquivos alterados:**
- `src/hooks/use-user-data.tsx` — prefixar chaves, não ler LS antes do load, limpar ao trocar de user
- `src/hooks/use-auth.tsx` — limpar LS no `signOut`

**Arquivos a auditar (usam localStorage cru, podem precisar de ajuste menor):**
- `src/components/home/AccountDrawer.tsx`
- `src/pages/Auth.tsx` (chave `core-welcome-done` — passar a ser por usuário)
- `src/components/finance/storage-keys.ts` + `MonthComparison.tsx` + `MonthTurnover.tsx` (leem `finance-*` cru — vão precisar consultar via `useUserData` ou ler com prefixo)
- `src/hooks/use-daily-nudge.ts`, `src/hooks/use-offline-queue.ts`, `src/components/MonthlyBudget.tsx`, `src/components/casa/HomeUtilities.tsx`

**Sem mudança de schema** no Supabase. Apenas código cliente + uma limpeza pontual de dados.

---

## Próximo passo

Se aprovar, eu:
1. Implemento o fix completo (itens 1–4).
2. Em seguida, rodo um SELECT no `user_data` da conta `store.street.brasil` e te mostro o que está lá pra você decidir o que apagar.
