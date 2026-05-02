# Por que esses crashes acontecem

A causa é **sempre a mesma** e tem origem no seed inicial de demonstração que coloquei na sua conta:

1. **Os dados de demo foram salvos no Supabase com formatos diferentes do que os componentes esperam**. Exemplo concreto que descobri agora:
   - O `dieta-diary-v2` foi seedado como `{ "2026-05-02": { c:173, f:50, kcal:1700, p:118 } }` (dados de macros)
   - Mas o componente `Dieta.tsx` espera `{ "2026-05-02": { meals: {...}, extraFood: { had, description } } }` (diário de refeições)
   - Quando o React renderiza e tenta ler `diary.extraFood.had` → tela branca.

2. **Os componentes confiam cegamente no formato dos dados**. Eles fazem `obj.x.y.z` sem verificar se `x` ou `y` existem. Um único campo faltando derruba a aba inteira.

Já corrigi pontualmente Metas, Wishlist e Dieta nas últimas mensagens, mas isso é remendo. Existem ainda **mais bombas armadas** entre as 119 chaves seedadas, e novos crashes vão aparecer conforme você navegar.

# O que vou fazer

Atacar a raiz nos **dois lados** ao mesmo tempo:

## Parte 1 — Limpar os dados seedados quebrados (Supabase)

Auditei todas as 119 chaves do seu usuário e identifiquei as que ainda têm formato incompatível ou incompleto. Para cada uma, vou:

- **Reescrever** com o shape correto que o componente espera, OU
- **Deletar** quando o seed é mais confuso do que útil (o app cai no estado vazio padrão, sem crash).

Chaves identificadas como problema:
- `dieta-diary-v2` — formato de macros em vez de diário → reescrever no shape `{ meals, extraFood }`
- `casa-meal-plan` — só tem almoço/janta, falta café/lanche → completar
- `dieta-meals-config` — array de strings, componente espera array de objetos `{id, name, time}` → converter
- `rotina-schedule` — chaves de hora como `"0:00"` em vez de `"00:00"` → normalizar
- `core-rotina-habit-log` — usa IDs `h1/h2/h3` que não batem com `rotina-habits` (que é array de strings sem ID) → recalcular
- `pet-list` — `weight` é string `"32kg"`, componente espera number → corrigir
- `treino-weekly-volume`, `saude-meals`, `travel-budget-v2`, `travel-packing-v2` — verificar e ajustar conforme cada componente
- Demais chaves com `t:object` ou `t:array` que ainda não validei serão checadas uma por uma.

## Parte 2 — Blindar os componentes (código)

Mesmo com dados corretos, o app **não pode mais crashar** se vier qualquer coisa estranha (dado antigo de outro usuário, import de backup, bug futuro). Vou:

1. **Padronizar o acesso seguro** em todas as páginas que leem `user_data`:
   - Trocar `obj.x.y` por `obj?.x?.y ?? default`
   - Para arrays: `Array.isArray(x) ? x : []`
   - Para números: `Number(x) || 0`

2. **Criar um `safeParse` por módulo** (helper local em cada página grande) que normaliza o dado lido do Supabase antes de qualquer render. Foi o padrão que apliquei em Dieta e Wishlist agora — vou estender para:
   - `Rotina.tsx`, `Saude.tsx`, `Treino.tsx`, `Dieta.tsx`, `Casa.tsx` (e seus subcomponentes)
   - `Pet.tsx`, `Viagens.tsx`, `Relacionamentos.tsx`
   - `DesenvolvimentoPessoal.tsx`, `Hiperfoco.tsx`, `Carreira.tsx`, `Estudos.tsx`, `Beleza.tsx`, `Biblioteca.tsx`, `Detox.tsx`
   - Widgets da Home (`HabitsWidget`, `WorkoutWidget`, `FinancesWidget`, `HealthWidget`, etc.)

3. **Envolver cada página em ErrorBoundary** (já existe um em `App.tsx`, mas vou adicionar um por rota) para que, se algo ainda escapar, só aquela aba mostre uma mensagem amigável em vez de tela branca no app inteiro.

## Parte 3 — Verificar funções que podem ter sido afetadas

Você mencionou widgets e adicionar informações. Vou testar manualmente o fluxo de:

- **Adicionar/editar/deletar** em cada módulo (Rotina, Saúde, Dieta, Treino, Finanças, Casa, Pet, Viagens, Relacionamentos, DP, Hiperfoco, Carreira, Estudos, Beleza, Biblioteca, Detox)
- **Widgets da Home**: arrastar, adicionar via picker, todos renderizando sem dados e com dados
- **Onboarding/Welcome** rodando do zero
- **Importação de URL** (Wishlist, Biblioteca)

Se encontrar algum botão/função quebrado pelas mudanças anteriores, conserto na mesma migração.

# Detalhes técnicos

```text
┌─ Causa ─────────────────────────────────────────────┐
│ seed inicial → user_data (Supabase)                 │
│   shape A (incompleto)                              │
│      ↓                                              │
│ componente lê → espera shape B                      │
│   acessa obj.x.y.z sem optional chaining            │
│      ↓                                              │
│ TypeError → React unmount → tela branca             │
└─────────────────────────────────────────────────────┘

┌─ Solução em 3 camadas ──────────────────────────────┐
│ 1. Migração SQL: corrigir/deletar shapes errados    │
│ 2. safeParse por módulo: normaliza no useMemo       │
│ 3. ErrorBoundary por rota: contém falhas futuras    │
└─────────────────────────────────────────────────────┘
```

A migração de dados usa o tool de **Modify database** (você precisa aprovar). Os ajustes de código eu faço direto. Não há mudança de estrutura de tabela — apenas conteúdo de `user_data` e código React.

# Ordem de execução

1. Migração de dados (uma única, cobrindo todas as ~12 chaves problemáticas)
2. Helpers `safeParse` + ErrorBoundary nas páginas
3. Smoke test mental de cada módulo
4. Te aviso para dar Ctrl+Shift+R e testar

Posso aplicar?
