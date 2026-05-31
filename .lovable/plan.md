## Dois ajustes no slide 0 mobile

### 1. CTA "Começar agora" deve avançar slide, não ir pro app
Trocar `onClick={finish}` por `onClick={goNext}` no botão do slide 0. O `finish` (→ `/financas`) só dispara no último slide (`isLast`), via `mobileNav`.

### 2. Cores idênticas à foto
A foto usa **verde puro** (Receitas / Saldo do mês) e **vermelho puro** (Gastos). Hoje uso `--chart-2` (verde escuro, ok) e `--chart-1` (rosa/magenta, errado).

Trocar nos 3 cards do slide 0:
- Receitas → `--success` (verde 142 55% 42%)
- Gastos → `--destructive` (vermelho 0 72% 55%)
- Saldo do mês → `--success`

Esses tokens já existem em `index.css` e respeitam o memory "Colors via CSS tokens only".

## Fora de escopo
- Outros slides, desktop, qualquer outra coisa.
