## Por que mudar (resumo das métricas)

- 47% dos confirmados nunca abriram um módulo de verdade
- Sessão média dos "exploradores" = 69s (pessoa não chegou ao valor)
- Onboarding atual fala MUITO ("16 módulos", "tudo em branco", "decida você") e pede ZERO ação → resultado = pessoa pula e some
- Princípio aplicado: **Hooked (Nir Eyal)** + **Lean Startup** — onboarding bom não educa, força o aha moment.

## O que vai ser feito

Substituir completamente o `OnboardingWizard.tsx` atual por um novo fluxo `QuickStartOnboarding.tsx` com **3 telas** (não 4) focadas em ação, não explicação.

### Tela 1 — Promessa curta (5 segundos de leitura)

Headline: **"Tu não precisa de mais 1 app. Precisa parar o caos."**
Subtext: "Em 60 segundos tu vai sair daqui com a primeira coisa da tua vida no lugar."
CTA único: **"Bora"** (sem "Pular")

Sem grid de 16 ícones, sem "bem-vindo ao CORE". Headline direto na dor.

### Tela 2 — A escolha (single-select, 4 opções grandes)

Pergunta: **"Por onde tu quer começar a se organizar?"**
Sub: "Escolhe 1. Os outros ficam aqui esperando."

4 cards grandes, full-width, cada um com ícone + label + 1 frase de benefício:

```text
[💰] FINANÇAS         Saiba pra onde teu dinheiro vai
[✅] HÁBITOS          Construa rotina sem culpa
[🥗] DIETA            Coma sem se perder
[💪] TREINO           Não falte mais
```

Tap = avança automático (sem botão "Próximo"). Cores dos ícones seguem `--chart-1..5`.

### Tela 3 — Spotlight + ação obrigatória

Fecha o modal e leva pro módulo escolhido. Aplica overlay escuro (`bg-black/70 backdrop-blur-sm`) cobrindo TUDO menos:
- O título da seção principal (ex: "Adicionar transação")
- O botão **+ / Adicionar** que executa a primeira ação

Bubble de texto com seta apontando pro botão:
- Finanças: **"Adiciona teu primeiro gasto. Pode ser o café de hoje."**
- Hábitos: **"Cria 1 hábito. Pode ser 'beber água'."**
- Dieta: **"Registra a próxima refeição que tu vai fazer."**
- Treino: **"Cria teu primeiro treino. Pode ser 'Push 1'."**

Sem botão "pular" no spotlight. Só fecha quando a ação é completada (detectado via evento `markActivation` que já existe).

Após completar → toast/celebração curta ("Pronto. Tá salvo.") + libera a Home normal.

### Mapeamento módulo → rota → activation key

| Escolha | Rota | Activation key (já existe) |
|---|---|---|
| Finanças | `/financas` | `first_transaction` |
| Hábitos | `/rotina` | `first_habit` |
| Dieta | `/dieta` | `first_meal` |
| Treino | `/treino` | `first_workout` |

### Detalhes técnicos

- Novo arquivo: `src/components/onboarding/QuickStartOnboarding.tsx` (substitui o uso do `OnboardingWizard`)
- Novo arquivo: `src/components/onboarding/SpotlightOverlay.tsx` — componente reutilizável que recebe um `targetSelector` (CSS selector) e renderiza um overlay com "buraco" sobre o elemento + bubble de texto
- Atualizar `src/pages/Home.tsx`:
  - Trocar `import { OnboardingWizard }` por `import { QuickStartOnboarding }`
  - Trocar `<OnboardingWizard />` por `<QuickStartOnboarding />`
  - `onComplete` continua salvando `core-onboarding-done = true`
- Persistir escolha em `user_data` key `quickstart-target-module` para que, ao chegar no módulo, o `SpotlightOverlay` saiba que precisa mostrar
- Spotlight é montado dentro de cada uma das 4 páginas (`Index.tsx` finanças, `Rotina.tsx`, `Dieta.tsx`, `Treino.tsx`) lendo essa key
- Spotlight some sozinho quando o `markActivation(action_key)` correspondente for chamado (já é chamado nesses 4 fluxos)
- Adicionar `data-onboarding="add-button"` nos botões "+" das 4 páginas para o spotlight ancorar
- Manter `OnboardingWizard.tsx` no projeto (não deletar) caso queiramos reverter, mas removê-lo do fluxo
- Tracking: `trackEvent("quickstart_module_chosen", { module })` e `trackEvent("quickstart_completed", { module })`

### O que NÃO vai ser feito agora (deixar pra próxima iteração)

- Tour dos outros 3 módulos depois de completar (mantemos simples no v1, medimos primeiro)
- A/B test da copy
- Versão pra quem já é usuário antigo (eles continuam com o flag `core-onboarding-done` true e não vêem nada)

## Resultado esperado (apostas)

- "Abriu 1 módulo" sobe de 73% → 90%+
- `first_transaction` (ou equivalente) dobra
- Sessão D0 média sobe de 69s → 3min+
