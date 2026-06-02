## Objetivo

Adicionar botão **"Pular"** no balão do tutorial nos passos de **investimentos** e **desejos**, pra quem ainda não tem investimento ou nenhum desejo em mente conseguir avançar sem precisar preencher.

## O que muda

### 1. `src/components/onboarding/SpotlightOverlay.tsx`

- Adicionar campo opcional `skippable?: boolean` no tipo `SpotlightStep`.
- Quando `step.skippable` for `true`, renderizar um botão discreto **"Pular este passo"** dentro do balão (logo abaixo do label). Ao clicar, chama `advance()` e dispara `trackEvent("spotlight_step_skipped", { module, step, label })`.
- Estilo: link pequeno (`text-xs text-muted-foreground hover:text-foreground`), alinhado à direita, sem mexer no resto do layout do balão.

### 2. `src/pages/Index.tsx` — marcar passos como `skippable`

Adicionar `skippable: true` nos 4 passos relacionados:

- `tab-investimentos` — "Acompanhe seus investimentos aqui."
- `add-investment` — "Cadastre seu primeiro aporte."
- `tab-itens` — "Liste o que quer comprar e priorize."
- `add-wish` — "Adicione um item da sua lista de desejos."

## Arquivos tocados

- `src/components/onboarding/SpotlightOverlay.tsx`
- `src/pages/Index.tsx`

Nada além disso.
