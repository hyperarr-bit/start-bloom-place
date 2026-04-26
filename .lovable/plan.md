# 🛡️ Relatório de Auditoria de Segurança — CORE App

Varredura completa do código (frontend, edge functions, RLS, storage e auth). Encontrei **8 vulnerabilidades** ativas, das quais **2 são críticas** e exigem correção imediata.

---

## 🔴 Vulnerabilidade 1: Edge function `abacatepay-setup-products` SEM autenticação

⚠️ **Severidade: CRÍTICA**

🔍 **Explicação:** A função está pública (não valida `Authorization` header nem secret). Qualquer pessoa na internet pode invocá-la repetidamente, causando:
- Criação descontrolada de produtos na sua conta AbacatePay (consome cota/dinheiro real).
- Sobrescrita de `app_config` (chave `abacatepay_product_*_id`) quebrando o checkout legítimo.
- DoS na API do AbacatePay com a sua API key.

🛠️ **Solução prática:** Adicionar guarda de admin no início do `serve()` em `supabase/functions/abacatepay-setup-products/index.ts`:

```ts
const authHeader = req.headers.get("Authorization");
if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

const supaAuth = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);
const { data: { user }, error: authErr } = await supaAuth.auth.getUser(
  authHeader.replace("Bearer ", "")
);
const ADMIN_ID = "2c896992-6849-4ca6-9a66-5c2414bb9424";
if (authErr || !user || user.id !== ADMIN_ID) {
  return jsonResponse({ error: "Forbidden" }, 403);
}
```

---

## 🔴 Vulnerabilidade 2: Bucket `receipts` é PÚBLICO + policy `anon SELECT`

⚠️ **Severidade: CRÍTICA**

🔍 **Explicação:** Confirmado via consulta ao banco:
- `storage.buckets.public = true` para `receipts`
- Policy `"Public can view receipts"` permite `SELECT TO anon USING (bucket_id='receipts')`

Isso significa que **qualquer pessoa na internet** pode listar e baixar comprovantes financeiros de **todos os usuários**, sabendo só o nome do bucket. Vazamento direto de dados financeiros (LGPD).

🛠️ **Solução prática:** Migration:

```sql
-- Tornar bucket privado
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- Remover policy pública
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;
```

A policy `"Users can view own receipts"` (já existente, escopada por `auth.uid()`) continua servindo o app via `createSignedUrl()` quando precisar exibir a imagem.

---

## 🔴 Vulnerabilidade 3: Webhook AbacatePay aceita secret na query string

⚠️ **Severidade: ALTA**

🔍 **Explicação:** Em `abacatepay-webhook/index.ts` o código aceita o secret via `?secret=...` da URL. Query strings vazam para:
- Logs do Supabase Edge Runtime
- Logs de proxies/CDN intermediários
- Histórico do navegador caso o painel AbacatePay seja aberto

Além disso, **não há verificação HMAC** da assinatura do payload nem proteção contra **replay** (mesmo evento pode ser reenviado e reativar assinatura cancelada).

🛠️ **Solução prática:** Em `supabase/functions/abacatepay-webhook/index.ts`:

```ts
// Aceitar APENAS via header
const receivedSecret = req.headers.get("x-webhook-secret");
if (!receivedSecret || receivedSecret !== webhookSecret) {
  return new Response("Unauthorized", { status: 401 });
}
```

E criar tabela `webhook_events(id text primary key, processed_at timestamptz)` para registrar `body.id` e descartar duplicatas no início do handler.

---

## 🔴 Vulnerabilidade 4: Verificação de admin baseada em UUID/email hardcoded no client

⚠️ **Severidade: ALTA**

🔍 **Explicação:** `src/lib/admin.ts` exporta `ADMIN_ID` e a UI esconde itens com `isAdmin(user.id)`. Embora a policy SELECT de `module_analytics` use `auth.uid() = '...'` no servidor (correto), o padrão é frágil:
- Não existe tabela `user_roles` nem função `has_role()`.
- Promover novo admin exige redeploy de código + migration.
- Padrão recomendado pelo guia de segurança Supabase exige role em tabela separada com `SECURITY DEFINER`.

🛠️ **Solução prática:** Migration:

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

INSERT INTO public.user_roles (user_id, role)
VALUES ('2c896992-6849-4ca6-9a66-5c2414bb9424', 'admin');

-- Substituir policy de module_analytics
DROP POLICY "Admin can read all analytics" ON public.module_analytics;
CREATE POLICY "Admins read all analytics" ON public.module_analytics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

E atualizar `src/lib/admin.ts` para consultar `user_roles` (ou usar `has_role` via RPC).

---

## 🔴 Vulnerabilidade 5: Senha mínima fraca + Leaked Password Protection desativado

⚠️ **Severidade: MÉDIA**

