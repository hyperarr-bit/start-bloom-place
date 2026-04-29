## Problema

Hoje, quando você abre o app, o **score do dia**, **nome** e **dias consecutivos** mostram zerado/vazio por alguns segundos até o Supabase responder. Só depois eles "pulam" pro valor certo.

### Por que acontece

No `useUserData` (hook que lê os dados), a lógica é:

1. Ao logar, o `store` em memória começa vazio e `loaded = false`.
2. Faz uma única query no Supabase pedindo TODOS os dados do usuário.
3. Enquanto não responde, `useLifeHubData` retorna **defaults zerados** (score=0, streak=0, userName="").
4. Quando a query termina (300ms a 2s dependendo da rede), tudo aparece de uma vez.

O cache local (`localStorage`) **já existe** e é populado, mas ele é **ignorado durante o carregamento** — a função `get()` só lê do localStorage *depois* que `loaded === true`. Ou seja, o cache não está sendo usado para evitar o flash de tela vazia.

## Solução

Hidratar o `store` em memória **imediatamente do localStorage** assim que o usuário é conhecido, antes da query do Supabase terminar. Quando o Supabase responder, sobrescreve com os dados frescos (mas, na maioria das vezes, já vai estar igual).

Resultado: score, nome e streak aparecem **instantaneamente** com o último valor conhecido, e só atualizam se o servidor tiver mudança.

## Mudanças

### `src/hooks/use-user-data.tsx`

1. Adicionar uma função `hydrateFromLocal(userId)` que varre o `localStorage` procurando chaves `u:{userId}:*` e monta um `store` inicial.
2. No `useEffect` que dispara quando o `user` muda:
   - Antes do `loadFromSupabase()`, chamar `hydrateFromLocal(user.id)` e setar `store` + `loaded = true` imediatamente.
   - Manter `loadFromSupabase()` rodando em background. Quando responder, faz merge (dados do servidor sobrescrevem o cache).
3. Ajustar a lógica de "trocou de usuário" pra continuar limpando o cache antigo (segurança multi-conta não muda).

### Comportamento resultante

- **1ª vez logando** (cache vazio): mesmo comportamento de hoje, mostra defaults até o Supabase responder. Sem regressão.
- **2ª vez em diante** (cache cheio): score, nome e streak aparecem **na hora**, sem flash.
- **Trocou de conta**: cache da conta anterior é apagado (já funciona assim).

## Arquivos modificados

- `src/hooks/use-user-data.tsx` (único arquivo)

Sem mudanças no Supabase, sem mudanças no schema, sem novas dependências.
