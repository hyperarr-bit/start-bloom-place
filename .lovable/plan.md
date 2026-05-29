## Problema

No print do Android (tela pequena) o botão "Continuar / Começar agora" do tutorial inicial (`WelcomeScreen.tsx`) sai da viewport: o container usa `overflow-hidden` + `flex-1` no mock, então quando o conteúdo é maior que a altura, o nav fica abaixo da dobra e o usuário não consegue avançar.

Esse é o "tutorial" antes do signup, com slides:
1. Tenha controle da sua vida financeira
2. Veja seu mês com clareza
3. **Controle seus gastos e limites** ← o slide 3 que o usuário citou
4. Planeje seus desejos e objetivos
5. Comece pela sua primeira receita

## O que fazer

### 1. Layout responsivo seguro (mobile)
`src/components/WelcomeScreen.tsx`:
- Trocar `overflow-hidden` por `overflow-y-auto` no container raiz (mantendo desktop intacto).
- Garantir que o bloco `nav` fique sempre visível: dar `shrink-0` ao nav e ao header "CORE", e trocar `flex-1` do mock por `min-h-0` + altura máxima limitada (`max-h-[clamp(180px,38vh,320px)]`) com `overflow-hidden` só na área do mock.
- Reduzir paddings/margens em telas curtas (`h-[640px]` ou menos): `mb-5 → mb-3`, `py-3 → py-1`, `text-[28px] → text-2xl` quando `max-h-[700px]`.
- Adicionar `pb-[max(1rem,env(safe-area-inset-bottom))]` reforçado no wrapper do nav para Androids com gesture bar.

Resultado: nav (botão Continuar + dots + Voltar) sempre dentro da tela, mock se ajusta ao espaço restante e, se ainda não couber, o conteúdo do meio pode rolar — o botão nunca some.

### 2. Tracking de dropoff por slide
`src/components/WelcomeScreen.tsx`:
- Já existe `onboarding_step_view` por slide. Adicionar:
  - `onboarding_step_exit` no unmount/`pagehide`/`visibilitychange:hidden` com `{ step, slide_title, completed: boolean }` quando o usuário sai sem clicar em "Começar agora".
  - `onboarding_step_back` quando clica "Voltar" (com `from_step`, `to_step`).
- Usar `useRef` pra guardar último step e flag `completedRef` (já temos `finish()` — setar antes de redirect).

### 3. Painel admin pra ver onde o usuário largou
`src/pages/admin/AdminUso.tsx` (já existe):
- Adicionar uma nova seção **"Tutorial inicial — Dropoff por slide"** abaixo das tabelas existentes.
- Tabela com colunas: `Slide` (1..5 + título), `Views`, `Exits sem completar`, `% dropoff`, `Voltas (back)`.
- Mesma RPC pattern dos outros: criar `admin_welcome_dropoff(_from, _to)` em SQL que lê `analytics_events` filtrando `event_name IN ('onboarding_step_view','onboarding_step_exit','onboarding_step_back')`, agrupa por `step`, exclui test users.
- Reusa o filtro de período (hoje/7d/30d/tudo) já presente na página.

## Arquivos

- editar: `src/components/WelcomeScreen.tsx` (layout + novos eventos)
- nova migration SQL: RPC `admin_welcome_dropoff`
- editar: `src/pages/admin/AdminUso.tsx` (nova seção + chamada da RPC)
- editar: `src/integrations/supabase/types.ts` (auto após migration)

## Fora de escopo

- Não mexer no `PreSignupTutorial`, `QuickStartOnboarding`, `SpotlightOverlay` nem no layout desktop (já funciona).
- Sem redesign visual dos slides.
