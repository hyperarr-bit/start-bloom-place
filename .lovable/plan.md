

# Gamificação Global — Tela Dedicada Acessível pela Home

## Resumo
Remover a aba "Desafios" (com o desafio 52 semanas) do módulo de Finanças e criar uma tela dedicada de Conquistas acessível por um botão de troféu no header da Home. A gamificação será funcional de verdade, puxando dados reais de todos os módulos.

---

## O que muda

### 1. Remover do Finanças
- Remover a aba `🏆 DESAFIOS` do array `tabs` em `Index.tsx`
- Remover o import e renderização do `<Gamification>` 
- Remover os estados `streakDays`, `setStreakDays`, `challenge52Weeks`, `setChallenge52Weeks`
- Manter as variáveis computadas (`savingsRate`, `billsPaidRate`, etc.) que são usadas por outros componentes

### 2. Nova página `/conquistas`
Página dedicada com:

**Header**: Botão voltar + "Conquistas" + ThemeToggle

**Nível + XP**: Barra de progresso com nível atual (Bronze → Diamante), XP total, próximo nível

**Stats row (3 cards)**:
- Streak de dias (usa `core-hub-streak` da Home, já existente)
- Conquistas desbloqueadas / total
- XP total acumulado

**Check-in diário**: Card com botão — incrementa streak se consecutivo, reseta se pulou um dia. Usa chave `gamification-lastCheckIn` (nova, separada da finance)

**Badges organizados por categoria** (reutiliza `BadgesGrid`):
- **Finanças** (6 badges): Primeiro Salário, Poupador ≥20%, Contas em Dia, Investidor R$1k+, Investidor Pro R$10k+, Livre de Dívidas
- **Saúde** (4 badges): Hidratado (8 copos/dia por 7 dias), Farmácia em Dia, Treino Completo (completar treino do dia), Noite de Sono (registrar sono)
- **Hábitos** (4 badges): Streak 7 dias, Streak 30 dias, Streak 100 dias, 100% hábitos do dia
- **Geral** (4 badges): Primeiro Check-in, Explorador (3+ módulos), Leitor (terminar 1 livro), Mestre (atingir nível Diamante)

**Dados reais**: Cada badge puxa do `useUserData` — mesmas chaves que os módulos usam. Sem props artificiais.

**Dicas de XP**: Card no final mostrando os próximos badges a desbloquear

### 3. Acesso pela Home
- Botão de troféu 🏆 no header da Home (ao lado do ThemeToggle e logout)
- Navega para `/conquistas`
- Se há badges novos não vistos, mostrar dot indicador no botão

### 4. Rota no App.tsx
- Adicionar rota `/conquistas` protegida com TrialBanner

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Conquistas.tsx` | **Criar** — página dedicada de gamificação, puxa dados via `useUserData` direto |
| `src/components/gamification/AchievementsPage.tsx` | **Criar** — componente principal: monta badges com dados reais, check-in, nível, stats |
| `src/components/gamification/BadgesGrid.tsx` | **Manter** — reutilizar como está |
| `src/components/gamification/LevelProgress.tsx` | **Manter** — reutilizar como está |
| `src/components/gamification/UnlockModal.tsx` | **Manter** — reutilizar como está |
| `src/components/gamification/types.ts` | **Manter** — reutilizar como está |
| `src/pages/Index.tsx` | **Editar** — remover aba Desafios, remover estados de gamificação, remover import |
| `src/pages/Home.tsx` | **Editar** — importar botão troféu no header |
| `src/components/home/GreetingHeader.tsx` | **Editar** — adicionar botão 🏆 antes do logout |
| `src/App.tsx` | **Editar** — adicionar rota `/conquistas` |
| `src/components/Gamification.tsx` | **Remover** — substituído pelo novo `AchievementsPage` |

---

## Dados Reais por Badge

Os badges lerão diretamente do `useUserData`:

```text
finance-incomes        → Primeiro Salário (length > 0)
finance-incomes/expenses → Poupador (savingsRate ≥ 20%)
finance-dueDays        → Contas em Dia (100% paid)
finance-investments    → Investidor / Investidor Pro
finance-installments   → Livre de Dívidas
core-saude-water       → Hidratado (7 dias consecutivos)
core-saude-supplements → Farmácia em Dia
saude-workout-log      → Treino Completo
core-saude-sleep       → Noite de Sono
core-hub-streak        → Streaks (7/30/100)
core-rotina-habits     → 100% hábitos
lib-books              → Leitor (1 livro lido)
```

Cada badge calcula seu estado `unlocked` a partir dessas chaves — sem dependência de props externas.

