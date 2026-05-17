## Por que "buga" e não aparece

O `SpotlightOverlay` só renderiza a bolha quando consegue achar o elemento `[data-spotlight=...]` no DOM via `querySelector`. Quando o elemento não está presente, o overlay fica **ativo mas invisível** — exatamente o que dá a impressão de "tutorial bugado".

No Treino especificamente o alvo `[data-spotlight="add-exercise"]` só existe quando **todas** essas condições são verdadeiras ao mesmo tempo:

1. A aba ativa é **"hoje"** (o usuário pode entrar em outra aba e o alvo some).
2. O card do dia renderizado é o **dia de hoje** (`day === todayDayName`).
3. O dia de hoje **não é dia de descanso** (`isActive && totalCount === 0`) — se for descanso, renderiza outro branch sem `data-spotlight`.
4. O dia de hoje ainda **não tem nenhum exercício** — se já tem, vai pro branch da linha 416 que também não tem `data-spotlight`.

Mesmo problema potencial em Dieta/Rotina/Finanças quando o usuário não está na aba/seção esperada.

Além disso, não há **plano B** visual: se o alvo não aparece, o usuário simplesmente não vê nada.

## Correções

### 1. Fallback visual em `SpotlightOverlay` (resolve qualquer módulo)

Quando o spotlight estiver ativo e o `rect` continuar `null` por mais de ~800ms, mostrar um card flutuante **centralizado embaixo** (não cobre o conteúdo principal) com:

- "Passo X de N"
- O `step.label` atual
- Texto curto: "Não estou encontrando este item na tela. Navegue até ele ou toque em Pular."
- Botão "Pular tutorial" → chama `finish("dismissed")`

Assim que o alvo aparecer no DOM (usuário muda de aba/scrolla), o fallback some e a bolha ancorada volta a ser usada. Resultado: **nunca mais "tela em branco"**.

### 2. Garantir aba correta no Treino

Em `src/pages/Treino.tsx`, quando o spotlight for ativar (guest + `quickstart-target-module === "treino"` + `spotlight-done-treino` vazio), forçar `setActiveTab("hoje")` no mount. Pequeno `useEffect` no topo do componente.

### 3. Fallback do alvo no Treino quando hoje é dia de descanso

Para o caso em que `todayDayName` cai num dia sem treino (sem alvo no DOM), adicionar `data-spotlight="add-exercise"` também no input do **primeiro dia ativo da semana** como segundo seletor candidato. Implementação simples: mudar o seletor do step para uma lista CSS:

```ts
selector: '[data-spotlight="add-exercise"]'
```

continua igual; basta no `Treino.tsx` aplicar `data-spotlight="add-exercise"` no input do primeiro dia ativo quando o dia de hoje é descanso. O overlay já pega o primeiro match via `querySelector`.

### 4. (Opcional, baixo custo) Log de diagnóstico

Em `SpotlightOverlay`, quando o spotlight fica ativo por >2s sem `rect`, chamar `trackEvent("spotlight_target_missing", { module: moduleKey, step: stepIdx, selector: step.selector })`. Útil pra a gente ver no painel se o problema reaparece em outro módulo.

## Arquivos

- `src/components/onboarding/SpotlightOverlay.tsx` — adicionar estado `rectMissing`, timer 800ms, JSX do card fallback centralizado, evento de telemetria.
- `src/pages/Treino.tsx` — `useEffect` que força `activeTab="hoje"` quando o tutorial vai aparecer, e atributo `data-spotlight="add-exercise"` no input do primeiro dia ativo quando hoje é descanso.

Sem alterações em Dieta/Rotina/Finanças — o fallback do item 1 já cobre os mesmos cenários nesses módulos.