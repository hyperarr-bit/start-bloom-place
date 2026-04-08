

# Plano: Padronizar todos os inputs de data do app

## Problema
Apenas o `PeoplePanel` tem o fix de CSS (`appearance-none`, placeholder visual com overlay). Todos os outros ~25+ inputs `type="date"` ficam como retangulos brancos vazios no mobile — sem indicacao visual de que sao campos de data.

## Solucao
Aplicar o mesmo padrao em todos os inputs de data: `appearance-none`, `[&::-webkit-date-and-time-value]:text-left`, e um placeholder visual quando o valor esta vazio.

## Arquivos e mudancas (14 arquivos)

| Arquivo | Campos de data | Placeholder |
|---------|---------------|-------------|
| `src/components/relacionamentos/EventLog.tsx` | 1 (data do evento) | "Data" |
| `src/components/relacionamentos/DateCalendar.tsx` | 1 (data especial) | "Data" |
| `src/components/home/widgets/CountdownWidget.tsx` | 1 (data meta) | "Data" |
| `src/components/pet/PetExpenses.tsx` | 1 (data gasto) | "Data" |
| `src/components/pet/PetHealth.tsx` | 2 (data + proxima) | "Data" / "Proxima" |
| `src/components/casa/MaintenanceLog.tsx` | 1 (data garantia) | "Data" |
| `src/components/saude/MedicalLog.tsx` | 2 (consulta + exame) | "Data" |
| `src/components/saude/BodyEvolution.tsx` | 1 (data medicao) | "Data" |
| `src/components/travel/BillSplitter.tsx` | 1 | "Data" |
| `src/components/travel/TravelDiary.tsx` | 1 | "Data" |
| `src/components/travel/TripCountdown.tsx` | 2 (ida + volta) | "Ida" / "Volta" |
| `src/components/travel/DailyTimeline.tsx` | 1 | "Data" |
| `src/components/travel/TravelBudget.tsx` | 2 (ida + volta) | ja tem label acima |
| `src/pages/Carreira.tsx` | 2 | "Data" |
| `src/pages/Estudos.tsx` | 1 | "Data" |
| `src/pages/Biblioteca.tsx` | 4 | ja tem labels acima |
| `src/components/beleza/ProductInventory.tsx` | 1 | ja tem label acima |
| `src/components/beleza/ProductShelf.tsx` | 1 | ja tem label acima |
| `src/components/InstallmentTracker.tsx` | 1 | "Data" |
| `src/components/InvestmentsTracker.tsx` | 1 | ja tem label |
| `src/components/IncomeTable.tsx` | 1 | "Data" |
| `src/pages/Treino.tsx` | 1 | inline, sem necessidade |

## Padrao aplicado em cada input

Para inputs **sem label** acima (maioria dos casos inline/compactos):
```tsx
<div className="relative">
  <Input type="date" value={val} onChange={...} 
    className="... appearance-none [&::-webkit-date-and-time-value]:text-left" />
  {!val && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Data</span>}
</div>
```

Para inputs **com label** acima (Biblioteca, Beleza, TravelBudget):
- Apenas adicionar `appearance-none [&::-webkit-date-and-time-value]:text-left` ao className (o label ja serve de indicacao)

## Resumo
- ~25 inputs de data corrigidos
- ~20 arquivos alterados
- Padrao identico ao PeoplePanel ja aprovado

