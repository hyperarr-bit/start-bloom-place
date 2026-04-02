

# Implementação das 4 Funcionalidades de Finanças

Vou implementar todas na ordem: Controle de Cartões → Tags Personalizadas → Alertas Inteligentes → Scan de Comprovantes.

---

## 1. 💳 Controle de Cartões

**Novo arquivo**: `src/components/finance/CreditCards.tsx`

Nova aba "💳 CARTÕES" no módulo de finanças. O usuário cadastra cartões com:
- Nome, bandeira (Visa, Mastercard, Elo, etc.), limite total, data de fechamento, melhor dia de compra
- Fatura atual calculada automaticamente somando despesas do mês com `paymentMethod === "credito"` e `cardName` correspondente
- Barra de progresso de uso do limite (verde < 50%, amarelo < 80%, vermelho ≥ 80%)
- Cards visuais no padrão `bg-card rounded-lg border border-border p-4`

**Persistência**: chave `finance-credit-cards` via `usePersistedState`

**Edição em Index.tsx**: adicionar aba e renderizar componente

---

## 2. 🏷️ Tags Personalizadas

**Alterações em**: `ExpenseTable.tsx`, `FixedExpensesTable.tsx`

- Adicionar campo `tags: string[]` na interface Expense
- Input de tags no formulário (chips com X para remover, input livre)
- Tags renderizadas como badges coloridos na tabela ao lado da categoria
- Filtro por tag no topo da tabela (dropdown multi-select)
- Tags salvas em localStorage como parte dos dados existentes (retrocompatível — despesas sem tags continuam funcionando)

---

## 3. 🔔 Alertas Inteligentes

**Novo arquivo**: `src/components/finance/SmartAlerts.tsx`

Componente de alertas que aparece no topo da aba "financeiro" (abaixo do summary):
- **Contas a vencer**: verifica `dueDays` e alerta 3 dias antes do vencimento
- **Limite ultrapassado**: verifica `CategoryBudgets` e alerta quando > 80%
- **Meta atingida**: celebra quando meta de economia é alcançada

Visual: cards compactos com ícones (Bell, AlertTriangle, CheckCircle), cores semânticas (warning, destructive, success), dismiss individual.

**Persistência**: `finance-dismissed-alerts` para alertas descartados

---

## 4. 📸 Scan de Comprovantes

**Novo bucket Supabase**: `receipts` (público para leitura)

**Migration SQL**: criar bucket + RLS policies para upload autenticado

**Alterações em**: `ExpenseTable.tsx`
- Botão câmera/upload ao lado de cada despesa
- Upload para Supabase Storage (`receipts/{user_id}/{expense_id}.jpg`)
- Thumbnail clicável na tabela que abre modal com imagem completa
- Campo `receiptUrl?: string` adicionado à interface Expense

**Novo componente**: `src/components/finance/ReceiptViewer.tsx` — modal de visualização

---

## Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| `src/components/finance/CreditCards.tsx` | Criar |
| `src/components/finance/SmartAlerts.tsx` | Criar |
| `src/components/finance/ReceiptViewer.tsx` | Criar |
| `src/components/ExpenseTable.tsx` | Editar (tags + receipts) |
| `src/pages/Index.tsx` | Editar (nova aba + alertas + wiring) |
| Migration SQL | Criar bucket `receipts` |

Todos seguem a identidade visual mapeada: tokens de cor, `bg-card`, `rounded-lg`, `border-border`, `text-xs`, Lucide icons, inputs `h-7`.

