

# Plano: Aplicar design de planilha viva nos modulos restantes

## Modulos afetados

4 modulos com 14 componentes que ainda usam o padrao antigo (empty state + botao toggle para form escondido). Precisam virar cards coloridos permanentes com input inline sempre visivel.

## Padrao alvo (referencia: CleaningRoutine, RoomManager, SafetyChecks)
- Card com **header colorido** (bg-X-200 dark:bg-X-900/60)
- **Body com cor suave** correspondente
- Quando vazio: texto italic "Nenhum item ainda" dentro do body
- **Input inline sempre visivel** no final do card (border-dashed)
- Remover showForm toggle e AnimatePresence do form

---

### 1. Relacionamentos (5 componentes)

| Componente | Card permanente | Cor |
|---|---|---|
| **PeoplePanel** | Card "PESSOAS" com tabela Nome/Relacao/Aniversario/Notas + input inline 4 campos | rose-200 |
| **DateCalendar** | Card "DATAS ESPECIAIS" com lista + input inline Titulo/Pessoa/Data | purple-200 |
| **MomentsTimeline** | Card "MOMENTOS" com timeline + input inline Data/Pessoa/Descricao | pink-200 |
| **GiftIdeas** | Card "PRESENTES" com tabela Pessoa/Ideia/Link/Status + input inline | amber-200 |
| **EventLog** | Card "EVENTOS" com lista + input inline Nome/Data/Local | indigo-200 |

### 2. Pet (4 componentes)

| Componente | Card permanente | Cor |
|---|---|---|
| **PetList** | Card "MEUS PETS" com tabela Nome/Especie/Raca/Peso/Nascimento + input inline | amber-200 |
| **PetHealth** | Card "SAUDE" com tabela Pet/Tipo/Nome/Data/Proxima + input inline | green-200 |
| **PetExpenses** | Card "GASTOS" com header total do mes + tabela Pet/Categoria/Valor/Data + input inline | blue-200 |
| **PetDiary** | Card "DIARIO" sempre visivel com tabela + input inline | violet-200 |

### 3. Hiperfoco/Mente (2 componentes)

| Componente | Card permanente | Cor |
|---|---|---|
| **StrategyPanel** | Card "ESTRATEGIAS" com cards por status (Planejando/Executando/Concluido) + input inline | blue-200 |
| **DreamJournal** | Card "DIARIO DE SONHOS" com tabela Data/Descricao/Tags + input inline | indigo-200 |

### 4. Detox (2 componentes)

| Componente | Card permanente | Cor |
|---|---|---|
| **DetoxTracker** | Card "HABITOS" com lista + input inline Nome/Icone | lime-200 |
| **DetoxDiary** | Card "REGISTRO DO DIA" com tabela Data/Gatilho/Dificuldade/Nota + input inline | amber-200 |

## Padrao de mudanca em cada componente

1. Remover `showForm` state e o toggle `setShowForm(!showForm)`
2. Remover `AnimatePresence` wrapper do form
3. Envolver todo o conteudo em card com header colorido + body
4. Mover inputs do form para **dentro do body** como linha inline permanente
5. Manter toda a logica existente (add, remove, etc.)
6. Empty state: `<p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum X ainda</p>`

## Arquivos alterados (13)

| Arquivo | Mudanca |
|---|---|
| `src/components/relacionamentos/PeoplePanel.tsx` | Card permanente + input inline |
| `src/components/relacionamentos/DateCalendar.tsx` | Card permanente + input inline |
| `src/components/relacionamentos/MomentsTimeline.tsx` | Card permanente + input inline |
| `src/components/relacionamentos/GiftIdeas.tsx` | Card permanente + input inline |
| `src/components/relacionamentos/EventLog.tsx` | Card permanente + input inline |
| `src/components/pet/PetList.tsx` | Card permanente + input inline |
| `src/components/pet/PetHealth.tsx` | Card permanente + input inline |
| `src/components/pet/PetExpenses.tsx` | Card permanente + input inline |
| `src/components/pet/PetDiary.tsx` | Card permanente + input inline |
| `src/components/hiperfoco/StrategyPanel.tsx` | Card permanente + input inline |
| `src/components/hiperfoco/DreamJournal.tsx` | Card permanente + input inline |
| `src/components/detox/DetoxTracker.tsx` | Card permanente + input inline |
| `src/components/detox/DetoxDiary.tsx` | Card permanente + input inline |

