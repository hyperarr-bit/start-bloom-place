# Inverter ordem: tutorial como convidado → criar conta no final

## Objetivo
Quando alguém abre o app pela primeira vez (sem conta):
1. **Não mostrar mais** a `WelcomeScreen` com iPhone + botões "Começar / Entrar".
2. Cair direto no `QuickStartOnboarding` (a tela "Organize sua vida em 1 só lugar" → escolha de módulo → tutoriais dos módulos).
3. Quando concluir os 4 módulos e aparecer a tela "🎉 Parabéns! Você liberou os 16 módulos", o botão **"Bora usar"** vira **"Criar conta para salvar"** e leva para `/auth?signup=1`.
4. Tudo que o convidado preencheu durante o tutorial (nome, primeira despesa, primeiro hábito, primeira refeição, primeiro treino, widgets, etc.) é **preservado** e migrado para a conta nova após signup.

Quem já tem conta continua conseguindo entrar (link "Já tenho conta" no topo do onboarding).

## Como funciona o "modo convidado"

Hoje o app exige login (`ProtectedRoute` redireciona para `/auth`) e o `useUserData` só lê/grava no Supabase quando há `user`. Vamos adicionar um modo guest:

- **Storage convidado**: quando não há `user`, `useUserData` lê e grava em `localStorage` sob o prefixo `guest:<key>` (em vez de `u:<id>:<key>`). Mesma API `get/set/loaded`, sem Supabase.
- **Roteamento**: `/` deixa de exigir login. `ProtectedRoute` passa a permitir convidado em `/` (Home) e nos 4 módulos do tutorial (`/financas`, `/rotina`, `/dieta`, `/treino`). Rotas pagas/avançadas continuam exigindo login (redirecionam para `/auth`).
- **Trial banner / winback / grace**: ocultos para convidado (sem `user`).
- **Inicio (`/inicio`)**: rota mantida apenas como link público antigo, mas removida do fluxo padrão. `WelcomeScreen` continua existindo só para quem acessar `/inicio` direto (não quebra links externos).

## Fluxo completo (convidado)

```text
abre app (/) 
  → Home renderiza
  → QuickStartOnboarding aparece (step 0: "Quero começar")
  → escolhe módulo → vai pro tutorial do módulo (spotlight)
  → volta pra Home → escolhe próximo módulo
  → ... 4 módulos concluídos ...
  → tela "Parabéns! 16 módulos liberados"
  → botão "Criar conta para salvar meu progresso"
  → /auth?signup=1 (mostra aviso "seus dados do tutorial serão salvos")
  → após signup confirmado e login:
       useUserData detecta guest data → faz upsert em massa no user_data → limpa guest:*
```

## Migração guest → conta

No `UserDataProvider`, quando `user` aparece (login/signup) e existe pelo menos uma chave `guest:*` no localStorage:
1. Lê todas as chaves `guest:*`.
2. Para cada uma, faz `upsert` em `user_data` com `{ user_id, key, value }`.
3. Em caso de sucesso, remove as chaves `guest:*` e popula o cache `u:<id>:<key>`.
4. Em caso de conflito (chave já existe na conta — ex.: usuário antigo logando em browser onde alguém testou guest), **a conta vence** e descartamos o guest, exceto para chaves de tutorial (`spotlight-done-*`, `core-onboarding-done`, `core-all-modules-celebrated`) onde guest vence (para não obrigar a refazer o tutorial).

Estratégia técnica: select das chaves existentes do user_data primeiro, decidir conflito por chave, depois upsert em lote.

## Arquivos

**Editar:**
- `src/hooks/use-user-data.tsx` — adicionar branch guest (ler/escrever `guest:*` quando `!user`); adicionar efeito de migração quando user passa de null → definido.
- `src/components/ProtectedRoute.tsx` — aceitar `allowGuest` prop; sem prop continua exigindo login.
- `src/App.tsx` — `/`, `/financas`, `/rotina`, `/dieta`, `/treino` ganham `allowGuest`. Demais rotas seguem como estão.
- `src/pages/Home.tsx` — remover dependência de `user` para inicializar onboarding (já usa `loaded` do useUserData, então funciona com guest).
- `src/components/onboarding/QuickStartOnboarding.tsx` — quando guest e celebração concluída, botão muda para "Criar conta para salvar" e navega para `/auth?signup=1`. Adicionar link discreto "Já tenho conta" no step 0.
- `src/pages/Auth.tsx` — banner topo "Seu progresso do tutorial será salvo na sua conta" quando há `guest:*` no localStorage. Após signup com confirmação por email, instruir usuário; após login a migração roda automática.
- `src/components/TrialBanner.tsx`, `GracePeriodBanner.tsx`, `GlobalWinback.tsx` — early return se `!user` (provavelmente já fazem; confirmar).
- `src/hooks/use-auth.tsx` — `purgeLocalUserCache` em signOut **não pode** apagar `guest:*` (já preserva por allowlist; só garantir que o prefixo `guest:` não cai nos `startsWith` de purga).

**Não mexer:**
- `src/components/WelcomeScreen.tsx` e `src/pages/Inicio.tsx` ficam como estão (rota `/inicio` continua acessível mas não é mais o ponto de entrada).
- Tabelas Supabase: nenhuma migração necessária.

## Detalhes técnicos importantes

- **Heavy keys**: durante guest tudo fica em localStorage (limite ~5MB). Como o tutorial só preenche entradas pequenas (nome, 1 despesa, 1 hábito, etc.) não há risco prático. A regra "imagens vão pro Storage" continua valendo — guests não podem subir pro Storage sem auth, então o `PhotoPicker` deve detectar guest e mostrar "Crie conta para adicionar foto" (fora do escopo dessa task se nenhum widget de tutorial pede foto; verificar e tratar se aparecer).
- **Analytics**: `trackEvent` e `markActivation` exigem `user_id`. Para guest, fazem no-op silencioso (já é o comportamento atual quando user é null).
- **Reset onboarding (`ONBOARDING_RESET_KEY`)**: continua funcionando em guest porque usa `useUserData` que agora tem branch guest.
- **Race condition signup → migração**: o efeito de migração escuta a transição `prevUserId === null && nextUserId !== null` no `UserDataProvider` e roda **antes** de marcar `loaded=true`, para que o primeiro render pós-login já veja os dados migrados.
