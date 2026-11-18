# /escolha (2 planos: Mensal R$ 34,90 · Vitalício R$ 97,90): o que depende de você

Ramo `planos-34-97`, worktree `/Users/joao/core/wt-planos`. **Nada foi subido.** Não houve push, deploy, migração, nem mudança na Stripe ou na Meta.

A página está atrás de duas chaves no `<head>` do `landing.html`, as duas desligadas:

- **`PLANOS_PAGINA = "off"`**: o link `/escolha` manda para a `/oferta` com a mesma query (utm, fbclid) e não vende.
- **`PLANOS_PIX_MENSAL = "off"`**: o mensal só aparece no cartão.

A `/oferta` continua igual. Isso está provado por teste: os atributos e a memória do `<head>` são idênticos aos do main `ead00a4a`, com a chave desligada e com ela ligada.

---

## 1. Painel da Stripe

### 1.1 PIX → "Pagamentos recorrentes" (Pix Automático)
- Ligar no painel (Configurações → Formas de pagamento → Pix). A confirmação leva uns 3 dias.
- O código só usa o Pix recorrente com duas coisas ligadas:
  - a env `STRIPE_PIX_RECORRENTE=on` no Supabase;
  - a chave `PLANOS_PIX_MENSAL = "on"` na página.
- Antes disso o mensal é só no cartão. Se alguém chamar a função mesmo assim, o servidor responde 503.

### 1.2 Chave restrita (`STRIPE_SECRET_KEY`)
Hoje ela tem: PaymentIntents escrita, Charges leitura, Customers leitura.

O que **falta** (Developers → API keys → editar a chave restrita):

| Recurso | Precisa | Por quê |
|---|---|---|
| PaymentIntents | **Escrita** (já tem) | Vitalício: criar, confirmar, parcelar e cancelar o Pix antigo. Mensal: pôr a metadata no PI da 1ª fatura. |
| Charges | Leitura (já tem) | Método e parcelas no webhook. |
| **Customers** | **Escrita** (hoje é só leitura) | Criar o cliente da assinatura e definir o cartão padrão. |
| **Subscriptions** | **Escrita** | Criar a assinatura (cartão e Pix). O webhook lê o estado atual, agenda o cancelamento no fim do período (mensal em dobro ou vitalício por cima) e cancela na hora no estorno. |
| **Invoices** | **Escrita** | Anular (void) a 1ª fatura do Pix mensal quando a pessoa troca de forma de pagar: é a trava contra pagar duas vezes. O webhook também lê a fatura (estorno do mensal). |
| **PaymentMethods** | **Escrita** | Anexar o cartão ao cliente (attach). |
| **Prices** | **Leitura** | Conferir que `STRIPE_PRECO_MENSAL_34` é mesmo 3490 BRL/mês. Sem isso o mensal fica indisponível (503). |
| Products | Leitura (opcional) | O código não lê, mas o painel mostra junto do preço. |
| SetupIntents | não precisa | O código não usa (a doc do Pix por assinatura não usa). |
| Mandates | Leitura (opcional) | O código não lê. Só serve se um dia quisermos ver o mandato do Pix Automático pelo painel ou pela API. |

### 1.3 Eventos do webhook
Endpoint de hoje: `…/functions/v1/stripe-webhook`. Ele já tem `payment_intent.succeeded`, `charge.refunded` e `charge.dispute.created`.

Adicionar no **mesmo** endpoint (se ainda não estiverem lá por causa do /funil-app):
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

`mandate.updated` (a pessoa revogou o Pix Automático no banco) não está tratado. Não precisa adicionar. Se a pessoa revogar, a próxima cobrança falha e cai no fluxo de "falhou" (`past_due` → fim).

### 1.4 Produto e preço
- O **mensal usa um Price da Stripe**: a env **`STRIPE_PRECO_MENSAL_34`**, a mesma do /funil-app. O código não cria preço (não usa `price_data`).
- Se o preço ainda não existir, criar o produto "CORE mensal" com preço recorrente de **R$ 34,90 BRL por mês** e gravar o `price_…` com `supabase secrets set STRIPE_PRECO_MENSAL_34=price_…`.
- O código confere o preço a cada assinatura: unit_amount 3490, brl, month, interval_count 1, ativo.
- O **vitalício não usa produto nem preço**: é um PaymentIntent de 9790 com o valor fixo no servidor (`_shared/stripe-ofertas.ts`, linha `planos`).

