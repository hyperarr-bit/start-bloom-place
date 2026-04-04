

# Plano: Renomear Hiperfoco → Mente + 3 Novos Módulos (Relacionamentos, Pet, Detox)

## Resumo
Renomear o módulo "Hiperfoco" para "Mente", criar 3 novos módulos para fechar o grid 4×4 (16 módulos) na Home.

---

## 1. Renomear Hiperfoco → Mente

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Hiperfoco.tsx` | Trocar título "HIPERFOCO" → "MENTE", ícone `Brain` permanece |
| `src/components/home/ModuleDrawer.tsx` | `label: "Mente"` no módulo hiperfoco |
| `src/App.tsx` | Rota `/hiperfoco` permanece (não quebra links) |

---

## 2. Módulo Relacionamentos (`/relacionamentos`)

**Ícone**: `Users` · **Cor**: `bg-rose-400/20 text-rose-600`

**Abas**:
- **Pessoas** — Cadastro de pessoas importantes (nome, relação, aniversário, notas). Card com countdown pro próximo aniversário.
- **Momentos** — Registro de encontros/momentos especiais (data, com quem, descrição). Timeline visual.
- **Presentes** — Lista de ideias de presentes por pessoa, com status (ideia/comprado/entregue).

**Dados**: `useUserData` com chaves `rel-people`, `rel-moments`, `rel-gifts`.

---

## 3. Módulo Pet (`/pet`)

**Ícone**: `PawPrint` (Lucide) · **Cor**: `bg-amber-400/20 text-amber-500`

**Abas**:
- **Meus Pets** — Cadastro (nome, espécie, raça, peso, nascimento, foto placeholder). Card por pet.
- **Saúde** — Vacinas (nome, data, próxima dose), vermífugo, consultas. Alerta de vacina próxima.
- **Rotina** — Checklist diário (comida, água, passeio, banho) com toggle por dia.
- **Gastos** — Registro de gastos com pet (ração, vet, brinquedos) com total mensal.

**Dados**: `useUserData` com chaves `pet-list`, `pet-health`, `pet-routine`, `pet-expenses`.

---

## 4. Módulo Detox — Dias Puros (`/detox`)

**Ícone**: `Leaf` ou `ShieldCheck` · **Cor**: `bg-lime-400/20 text-lime-600`

**Conceito**: Rastrear "dias limpos" de hábitos que o usuário quer parar ou controlar (redes sociais, álcool, cigarro, junk food, etc). Foco em streaks e recaídas.

**Abas**:
- **Rastreador** — Lista de hábitos a evitar (configurável). Cada um mostra streak atual (dias sem), recorde, e botão "Recaí" que reseta o contador. Grid visual tipo GitHub contributions mostrando dias puros vs recaídas no mês.
- **Diário** — Registro de como se sentiu no dia (gatilhos, dificuldade 1-5, nota livre). Ajuda a identificar padrões.
- **Conquistas** — Marcos automáticos: 1 dia, 3 dias, 7 dias, 14 dias, 30 dias, 60, 90, 180, 365. Badge desbloqueado a cada marco com frase motivacional.
- **Estatísticas** — Taxa de sucesso (%), maior streak, total de dias puros, gráfico mensal de evolução.

**Dados**: `useUserData` com chaves `detox-habits`, `detox-log`, `detox-diary`.

---

## 5. Registro nos sistemas globais

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar 3 rotas protegidas: `/relacionamentos`, `/pet`, `/detox` |
| `src/components/home/ModuleDrawer.tsx` | Adicionar 3 módulos ao array `modules` (total: 16) |
| `src/components/gamification/AchievementsPage.tsx` | Adicionar badges para os novos módulos (ex: "7 dias puro", "Pet vacinado", "10 momentos registrados") |

---

## Arquivos a criar

| Arquivo | Conteúdo |
|---------|----------|
| `src/pages/Relacionamentos.tsx` | Página com 3 abas |
| `src/components/relacionamentos/PeoplePanel.tsx` | CRUD de pessoas + countdown aniversário |
| `src/components/relacionamentos/MomentsTimeline.tsx` | Timeline de momentos |
| `src/components/relacionamentos/GiftIdeas.tsx` | Lista de presentes por pessoa |
| `src/pages/Pet.tsx` | Página com 4 abas |
| `src/components/pet/PetList.tsx` | Cadastro de pets |
| `src/components/pet/PetHealth.tsx` | Vacinas e consultas |
| `src/components/pet/PetRoutine.tsx` | Checklist diário |
| `src/components/pet/PetExpenses.tsx` | Gastos com pet |
| `src/pages/Detox.tsx` | Página com 4 abas |
| `src/components/detox/DetoxTracker.tsx` | Streaks + grid de dias puros |
| `src/components/detox/DetoxDiary.tsx` | Diário de gatilhos |
| `src/components/detox/DetoxAchievements.tsx` | Marcos e badges |
| `src/components/detox/DetoxStats.tsx` | Estatísticas e gráficos |

---

## Padrão visual
Todos seguem o padrão existente: header sticky com seta voltar + ícone + título, `Tabs` com `TabsList` horizontal scrollável, cards com `bg-card border border-border rounded-xl`, dados via `useUserData`.

