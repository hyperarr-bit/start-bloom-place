
## O que está escrito na imagem
`Erro ao iniciar checkout: Edge Function returned a non-2xx status code`

## O que isso significa
Isso **não é o erro real da AbacatePay**.  
Isso significa apenas que o frontend chamou a edge function `abacatepay-checkout` e ela respondeu com **HTTP 500** (ou outro status fora de 2xx). Ou seja: o problema está **no backend da integração**, não no botão nem na tela.

## Diagnóstico frio do que está acontecendo
Pelos logs atuais da função, o erro real é este:

```text
[ABACATEPAY-CHECKOUT] ERROR: Expected property 'customer.name' to be string but found: undefined
```

Então hoje o fluxo quebra **antes mesmo de gerar a URL do checkout**.

## Causa real encontrada no código
No arquivo `supabase/functions/abacatepay-checkout/index.ts`, o código envia:

```ts
customer: {
  email: user.email,
}
```

Mas a documentação da AbacatePay mostra que, quando você envia `customer`, ela espera dados completos do cliente. E a documentação de cliente v1 deixa claro que `name`, `cellphone`, `email` e `taxId` são obrigatórios.

Hoje seu projeto **não tem esses dados disponíveis** para cobrança:
- `profiles` só tem `id`, `created_at` e `display_name`
- não existe campo para telefone
- não existe campo para CPF/CNPJ
- o checkout está tentando criar a cobrança com dados insuficientes

## Sobre a recorrência
Você está certo em contestar isso: **a AbacatePay tem recorrência**.

O problema é que o código atual está usando o endpoint **v1**:
```text
POST /v1/billing/create
```

Esse endpoint é de **cobrança/checkout**, e a própria documentação dele limita `frequency` a:
- `ONE_TIME`
- `MULTIPLE_PAYMENTS`

Para recorrência real, a documentação atual da AbacatePay mostra o fluxo de **assinatura v2**:
```text
POST /v2/subscriptions/create
```

Então há **2 problemas separados** hoje:
1. **Erro imediato:** faltam dados obrigatórios do cliente (`customer.name` etc.)
2. **Erro de arquitetura:** a integração foi montada no endpoint errado para SaaS recorrente

## Possibilidades corretas
### Caminho A — remendo rápido
Fazer o checkout atual parar de dar 500:
- coletar nome + telefone + CPF/CNPJ
- enviar `customer` completo
- manter `v1/billing/create`

Isso faria o checkout abrir, **mas ainda não seria a recorrência ideal**.

### Caminho B — correção certa
Migrar para o fluxo de assinatura da AbacatePay:
- usar endpoint de assinatura v2
- usar produto/plano recorrente configurado na AbacatePay
- adaptar webhook para eventos de assinatura/cobrança
- persistir status da assinatura localmente

Esse é o caminho que eu recomendo.

## Plano de correção recomendado
1. **Corrigir a base dos dados do cliente**
   - adicionar no perfil os campos de cobrança: nome completo, telefone e CPF/CNPJ
   - validar isso antes de tentar checkout

2. **Parar de usar o fluxo v1 para assinatura**
   - trocar `abacatepay-checkout` do `v1/billing/create` para o endpoint de assinatura recorrente da AbacatePay
   - mapear os planos mensal/anual para os produtos/itens corretos da AbacatePay

3. **Ajustar o frontend de planos**
   - se faltar dado obrigatório, abrir coleta/complemento cadastral antes do redirecionamento
   - mostrar o erro real da função em vez do toast genérico

4. **Revisar webhook**
   - adaptar o `abacatepay-webhook` para os eventos compatíveis com assinatura recorrente
   - manter atualização da tabela `subscriptions` com mais robustez
   - alinhar o parâmetro de secret com o formato esperado no painel/webhook

5. **Validar ponta a ponta**
   - criar checkout
   - confirmar redirecionamento
   - simular/validar evento de pagamento
   - conferir atualização da assinatura no app

## Arquivos que devem entrar na correção
- `supabase/functions/abacatepay-checkout/index.ts`
- `supabase/functions/abacatepay-webhook/index.ts`
- `src/pages/Planos.tsx`
- migration para ampliar `profiles` com dados de cobrança

## Detalhe técnico importante
O texto da imagem continua igual porque o frontend só mostra:
```text
Edge Function returned a non-2xx status code
```
Mas o erro interno **já mudou**: agora não é mais `frequency`; agora o bloqueio real é `customer.name` ausente. Então a leitura correta é:

```text
UI -> falha genérica 500
Logs -> causa verdadeira: customer.name undefined
Arquitetura -> endpoint atual não é o ideal para recorrência SaaS
```
