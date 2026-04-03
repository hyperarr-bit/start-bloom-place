

# Ajustes no Módulo de Investimentos

## 2 mudanças:

### 1. Texto "MEUS INVESTIMENTOS" cortado no header
O header preto do card (linha 165-169) usa `table-header-dark` mas o texto e botão ficam apertados no mobile (430px). Adicionar `px-4` ao header para dar padding lateral, igual ao fix feito no BillsDueCards.

### 2. Campo de taxa de retorno anual (%) por investimento
Atualmente o simulador usa taxas fixas hardcoded (8%, 15%, 6%). Cada investimento precisa ter um campo `expectedReturn` (% anual esperada) para que:
- O cálculo de projeção 5/10 anos use juros compostos reais por investimento
- A rentabilidade projetada reflita a taxa informada pelo usuário
- O simulador de independência financeira use a média ponderada das taxas

#### Interface atualizada
```typescript
interface Investment {
  // ... campos existentes
  expectedReturn: number; // % anual esperada (ex: 12.5)
}
```

#### Formulário
Adicionar campo "Rentabilidade esperada (%)" no form de criação e na linha de cada investimento (editável).

#### Simulador corrigido
- **5 anos**: `Σ (valorAtual_i × (1 + taxa_i/100)^5) + Σ (aporteMensal_i × ((1+taxa_i/12/100)^60 - 1) / (taxa_i/12/100))`
- **10 anos**: mesma fórmula com 120 meses
- **Renda passiva**: usa média ponderada das taxas pelo valor atual

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/InvestmentsTracker.tsx` | Adicionar `px-4` no header; campo `expectedReturn` na interface e form; usar juros compostos reais no simulador; campo editável de % em cada investimento |

