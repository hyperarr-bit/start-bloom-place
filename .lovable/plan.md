## Contexto

No app, todo cadastro inicia um trial automaticamente (o trigger `handle_new_user` insere o evento `trial_started` e agenda os emails). Hoje (28/05) houve **1 cadastro novo**: `davi.habeck15@gmail.com`.

A página `/admin/usuarios` já puxa do Supabase (RPC `admin_list_users`), mas não destaca quem iniciou o trial hoje, nem oferece um filtro "Trial iniciado". Vou adicionar essa visão.

## O que vou fazer

1. **Nova RPC `admin_trials_started`** no Supabase, retornando:
   - `user_id`, `email`, `started_at` (do evento `trial_started` ou fallback `auth.users.created_at`)
   - `subscription_status` (active / trialing / canceled / none)
   - `days_since_start`
   - Filtro por período: hoje / 7d / 30d / tudo
   - Exclui usuários de teste (já existe `is_test_user`)

2. **Nova aba no admin: `/admin/trials`** ("Trials")
   - 4 cards no topo: Hoje · 7 dias · 30 dias · Total
   - Tabela com email, data de início, status da assinatura, dias ativo
   - Filtros de período (Hoje / 7d / 30d / Tudo)
   - Busca por email
   - Auto-refresh a cada 30s (mesmo padrão de `AdminUsers`)

3. Adicionar item "Trials" no `AdminLayout` (entre Funil e Usuários) com ícone `UserPlus`.

## Arquivos

- migration: nova função `admin_trials_started(_period text)`
- novo: `src/pages/admin/AdminTrials.tsx`
- editar: `src/pages/admin/AdminLayout.tsx` (adicionar nav item)
- editar: `src/App.tsx` (adicionar rota)