🔍 **Explicação:** `src/pages/Auth.tsx` aceita senha de **6 caracteres** sem requisitos de complexidade. O linter Supabase também acusa "Leaked Password Protection Disabled" — usuários podem cadastrar senhas vazadas em breaches conhecidos.

🛠️ **Solução prática:**
1. Subir mínimo para **8 caracteres** + exigir letra + número no `Auth.tsx`:
```ts
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  toast({ title: "Senha fraca", description: "Mínimo 8 caracteres, com letras e números.", variant: "destructive" });
  return;
}
```
2. Painel Supabase → **Authentication → Policies** → ativar **Leaked Password Protection**: https://supabase.com/dashboard/project/itoylenzvahbscgjgtqf/auth/providers

---

## 🔴 Vulnerabilidade 6: Trigger `on_auth_user_created` ausente

⚠️ **Severidade: MÉDIA**

🔍 **Explicação:** A função `public.handle_new_user()` existe, mas a listagem de triggers do projeto retorna vazia. Resultado: novos signups **não criam linha em `public.profiles`**, então `checkout` (que faz `select display_name, phone, tax_id from profiles where id = userId`) e `check-subscription` falham silenciosamente para qualquer conta nova → checkout sem nome, trial não calculado corretamente.

🛠️ **Solução prática:** Migration:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill para usuários existentes sem profile
INSERT INTO public.profiles (id, created_at)
SELECT u.id, u.created_at FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

---

## 🔴 Vulnerabilidade 7: GraphQL introspection expõe schema ao role `anon`

⚠️ **Severidade: BAIXA**

🔍 **Explicação:** Linter acusa 5 objetos visíveis na introspecção GraphQL via `/graphql/v1` para `anon`. Mesmo com RLS ativado, atacantes mapeiam estrutura de dados (nomes de colunas como `tax_id`, `customer_email`, `abacatepay_subscription_id`) para planejar ataques mais direcionados.

🛠️ **Solução prática:** Migration revogando SELECT de `anon` nas tabelas privadas (RLS continua bloqueando, isso só remove da introspecção):

```sql
REVOKE SELECT ON public.profiles, public.subscriptions,
  public.user_data, public.module_analytics, public.app_config
FROM anon;
```

---

## 🔴 Vulnerabilidade 8: SSRF parcial em `fetch-product-metadata` / `fetch-book-metadata`

⚠️ **Severidade: BAIXA**

🔍 **Explicação:** Ambas funções fazem `fetch(url)` no input do usuário. Há allowlist de domínios (bom!), porém:
- `redirect: 'follow'` segue redirects sem revalidar — site permitido pode redirecionar para `http://169.254.169.254` (metadata IMDS) ou `http://localhost`.
- Não há limite de tamanho do response (pode esgotar memória da função).

🛠️ **Solução prática:** Em ambas funções, trocar:

```ts
const response = await fetch(url, {
  headers: { /* ... */ },
  redirect: 'manual',         // não seguir redirects automaticamente
  signal: AbortSignal.timeout(8000),
});
// Se for 3xx, revalidar Location com isAllowedUrl() e refetch manual
// Limitar leitura: const text = (await response.text()).slice(0, 2_000_000);
```

---

## ✅ Pontos auditados que estão seguros

- **RLS de `user_data`, `profiles`, `subscriptions`**: corretamente escopadas por `auth.uid()`.
- **`ProtectedRoute`**: todas as rotas sensíveis (`/`, `/financas`, `/admin/analytics`, etc.) usam `<ProtectedRoute>`.
- **`service_role_key`**: usada apenas em edge functions via `Deno.env`, **nunca** no frontend.
- **`abacatepay-checkout`**: valida JWT, usa Zod para input, busca produto via `app_config`.
- **`check-subscription`**: valida JWT, escopo correto.
- **Bucket `skin-photos`**: agora privado, policies por `auth.uid()` no folder name.
- **Função `handle_new_user`**: tem `SECURITY DEFINER` + `SET search_path = public` (correto).
- **`rls_auto_enable`**: event trigger ativando RLS automaticamente em novas tabelas (excelente defesa em profundidade).

---

## 📋 Ordem sugerida de implementação após aprovação

1. **CRÍTICO** — Corrigir bucket `receipts` (migration: tornar privado + drop policy `anon`).
2. **CRÍTICO** — Adicionar auth admin em `abacatepay-setup-products`.
3. **ALTA** — Webhook: aceitar secret só por header + tabela de idempotência.
4. **ALTA** — Criar `user_roles` + `has_role()` + atualizar `module_analytics` policy + refator `lib/admin.ts`.
5. **MÉDIA** — Trigger `on_auth_user_created` + backfill de profiles.
6. **MÉDIA** — Senha mínima 8 + ativar leaked password no painel.
7. **BAIXA** — Revoke SELECT de `anon` + endurecer SSRF (redirect manual + timeout).

Posso prosseguir com a implementação completa após sua aprovação.
