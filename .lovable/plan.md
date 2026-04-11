

## Plano: Usar links de pagamento fixos do dashboard

### Problema
Os links de pagamento foram criados manualmente no dashboard da AbacatePay, então não precisamos mais criar billings via API. A edge function deve simplesmente retornar o link correto baseado no plano escolhido.

### Alteração em `supabase/functions/abacatepay-checkout/index.ts`

Simplificar a função para apenas retornar o link fixo:

- Mensal: `https://app.abacatepay.com/pay/bill_sLEKFXn23xDfmXm4w0YenBZM`
- Anual: `https://app.abacatepay.com/pay/bill_tQZey5eLr4JtaKgcMMASu6n1`

Remover toda a lógica de criação de customer e billing via API — não é mais necessária. Manter apenas a autenticação do usuário para garantir que só usuários logados acessem o checkout.

### Resultado
- Checkout redireciona direto para o link de pagamento com recorrência configurada no dashboard
- Função muito mais simples e sem dependência da API key
- Frontend não muda nada

