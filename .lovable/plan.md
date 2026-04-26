# Painel /admin isolado + seed de dados + métricas de conversão/churn

## 1. Nova área `/admin` (separada do app principal)

Criar diretório `src/pages/admin/` com:

- **`AdminLogin.tsx`** (rota `/admin`) — tela de login dedicada (visual diferente do app, fundo escuro). Faz `supabase.auth.signInWithPassword({ email, password })`. Após sucesso, valida:
  1. `email === "jv20101958@gmail.com"` (constante)
  2. `checkIsAdmin(user.id) === true` (consulta `user_roles`)
  
  Se qualquer check falhar → `signOut()` + mensagem "Acesso negado". Se passar → redireciona para `/admin/dashboard`.

- **`AdminLayout.tsx`** — wrapper que re-valida email+role em toda navegação dentro de `/admin/*`. Possui sidebar com: Dashboard, Analytics, Conversão, Churn, Usuários, Funil. Botão "Sair do Admin".

- **`AdminDashboard.tsx`** (rota `/admin/dashboard`) — overview executivo: MRR estimado, total de usuários, ativos hoje/7d/30d, trial→pago %, churn 30d.

- **`AdminAnalyticsPage.tsx`** (rota `/admin/analytics`) — reutiliza a lógica atual de `AdminAnalytics.tsx` (módulos, abas, horários de pico, ranking).

- **`AdminConversion.tsx`** (rota `/admin/conversao`) — funil:
  - Cadastros totais → ativos no trial (>1 sessão) → converteram para pago → ainda ativos
  - Taxa de conversão trial→pago (% dos que assinaram dos que se cadastraram nos últimos 30d)
  - Tempo médio até conversão
  - Gráfico de cohort semanal

- **`AdminChurn.tsx`** (rota `/admin/churn`) — 
  - Churn rate mensal (cancelados / ativos no início do período)
  - Lista de cancelamentos recentes com último módulo usado
  - Usuários "em risco" (ativos pagos sem sessão há ≥7 dias)
  - Gráfico de churn por mês

- **`AdminUsers.tsx`** (rota `/admin/usuarios`) — tabela com: email, plano, status, criado em, última sessão, total de sessões, módulo favorito.

- **`AdminFunnel.tsx`** (rota `/admin/funil`) — funil de ativação por módulo: % de usuários que abriram cada módulo, % que voltaram ≥3x, módulos com baixa adesão (oportunidades).

Todas as rotas `/admin/*` são protegidas por `AdminLayout` com dupla validação (email + role).

## 2. Remover acesso admin do app principal

- `src/components/home/ModuleDrawer.tsx`: remover o botão "Painel Analytics" (linhas 121-129) e a checagem `isAdminUser`. O admin agora acessa via URL direta `/admin`.
- `src/App.tsx`: remover `import AdminAnalytics from "./pages/AdminAnalytics"` e a rota `/admin/analytics` antiga (linha 70). Adicionar as novas rotas `/admin/*` apontando para `AdminLayout` + páginas filhas.
- Manter `src/pages/AdminAnalytics.tsx` apenas se for referenciado em outro lugar — caso contrário, deletar (a lógica migra para `AdminAnalyticsPage.tsx`).

## 3. Segurança (RLS / backend)

A conta `jv20101958@gmail.com` (`2c896992-…`) já tem role `admin` no `user_roles`. Vamos reforçar:

- **Nova migração SQL** com:
  - Política `SELECT` em `public.subscriptions` para admins lerem todas: `CREATE POLICY "Admins read all subs" ON subscriptions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));`
  - Política `SELECT` em `public.profiles` para admins lerem todos: `CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));`
  - Função SECURITY DEFINER `public.admin_list_users()` que retorna `(user_id, email, created_at, last_sign_in_at)` lendo de `auth.users` JOIN `subscriptions` JOIN `profiles` — só executa se `has_role(auth.uid(),'admin')`. Usada em `AdminUsers.tsx` (porque o cliente não pode ler `auth.users` diretamente).
  - Função SECURITY DEFINER `public.admin_metrics_overview()` retornando JSON com totais agregados (cadastros, ativos, conversões, churn, MRR estimado).

- **Trava de email no servidor** (defesa extra): a função `admin_metrics_overview()` valida internamente `auth.jwt()->>'email' = 'jv20101958@gmail.com'` além do `has_role`. Assim, mesmo que outro usuário ganhe role admin por engano no futuro, não consegue ler dados sensíveis de outros usuários por essas funções.

## 4. Seed de dados realistas (conta jv20101958)

Via INSERT direto em `public.user_data` (todas chaves usam `user_id = 2c896992-6849-4ca6-9a66-5c2414bb9424`):

- **rotina** — 30 dias de tarefas concluídas (acordar, treinar, ler, etc.) com streaks
- **financas** — ~40 transações dos últimos 30 dias (salário, mercado, gasolina, restaurantes, assinaturas), categorias variadas
- **treino** — 18 sessões (ABC), pesos progressivos
- **dieta** — 30 dias de refeições + hidratação 2-3L/dia
- **saude** — pressão, peso (75→73kg), humor
- **biblioteca** — 4 livros (2 lidos, 1 lendo, 1 wishlist) com metadados
- **estudos** — 2 cursos em andamento, sessões de pomodoro
- **carreira** — metas trimestrais, networking
- **hiperfoco** — 25 sessões de foco
- **beleza** — skincare diário
- **casa** — limpeza semanal, contas
- **viagens** — 1 viagem planejada
- **relacionamentos** — contatos importantes, datas
- **pet** — vacinas, alimentação
- **detox** — dias sem álcool/açúcar
- **conquistas** — pontos acumulados (~2400 pts)
- **module_analytics** — 80 sessões espalhadas em 30 dias para alimentar o painel

Tudo via tool de inserção SQL (não migração).

## Detalhes técnicos

- Métricas de conversão usam `subscriptions.status` (`active`, `trialing`, `canceled`) + `created_at`.
- MRR = soma de `subscriptions` ativas × preço do plano (ler de `app_config` se existir, senão hardcode R$19,90/mês).
- Churn 30d = canceladas nos últimos 30d / ativas no início do período.
- "Em risco" = subscription `active` cujo `user_id` não tem `module_analytics` nos últimos 7 dias.
- Charts: reutilizar `recharts` já no projeto.
- Validação dupla no client (email + role) é UX/defesa em profundidade; a segurança real está nas RLS + funções SECURITY DEFINER no Postgres.

## Ações manuais necessárias

Nenhuma. O role admin já existe, e não precisa configurar nada no painel Supabase.

## Resumo do que muda

- ✅ Novo `/admin` com login próprio (mesma senha do Supabase, mas página separada)
- ✅ Só `jv20101958@gmail.com` + role admin entram
- ✅ Removido botão e link admin do app principal
- ✅ RLS reforçada: admins leem `profiles`/`subscriptions`; funções SECURITY DEFINER com double-check de email
- ✅ Conta populada com 30 dias de dados realistas em todos os 16 módulos
- ✅ Painel com Conversão, Churn, Funil, Usuários, MRR, Em risco — além das métricas atuais