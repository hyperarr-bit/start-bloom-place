## Aprofundar Admin: tabela de ofertas + painel completo de churn

### O que é entregue

Tudo que o admin precisa saber sobre **por que os usuários cancelam**, **o que está funcionando** com as ofertas de retenção e **em que dia do trial o app perde gente**.

---

### 1. Tabela de breakdown em `/admin/retention` (finalizar)

Substituir a tabela única atual por **uma tabela por tipo de oferta**, cada uma com:

- Header com **taxa de sucesso de aplicação** (cor verde/âmbar/vermelho conforme % ≥80/≥50/<50)
- Subtotal: total aceitas, aplicadas, falharam
- Barra visual da distribuição por status

Exemplo visual:
```
┌─ Desconto 50% / 2 ciclos ─────────────────── 87.5% sucesso ┐
│ Status      Qtd   % do tipo   ▓▓▓▓▓▓░░░░               │
│ Aplicado    14    66%         ████████████              │
│ Aguardando   5    24%         ████                      │
│ Falhou       2    10%         ██                        │
└─────────────────────────────────────────────────────────┘
```

> Esses dados já vêm da RPC `admin_retention_offers_breakdown` que criei na turn anterior — nenhuma migration necessária.

---

### 2. Reformular `/admin/churn` num painel executivo profundo

Substituir a página atual (que só mostra inativos + cards básicos) por **6 seções de análise de churn**:

#### 2a. KPIs principais (linha de cards)
- Churn rate 30d (vem de `admin_metrics_overview`)
- Voluntary churn (cancelaram pelo app) vs Involuntary (falha de pagamento)
- Tempo médio até cancelar
- LTV impactado pelo churn (R$ perdidos/mês)

#### 2b. Curva de retenção do trial (D1→D7)
Gráfico de linha mostrando, para usuários cadastrados nos últimos 60d, **quantos % ainda voltavam ao app em cada dia do trial**. Identifica visualmente o "cliff" — onde a maioria abandona.

#### 2c. Análise de cupons/ofertas — "o que está dando certo"
Card duplo lado a lado:
- **Desconto 50%**: aceitos × ainda assinantes hoje × % retenção
- **Pausa**: idem
Com badge "vencedor" no que tem maior retenção e diagnóstico textual: *"Desconto retém 67% vs Pausa 41% — focar em desconto"*

#### 2d. Motivos × eficácia de save
Tabela mostrando para cada motivo (`too_expensive`, `not_using`, etc.):
- Total que cancelou por esse motivo
- Quantos foram salvos com desconto
- Quantos foram salvos com pausa
- **Save rate por motivo** (cor verde/vermelho)

Insight automático: "Motivo X tem save rate Y% — oferta atual [está/não está] funcionando"

#### 2e. Cohort dos últimos 6 meses
Tabela cohort mensal:
| Mês | Signups | Conversão | Cancelados | Retenção 30d |

Mostra tendência: a retenção está melhorando ou piorando mês a mês.

#### 2f. Pagantes inativos em risco (mantém o atual)
Lista de usuários que não usam o app há 7+ dias mas ainda pagam — candidatos a re-engajamento proativo.

---

### 3. Estratégia de implementação dos dados

Para evitar dependência de novas RPCs (a tool de migration está intermitente nesta sessão), faço as queries **direto do client com a service de admin** usando as tabelas que o admin já consegue ler via RLS:

- `cancel_attempts` (admin tem SELECT) → motivos, outcomes, voluntary churn
- `retention_offers_used` (admin tem SELECT) → efetividade das ofertas
- `subscriptions` (admin tem SELECT) → cancelados, involuntary, MRR perdido
- `module_analytics` (admin tem SELECT) → curva de retenção do trial
- `admin_metrics_overview` RPC já existente → KPIs gerais

As agregações ficam num hook `useChurnDeepMetrics()` em `src/hooks/use-churn-metrics.ts` — todas client-side mas leves (volumes pequenos no admin, no máx ~60d de dados).

> Caso prefira, depois posso converter num RPC único `admin_churn_deep_metrics()` quando a migration tool estiver disponível, melhorando performance e centralizando lógica. Por ora, client-side entrega o painel hoje.

---

### Arquivos

**Editados:**
- `src/pages/admin/AdminRetention.tsx` — tabela de breakdown agrupada por offer_type
- `src/pages/admin/AdminChurn.tsx` — reescrita completa com as 6 seções

**Novos:**
- `src/hooks/use-churn-metrics.ts` — hook que agrega queries das tabelas

**Sem migrations** nesta entrega. Se quiser que eu suba o RPC `admin_churn_deep_metrics()` depois (mais performático), basta pedir.