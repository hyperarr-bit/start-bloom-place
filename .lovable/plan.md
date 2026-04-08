

# Plano: Corrigir layout do campo de data no formulário de Pessoas

## Problema
O input `type="date"` no formulário de adicionar pessoa está desconfigurado no mobile (iOS/Safari aplica estilos nativos que ignoram a altura definida). O campo fica maior que o campo "Notas" ao lado, quebrando o alinhamento do grid.

## Mudança

No `src/components/relacionamentos/PeoplePanel.tsx`, linha 117:

- Adicionar `appearance-none` ao className do input de data para resetar estilos nativos do iOS
- Adicionar `placeholder="dd/mm/aaaa"` para clareza visual
- Garantir que o input tenha mesma altura com classes extras de controle

```tsx
// De:
<Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-7 text-[11px]" />

// Para:
<Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-7 text-[11px] appearance-none [&::-webkit-date-and-time-value]:text-left" placeholder="dd/mm/aaaa" />
```

## Arquivo alterado (1)

| Arquivo | Mudança |
|---------|---------|
| `src/components/relacionamentos/PeoplePanel.tsx` | Adicionar `appearance-none` e classes de normalização ao input de data |

