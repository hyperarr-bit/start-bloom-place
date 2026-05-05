# Auditoria: bugs causados por dados antigos/seed

Investiguei o `user_data` da sua conta e o código de cada módulo. Encontrei **6 problemas reais** (alguns silenciosos, outros causando tela branca). O da sua conta foi parcialmente coberto pelo último migration, mas ele só normalizou alguns shapes — o código continua frágil para qualquer usuário com dado legado.

## Bugs encontrados

### 1. `dp-gratitude` — shape misto (Gratidão na aba Desenvolvimento)
No banco a chave hoje tem 3 formatos misturados:
```
"0":           { id, date, items: [...] }      ← objeto antigo
"1":           { id, date, items: [...] }      ← objeto antigo
"2026-05-02":  ["Sou grato ", "Sou grato...", ""]  ← formato novo
```
O componente espera `Record<dateStr, string[]>` e ordena/renderiza pelas chaves. Resultado: aparece "0" e "1" como datas inválidas no histórico (e quase quebra ao tentar `new Date("0"+"T12:00:00")`).

### 2. `core-mood-log` — shape inconsistente entre módulos
- **QuickActions** grava `{ value, emoji, time }`
- **Rotina** lê `moodLog[key]?.mood` (campo `mood` que não existe)
- **DesenvolvimentoPessoal** lê `moodLog[today]` esperando **número puro** (`4`, `5`)
- Banco hoje tem mistura: `"2026-04-29": 4` e `"2026-05-02": { time, emoji, value }`

Isso faz a UI mostrar "humor não registrado" mesmo quando há registro, e em alguns cards de comparação histórica pode quebrar a renderização.

### 3. `saude-meals` — chaves duplicadas em maiúsculo/minúsculo
A chave foi populada duas vezes: `"Sexta"` E `"SEXTA"`, `"Quarta"` E `"QUARTA"` etc. Resultado: arquivo de ~5,6 KB (bloated), e a UI pode mostrar refeições duplicadas / inconsistentes dependendo de qual chave o componente itera.

### 4. `dieta-diary-v2` — começa como `{}` mas componente espera `Record<dateStr, { meals, macros }>`
Migration anterior zerou para `{}`. Sem normalização defensiva, qualquer leitura `diary[today].meals.map(...)` quebra silenciosamente. Hoje funciona porque está vazio, mas se você adicionar uma refeição com formato antigo (ou se o seed for re-aplicado), vai voltar a quebrar.

### 5. `hiperfoco-strategies` — item órfão sem campos esperados
Já tem item `{ id, status:'planejando', title:'Ffhg', description:'', actions:[] }` salvo no banco. O `StrategyPanel` foi defendido na última iteração, mas falta o mesmo tratamento em `IdeasPanel`, `TimelinePanel`, `GoalsPanel` e `GoalsBoardV2` (mesmo padrão de dados).

### 6. Sem normalização global na leitura
Hoje cada componente normaliza por conta própria (e nem todos fazem). Toda vez que mexemos em seed ou um usuário entra com dado de outra versão, a chance de tela branca volta. Falta uma camada de saneamento por chave.

---

## Plano de correção

### A. Camada de normalização (`src/lib/data-normalizers.ts` — novo arquivo)
Cria um mapa `key → normalize(value, fallback)` aplicado dentro do `usePersistedState` (e no `get` do `useUserData` opcionalmente). Cobre:

| Chave                          | Regra                                                                 |
|--------------------------------|------------------------------------------------------------------------|
| `dp-gratitude`                 | só mantém entradas cuja chave bate `/^\d{4}-\d{2}-\d{2}$/`; converte `{items:[...]}` → array; descarta o resto |
| `core-mood-log`                | normaliza valor para `{ value:number, emoji?:string, time?:string }`; se for número puro vira `{value:n}` |
| `saude-meals`                  | merge case-insensitive das chaves de dia da semana (mantém versão Title Case canônica) |
| `dieta-diary-v2`               | garante `Record<dateStr,{meals:[],macros:{}}>`; descarta entradas malformadas |
| `hiperfoco-strategies`         | mesmo saneamento já feito no StrategyPanel, agora central |
| `goals-board-v2`               | garante `actionGroups`, `problems`, `referenceImages`, `referenceLinks` como arrays |
| `finance-monthly-budgets`      | garante shape `{month, value:number, hasNote:boolean}` |
| `rotina-habits-checked` / `core-rotina-habit-log` | descarta IDs que não existem mais em `rotina-habits` |

### B. Adapter no `usePersistedState`
```ts
const stored = get(key, fallback);
const normalized = normalizers[key]?.(stored, fallback) ?? stored;
```
Custo zero para chaves sem normalizador. Aplica saneamento **uma vez** na hidratação.

### C. Migration de limpeza para a sua conta (`uid 2c896992…`)
- `dp-gratitude`: remove chaves `"0"`/`"1"`/qualquer chave não-data; preserva `"2026-05-02"`.
- `core-mood-log`: converte cada valor para `{value, emoji?, time?}`.
- `saude-meals`: deleta chaves UPPER quando existe a Title Case correspondente.
- Mantém o resto intacto.

### D. Pequenos ajustes nos componentes
- `Rotina.tsx`: trocar `moodLog[key]?.mood` → `moodLog[key]?.value` (campo correto).
- `IdeasPanel`, `TimelinePanel`, `GoalsPanel`: aplicar mesma sanitização defensiva já feita em StrategyPanel.

### E. Console warning em dev
Quando o normalizer descartar dado, loga `console.warn("[data-normalizer] dropped malformed entries from <key>", count)` — assim conseguimos rastrear regressões futuras sem o usuário ver nada.

---

## Arquivos afetados
- Novo: `src/lib/data-normalizers.ts`
- Editado: `src/hooks/use-persisted-state.ts` (1 linha de hook)
- Editado: `src/pages/Rotina.tsx` (`?.mood` → `?.value`)
- Editado: `src/components/hiperfoco/IdeasPanel.tsx`, `TimelinePanel.tsx`, `GoalsPanel.tsx` (sanitização)
- Nova migration SQL (cleanup da sua conta)

## Fora de escopo (proponho não tocar agora)
- Reescrever a UI de Gratidão/Humor (só consertar shape).
- Migrar imagens base64 já existentes (regra de Storage já está ativa para uploads novos).

Posso aplicar?
