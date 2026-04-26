## Objetivo

Mudar o trial de **24h** para **7 dias sem cartão**, criar uma jornada de **onboarding D1-D7** (e-mail + push web opcional) que incentiva ativação de módulos, e fazer o paywall aparecer só no D6/D7 — sem nunca tirar do usuário a opção de assinar antes.

---

## 1. Trial: 24h → 7 dias (sem cartão)

**Backend (`check-subscription/index.ts`)**

- `checkTrialExpired`: trocar `hours > 24` por `days > 7`.
- Retornar também `trial_day` (1–7) e `trial_hours_left` para o frontend renderizar prompts diferentes por dia.

**Frontend (`TrialBanner.tsx` + `use-auth.tsx`)**

- `useAuth` passa a expor `trialDay` e `trialHoursLeft`.
- Banner muda de tom por fase:
  - **D1-D3** (descoberta): banner discreto "Você está no seu teste grátis — explore à vontade. [Assinar agora]".
  - **D4-D5** (engajamento): banner mostra progresso de ativação ("Você já usou X módulos. Faltam Y dias.") + CTA suave.
  - **D6** (conversão): banner sticky no topo com countdown "Resta 1 dia. Garanta seu acesso." + CTA primário.
  - **D7** (último dia): modal não-bloqueante ao abrir o app + banner urgente.
  - **Pós-D7**: tela bloqueante atual (já existe), redireciona para `/planos`.
- Botão **"Assinar agora"** sempre visível em todos os estados (mesmo D1) → garante a opção de pagar quando quiser.

**Auth (`Auth.tsx` linha 229)**

- Trocar copy "Sem cartão de crédito necessário" por "**7 dias grátis. Sem cartão. Cancele quando quiser.**"

---

## 2. Sequência de onboarding D1-D7

### Infraestrutura de e-mail

Usar **Lovable Emails** (built-in). Sequência:

1. Configurar domínio de e-mail (vai aparecer botão de setup se ainda não tiver).
2. Scaffold de transactional emails.
3. Criar 7 templates React Email em `_shared/transactional-email-templates/`:


| Dia         | Template                | Gatilho                            | Mensagem-chave                                                              |
| ----------- | ----------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| D0 (signup) | `trial-welcome`         | imediato após signup               | "Bem-vindo. Seus 7 dias começaram. Comece pelo módulo Rotina."              |
| D1          | `trial-d1-first-action` | 24h após signup, se não criou nada | "Que tal registrar sua primeira tarefa?" (deep-link `/rotina`)              |
| D2          | `trial-d2-finance`      | 48h                                | "Adicione 1 transação e veja seu primeiro insight financeiro."              |
| D3          | `trial-d3-habit`        | 72h                                | "Crie 1 hábito. Estudo mostra: 3 dias = início de rotina."                  |
| D4          | `trial-d4-progress`     | 96h                                | Recap personalizado: "Você usou X módulos esta semana."                     |
| D5          | `trial-d5-value`        | 120h                               | "Veja seu painel de progresso. Faltam 2 dias do trial."                     |
| **D6**      | `trial-d6-convert`      | 144h                               | **Primeiro CTA forte de pagamento** — "Garanta seu acesso por R$14,90/mês." |
| **D7**      | `trial-d7-last-call`    | 168h                               | **Último dia** — desconto opcional / urgência.                              |


### Agendamento (cron)

- Tabela nova: `trial_email_schedule` (`user_id`, `email_key`, `send_at`, `sent_at`, `status`).
- No signup (trigger DB ou edge function `schedule-trial-emails`): inserir 8 linhas (D0–D7) com `send_at` calculado a partir de `created_at`.
- Cron job pg_cron a cada 15min: chamar edge function `dispatch-trial-emails` que:
  1. Busca rows com `send_at <= now()` e `status='pending'`.
  2. Para cada uma, checa se usuário ainda está em trial e não pagou; se sim, invoca `send-transactional-email`.
  3. Marca como `sent` (ou `skipped` se já é assinante).
- **Idempotência**: `idempotencyKey = "trial-${user_id}-${email_key}"`.

### Dados dinâmicos por e-mail

Edge function de dispatch lê `module_analytics` e `user_data` do usuário para personalizar:

- "Você ainda não criou nenhuma transação" vs. "Você já registrou 5 transações"
- Lista os 3 módulos mais usados no D4.

### Push notifications (web)

- **Opt-in suave**: na primeira sessão >2min, modal "Quer dicas para aproveitar seu trial? Ative as notificações."
- Usar Web Push API + Service Worker (`public/sw.js` já existe? — verificar; se não, criar).
- Mesma sequência D1-D7 reaproveitada (push só dispara se permissão concedida; e-mail é fallback universal).
- Para começar simples: implementar apenas o opt-in + persistência da subscription no Supabase (`push_subscriptions` table). Disparo real de push pode ficar para iteração futura — **e-mail é o canal principal**.

---

## 3. Pagamento sempre disponível

- Botão "Assinar" persistente no `AccountDrawer` e no `TrialBanner` em **todos** os dias (D1-D7).
- Página `/planos` acessível a qualquer momento via menu/conta.
- Em todos os e-mails (mesmo D1-D5), incluir link discreto no rodapé: "Já quer assinar? [Garantir acesso]".

---

## 4. Mudanças no banco

Migração nova (apenas schema, sem dados):

1. `trial_email_schedule` (id, user_id, email_key, send_at, sent_at, status, created_at) com RLS.
2. `push_subscriptions` (id, user_id, endpoint, p256dh, auth, created_at) com RLS.
3. Trigger `on_auth_user_created`: além de criar profile, popular `trial_email_schedule` com 8 entradas.
4. Cron pg_cron `dispatch-trial-emails` a cada 15min via pg_net.

Funções `admin_metrics_overview` e similares: nada muda; passam a refletir naturalmente o trial de 7 dias.

---

## 5. Detalhes técnicos

**Arquivos novos**

- `supabase/functions/dispatch-trial-emails/index.ts`
- `supabase/functions/_shared/transactional-email-templates/trial-welcome.tsx` (e D1-D7)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (atualizar)
- `src/hooks/use-push-notifications.ts`
- `src/components/PushOptInModal.tsx`
- `public/sw.js` (se não existir)

**Arquivos editados**

- `supabase/functions/check-subscription/index.ts` — 24h → 7d, expor `trial_day`.
- `src/hooks/use-auth.tsx` — expor `trialDay`, `trialHoursLeft`.
- `src/components/TrialBanner.tsx` — UI por fase + CTA sempre visível.
- `src/pages/Auth.tsx` — copy "7 dias sem cartão".
- `src/components/home/AccountDrawer.tsx` — botão "Assinar" permanente.

**Pré-requisito de e-mail**: Se o domínio ainda não estiver configurado, o setup vai aparecer como primeiro passo. Após configuração, a sequência é ativada automaticamente.

---

## Resultado esperado

- Trial de 7 dias real, sem fricção de cartão na entrada.
- 8 toques de e-mail bem-cronometrados aumentando ativação e empurrando conversão só quando faz sentido (D6/D7).
- Push como canal complementar (opt-in).
- Pagamento disponível a qualquer momento — usuário decidido converte no D2 se quiser.
- Métricas do `/admin` continuam funcionando e agora ficam mais ricas (vão mostrar conversão por dia do trial).