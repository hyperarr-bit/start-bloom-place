## O que vai mudar

### 1. Nova oferta: 7 dias grátis (extensão de período)
Quando o motivo for **"Não tô usando o suficiente"**, além das ofertas atuais (50% off + pausa), vai aparecer também um card de **"+7 dias grátis pra você testar de verdade"** — estende `current_period_end` em 7 dias sem cobrar.

### 2. Suporte interno (substitui mailto)
Quando o motivo for **"Tive problema técnico"** (ou clicar no atalho de suporte), em vez de abrir Gmail/mailto, abre um **textarea inline** dentro do próprio dialog pedindo "Conta o que aconteceu". Ao enviar:
- Salva no banco (tabela nova `support_tickets`) — visível pro admin.
- Mostra confirmação: **"Recebi! Já tô olhando seu caso pessoalmente, te respondo em até 24h. 💛"**

### 3. Copy mais convincente no recurso faltante
Botão **"Quero ser avisado quando lançar"** → ao clicar, toast muda pra:
**"Anotado! Esse recurso já tá na nossa lista de prioridades — vou correr pra entregar. Te aviso assim que sair. 💛"**
(Hoje só diz "Vou te avisar"; novo texto sinaliza que já vão tentar adicionar.)

### 4. Tracking de conversão motivo × oferta
Pra você analisar qual combinação salva mais usuários, todo `cancel_attempts` vai gravar **quais ofertas foram exibidas** no momento, junto do motivo. Já existe `reason`; vamos adicionar coluna `offers_shown` (jsonb).

Quando a tela de oferta abrir, o frontend dispara `log_offers_shown` com a lista (ex: `["discount", "pause", "extend_7d"]`). Você consulta:
```sql
SELECT reason, offers_shown, outcome, count(*)
FROM cancel_attempts
GROUP BY reason, offers_shown, outcome;
```

---

## Detalhes técnicos

### Migration
```sql
-- 1. Nova coluna em cancel_attempts
ALTER TABLE cancel_attempts ADD COLUMN offers_shown jsonb DEFAULT '[]'::jsonb;

-- 2. Nova tabela de tickets de suporte
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'cancel_flow', -- 'cancel_flow' | 'general'
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  cancel_attempt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tickets" ON support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own tickets" ON support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all tickets" ON support_tickets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update tickets" ON support_tickets
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role full access tickets" ON support_tickets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Edge function: `cancel-subscription-flow/index.ts`
Adicionar 3 novas actions:

- **`log_offers_shown`**: `{ attemptId, offers: string[] }` → `UPDATE cancel_attempts SET offers_shown = $offers`.
- **`extend_trial`** (nova oferta de 7 dias): só liberada quando `reason = 'not_using'` e ainda não usada (registra em `retention_offers_used` com `offer_type='extend_7d'`). Estende `current_period_end` em 7 dias. Adicionar `canUseExtension` no retorno de `eligibility`/`open`.
- **`submit_support_ticket`**: `{ attemptId, message }` → insere em `support_tickets` linkado ao `cancel_attempt_id`, marca attempt como `outcome='saved_feedback'`, registra evento `support_ticket_created`.

### Frontend: `CancelFlowDialog.tsx`
- Estado novo: `canUseExtension`, `supportMessage`, `showSupportForm`.
- No `useEffect` quando entra no step `offer`: monta lista de ofertas exibidas conforme `reason` + elegibilidade e dispara `log_offers_shown`.
- **Card "+7 dias grátis"**: renderizado só quando `reason === 'not_using' && canUseExtension`.
- **Botão "Falar com o suporte"**: vira `<Button>` que abre form inline (textarea + enviar) em vez de `<a href="mailto:">`. Submit chama `submit_support_ticket`.
- **Toast do "avisado quando lançar"**: nova copy convincente.

### Admin (opcional, mas recomendado)
Criar `src/pages/admin/AdminSupportTickets.tsx` com listagem simples (email, mensagem, data, status) + botão "marcar resolvido". Adicionar rota em `AdminLayout.tsx`. Se preferir adiar, você consulta direto no SQL editor por enquanto.

---

## Arquivos editados
- `supabase/functions/cancel-subscription-flow/index.ts` — 3 actions novas + lógica `extend_7d`
- `src/components/retention/CancelFlowDialog.tsx` — novo card, form de suporte, log de ofertas
- Migration: nova coluna `offers_shown` + tabela `support_tickets`
- (opcional) `src/pages/admin/AdminSupportTickets.tsx` + rota

## Como você analisa depois
```sql
SELECT reason, offers_shown, outcome, COUNT(*) AS n,
  ROUND(100.0 * COUNT(*) FILTER (WHERE outcome LIKE 'saved_%') / COUNT(*), 1) AS save_rate_pct
FROM cancel_attempts
WHERE created_at > now() - interval '30 days'
GROUP BY reason, offers_shown, outcome
ORDER BY n DESC;
```

Confirma pra eu implementar?