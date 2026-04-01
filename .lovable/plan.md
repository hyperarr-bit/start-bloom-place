

## Por que a Virada de Mês não funciona

Encontrei **3 bugs** no componente `MonthTurnover.tsx`:

### Bug 1: Condição nunca é verdadeira na primeira vez
Linha 127:
```js
if (lastSeenMonth && lastSeenMonth !== currentKey && prevHasData) {
```
Na primeira vez, `lastSeenMonth` é `""` (string vazia = falsy), então a condição falha. Logo em seguida (linha 130-132), o valor é atualizado para `"Abril-2026"`. Na próxima visita, `lastSeenMonth === currentKey`, então também não mostra. **O modal nunca aparece.**

### Bug 2: `getMonthTotals` lê direto do localStorage
A função `getMonthTotals` em `storage-keys.ts` usa `localStorage.getItem()` direto, mas os dados são gerenciados pelo `useUserData` (que armazena no Supabase + cache local). Se o usuário nunca usou as chaves com prefixo de mês (`finance-month-marco-*`), os dados de Março estarão nas chaves base (`finance-incomes`, etc.) — mas `getMonthTotals("Março")` busca nas chaves prefixadas. Resultado: `prevHasData` é sempre `false` para o mês anterior se era o mês corrente quando os dados foram inseridos.

### Bug 3: `copyToMonth` também usa localStorage direto
Mesmo problema — lê/escreve `localStorage` diretamente em vez de usar o `useUserData`.

---

## Plano de Correção

### 1. Corrigir a lógica de detecção de virada de mês
- Mudar a condição: se `lastSeenMonth` está vazio OU diferente do mês atual, e o mês anterior tem dados → mostrar modal
- Separar o conceito de "primeira visita" (não mostrar) de "virada de mês" (mostrar)
- Lógica correta: se `lastSeenMonth` não está vazio E é diferente do currentKey → virada detectada

### 2. Corrigir `getMonthTotals` para o mês anterior
- O mês anterior (Março) era o mês corrente quando o usuário inseriu dados, então os dados estão nas chaves base (`finance-incomes`, etc.), não nas chaves prefixadas
- Ajustar `getMonthTotals` para considerar isso: quando o mês pedido era o "mês corrente do período anterior", buscar nas chaves base arquivadas
- Alternativa mais simples: ao detectar virada de mês, **primeiro arquivar** os dados do mês que acabou (mover das chaves base para chaves prefixadas) antes de calcular totais

### 3. Implementar "arquivamento" automático na virada
- Quando detectar que virou o mês, copiar os dados das chaves base para as chaves do mês anterior (prefixadas)
- Limpar as chaves base para o novo mês começar limpo
- Usar `useUserData().set()` em vez de `localStorage` direto

### 4. Garantir que `copyToMonth` use o sistema correto
- Atualizar para usar `useUserData` em vez de `localStorage` direto

### Arquivos a modificar
- `src/components/MonthTurnover.tsx` — lógica do useEffect, arquivamento, usar useUserData
- `src/components/finance/storage-keys.ts` — ajustar `getMonthTotals` para aceitar um getter customizado

### Resultado esperado
- No dia 1º de Abril, ao abrir a aba Finanças, o modal de recap de Março aparece automaticamente
- O wizard de cópia funciona corretamente
- Os dados são persistidos via Supabase (não localStorage direto)

