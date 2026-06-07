## Contexto

A tela "Organize sua vida em 1 só lugar" (imagem 1) e "Por onde você quer começar?" (imagem 2) já são as DUAS únicas telas do `QuickStartOnboarding` (passo 0 e passo 1). Não existem slides no meio hoje — `PreSignupTutorial` não está mais em uso, e `WelcomeScreen` (6 slides) só existe na rota `/inicio`, fora do fluxo principal.

Vou (1) garantir que esses slides antigos não aparecem em lugar nenhum do fluxo, (2) adicionar os eventos que faltam para conseguir medir as 12 etapas com precisão, e (3) refazer `/admin/tutorial-inicial` mostrando cada etapa em ordem com nome explícito, número absoluto, % vs anterior e % vs topo.

## Eventos que já existem (não mexer)

| Etapa do usuário | Evento atual |
|---|---|
| 1. Abriu "Organize sua vida" | `landing_view` com `source=quickstart` |
| 2. Clicou em "Quero começar" | `start_clicked` com `destination=module_choice` |
| 4. Clicou em um módulo | `quickstart_module_chosen` (com `module`) |
| 6. Fez passo N do módulo | `spotlight_step_view` (com `module`, `step`) |
| 7. Finalizou o módulo | `quickstart_completed` (com `module`) |
| 10. Form apareceu | `quicksignup_step_shown` |
| 11. Form terminado | `quicksignup_completed` |

## Eventos novos que vou adicionar

| Etapa | Novo evento | Onde disparar |
|---|---|---|
| 3. Entrou na página "Por onde você quer começar?" | `module_picker_view` | `QuickStartOnboarding` quando `step` muda para 1 |
| 5. Entrou de fato na página do módulo escolhido | `quickstart_module_opened` (com `module`) | `Index/Rotina/Dieta/DesenvolvimentoPessoal` no mount, quando `quickstart-target-module` bate com a rota |
| 8. Voltou pra fazer outro módulo | `quickstart_module_returned` | `QuickStartOnboarding` quando renderiza step 1 com `pendingModules` < 4 (ou seja, já completou ao menos 1 e voltou) |
| 9. Finalizou o tutorial inteiro (4 módulos) | `quickstart_all_completed` | `useModuleCompletionFlow` quando `allDone === true` |
| 13. Aceitou os 7 dias grátis | `trial_accepted` | logo após `quicksignup_completed` no `QuickSignupStep` (assinatura do trial dispara aqui) |

Nenhum evento existente é renomeado — só adição.

## Limpeza dos slides

- Remover import e uso de `PreSignupTutorial` se aparecer em qualquer lugar (já não aparece, mas confirmo no momento da execução).
- Não alterar `QuickStartOnboarding` além de adicionar os 3 novos `trackEvent` listados.
- Não alterar `WelcomeScreen` / `/inicio` (não está no fluxo).

## Admin: `/admin/tutorial-inicial`

Reescrever a página inteira, removendo o funil genérico atual. Estrutura nova:

### Seção única: Funil em ordem cronológica (12 cards verticais)

Cada card mostra:
- Número da etapa (1 a 12, pulando 12 → "13" conforme pedido do usuário) 
- Título em português, exatamente como o usuário descreveu
- Número absoluto de **usuários únicos** (distinct user_id quando logado, senão distinct session_id)
- % de conversão **vs etapa anterior**
- % vs **topo do funil** (etapa 1)
- Barra de progresso proporcional à etapa 1

Lista exata, na ordem:

1. Abriram a página "Organize sua vida em 1 só lugar"
2. Clicaram em "Quero começar"
3. Entraram na página "Por onde você quer começar?"
4. Clicaram em um módulo
5. Entraram de fato no módulo escolhido
6. Fizeram pelo menos 1 passo do tutorial do módulo
7. Finalizaram o módulo
8. Voltaram pra fazer outro módulo
9. Finalizaram o tutorial inteiro (4 módulos)
10. Apareceu o form de cadastro
11. Terminaram o form
12. Aceitaram os 7 dias grátis

### Bloco extra (abaixo do funil): detalhe por módulo

Tabela pequena com Finanças / Hábitos / Dieta / Metas mostrando, em colunas:
- Cliques (4)
- Entraram (5)
- Passo 1, Passo 2, Passo 3… (6, dinâmico)
- Finalizaram (7)
- % de conversão clique → finalizou

### Filtros de período

Manter os mesmos do funil atual: 1h, hoje, 24h, 7d, 30d, tudo, dia+hora.

## Backend

Nova RPC `admin_onboarding_funnel_v2(_from timestamptz, _to timestamptz)`:
- Admin-only via `has_role(auth.uid(), 'admin')`
- Respeita `analytics_reset_at` de `app_config`
- Retorna JSON com `stages` (12 linhas: `key`, `label`, `users`) e `by_module` (linhas por módulo com `clicked`, `opened`, `steps` jsonb, `completed`)
- Unicidade: `coalesce(user_id::text, session_id)`

A RPC antiga `admin_onboarding_funnel` continua existindo para não quebrar nada.

## Arquivos tocados

- `src/components/onboarding/QuickStartOnboarding.tsx` — 2 novos `trackEvent`
- `src/pages/Index.tsx`, `src/pages/Rotina.tsx`, `src/pages/Dieta.tsx`, `src/pages/DesenvolvimentoPessoal.tsx` — `trackEvent("quickstart_module_opened")` no mount se for o módulo escolhido
- `src/hooks/use-module-completion-flow.tsx` — `trackEvent("quickstart_all_completed")` quando `allDone`
- `src/components/onboarding/QuickSignupStep.tsx` — `trackEvent("trial_accepted")` após sucesso
- `supabase/migrations/...sql` — nova RPC `admin_onboarding_funnel_v2`
- `src/pages/admin/AdminTutorialInicial.tsx` — reescrever para consumir a nova RPC e renderizar exatamente as 12 etapas + tabela por módulo
