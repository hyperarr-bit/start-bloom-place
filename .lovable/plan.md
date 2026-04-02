

# Unificar Identidade Visual em Todas as Abas do Módulo de Finanças

## Análise das Inconsistências Encontradas

Analisei cada aba e identifiquei dois padrões visuais coexistindo:

**Padrão A — Dashboard/Gráficos** (correto):
- Card: `bg-card rounded-lg border border-border p-4`
- Título: `emoji + TEXTO UPPERCASE text-xs font-bold mb-3`
- Cores semânticas, `tabular-nums`, sem ícones Lucide nos títulos

**Padrão B — xTiles/Viagem** (correto para viagem):
- Card: `rounded-xl border border-border overflow-hidden`
- Header colorido: `bg-violet-300 dark:bg-violet-700 px-3 py-2`
- Emoji no header, botão "+" integrado

**Inconsistências por aba:**

| Aba | Problema |
|-----|----------|
| **Investimentos** | Usa Lucide icons nos títulos (`Wallet`, `PiggyBank`) em vez de emojis. `table-header-dark` no cabeçalho da tabela |
| **Desejos** | Usa `Heart` Lucide no header. Import URL com `border-pink-300` hardcoded. `rounded-xl` diferente do padrão |
| **Simuladores** | Títulos com Lucide (`TrendingUp`, `Clock`, `CreditCard`, `Target`). Sub-cards resultado com cores hardcoded (`bg-green-500/10 border border-green-500/20`) |
| **Desafios** | Stats row usa Lucide (`Flame`, `Trophy`, `Gift`). Check-in com gradiente `from-orange-500/10 to-red-500/10` destoante |
| **Limites** | Título usa Lucide `Gauge`. Sem header com emoji padrão |
| **Relatórios** | Botões com Lucide (`FileText`, `Download`). Títulos com Lucide em vez de emoji |
| **Saúde Financeira** | Score card com gradiente. Tips usam Lucide icons. Métricas com Lucide em vez de emojis |

---

## Plano — Padronizar Tudo

### Regra unificada para títulos de card
Trocar TODOS os ícones Lucide nos títulos de seção por emojis, mantendo o formato:
```
<h3 className="text-xs font-bold mb-3">📊 TÍTULO AQUI</h3>
```

### Arquivo por arquivo

#### 1. `InvestmentsTracker.tsx`
- Summary cards: trocar `Wallet`, `PiggyBank`, `TrendingUp/Down`, `Calendar` por emojis equivalentes nos labels (não nos títulos — nos summary cards manter o padrão do Dashboard que usa Lucide como ícone decorativo grande de `/30`)
- `DISTRIBUIÇÃO DA CARTEIRA` → `📊 DISTRIBUIÇÃO DA CARTEIRA`
- `MEUS INVESTIMENTOS` header: manter `table-header-dark` (já é padrão das tabelas)

#### 2. `WishlistItems.tsx`
- Header `Heart` icon → emoji `❤️` no título "Meus Desejos"
- Import URL: trocar `border-pink-300 dark:border-pink-700 bg-pink-50/50 dark:bg-pink-950/20` por tokens neutros `border-border bg-muted/30` ou `border-dashed border-muted-foreground/30`
- `rounded-xl` → `rounded-lg` para consistência

#### 3. `Simulators.tsx`
- Cada simulador: trocar Lucide por emoji nos títulos:
  - `<TrendingUp> JUROS COMPOSTOS` → `📈 JUROS COMPOSTOS`
  - `<Clock> QUANTO TEMPO PRA JUNTAR?` → `⏱ QUANTO TEMPO PRA JUNTAR?`
  - `<CreditCard> FINANCIAMENTO VS À VISTA` → `💳 FINANCIAMENTO VS À VISTA`
  - `<Target> INDEPENDÊNCIA FINANCEIRA` → `🎯 INDEPENDÊNCIA FINANCEIRA`
- Sub-cards de resultado: manter `bg-green-500/10` etc (são resultados contextuais, padrão similar aos alertas)

#### 4. `Gamification.tsx`
- Stats row: manter Lucide como ícone decorativo grande (mesmo padrão do Dashboard quick stats com `w-8 h-8`)
- Check-in card: normalizar gradiente para `bg-card border border-border` com detalhe sutil
- Seções de badges/52 semanas: adicionar emoji nos títulos de seção

#### 5. `CategoryBudgets.tsx`
- Remover `<Gauge>` do título → `🎯 LIMITES POR CATEGORIA`
- Cards de categorias: já seguem bom padrão, manter

#### 6. `Reports.tsx`
- Títulos de seção: trocar Lucide por emojis
  - `<FileText>` → `📄`
  - `<Download>` → ícone mantido nos botões (Lucide OK para ações)
  - Título do relatório: `📋 RELATÓRIO MENSAL`

#### 7. `FinancialHealth.tsx`
- Título score: manter gradiente (é elemento hero, diferenciado propositalmente)
- Métricas individuais: trocar Lucide por emojis nos labels
  - `Shield` → 🛡️, `Target` → 🎯, `CreditCard` → 💳, etc
- Tips: manter Lucide nos alertas (padrão do Dashboard alerts)

---

## Arquivos Alterados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/InvestmentsTracker.tsx` | Emojis nos títulos de seção |
| `src/components/WishlistItems.tsx` | Emoji no header, normalizar border/radius |
| `src/components/Simulators.tsx` | Emojis nos 4 títulos de simulador |
| `src/components/Gamification.tsx` | Emojis nas seções, normalizar check-in card |
| `src/components/CategoryBudgets.tsx` | Emoji no título |
| `src/components/Reports.tsx` | Emojis nos títulos de seção |
| `src/components/FinancialHealth.tsx` | Emojis nas métricas |

Nenhuma mudança de lógica ou dados. Apenas ajustes visuais de consistência.

