

## Plano: Checkout PIX inline no app

### O que muda
Em vez de abrir nova aba com o checkout da AbacatePay, o usuário clica em "Assinar" e vê o QR Code PIX e o código copia-e-cola direto na página de planos.

### Como funciona

**1. Nova edge function `abacatepay-pix` (ou modificar a existente)**
- Usa o endpoint `/transparents/create` da AbacatePay em vez de `/v1/billing/create`
- Envia `method: "PIX"` e `data: { amount, metadata }` 
- Retorna o `brCode` (copia-e-cola), `brCodeBase64` (imagem QR), `id` do PIX e `expiresAt`
- Mantém a lógica de autenticação e cache de `customerId` existente

**2. Atualizar `Planos.tsx` — tela de pagamento inline**
- Ao clicar "Assinar", chama a edge function e recebe os dados do PIX
- Exibe um modal/seção com:
  - Imagem QR Code (base64)
  - Código copia-e-cola com botão "Copiar"
  - Timer de expiração (countdown baseado no `expiresAt`)
  - Valor e plano selecionado
- Remove a lógica de `window.open` (nova aba)

**3. Webhook mantido**
- O webhook `abacatepay-webhook` existente continua tratando a confirmação do pagamento
- Quando o PIX é pago, o webhook ativa a assinatura normalmente

### Dúvida importante
O endpoint `/transparents/create` gera um PIX avulso — ele não vincula automaticamente à recorrência do produto. A recorrência que você configurou no dashboard funciona via o billing (`/v1/billing/create`) que redireciona ao checkout deles.

**Opções:**
- **Opção A**: Usar `/transparents/create` para o primeiro pagamento PIX inline, mas a recorrência automática precisaria ser gerenciada manualmente (criar novo PIX a cada ciclo via cron/webhook)
- **Opção B**: Manter o `/v1/billing/create` mas buscar os dados do PIX da cobrança gerada e exibir inline (se a API retornar o brCode na resposta do billing)

Preciso saber qual abordagem você prefere antes de implementar. Quer que eu investigue se o billing retorna os dados do PIX diretamente?

