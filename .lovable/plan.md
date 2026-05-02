## Objetivo

Substituir TODOS os dados da conta `jv20101958@gmail.com` (user_id `2c896992-6849-4ca6-9a66-5c2414bb9424`) por um dataset rico, coerente e visualmente impactante para gravar criativos. Perfil escolhido: **homem 32 anos, dev, foco em produtividade**, com **90 dias** de histórico em todos os módulos.

## Estratégia técnica

A tabela `user_data` tem RLS que só permite o próprio usuário escrever. Como não temos acesso direto ao psql nesta sessão e o usuário não é o que está logado para mim, vou criar uma **edge function temporária** com service role key que:

1. Aceita `{ user_id, mode: "replace", entries: [{key, value}, ...] }`
2. Verifica que o user_id pertence a `jv20101958@gmail.com` (allow-list hardcoded) — sem isso é 403
3. Apaga todos os `user_data` daquele user
4. Faz upsert de todas as novas chaves em chunks de 50

Depois chamo essa função via `curl_edge_functions` com o payload completo.

A função fica no projeto após o seed (não precisa apagar — está protegida por allow-list de email), mas posso remover se preferir.

## Dataset que vou popular

Cobertura completa de **todos os módulos do app** com 90 dias de histórico. Persona: "Lucas, 32, dev backend sênior, mora em SP, casado, 1 cachorro, treina 4x/sem, lê 1 livro/mês, economiza 30% do salário".

### Home + Gamificação
- `core-user-name`: "Lucas"
- `core-home-widgets-v2`: lista com 8 widgets ativos (finances, habits, health, workout, calories, week-progress, quick-notes, countdown)
- `core-home-quick-notes`: 3 notas rápidas
- `core-home-countdowns`: 2 contagens (viagem Lisboa, aniversário esposa)
- `core-hub-streak`: 47 dias
- `conquistas_points`: 1840
- `conquistas_unlocked`: ~25 conquistas
- `core-onboarding-done`, `core-welcome-done`: true

### Finanças (módulo mais visual)
- `financas_categories`: 12 categorias coerentes
- `financas_transactions`: ~120 transações dos últimos 90 dias com descrições realistas (Mercado Livre, Uber, iFood, Netflix, Salário, Freela, etc.) — valores que somam um saldo positivo crescente
- `finance-credit-cards`: 3 cartões (Nubank, Inter, C6) com limites e closing days
- `finance-fixed-expenses`: 8 fixas (aluguel R$2.400, condomínio, internet, streamings, academia, plano de saúde, etc.)
- `finance-incomes`: salário CLT R$ 12.500 + freela mensal
- `finance-investments`: 5 ativos (CDB, Tesouro IPCA, ITSA4, BOVA11, Bitcoin) com valores crescentes
- `finance-goals`: 4 metas (Reserva R$ 36k de 50k, Viagem Europa R$ 8k de 15k, Carro R$ 22k de 60k, MBA R$ 5k de 30k)
- `finance-wishlist`: 5 itens (PS5 Pro, MacBook M4, monitor Dell, etc.)
- `finance-installments`: 2 parcelamentos ativos
- `finance-category-budgets`: orçamentos por categoria
- `finance-trips`, `finance-notes`, `finance-streak`: 23 dias
- `finance-month-{mes}-*`: dados dos 3 meses do trimestre (fevereiro, março, abril) com receitas/despesas/fixas

### Rotina + Hábitos
- `rotina_tasks`: 8 tarefas
- `rotina-habits`: 6 hábitos (Beber 2L água, Ler 30min, Meditar, Exercício, Inglês 15min, Dormir 23h)
- `rotina-habits-checked`: histórico denso de 90 dias com ~85% de completion
- `rotina-schedule`: agenda semanal preenchida
- `habits`: idem em formato alternativo
- `heatmap-log`: 90 dias de heatmap
- `weekly-reviews`: 12 reviews semanais

### Saúde (Saude.tsx)
- `saude_weight`: 90 pontos (de 78kg → 73kg em curva descendente realista)
- `saude_pressao`: 12 medidas mensais
- `saude_mood`: 90 dias com distribuição realista
- `core-saude-water`: 90 dias com média 7-8 copos
- `core-saude-sleep`: 90 dias com média 7h
- `core-saude-measures`: 6 medidas corporais (peito, cintura, etc.)
- `core-saude-sentiment`: 30 anotações de humor
- `saude-bmi-height`: 178, `saude-bmi-weight`: 73
- `saude-workouts-v2`, `saude-workout-log`, `saude-workout-notes`: histórico
- `hidratacao`: histórico

