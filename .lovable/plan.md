## Plano

Manter apenas o módulo **Finanças** na página de Conquistas e expandir bastante o catálogo de badges financeiros.

### Mudanças em `src/components/gamification/AchievementsPage.tsx`
- Remover toda lógica/leitura de saúde, hábitos, leitura, relacionamentos, pet, detox e general.
- Remover seção "Progresso por Categoria" (sobra só uma) e cartão de streak (não é mais relevante sem hábitos) — manter só os cartões de Conquistas e XP.
- `buildBadges` passa a ler somente chaves `finance-*` e devolver badges com `category: "finance"`.
- Badge "Mestre" (Diamante) permanece como meta global de XP.

### Mudanças em `src/components/gamification/BadgesGrid.tsx`
- Já filtra por categoria, então funcionará automaticamente exibindo só a seção de Finanças.

### Novos badges de Finanças (≈20 no total)
Receitas/Despesas
- Primeiro Salário (1ª receita) — já existe
- Múltiplas Rendas (3+ receitas distintas)
- Primeira Despesa registrada
- Organizador (10+ despesas categorizadas)
- Mestre do Orçamento (50+ lançamentos no mês)

Poupança
- Poupador (≥20%) — já existe
- Super Poupador (≥40%)
- Formiguinha (≥60%)

Investimentos
- Investidor R$ 1.000 — já existe
- Investidor Pro R$ 10.000 — já existe
- Patrimônio R$ 50.000
- Patrimônio R$ 100.000
- Diversificado (3+ ativos diferentes)

Contas/Dívidas
- Contas em Dia — já existe
- Pontual (12 meses seguidos sem atraso) — baseado em histórico de `finance-dueDays`
- Livre de Dívidas — já existe
- Quitador (parcelamento totalmente quitado registrado)

Metas/Planejamento
- Sonhador (1ª meta criada em `finance-goals`)
- Realizador (1ª meta concluída)
- Reserva de Emergência (saldo guardado ≥ 3× despesas mensais)

Wishlist/Educação
- Lista de Desejos (1+ item em `finance-wishlist`)
- Comprador Consciente (item marcado como adquirido)

Mestre
- Mestre Financeiro — desbloqueia ao atingir Diamante (2000 XP)

### Detalhes técnicos
- XP padrão 50; badges "Pro" e marcos altos valem 100; topo (patrimônio 100k, Mestre) valem 200.
- Para "Pontual" e "Reserva de Emergência" usaremos heurísticas a partir dos dados já persistidos (sem novas chaves nem migrações).
- Nenhuma alteração de banco, rotas ou outros módulos.
