## Correção do streak (dias consecutivos)

### Bug 1: data em UTC
`todayStr()` usa `toISOString()`, que retorna UTC. No Brasil (UTC-3), depois das 21h o app já acha que é "amanhã" — o streak quebra ou pula um dia sem motivo.

**Fix:** trocar por `localDateStr()` baseado em `getFullYear/Month/Date` (horário local). Aplicar tanto no `tStr` quanto no `yesterdayStr` para os dois usarem o mesmo fuso.

### Bug 2: race com a hidratação do cache
Depois da última mudança, o `useEffect` do streak roda assim que `loaded === true` — ou seja, **com dados do cache local**. Se o servidor tiver um `lastDate` mais recente (ex: você usou em outro dispositivo), o cálculo é feito errado e o `set()` sobrescreve o valor correto que o Supabase ainda nem entregou.

**Fix:** atrasar o cálculo do streak em ~800ms via `setTimeout` dentro do `useEffect`, dando tempo do refresh em background do Supabase chegar antes.

### Arquivo modificado

- `src/hooks/use-life-hub-data.ts` — substituir `todayStr` pela versão local e envolver a lógica do streak em `setTimeout(..., 800)`.

Sem mudanças no schema, sem novas dependências.
