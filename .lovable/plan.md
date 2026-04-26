
# 🛡️ Revisão de Row Level Security (RLS) — Relatório Final

Auditei **todas as 7 tabelas do schema `public`** + **storage.objects** (buckets `receipts` e `skin-photos`). Resultado: **o isolamento por usuário está correto e nenhuma política precisa ser alterada.** Detalhes abaixo.

---

## 1. Tabelas que armazenam dados do usuário

> Observação importante sobre a sua pergunta: este app **não tem tabelas separadas** chamadas "tarefas diárias", "consumo de água" ou "pontuação". Esses módulos (rotina, saúde/hidratação, gamificação/score) **gravam todos no mesmo lugar**: `public.user_data`, usando uma estrutura chave-valor (`key`, `value jsonb`) escopada por `user_id`. Ou seja, basta a RLS de `user_data` estar correta — e está.

### `user_data` (tarefas, hábitos, hidratação, gamificação, finanças, etc.)
| Operação | Política | Regra | Status |
|---|---|---|---|
| SELECT | Users can read own data | `auth.uid() = user_id` | ✅ |
| INSERT | Users can insert own data | WITH CHECK `auth.uid() = user_id` | ✅ |
| UPDATE | Users can update own data | USING + WITH CHECK `auth.uid() = user_id` | ✅ |
| DELETE | Users can delete own data | `auth.uid() = user_id` | ✅ |

Cobertura completa nas 4 operações. Um usuário **não consegue** ler nem alterar dados de outro. RLS habilitada.

### `profiles`
| Operação | Política | Regra | Status |
|---|---|---|---|
| SELECT | Users can read own profile | `auth.uid() = id` | ✅ |
| UPDATE | Users can update own profile | USING + WITH CHECK `auth.uid() = id` | ✅ |
| INSERT | — | (feito pelo trigger `handle_new_user` com `SECURITY DEFINER`) | ✅ |
| DELETE | — | bloqueado (sem política, RLS nega por padrão) | ✅ |

Correto: o INSERT é feito automaticamente no signup; bloquear DELETE pelo cliente é o comportamento desejado.

### `subscriptions`
| Operação | Política | Regra | Status |
|---|---|---|---|
| SELECT | Users can read own subscriptions | `auth.uid() = user_id` | ✅ |
| ALL (service_role) | Service role can manage subscriptions | apenas role `service_role` | ✅ |

Usuário só lê a própria assinatura. Mutações ficam exclusivamente nas edge functions (`abacatepay-webhook`, `abacatepay-checkout`) usando service role — usuário **não** pode forjar plano "active" nem alterar período de cobrança a partir do client. ✅

### `user_roles`
| Operação | Política | Regra | Status |
|---|---|---|---|
| SELECT | Users read own roles | `auth.uid() = user_id` | ✅ |
| INSERT/UPDATE/DELETE | — | bloqueados (sem política) | ✅ |

Crítico para evitar **escalonamento de privilégios**: o usuário não consegue se auto-promover a `admin`. Promoção exige migration manual ou service role. ✅

### `module_analytics`
| Operação | Política | Regra | Status |
|---|---|---|---|
| INSERT | Users can insert own analytics | WITH CHECK `auth.uid() = user_id` | ✅ |
| SELECT | Admins read all analytics | `has_role(auth.uid(), 'admin')` via SECURITY DEFINER | ✅ |
| UPDATE/DELETE | — | bloqueados | ✅ |

Usuário comum **não vê** os próprios analytics nem os de outros — só admins leem (intencional, é tabela de telemetria agregada). ✅

### `app_config`
| Operação | Política | Regra | Status |
|---|---|---|---|
| ALL | Service role full access | apenas `service_role` | ✅ |

Tabela com IDs de produtos AbacatePay e config sensível. Nenhum acesso para `anon` ou `authenticated` — só edge functions. ✅

### `webhook_events`
| Operação | Política | Regra | Status |
|---|---|---|---|
| ALL | Service role full access webhook_events | apenas `service_role` | ✅

Tabela de idempotência usada pelo webhook AbacatePay. Cliente não tem nenhum acesso. ✅

---

## 2. Storage (buckets)

| Bucket | Público? | SELECT | INSERT | DELETE |
|---|---|---|---|---|
| `receipts` | **false** ✅ | escopo `foldername[1] = auth.uid()` | escopo `foldername[1] = auth.uid()` | escopo `foldername[1] = auth.uid()` |
| `skin-photos` | **false** ✅ | escopo `foldername[1] = auth.uid()` | escopo `foldername[1] = auth.uid()` | escopo `foldername[1] = auth.uid()` |

Ambos privados; arquivos isolados por pasta `{user_id}/...`. Para exibir no app é usado `createSignedUrl()`. **Nenhum vazamento entre usuários.** ✅

---

## 3. Tabelas indevidamente públicas

**Nenhuma.** Não existe nenhuma tabela em `public` com policy aberta a `anon`, e não há policy com expressão `true` exposta a `authenticated`. Os únicos `USING true` são restritos ao role `service_role` (que só edge functions usam internamente).

---

## 4. RLS quebrando o app?

Verifiquei o fluxo a partir do código que o app realmente usa:

- `use-user-data.tsx` / `use-life-hub-data.ts` lêem e escrevem em `user_data` sempre passando `user_id = session.user.id` → bate com a policy ✅
- `Auth.tsx` / signup → `handle_new_user` (SECURITY DEFINER) cria `profiles` automaticamente, contornando o INSERT bloqueado ✅
- Checkout / webhook → usam service role, ignoram RLS ✅
- Admin (`AdminAnalytics.tsx`) → `checkIsAdmin` consulta `user_roles` com a sessão do usuário, e a SELECT policy permite ler a própria role ✅
- Upload de comprovante / foto → caminho `{auth.uid()}/arquivo.ext` casa com `foldername[1] = auth.uid()` ✅

**Nenhuma policy está bloqueando funcionalidade legítima.**

---

## ✅ Conclusão

Os dados de cada usuário estão **totalmente isolados**. Todas as tabelas com dados pessoais (`user_data`, `profiles`, `subscriptions`) exigem `auth.uid() = user_id` em todas as operações permitidas; tabelas administrativas (`app_config`, `webhook_events`, mutações de `subscriptions`) só são acessíveis via service role; `user_roles` impede escalonamento de privilégios; e os buckets de storage estão privados com escopo por pasta de usuário.

**Nenhuma alteração de RLS é necessária.** Como esta revisão não exige mudanças no código nem no banco, basta aprovar este plano para encerrar a tarefa — não haverá nenhuma migration aplicada.
