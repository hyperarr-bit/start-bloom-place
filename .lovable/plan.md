
Diagnóstico confirmado

O texto da imagem é:
`Edge Function returned a non-2xx status code`

O que isso significa:
- a tela só está mostrando um erro genérico do `supabase.functions.invoke(...)`
- o erro real está no backend da edge function

Do I know what the issue is?
Sim.

O erro real atual, pelos logs da função, é:
`[ABACATEPAY-CHECKOUT] ERROR: User not authenticated`

Leitura fria do problema

1. A rota `/planos` hoje é pública
- em `src/App.tsx`, a rota `"/planos"` não está dentro de `ProtectedRoute`

2. O checkout depende obrigatoriamente de usuário autenticado
- em `supabase/functions/abacatepay-checkout/index.ts`, a função busca o usuário pelo token e falha se não houver sessão:
  - `if (!user?.email) throw new Error("User not authenticated")`

3. A tela de planos não barra usuário deslogado antes de chamar a função
- em `src/pages/Planos.tsx`, `handleCheckout()` tenta seguir o fluxo mesmo se `supabase.auth.getUser()` voltar sem usuário
- então o frontend chama a edge function sem sessão válida e recebe o erro genérico da imagem

4. O problema atual não é mais o payload do cliente
- `phone` e `tax_id` já foram adicionados
- o bloqueio agora acontece antes, na autenticação

5. A migração para recorrência AbacatePay continua sendo importante, mas é uma etapa separada
- primeiro precisamos fazer o fluxo parar de falhar por auth
- não faz sentido mexer em webhook/recorrência enquanto o checkout nem passa da autenticação

Plano de correção

1. Fechar a entrada errada do fluxo
- proteger a rota `/planos` com `ProtectedRoute`
- assim, se alguém tentar abrir planos sem login, vai para `/auth`

2. Adicionar uma segunda proteção na própria tela
- em `src/pages/Planos.tsx`, antes de invocar `abacatepay-checkout`, validar sessão explicitamente
- se não houver usuário:
  - mostrar mensagem clara tipo `Faça login para assinar`
  - redirecionar para `/auth`
  - não chamar a edge function

3. Endurecer a edge function
- em `supabase/functions/abacatepay-checkout/index.ts`:
  - validar `Authorization` com segurança, sem `!`
  - retornar erro explícito de autenticação quando faltar token/sessão
  - manter logs claros para diferenciar:
    - sem header
    - token inválido
    - usuário inexistente
- opcionalmente devolver resposta estruturada (`ok: false`) para o frontend conseguir exibir o erro real

4. Melhorar a mensagem mostrada no app
- em `Planos.tsx`, tratar melhor o retorno de erro da função
- se vier erro conhecido de autenticação, mostrar algo como:
  - `Sua sessão expirou. Entre novamente para continuar.`
em vez do genérico `non-2xx`

5. Só depois retomar a parte da recorrência
- com o auth resolvido e o checkout abrindo, aí sim revisar a integração AbacatePay para assinatura recorrente real
- essa parte deve vir numa segunda rodada, separada do bug atual

Arquivos que entram nesta correção
- `src/App.tsx`
- `src/pages/Planos.tsx`
- `supabase/functions/abacatepay-checkout/index.ts`

Arquivos que não precisam entrar agora
- `supabase/functions/abacatepay-webhook/index.ts`
- novas migrations no banco

Detalhes técnicos
- causa imediata: rota pública + checkout dependente de sessão
- sintoma visual: toast genérico do Supabase Functions
- causa real no backend: `User not authenticated`
- evidência adicional: o replay/snapshot mostra sessão caindo em `/auth`, reforçando que houve tentativa sem autenticação ativa

Resultado esperado após a implementação
- usuário deslogado não consegue mais disparar checkout
- usuário logado consegue chamar a edge function com sessão válida
- se a sessão expirar, o app mostra erro claro e redireciona corretamente
- aí fica possível depurar somente o que sobrar da integração com a AbacatePay, sem esse falso ruído de autenticação
