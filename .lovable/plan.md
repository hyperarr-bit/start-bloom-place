## Objetivo

Simplificar o fluxo de cancelamento para **apenas 2 passos**, removendo a tela de confirmação intermediária.

Novo fluxo:
```text
Passo 1: Motivo → Passo 2: Ofertas (com opção de cancelar direto)
```

---

## Mudanças

### 1. `src/components/retention/CancelFlowDialog.tsx`

- **Remover o step `"confirm"`**. Tipo `Step` passa a ser: `"reason" | "offer" | "done"`.
- **Alterar o botão "Cancelar mesmo assim"** no step `offer` para chamar `handleConfirmCancel` diretamente em vez de ir para `setStep("confirm")`.
- **Remover todo o bloco JSX** do step `"confirm"` (linhas 370-398).
- **Manter o step `"done"`** para mostrar a confirmação final após o cancelamento.

### 2. Comportamento dos botões no step `offer`

- **"← Voltar"**: volta para `reason` (mantém como está)
- **"Cancelar mesmo assim"**: chama `handleConfirmCancel()` diretamente, mostra loading, e vai para `done` se sucesso

---

## Detalhes técnicos

- A função `handleConfirmCancel` já existe e faz o cancelamento + vai para `done` — só precisa ser chamada diretamente
- O step `done` continua mostrando a confirmação de que o cancelamento foi processado e até quando tem acesso
- Sem impacto nos edge functions — a lógica de cancelamento permanece a mesma