# Corrigir calculadora de IMC

## Bug

Em `src/pages/Saude.tsx` (linha 195) o cálculo é:
```ts
Number(bmiWeight) / Math.pow(Number(bmiHeight) / 100, 2)
```

Com altura `1.76` (em metros), divide por 100 → 0.0176 → IMC = 60 / 0.0176² ≈ **193698** (foi exatamente o que apareceu).

Outros problemas:
- Vírgula decimal ("1,76") vira `NaN`.
- Não há validação de faixa razoável.

## Solução

Substituir o bloco de cálculo (linhas 192-197) por uma versão que:
1. Aceita vírgula ou ponto como separador decimal.
2. Detecta automaticamente se a altura veio em metros (valor < 3) ou cm (>= 3).
3. Valida faixas plausíveis (altura 0.5–2.7 m; peso 0–500 kg) antes de mostrar resultado.

```ts
const parseNum = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const heightRaw = parseNum(bmiHeight);
const weightRaw = parseNum(bmiWeight);
const heightM = heightRaw > 3 ? heightRaw / 100 : heightRaw; // cm vs m
const valid =
  Number.isFinite(heightM) && heightM > 0.5 && heightM < 2.7 &&
  Number.isFinite(weightRaw) && weightRaw > 0 && weightRaw < 500;
const bmi = valid ? (weightRaw / (heightM * heightM)).toFixed(1) : null;
```

Com isso:
- 176 + 60 → 19.4 (Normal)
- 1,76 + 60 → 19.4 (Normal)
- 1.76 + 60 → 19.4 (Normal)

## Arquivo alterado
- `src/pages/Saude.tsx` (apenas o componente `BMICalculator`, linhas 192-197)
