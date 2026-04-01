

## Plano: 8 Melhorias para o CORE App

### 1. PWA — App instalável no celular
- Criar `public/manifest.json` com nome, ícones, cores e `display: standalone`
- Criar `public/sw.js` (service worker básico com cache de assets)
- Registrar service worker em `src/main.tsx`
- Adicionar `<link rel="manifest">` e meta tags no `index.html`
- Adicionar prompt "Instalar app" na Home quando disponível

### 2. Empty States — Telas vazias com ilustração e CTA
- Criar componente reutilizável `src/components/EmptyState.tsx` com ícone, título, descrição e botão de ação
- Aplicar em: `IncomeTable`, `ExpenseTable`, `FixedExpensesTable`, `FinancialGoals`, `InstallmentTracker`, `InvestmentsTracker`, `WishlistItems`
- Cada empty state terá um ícone contextual e texto motivacional em português

### 3. Micro-interações e animações de feedback
- Adicionar `framer-motion` animations ao adicionar/remover itens nas tabelas (layout animations)
- Animação de confetti/pulse ao completar uma meta ou marcar conta como paga
- Transições suaves nos cards do Dashboard ao carregar dados
- Botões com `whileTap={{ scale: 0.95 }}` nos componentes principais

### 4. Recuperação de senha
- Adicionar link "Esqueci minha senha" na página `Auth.tsx`
- Criar página `src/pages/ResetPassword.tsx` com campo de email para envio do link
- Criar página `src/pages/UpdatePassword.tsx` para definir nova senha (recebe token via URL)
- Adicionar `resetPassword` no `use-auth.tsx` usando `supabase.auth.resetPasswordForEmail`
- Adicionar rotas `/reset-password` e `/update-password` no `App.tsx`

### 5. Dashboard com gráficos melhorados
- Adicionar gráfico de evolução mensal (linha) no Dashboard usando `recharts` (já disponível via shadcn chart)
- Gráfico de pizza para distribuição de despesas por categoria
- Card de tendência mostrando se gastos estão subindo ou descendo vs mês anterior
- Indicador visual de saúde financeira (gauge/termômetro)

### 6. Gamificação aprimorada
- Adicionar sistema de badges/conquistas no componente `Gamification.tsx`
- Badges: "Primeira meta", "7 dias seguidos", "Investidor iniciante", "Sem dívidas"
- Animação de desbloqueio com modal celebratório
- Persistir badges no `usePersistedState`

### 7. Sincronização offline melhorada
- Implementar queue de operações offline em `src/hooks/use-offline-queue.ts`
- Detectar estado online/offline com `navigator.onLine` e evento listeners
- Mostrar banner "Modo offline" quando desconectado
- Sincronizar dados pendentes quando voltar online

### 8. Dark mode refinado
- Revisar variáveis CSS do dark mode em `index.css` para melhor contraste
- Ajustar cards financeiros (receitas, despesas, dívidas, investimentos) no dark mode
- Garantir que gráficos e badges respeitem o tema
- Melhorar bordas e sombras no dark mode

### Detalhes técnicos

**Arquivos novos:**
- `public/manifest.json`, `public/sw.js`
- `src/components/EmptyState.tsx`
- `src/pages/ResetPassword.tsx`, `src/pages/UpdatePassword.tsx`
- `src/hooks/use-offline-queue.ts`

**Arquivos modificados:**
- `index.html` — meta tags PWA
- `src/main.tsx` — registro do service worker
- `src/App.tsx` — novas rotas
- `src/pages/Auth.tsx` — link "Esqueci minha senha"
- `src/hooks/use-auth.tsx` — função resetPassword
- `src/index.css` — refinamento dark mode
- `src/components/Gamification.tsx` — sistema de badges
- `src/components/Dashboard.tsx` — gráficos
- Tabelas financeiras — empty states e micro-interações

**Dependências:** Nenhuma nova (recharts já está disponível via shadcn/chart, framer-motion já instalado)

