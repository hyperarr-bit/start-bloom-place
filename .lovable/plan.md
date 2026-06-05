## Objetivo
Atualizar `src/components/AccessGateUI.tsx` (tela que abre no in-app browser do TikTok) pra refletir que o CORE agora cobre todos os 16 módulos, não só finanças.

## Mudanças

**Headline**
- De: "Controle sua vida financeira em um só lugar"
- Para: "Organize toda a sua vida em um só app"

**Subtítulo**
- Mantém estilo atual, trocando exemplos:
- De: "Receitas, gastos, contas, desejos e investimentos sem complicação."
- Para: "Finanças, dieta, treino, rotina, metas e muito mais sem complicação."

**Cards de exemplo (3 cards rotativos por módulo)**
- Substituir os 3 cards fixos (Receitas/Gastos/Saldo) por 3 cards que rotacionam entre módulos a cada ~2.5s com fade/slide suave.
- Cada card mantém o mesmo layout atual (ícone colorido à esquerda, label + valor, ícone de tendência à direita).
- Pool de exemplos (1 por módulo, com ícone Lucide e cor temática):
  - Finanças — Wallet — "Saldo do mês" / "+R$ 2.365,00" (verde)
  - Dieta — Utensils — "Calorias hoje" / "1.840 kcal" (laranja)
  - Treino — Dumbbell — "Treino de hoje" / "Peito + Tríceps" (azul)
  - Rotina — CalendarCheck — "Hábitos hoje" / "5 de 7 ✓" (roxo)
  - Metas — Target — "Meta da semana" / "75% concluída" (rosa)
  - Saúde — HeartPulse — "Água hoje" / "1,8 / 2,5L" (ciano)
  - Hiperfoco — Brain — "Foco hoje" / "2h 15min" (índigo)
  - Estudos — GraduationCap — "Leitura" / "32 págs hoje" (âmbar)
- A cada ciclo, mostra 3 cards diferentes do pool (rotação contínua).

**Restante mantido igual**
- Halo verde + seta (indicador dos 3 pontos)
- Título "CORE"
- Caixa "Para acessar agora" com passos 1 e 2
- CTA preto "Toque nos 3 pontos para continuar"
- Footer "Leva menos de 2 minutos para configurar"
- Todos os tamanhos fluidos com `clamp()` + `svh` (estável no iOS Safari)

## Arquivos
- editar `src/components/AccessGateUI.tsx`

## Detalhes técnicos
- Rotação via `useState` + `useEffect` com `setInterval`, sem libs novas.
- Transição com classes Tailwind (`transition-opacity duration-500`) + `key` no container pra trigger do fade.
- Cores via classes Tailwind existentes (green/red/blue/orange/purple/pink/cyan/indigo/amber-100 + -500/600), mantendo padrão atual do componente (esse arquivo já usa cores diretas, não tokens — manter consistência local).
