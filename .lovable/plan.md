## Objetivo

1. Aumentar a oferta de retenção de **50% off por 2 meses** → **50% off por 3 meses**.
2. Encurtar o fluxo de cancelamento de 4 passos para 3, juntando o passo "como podemos ajudar" (segmented) com o passo "ofertas" em uma única tela.

Novo fluxo:
```text
Passo 1: Motivo  →  Passo 2: Resposta segmentada + Ofertas (unificado)  →  Passo 3: Confirmação
```

---

## Mudanças

### 1. `supabase/functions/cancel-subscription-flow/index.ts`
- Trocar `cycles: 2` → `cycles: 3` no `apply_discount`:
  - `metadata: { percent_off: 50, cycles: 3, ... }`
  - resposta `{ ok: true, type: "discount", percentOff: 50, cycles: 3 }`
  - evento analytics permanece com `percent_off: 50` (adicionar `cycles: 3`)

### 2. `supabase/functions/apply-pending-discounts/index.ts`
- Verificar se a aplicação do desconto na AbacatePay usa `cycles` do metadata; se sim, já passa a aplicar 3 ciclos automaticamente. Se estiver hardcoded como 2, atualizar para ler `metadata.cycles`.

### 3. `src/components/retention/CancelFlowDialog.tsx` — unificar steps
- Remover o step `"segmented"`. Tipo `Step` passa a ser: `"reason" | "offer" | "confirm" | "done"`.
- Após `handleReasonNext`, ir direto para `setStep("offer")`.
- Nova tela `"offer"` combina:
  - **Header empático contextual** (mensagem segmentada por motivo — atual conteúdo do step 2):
    - `not_using` → "Que tal um empurrãozinho?"
    - `missing_feature` → "Anotado! Mas antes de ir..."
    - `technical_issue` → "Vamos resolver isso"
    - `too_expensive` / `other` → "Entendi 💛 Tenho uma oferta pra você"
  - **Card principal de desconto** em destaque (50% off por 3 meses) — copy ajustada:
    - "Continue com tudo liberado pagando metade do preço nas próximas **3 cobranças**."
  - **Card secundário de pausa** (até 3 meses, sem cobranças).
  - Para `missing_feature` / `technical_issue`, manter botão extra ("Avise-me quando lançar" / "Falar com suporte") acima dos cards, ainda permitindo ver as ofertas na mesma tela.
- Footer: `← Voltar` (volta para `reason`) e `Cancelar mesmo assim` (vai para `confirm`).
- Botão "Voltar" do step `confirm` deve apontar para `"offer"` (não mais `"offers"`).
- Atualizar toast do `handleApplyDiscount`: "50% off nas próximas **3 cobranças**".

### 4. Texto do card de desconto
- "**50% off por 3 meses**" (era "por 2 meses")
- Subcopy: "Continue com tudo liberado pagando metade do preço nas próximas 3 cobranças."

---

## Detalhes técnicos

- O badge "só pode usar uma por ano" continua válido (regra de `retention_offers_used` não muda).
- Nenhuma mudança de schema necessária — `metadata.cycles` já é jsonb livre.
- Nenhum impacto em winback (fluxo separado).
- Analytics: eventos `retention_offer_accepted` e `retention_discount_applied` continuam, agora refletindo `cycles: 3`.
