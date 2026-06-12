# Bugs encontrados no tutorial e correções

## 1. Convidado é deslogado ao escolher 10 módulos
**Onde:** `src/App.tsx` linhas 95–107.
**Problema:** Só `home`, `financas`, `rotina`, `desenvolvimento`, `treino`, `dieta` têm `allowGuest`. Se um convidado escolhe Saúde, Casa, Estudos, Biblioteca, Beleza, Viagens, Carreira, Hiperfoco, Relacionamentos, Pet ou Detox no picker, o `ProtectedRoute` joga ele em `/auth` e o tutorial morre.
**Fix:** Adicionar `allowGuest` em todas as 10 rotas dos módulos do tutorial.

## 2. Spotlight de Finanças aparece mesmo sem ter sido escolhido
**Onde:** `src/components/onboarding/SpotlightOverlay.tsx` linha 61.
**Problema:** A condição `(target === moduleKey || moduleKey === "financas")` força o tutorial a sempre rodar em Finanças para usuário novo, mesmo se ele escolheu só "Rotina" ou outro.
**Fix:** Remover o `|| moduleKey === "financas"`. O spotlight só dispara quando o módulo aberto bate exatamente com o `quickstart-target-module`.

## 3. Hiperfoco está no picker mas não tem tutorial
**Onde:** `src/pages/Hiperfoco.tsx` — nenhum `SpotlightOverlay`.
**Problema:** Usuário escolhe Hiperfoco no picker → navega pra `/hiperfoco` → não acontece nada, parece quebrado.
**Fix:** Adicionar `<SpotlightOverlay moduleKey="hiperfoco" steps={[...]} />` com 2–3 passos nas tabs principais da página, no mesmo padrão dos outros módulos novos.

## 4. Picker reabre com lista incoerente entre módulos (recém-cadastrado)
**Onde:** `src/pages/Home.tsx` linha 117 + `SpotlightOverlay.tsx` `finish()`.
**Problema:** Ao concluir um spotlight, `finish()` limpa `quickstart-target-module` mas **não** limpa `force-new-user-tutorial`. Voltando pra Home, `pending = forceNewUser ? [...ALL_MODULES] : computePending()` ignora o que já foi feito. Visualmente o módulo concluído ainda aparece na lista até o `allDone` final disparar.
**Fix:** Trocar `pending = forceNewUser ? [...ALL_MODULES] : computePending()` por `pending = computePending()` (sempre). O `spotlight-done-{module}` já é zerado uma vez no início pra usuário novo (linha 112), então `computePending()` reflete corretamente o que falta.

## 5. Outros módulos não disparam tutorial depois do primeiro
**Onde:** consequência do #2 + `SpotlightOverlay.tsx` linha 92.
**Problema:** Depois de concluir o primeiro módulo escolhido, `finish()` faz `set("quickstart-target-module", "")`. Sem target, nenhum outro módulo dispara o tutorial — o usuário precisaria voltar pra Home e usar o picker de novo, mas o fluxo não direciona pra lá.
**Fix:** Em vez de limpar o target ao concluir um módulo, redirecionar o usuário de volta pra `/home` para o picker reaparecer com o próximo módulo. Ou seja, em `finish("completed")`: limpar o target **e** navegar pra `/home`. Assim o ciclo escolher → tutorial → voltar pro picker funciona até completar todos os escolhidos.

## 6. Treino: filtro de tutorial só considera convidado
**Onde:** `src/pages/Treino.tsx` linhas 174–179.
**Problema:** `if (!isGuest) return;` — pra usuário recém-cadastrado (`forceNewUser`) a aba "hoje" não é forçada, podendo deixar o spotlight sem alvo na tela.
**Fix:** Incluir `forceNewUser` na condição, igual ao `SpotlightOverlay.tsx` faz.

## Arquivos afetados
- `src/App.tsx`
- `src/components/onboarding/SpotlightOverlay.tsx`
- `src/pages/Home.tsx`
- `src/pages/Treino.tsx`
- `src/pages/Hiperfoco.tsx`

Nada mais será mexido — só o que está acima.
