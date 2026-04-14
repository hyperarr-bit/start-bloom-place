

# Abrir checkout na mesma aba

## Situação atual
- O checkout da AbacatePay **já está funcionando** (logs confirmam criação de assinatura com sucesso).
- O webhook está configurado corretamente para gravar a assinatura na tabela `subscriptions`.
- O `check-subscription` lê a tabela `subscriptions` e reconhece assinaturas ativas.
- As URLs de retorno estão corretas: `completionUrl` volta para `/planos?success=true` e `returnUrl` volta para `/planos?canceled=true`.

## Problema
O código em `Planos.tsx` usa `window.open("about:blank", "_blank")` para abrir o checkout em nova aba. O usuário quer que abra na mesma aba.

## O que vou fazer

### 1. Alterar `Planos.tsx` para redirecionar na mesma aba
- Remover `window.open("about:blank", "_blank")`.
- Usar `window.location.href = data.url` diretamente para redirecionar na mesma aba.
- Remover a referência ao `checkoutTab` e o toast "Checkout aberto em nova aba".

### 2. Verificar o fluxo pós-pagamento
- Após pagamento, a AbacatePay redireciona para `completionUrl` = `/planos?success=true`.
- O `useEffect` já detecta `?success=true` e mostra toast de sucesso.
- O botão de voltar (`ArrowLeft`) usa `navigate(-1)`, que volta para a página anterior no histórico do navegador.

### Arquivos
- `src/pages/Planos.tsx` -- remover lógica de nova aba, usar redirect na mesma aba.
