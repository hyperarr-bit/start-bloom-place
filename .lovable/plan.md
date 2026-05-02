# Corrigir crashes em Gratidão, Rotina de Limpeza e Estratégias

São o mesmo tipo de bug que já vimos: dado seedado (ou antigo) tem shape diferente do que o componente espera, o código acessa array sem checar e quebra.

## Erros identificados

| Aba | Arquivo | Linha | Causa |
|---|---|---|---|
| Gratidão (Desenvolvimento Pessoal) | `DesenvolvimentoPessoal.tsx` | 434 | `items.filter(...)` quando `items` não é array (entrada antiga de gratidão pode estar como string ou objeto) |
| Rotina de Limpeza (Casa) | `CleaningRoutine.tsx` | 180 | `section.items` undefined em alguma seção do seed |
| Estratégias (Hiperfoco) | `StrategyPanel.tsx` | 105 | `s.actions` undefined — o seed de `hiperfoco-strategies` tem `description` mas não `actions` |

## Correção

Aplicar o mesmo padrão defensivo das correções anteriores: normalizar o array logo na leitura.

**1. `DesenvolvimentoPessoal.tsx` linha 434**
```tsx
{(Array.isArray(items) ? items : []).filter(Boolean).map(...)}
```

**2. `CleaningRoutine.tsx` (após `usePersistedState`)**
```tsx
const [rawSections, setSections] = usePersistedState(...);
const sections = (Array.isArray(rawSections) ? rawSections : []).map(s => ({
  ...s,
  items: Array.isArray(s?.items) ? s.items : [],
}));
```

**3. `StrategyPanel.tsx` (após `usePersistedState`)**
```tsx
const [rawStrategies, setStrategies] = usePersistedState(...);
const strategies = (Array.isArray(rawStrategies) ? rawStrategies : []).map(s => ({
  id: s?.id ?? crypto.randomUUID(),
  title: s?.title ?? "",
  description: s?.description ?? "",
  actions: Array.isArray(s?.actions) ? s.actions : [],
  status: s?.status ?? "planejando",
}));
```

Não precisa migração de banco — a normalização em código já cura o problema e protege contra qualquer dado antigo no futuro.

Posso aplicar?
