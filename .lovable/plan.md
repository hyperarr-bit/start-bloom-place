## Problema atual

Hoje o app dispara `quicksignup-pending = true` (que abre o `QuickSignupModal` com a oferta de teste grátis) assim que o tutorial de **Finanças** (`src/pages/Index.tsx`) ou **Metas** (`src/pages/DesenvolvimentoPessoal.tsx`) termina — sem checar se os outros módulos (Rotina, Dieta) ainda estão pendentes. Rotina e Dieta, por sua vez, só mostram o modal genérico "Tutorial concluído!" e não disparam nada.

Resultado: o pop-up de cadastro aparece no meio do fluxo, antes do usuário completar os 4 módulos.

## O que vai mudar

Comportamento desejado ao terminar o tutorial de qualquer módulo (Finanças, Rotina, Dieta, Metas):

- **Ainda há módulos pendentes** → mostrar um card de conclusão com texto curto ("Falta X módulo(s) pra desbloquear seu teste grátis") e um botão **"Voltar e terminar os outros"** que navega para `/home` (lá o `QuickStartOnboarding` já reabre com os módulos restantes).
- **Foi o último módulo (0 pendentes)** e o usuário é convidado → aí sim setar `quicksignup-pending = true` após um pequeno delay, abrindo o `QuickSignupModal` (oferta de 7 dias grátis).
- Usuário já logado → nunca dispara o pop-up; mostra apenas o card de "tudo concluído" com botão de voltar pra Home.

## Implementação

1. **Novo hook `useModuleCompletionFlow`** (`src/hooks/use-module-completion-flow.tsx`):
   - Expõe `onModuleComplete(moduleKey)` e um `<CompletionDialog />` para renderizar na página.
   - Calcula pendentes a partir das chaves `spotlight-done-financas|rotina|dieta|metas` via `useUserData`.
   - Se pendentes > 0 → abre dialog com lista dos módulos restantes + botão "Voltar e terminar os outros" → `navigate("/home")`.
   - Se pendentes === 0 e `isGuest` → `setTimeout(() => set("quicksignup-pending","true"), 1500)` e mostra dialog "Tudo pronto! Vamos liberar seu teste grátis" com botão "Continuar".
   - Se pendentes === 0 e logado → dialog padrão "Tutorial concluído".

2. **Plugar o hook nas 4 páginas de módulo** passando como `onComplete` do `SpotlightOverlay`:
   - `src/pages/Index.tsx` — substitui o `setTimeout(setUserData("quicksignup-pending","true"), 3000)` atual.
   - `src/pages/DesenvolvimentoPessoal.tsx` — idem.
   - `src/pages/Rotina.tsx` — adiciona `onComplete` (hoje usa modal padrão).
   - `src/pages/Dieta.tsx` — adiciona `onComplete` (hoje usa modal padrão).

3. **Sem mudanças** em `QuickSignupModal`, `QuickStartOnboarding`, `SpotlightOverlay` (o modal padrão continua existindo como fallback caso o `onComplete` não seja passado, ex.: replays).

## Arquivos afetados

- `src/hooks/use-module-completion-flow.tsx` (novo)
- `src/pages/Index.tsx`
- `src/pages/DesenvolvimentoPessoal.tsx`
- `src/pages/Rotina.tsx`
- `src/pages/Dieta.tsx`

Nada de mudanças em backend, dados ou estilo geral — apenas o gatilho do pop-up e o card de conclusão por módulo.
