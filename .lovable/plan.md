# Corrigir conflito entre paywall antigo e novo win-back

## Problema (visível no screenshot)
Na Home, com trial expirado, três fluxos antigos sobrepõem a tela ao mesmo tempo:

1. **TrialBanner** (tela cheia bloqueante) — "Seu trial de 7 dias terminou · Ver planos a partir de R$14,90/mês"
2. **DailyNudge** (drawer inferior) — "DIA 7 DE 7 · TRIAL CORE · Seu trial terminou · Ver planos"
3. O novo **WinbackFlow (roleta + 80% OFF)** só aparece em `/planos` quando o usuário clica em assinar e desiste — então hoje ele nem é o fluxo principal de paywall.

Resultado: dois CTAs antigos ("Ver planos a partir de R$14,90") competindo entre si e mascarando a oferta nova de R$ 3,98/mês.

## Decisão
Unificar tudo em torno do novo win-back. O paywall expirado vira **um único ponto de entrada** que leva ao funil novo (roleta → 80% OFF anual).

## Mudanças

### 1. `src/components/TrialBanner.tsx` — paywall expirado
- Manter o lock screen full-screen para `trialExpired`, mas:
  - Trocar CTA "Ver planos a partir de R$14,90/mês" por **"Resgatar oferta especial → 80% OFF"** (subtítulo: "R$ 3,98/mês no plano anual").
  - Ao clicar: chamar `markIntent()` (do `use-winback-trigger`) e navegar para `/planos?canceled=true` para forçar o disparo do `WinbackFlow`.
- Banners não-expirados (D1–D7) seguem iguais.

### 2. `src/lib/dailyNudge.ts` — remover duplicata
- Remover o case `trialExpired` (linhas 26–35). Quando o trial expirou, o `TrialBanner` full-screen já cobre tudo; não faz sentido ter um drawer abaixo dele.
- `pickDailyNudge` retorna `null` se `trialExpired === true`.

### 3. `src/hooks/use-winback-trigger.ts` — permitir trigger via expiração
- Adicionar nova fonte: se `trialExpired === true` e usuário não assinou, considerar isso como gatilho válido (mesmo sem `?canceled=true` ou intent recente), respeitando o cooldown de 30 dias.
- Adicionar `source: "trial_expired"` no `trackEvent`.

### 4. `src/pages/Planos.tsx`
- Já monta `WinbackFlow` — sem mudança estrutural. Garantir que `markIntent()` é chamado no clique do botão "Assinar" (provavelmente já é).

## Resultado esperado
- Trial expirado → vê **apenas** o lock screen com CTA da oferta 80% OFF → clica → cai direto na roleta + oferta anual de R$ 3,98/mês.
- Sem drawer duplicado.
- DailyNudge continua funcionando normalmente nos dias 1–7 do trial ativo.

## Arquivos
- editar `src/components/TrialBanner.tsx`
- editar `src/lib/dailyNudge.ts`
- editar `src/hooks/use-winback-trigger.ts`