### Treino
- `treino_split`: split ABCDE (Push/Pull/Legs/Push/Pull)
- `treino_sessions`: ~50 sessões dos últimos 90 dias (4x/semana)
- `treino-exercise-history`: histórico de cargas (supino, agachamento, deadlift) com progressão crescente
- `treino-active-days`: 50 dias
- `treino-weekly-volume`: volume por semana

### Dieta
- `dieta_macros`: 2400/180/240/80 (cal/prot/carb/fat)
- `dieta_meals`: 90 dias × 5 refeições (café/lanche/almoço/lanche2/janta) com nomes reais
- `dieta-diary-v2`, `dieta-diary-followed`: aderência
- `dieta-meals-config`, `dieta-smart-list`, `dieta-cal-log`: completos

### Estudos
- `estudos_courses`: 4 cursos (React Avançado 75%, Inglês Fluente 60%, AWS Solutions Architect 40%, System Design 25%)
- `estudos_pomodoros`: ~80 pomodoros de 25min
- `estudos-schedule`: agenda semanal preenchida
- `estudos-notebooks`: 5 cadernos de matérias

### Hiperfoco
- `hiperfoco_sessions`: 30 sessões de foco profundo
- `hiperfoco-thoughts`: 15 pensamentos capturados
- `goals-board-v2`, `goals-home`: 6 metas com sub-tarefas

### Casa
- `casa_tasks`: 10 tarefas (limpar, organizar, manutenção)
- `casa-meal-plan`: cardápio semanal
- `casa-recipes`: 8 receitas (lasanha, frango grelhado, salada caesar, etc.)
- `casa-cleaning-reminders`: 5 lembretes

### Biblioteca
- `biblioteca_books` / `lib-books`: 12 livros (4 lidos: Hábitos Atômicos, Deep Work, O Poder do Hábito, Pense em Sistemas; 2 lendo; 6 wishlist)

### Beleza/Skincare
- `beleza_skincare`: rotina manhã/noite com 6 steps
- `skincare-daily-checkin`: 60 dias

### Carreira
- `carreira_metas`: 4 metas (Promoção Senior, Networking, Open Source, Speaker em meetup)

### Relacionamentos
- `rel-people`: 8 pessoas próximas (esposa, mãe, pai, irmão, 4 amigos)
- `relacionamentos_contacts`: histórico de contatos

### Pet
- `pet-list`: 1 pet (Thor, Golden Retriever, 3 anos)
- `pet_data`, `pet-routine-*`: rotina de alimentação/passeio

### Viagens
- `viagens_planejadas`: 3 viagens (Lisboa Jul, Floripa Set, Buenos Aires Dez)
- `travel-budget-v2`: orçamento Lisboa detalhado
- `travel-timeline-v2`: roteiro Lisboa 7 dias

### Desenvolvimento Pessoal
- `dp-life-goals`: 6 metas de vida
- `dp-wheel`: roda da vida com notas equilibradas (média 7.5)
- `dp-weekly-scores`: 12 semanas de scores
- `dp-mood-log`, `mood-log`, `energy-log`: completos

### Detox
- `detox_log`: 60 dias
- `detox-habits`: 4 hábitos (sem rede social manhã, sem celular antes dormir, etc.)
- `detox-diary`: 20 entradas

## Arquivos a criar

1. **`supabase/functions/seed-demo-user/index.ts`** — edge function com service role, allow-list por email, modo replace, upsert em chunks
2. **`supabase/config.toml`** — adicionar `[functions.seed-demo-user] verify_jwt = false` para chamar via curl sem token
3. **`scripts/seed-demo-payload.ts`** — gerador do payload completo (~3.000 linhas de dados sintéticos coerentes); roda local com `bun` e cospe um JSON

## Execução

1. Crio a edge function + atualizo config.toml + crio o gerador
2. Deploy automático
3. Rodo o gerador → `/tmp/payload.json`
4. Chamo a function via `curl_edge_functions` com `mode: "replace"` e o payload
5. Confirmo via `read_query` contando rows e mostrando algumas amostras
6. Se quiser, removo a edge function depois (recomendo manter — útil pra repor o seed quando você for gravar mais criativos)

## Confirmação

Posso aplicar?