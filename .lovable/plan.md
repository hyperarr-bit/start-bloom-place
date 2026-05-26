# Troca de abas sem flicker

## Causa do "piscar"
1. `useScrollActiveTabIntoView` chama `el.scrollIntoView({ inline: "center", block: "nearest" })` no `window`. Isso rola a página inteira verticalmente (não só a linha de tabs horizontal), causando o salto/piscada visível ao clicar em qualquer aba.
2. Cada aba monta/desmonta componentes pesados (`Dashboard`, `Reports`, `InvestmentsTracker`, etc.) que disparam re-render + animações de entrada (framer-motion `initial/animate`) toda vez, deixando a troca lenta e visualmente "quebrada".
3. O `setTimeout(30ms)` dentro do hook adiciona delay perceptível entre clicar e a aba reagir.

## Mudanças

### 1. `src/hooks/use-scroll-active-tab.ts`
- Trocar `scrollIntoView` por scroll manual **apenas no container horizontal de tabs** (subir até o ancestral com `overflow-x-auto`) usando `container.scrollTo({ left, behavior: "smooth" })`. Não tocar no scroll vertical da página.
- Remover o `setTimeout` (usar `requestAnimationFrame` para esperar 1 frame, sem delay perceptível).
- Não fazer nada se a tab já estiver visível na faixa horizontal.

### 2. `src/components/PageTransition.tsx`
- Reduzir `duration` de 0.3s → 0.18s e remover `y` translate no exit (mantendo só fade) para evitar o "pulo" entre rotas/abas que renderizam diferente.

### 3. Conteúdo das abas (Index.tsx e demais páginas com tabs)
- Sem mudança de arquitetura agora (manter `activeTab === "x" && <Comp/>` para não quebrar nada). Apenas garantir que o container `main` tenha `min-height` estável para não fazer a página "saltar" entre abas de tamanhos diferentes.
- Adicionar `min-h-[60vh]` no `<main>` das páginas com tabs (Index, Hiperfoco, Pet, Relacionamentos, etc. — só as que apresentam o sintoma).

### 4. Respeitar `prefers-reduced-motion`
- No `PageTransition`, se o usuário tem reduced motion, pular animação completamente (render direto).

## Resultado esperado
- Clicar em aba: resposta imediata, sem scroll vertical da página, sem flash branco, transição suave de ~180ms.
- Mantém todo o comportamento atual (componentes, dados, layout).

## Escopo
Somente frontend/apresentação. Nenhuma mudança em lógica de negócio, storage ou Supabase.
