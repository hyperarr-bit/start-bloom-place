## Objetivo
Remover o Passo 3 (anotação financeira) do tutorial spotlight de Finanças, que está causando ~69% de drop-off.

## Mudança
**Arquivo:** `src/pages/Index.tsx` (linha 144)

Remover esta única linha do array `steps` do `SpotlightOverlay`:

```ts
{ selector: '[data-spotlight="add-note"]', label: 'Escreva uma anotação financeira.', advanceOnAction: "first_note", checkKey: "finance-notes", onEnter: () => setActiveTab("financeiro") },
```

Resultado: o tutorial pula direto de "Cadastre um custo fixo" (passo 2) para "Adicione 1 conta no vencimento" (que vira o novo passo 3). Os contadores "Passo X de N" se ajustam automaticamente (de 12 → 11 passos).

## Fora do escopo
- Não mexer no componente `Notes` em si (continua existindo no app, só não faz mais parte do tutorial).
- Não mexer em analytics, eventos, ou no `SpotlightOverlay`.
- Sem outras "melhorias" não pedidas.

## Validação
Abrir `/` como guest, dar replay do tutorial via menu e confirmar que após "custo fixo" o tutorial vai direto pra "vencimento".