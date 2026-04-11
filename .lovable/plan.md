

## Plano: Otimizar checkout e corrigir texto

### 1. Corrigir texto "12 módulos" → "16 módulos"
- Linha 34 de `Planos.tsx`: trocar `"Todos os 12 módulos desbloqueados"` por `"Todos os 16 módulos desbloqueados"`

### 2. Acelerar redirecionamento
O delay atual vem de criar customer + billing em sequência (2 requests à API da AbacatePay antes de redirecionar).

Otimização: abrir uma nova aba/janela imediatamente ao clicar, mostrar feedback visual, e redirecionar assim que a URL chegar. Também podemos cachear o `customerId` para evitar recriar o customer toda vez.

Mudanças em `Planos.tsx`:
- Usar `window.open` com target para abrir checkout em nova aba (redirecionamento percebido como instantâneo)
- Ou manter na mesma aba mas mostrar skeleton/loading mais rápido

Mudanças em `abacatepay-checkout/index.ts`:
- Fazer as duas chamadas (customer + billing) em paralelo quando possível, ou cachear customerId no metadata do usuário para pular a criação de customer em checkouts futuros

### Arquivos modificados
- `src/pages/Planos.tsx` — texto + UX de loading
- `supabase/functions/abacatepay-checkout/index.ts` — otimizar fluxo

