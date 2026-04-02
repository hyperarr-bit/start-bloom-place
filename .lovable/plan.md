

# Reformular Cards do Dashboard

## Problema
Os 4 cards novos (Progresso do Mês, Últimas Transações, Gasto por Método, Fixos vs Variáveis) estão:
1. Na posição errada — devem ficar **por último**, após Evolução do Patrimônio
2. Usando estilo dos Alertas Inteligentes (ícones Lucide nos títulos, sub-cards coloridos com `bg-orange-500/10`) em vez do estilo dos cards de gráficos

## Identidade Visual Correta (cards de gráficos)
- Título: **emoji + UPPERCASE** (`📊 GASTOS POR CATEGORIA`, `📈 RECEITAS VS DESPESAS`, `💰 EVOLUÇÃO DO PATRIMÔNIO`)
- Container: `bg-card rounded-lg border border-border p-4`
- Título: `text-xs font-bold mb-3`
- Sem sub-cards coloridos internos — conteúdo direto e limpo

## Alterações em `Dashboard.tsx`

### 1. Mover blocos
Reordenar o JSX para:
1. Quick Stats (já existe)
2. Alertas Inteligentes (já existe)
3. Charts Grid — Gastos por Categoria + Receitas vs Despesas (já existe)
4. Evolução do Patrimônio (já existe)
5. **Progresso do Mês** (movido)
6. **Grid 2 colunas: Últimas Transações + Gasto por Método** (movido)
7. **Custos Fixos vs Variáveis** (movido)

### 2. Reformular títulos — trocar Lucide por emojis
- `<Clock> PROGRESSO DO MÊS` → `⏳ PROGRESSO DO MÊS`
- `<Receipt> ÚLTIMAS TRANSAÇÕES` → `🧾 ÚLTIMAS TRANSAÇÕES`
- `<CreditCard> GASTO POR MÉTODO` → `💳 GASTO POR MÉTODO`
- `<DollarSign> CUSTOS FIXOS VS VARIÁVEIS` → `⚖️ FIXOS VS VARIÁVEIS`

### 3. Reformular Fixos vs Variáveis
Remover os sub-cards coloridos (`bg-orange-500/10 border border-orange-500/20`) e usar layout limpo como os outros cards de gráficos — valores diretos sem bordas coloridas internas.

