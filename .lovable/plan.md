# Reset analytics + fix tracking + jornada por usuário

## 1. Zerar contagens a partir de agora

Adicionar uma "linha do tempo" para o admin: tudo gravado antes do reset some das telas (sem apagar dados crus).

- Gravar em `app_config` a chave `analytics_reset_at` = `now()` ao clicar num botão "Zerar contadores" no admin.
- Atualizar `admin_landing_funnel`, `admin_tutorial_dropoff` e `admin_dashboard_v2` para considerar `GREATEST(cutoff_por_dias, analytics_reset_at)` ao filtrar eventos.
- Botão "Zerar contadores agora" no topo da página Aquisição/Tutorial (com confirmação).

## 2. Por que "Quero começar" e "Concluiu tutorial" estão em 0

Os eventos `start_clicked` e `pre_signup_tutorial_completed` só disparam quando o visitante é convidado (`isGuest`). Como você está testando logado, nada conta. Mesma coisa para o passo-a-passo dos módulos: o admin filtra por sessão de convidado.

Correções em `QuickStartOnboarding.tsx`:
- Disparar `start_clicked`, `pre_signup_tutorial_started` e `pre_signup_tutorial_completed` para todos os usuários (com flag `is_guest` no payload).
- Disparar `landing_view` também para logados (com `source: "quickstart"`).

Em `SpotlightOverlay.tsx`:
- Manter `spotlight_shown` e `spotlight_step_view` para todos (hoje só rola pra guest).

## 3. Jornada do usuário (drill-down)

Nova RPC `admin_user_journey(_user_id uuid, _session_id text)` retornando lista cronológica de eventos do usuário (ou sessão pré-cadastro):
- timestamp, event_name, módulo, passo, label, página.

Na página **Usuários** do admin: cada linha ganha uma seta `>` que expande mostrando:
- Linha do tempo vertical: "Visitou → Clicou 'Quero começar' → Escolheu Finanças → Passo 1 Vencimentos → Passo 2 Cartões → **abandonou aqui**".
- Indica o último passo visto e em qual módulo + label parou.

Para visitantes anônimos (sem user_id), agrupar por `session_id` numa aba separada "Visitantes" mostrando a mesma timeline.

## Detalhes técnicos

**Migração SQL:**
- `INSERT INTO app_config (key, value) VALUES ('analytics_reset_at', jsonb_build_object('at', now())) ON CONFLICT (key) DO UPDATE ...` (chamado pelo botão via RPC `admin_reset_analytics()`).
- Atualizar 3 RPCs existentes para ler `analytics_reset_at` e usar como piso do `cutoff`.
- Nova RPC `admin_user_journey(_user_id, _session_id)`.
- Nova RPC `admin_recent_visitors(_limit)` listando sessões anônimas dos últimos N dias com último evento + último passo.

**Frontend:**
- `QuickStartOnboarding.tsx`: remover guards `if (isGuest)` dos trackings (manter só na lógica de navegação).
- `SpotlightOverlay.tsx`: remover guard `if (!isGuest) return;` do `useEffect` que ativa o tutorial — ou ao menos do tracking.
- `AdminLandingFunnel.tsx` / `AdminTutorialCompare.tsx`: botão "Zerar contadores".
- `AdminUsers.tsx`: coluna com seta expansível + timeline.
- Nova `AdminVisitors.tsx` (aba) para sessões anônimas.
