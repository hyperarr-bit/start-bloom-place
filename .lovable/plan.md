## Plano: Hardening de segurança + auditoria LGPD

### Parte 1 — Aplicar correções de segurança pendentes

**1.1 Migration SQL**

Adicionar políticas RLS explícitas que **negam** escrita em `user_roles` por usuários autenticados (defesa em profundidade contra escalonamento de privilégio):

```sql
-- Bloqueia INSERT/UPDATE/DELETE em user_roles para qualquer usuário logado.
-- Apenas service_role (edge functions com SUPABASE_SERVICE_ROLE_KEY) pode escrever.
CREATE POLICY "Deny insert user_roles to authenticated"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny update user_roles to authenticated"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny delete user_roles to authenticated"
  ON public.user_roles FOR DELETE TO authenticated
  USING (false);
```

Adicionar política `UPDATE` faltante no bucket `receipts` (escopo dono):

```sql
CREATE POLICY "Owners update own receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'receipts' AND auth.uid() = owner);
```

**1.2 Limpeza de ruído no scanner**

Marcar como "ignored" os ~24 avisos `SECURITY DEFINER` (todas as funções `admin_*` já checam `has_role(auth.uid(), 'admin')` internamente) e o aviso de `app_config` (RLS ativo, sem policy = nada acessível por usuários).

---

### Parte 2 — Auditoria LGPD detalhada

Após aplicar as correções acima, executarei uma análise sistemática focada em LGPD/vazamento de dados pessoais. Vou inspecionar:

**2.1 Banco de dados**
- Listar todas as tabelas com colunas que contêm dados pessoais (email, telefone, CPF/`tax_id`, nome, fotos, financeiro, saúde, dieta, hábitos, relacionamentos).
- Validar que **toda** tabela com dado pessoal tem RLS ativa + policy `auth.uid() = user_id` em SELECT/UPDATE/DELETE.
- Validar que `INSERT` exige `user_id = auth.uid()` (sem cláusulas permissivas).
- Conferir buckets de storage (`skin-photos`, `receipts`): privados + policies escopadas por owner em todas as operações.
- Conferir funções `SECURITY DEFINER` que retornam dados de outros usuários — confirmar que todas exigem `has_role(_, 'admin')` antes de retornar linhas.

**2.2 Edge functions**
- Inspecionar todas as funções em `supabase/functions/*` que usam `SUPABASE_SERVICE_ROLE_KEY` para garantir que filtram por `user_id` antes de retornar/mutar dados, e que validam o JWT do chamador (não confiam em `user_id` vindo do body).
- Validar webhooks (`abacatepay-webhook`) — confirmar verificação de assinatura/segredo.

**2.3 Frontend**
- Verificar se há logs de `console.log` com dados sensíveis (email, valores financeiros, CPF).
- Confirmar que após correção do bug multi-conta, `localStorage` está 100% namespaceado por `user_id` e que não há leitura de chaves legadas sem prefixo.
- Verificar `purgeUserLocalCache` no logout/troca de conta.

**2.4 Auth & e-mail**
- Validar que o redirect do e-mail de confirmação aponta para domínio próprio (não Supabase default).
- Confirmar que não há exposição de PII em URLs de redirect.

**2.5 Dados residuais da contaminação anterior**
- Re-auditar contas afetadas (`store.street.brasil`, `jv20101958@gmail.com`) no `user_data` para confirmar que não restou nenhuma chave cruzada.

**2.6 Entrega**
Relatório em chat com:
- ✅ Itens conformes
- ⚠️ Riscos médios (com correção sugerida)
- 🔴 Vazamentos críticos (com migration/patch imediato)
- Lista de chaves de `user_data` ainda contaminadas (se houver) + ação proposta (deletar).

---

### Arquivos/recursos que serão tocados na Parte 1
- Nova migration SQL (`user_roles` deny policies + `receipts` update policy).
- Atualizações no scanner de segurança (ignore tags) — não toca código.

A Parte 2 é apenas leitura/auditoria; qualquer correção encontrada vira um plano novo para sua aprovação antes de executar.