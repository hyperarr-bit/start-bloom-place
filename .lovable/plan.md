## Objetivo

Preencher a conta `jv20101958@gmail.com` (user_id `2c896992-6849-4ca6-9a66-5c2414bb9424`) com dados realistas em **todos os módulos** para gravação de criativo. **Zero alteração de código** — só inserts/updates em `public.user_data`.

## O que existe hoje (já preenchido)

Já tem dados em Finanças (mas vou enriquecer/garantir consistência) e core. Tudo o resto está vazio.

```
Existentes: core-user-name, core-home-widgets-v2, finance-incomes, finance-expenses,
finance-fixed-expenses, finance-dueDays, finance-installments, finance-investments,
finance-goals, finance-notes, finance-last-seen-month, finance-streak, ...
```

## O que vou popular (por módulo)

Para cada módulo, vou ler 1-2 componentes-chave para descobrir o **nome exato da chave** no `user_data` e o **schema esperado**, depois inserir dados realistas via `INSERT ... ON CONFLICT (user_id, key) DO UPDATE`.

### Finanças (enriquecer o que já tem)
- `finance-incomes`: salário (R$ 7.500), freelance (R$ 1.200), dividendos (R$ 180)
- `finance-fixed-expenses`: aluguel, internet, energia, água, Netflix/Spotify, academia, plano de saúde
- `finance-expenses` (variáveis): mercado, uber, restaurantes, farmácia, gasolina, lazer — usando categorias já existentes no app
- `finance-dueDays`: contas reais distribuídas nos dias 5/10/20/30 (algumas pagas, algumas pendentes) no formato `{day, color, bills:[{id,name,value,paid}]}`
- `finance-installments`: 2-3 parcelados (notebook 12x, geladeira 10x)
- `finance-investments`: Tesouro Selic, CDB, ações (ITSA4, BBAS3), FIIs (HGLG11)
- `finance-goals`: reserva de emergência, viagem, MacBook
- `finance-notes`: 3-4 lembretes financeiros
- `finance-wishlist`, `finance-monthly-budgets`, `finance-annual`, `finance-trips`

### Casa
- Cômodos (sala, cozinha, quarto, banheiro)
- Despensa (arroz, feijão, café, leite — alguns "Acabou")
- Lista de compras (puxando os "acabou")
- Cardápio da semana
- Rotina de limpeza
- Manutenção (2-3 itens)
- Plantas/pets (1 cacto, 1 samambaia)

### Saúde
- Hidratação (meta 2.5L, ~1.8L hoje)
- Diário médico (consulta dentista próxima)
- Farmácia (vitamina D, ômega 3)
- Evolução corporal (peso, altura, 3-4 medições)

### Dieta
- Refeições do dia (café, almoço, jantar, lanche) com calorias e macros realistas
- Meta diária de calorias e água

### Treino
- Plano semanal (segunda peito/tríceps, terça costas/bíceps, etc.)
- Histórico dos últimos 7 dias
- PRs (supino 80kg, agachamento 100kg)

### Rotina (hábitos)
- 5-6 hábitos: ler 30min, beber água, treinar, meditar, dormir 23h
- Streak de alguns dias preenchido

### Hiperfoco
- 3-4 metas ativas (lançar produto, aprender inglês)
- Captura de pensamentos com 5-6 entradas
- Diário de sonhos com 2 entradas

### Detox
- Hábitos a reduzir (Instagram, doces) com tracker de 7 dias
- 1-2 conquistas

### Beleza
- Rotina skincare (manhã/noite)
- Inventário de produtos (3-4 itens)
- Cronograma capilar
- Diário da pele (2-3 entradas)

### Pet
- 1 pet (cachorro "Thor", labrador, 3 anos)
- Rotina (ração, passeio)
- Saúde (vacina próxima)
- Despesas (ração mensal)

### Relacionamentos
- 4-5 pessoas (mãe, pai, irmã, melhor amigo, namorada)
- 2-3 datas importantes
- 3-4 momentos no timeline
- Ideias de presente

### Viagens
- 1 viagem planejada (Fernando de Noronha em julho)
- Bucket list (Japão, Patagônia)
- Checklist de mala
- Orçamento

### Biblioteca
- 4-5 livros (lendo: "Hábitos Atômicos", lidos: "Mindset", quero ler: "Sapiens")

### Estudos
- 2-3 cursos em andamento
- Flashcards / matérias

### Carreira
- Skills, metas profissionais, networking básico

### Desenvolvimento Pessoal
- Reflexões, valores, journaling

### Home (tela inicial)
- `core-home-widgets-v2`: ativar 6-8 widgets úteis (finanças, hábitos, água, treino, livros, agenda)
- `core-hub-streak`: streak realista (~7 dias)

## Como vou executar (técnico)

1. **Ler componentes** para descobrir chave + schema de cada módulo (ex.: `RoomManager.tsx`, `SmartPantry.tsx`, `HydrationTracker.tsx`, `PetList.tsx`, etc.) — uns 25 reads em paralelo.
2. **Backup** opcional dos dados atuais em `user_data_backup_lucas_seed` (já existe a tabela).
3. **Um único migration de INSERT** com `ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()` para todas as chaves de uma vez.
4. **Sem alterar nenhum arquivo .tsx/.ts** — só dados.

## Restrições respeitadas

- Não mexer em auth, roles, subscriptions, profile, storage.
- Não usar base64 em imagens (regra do projeto) — vou deixar campos de foto vazios.
- Categorias de despesas vão usar nomes que já existem no app (não inventar novas).
- Nome do usuário continua "João Victor".

## Resultado esperado

Ao abrir qualquer módulo no preview, vai ter dado realista visível — pronto pra gravar criativo mostrando o app "vivo".

Posso aplicar?