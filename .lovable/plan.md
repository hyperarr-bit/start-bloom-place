

## Plano: Configurar recorrência nos produtos AbacatePay

### Passo 1 — Você faz no dashboard (app.abacatepay.com)
Criar **2 novos produtos** em "Criar produto":

**Produto 1:**
- Nome: CORE PRO MENSAL
- Ciclo de pagamento: **Mensal**
- Valor: R$ 19,90 (1990 centavos)

**Produto 2:**
- Nome: CORE PRO ANUAL
- Ciclo de pagamento: **Anual**
- Valor: R$ 178,80 (17880 centavos)

Depois de criar, copie os **IDs dos produtos** que o dashboard gera.

### Passo 2 — Eu atualizo a edge function
Em `supabase/functions/abacatepay-checkout/index.ts`:
- Trocar o `externalId` dos planos pelos novos IDs de produto
- Nomes em maiúsculo (CORE PRO MENSAL / CORE PRO ANUAL)
- Manter `frequency: "MULTIPLE_PAYMENTS"` — a recorrência agora é controlada pelo ciclo do produto

### Resultado
- A AbacatePay cobra automaticamente no ciclo definido no produto
- Nomes aparecem em maiúsculo no checkout
- Nenhuma mudança no frontend

### Próximo passo
Me passe os 2 IDs dos produtos novos após criá-los no dashboard.

