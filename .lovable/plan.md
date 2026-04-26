Vou ajustar a roleta para girar automaticamente, deixá-la mais bonita (estilo do vídeo) e fazê-la aparecer antes da tela de trial expirado.

## 1. Girar automaticamente
- Remover o botão "GIRAR AGORA".
- Iniciar o giro assim que a roleta abrir, com pequeno delay para a animação de entrada.
- Mostrar título dinâmico: "Estamos girando para você..." → "Parabéns! Você ganhou".
- Manter o resultado fixo em 80% OFF (mantendo a regra de negócio atual).

## 2. Visual mais polido (referência do vídeo)
- Reescrever a roleta em SVG (ao invés de conic-gradient + divs).
- Fatias com gradiente alternando claro/primário, separadores brancos finos.
- Anel externo dourado/primário com leve glow ao redor.
- Pontos decorativos no rim simulando lâmpadas.
- Hub central com ícone Crown e sombra.
- Ponteiro mais elegante (triângulo com base circular).
- Brilho radial (shine) em cima das fatias para sensação 3D.
- Texto da fatia vencedora em destaque (maior e em peso 800).
- Animação de entrada suave (fade + scale) da roleta.

## 3. Aparecer antes da tela de trial
Hoje o `GlobalWinback` é montado dentro do `TrialBanner`, então a roleta só aparece junto com a tela de trial. Vou:
- Mover `GlobalWinback` para dentro do `App.tsx` (logo antes do `BrowserRouter` ou dentro do layout global), garantindo que o `Dialog` da roleta seja portalizado com z-index acima do TrialBanner full-screen.
- Adicionar um pequeno fade-in atrasado no TrialBanner (~300ms) ou simplesmente deixar a roleta cobrir o trial via portal.
- Remover o `GlobalWinback` de dentro do `TrialBanner.tsx` (todas as fases) para evitar montagem duplicada.

## 4. Arquivos afetados
- `src/components/retention/WinbackWheel.tsx` — reescrever com SVG, auto-spin, novo visual.
- `src/components/TrialBanner.tsx` — remover `<GlobalWinback />` das 4 fases.
- `src/App.tsx` — adicionar `<GlobalWinback />` no nível raiz, dentro do `BrowserRouter`, fora do `<AnimatedRoutes />`, para sempre estar montado.

## Resultado esperado
- Usuário sai de `/planos` → roleta gira sozinha por cima da tela → revela 80% OFF → tela de oferta com X → ao fechar, fica no trial expirado.