

# Plano: Atualizar preços e integrar Stripe

## 1. Atualizar preços na página de Planos

| Plano | Antes | Depois |
|-------|-------|--------|
| Mensal | R$ 27,90/mês (R$ 334,80/ano) | R$ 19,90/mês (R$ 238,80/ano) |
| Anual | R$ 14,90/mês (R$ 178,80/ano, -47%) | R$ 14,90/mês (R$ 178,80/ano, -25%) |

O desconto muda de 47% para ~25% (19,90 → 14,90).

**Arquivo:** `src/pages/Planos.tsx` — atualizar o objeto `plans` com os novos valores e o badge de desconto.

## 2. Integrar com Stripe

Para integrar pagamentos reais com Stripe, preciso habilitar a integração Stripe do Lovable. Isso vai:

1. **Habilitar Stripe** — usando a ferramenta do Lovable que coleta sua chave secreta do Stripe
2. **Criar produtos/preços** no Stripe (CORE Pro Mensal R$19,90 e CORE Pro Anual R$14,90/mês)
3. **Criar edge function** para gerar sessão de checkout do Stripe
4. **Conectar o botão "Assinar"** para redirecionar ao checkout do Stripe
5. **Criar webhook** para atualizar a tabela `subscriptions` quando o pagamento for confirmado

### Passo a passo para você:
1. Eu atualizo os preços agora
2. Habilito o Stripe (vai pedir sua chave secreta do Stripe — você pega no [Dashboard do Stripe](https://dashboard.stripe.com/apikeys))
3. Depois implemento o fluxo completo de checkout

**Quer que eu prossiga com os dois passos (preços + habilitar Stripe)?**

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Planos.tsx` | Atualizar preços para 19,90 mensal e 14,90 anual, desconto -25% |