### 1.5 Apple Pay / Google Pay
- O cartão da `/escolha` usa o Payment Element com `wallets: applePay "auto", googlePay "auto"`. Os botões aparecem quando o aparelho suporta.
- Na Stripe (Configurações → Formas de pagamento → **Domínios de formas de pagamento**), registrar `www.coreaplicativo.com.br` e `coreaplicativo.com.br`, se ainda não estiverem lá.
- O site inteiro manda `Permissions-Policy: payment=()`, que bloqueia carteira. O `vercel.json` ganhou uma regra **só para `/escolha`** com `payment=(self "https://js.stripe.com")`, colocada depois da regra geral.
- **Conferir depois do deploy:** `curl -sI https://www.coreaplicativo.com.br/escolha | grep -i permissions`. Tem que aparecer `payment=(self "https://js.stripe.com")`. Se aparecer `payment=()`, a Vercel não deixou a regra de baixo sobrescrever, e o Apple Pay não vai aparecer. Nesse caso me chame.
- Na `/oferta` nada mudou: carteira continua desligada lá.

## 2. Nota fiscal
- A Stripe não emite nota. Vale o que já estava pendente na `/oferta`: escolher um emissor (eNotas, NFE.io, Notazz) ou o Emissor Nacional, e perguntar ao contador.
- **Novidade com o mensal:** é **1 nota por mês pago** (cada `invoice.paid`). O vitalício continua sendo 1 nota.
- O checkout **não pede CPF** (como a /oferta hoje).
- A doc da Stripe lista nome + CPF como dados de cobrança do Pix Automático, mas fala em "transações internacionais". **Assumi** que, como na /oferta, o Pix sai sem CPF. Se a 1ª compra real do Pix mensal falhar pedindo CPF, me avise: o campo de CPF já existe no checkout da /oferta e dá pra trazer.

## 3. Ordem de deploy (cada passo com o seu ok)
1. **Painel da Stripe:** itens 1.2, 1.3, 1.4 e 1.5. O 1.1 (Pix recorrente) pode ser pedido já, porque leva uns 3 dias.
2. **Funções** (o `_shared` vai junto em cada uma):
   - `supabase functions deploy stripe-criar`
   - `supabase functions deploy stripe-status`
   - `supabase functions deploy stripe-webhook --no-verify-jwt`
   - `supabase functions deploy afiliados` (o link de indicação passa a aceitar a compra do vitalício da /escolha)

   Depois do deploy, conferir que a /oferta segue vendendo normal: na 1ª venda, olhar o log do webhook.
3. **Sem migração:** nenhuma tabela nova. O mensal usa a linha de `subscriptions` de sempre e a comissão usa `afiliado_vendas`.
4. **Site** (merge do ramo, com as 2 chaves `off`): `/escolha` existe, mas vai para a `/oferta`.
5. **Ligar a página:** `PLANOS_PAGINA = "on"` (1 commit). Antes de anunciar, **1 compra real de cada**, com reembolso depois:
   - vitalício no Pix;
   - vitalício no cartão em **12x**: confere se o seu banco cobrou juros e qual o valor real da parcela (a tela mostra 12x de R$ 8,16, o total dividido por 12, arredondado para cima);
   - mensal no cartão.

   Em cada compra, conferir:
   - o acesso no app;
   - o e-mail;
   - `stripe_venda` com `pagina: planos`;
   - o Purchase no Gerenciador de Eventos, 1 só, com valor 97,90 ou 34,90;
   - no mensal: cancelar pelo app e ver `cancel_scheduled` com o acesso até o fim do mês.
6. **Campanha nova da Meta** só para `https://www.coreaplicativo.com.br/escolha`, depois do passo 5.
7. **Pix Automático**, quando a Stripe confirmar o recorrente:
   - `supabase secrets set STRIPE_PIX_RECORRENTE=on`;
   - `PLANOS_PIX_MENSAL = "on"` (1 commit);
   - 1 assinatura real no Pix, conferindo que o banco pediu a autorização do débito mensal.

**Rollback:** `PLANOS_PAGINA = "off"` (a página volta a mandar para a /oferta) ou `PLANOS_PIX_MENSAL = "off"`. As funções novas não mudam a /oferta.

## 4. Decisões que ficaram com você
- **Carência de 7 dias no mensal que não pagou.** Hoje o app (`check-subscription`) dá 7 dias além do fim do período para quem está `active` ou `past_due`. Mantive o mesmo mecanismo, como pedido.
  - Por isso, quem **para de pagar** fica até 7 dias além do mês pago, enquanto a Stripe tenta de novo.
  - Quem **cancela** perde o acesso exatamente no fim do mês pago (`cancel_scheduled` não tem carência).
  - A carência é necessária para o Pix Automático: o banco debita 3 dias depois do vencimento (até 7 com as novas tentativas). Sem ela, todo assinante do Pix ficaria 3 dias sem acesso todo mês.
- **Link de indicação.** O link que o comprador da /escolha recebe aponta para a **/oferta** (é o link de sempre do indique). A amiga que comprar na /oferta gera os 50% de 67,90 (= R$ 33,95, o mesmo valor). Quem chega na `/escolha?ref=…` gera os R$ 33,95 fixos: no vitalício na hora, no mensal só no 2º pagamento. Se quiser que o link mande para a /escolha, é uma linha.
- **Folha do indique.** Ela aparece no pós-compra só do **vitalício**. O comprador do mensal não ganha link.
