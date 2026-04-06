

# Plano: Cards vazios no Casa + ícones coloridos nos headers

## Problema 1: Cards no Casa vêm pré-preenchidos
Vários componentes do módulo Casa inicializam com dados default ao invés de começar vazios com instruções:
- **RoomManager**: 6 cômodos pré-cadastrados (Quarto Casal, Sala, Cozinha...)
- **GroceryList**: 9 categorias pré-cadastradas (HortiFrutti, Açougue...)
- **CleaningRoutine**: 3 seções com tarefas pré-preenchidas
- **MealPlanner**: 4 receitas default
- **MaintenanceLog**: 4 tarefas de manutenção default

## Solução 1: Inicializar vazio + empty state com instruções
Mudar o `usePersistedState` de cada componente para inicializar com `[]` e mostrar um empty state com instrução do que adicionar (ex: "Adicione seu primeiro cômodo", "Crie categorias para sua lista de mercado").

## Problema 2: Headers sem ícone ou com `≡` genérico
4 módulos usam `≡` ao invés do ícone Lucide com a cor da home:
- **Casa** → `≡` (deveria: `Home` cyan)
- **Finanças** → `≡` (deveria: `DollarSign` amber)
- **Saúde** → `≡` (deveria: `Heart` red)
- **Rotina** → `≡` + h1 duplicado (deveria: `CalendarCheck` emerald)

Outros módulos já têm ícone mas sem a cor certa da home (ex: Estudos usa `text-indigo-600` mas na home é `text-indigo-600` — ok). Preciso alinhar as cores com o `ModuleDrawer`.

## Cores da Home (referência)
| Módulo | Ícone | Cor |
|--------|-------|-----|
| Finanças | DollarSign | text-amber-600 |
| Casa | Home | text-cyan-600 |
| Saúde | Heart | text-red-600 |
| Rotina | CalendarCheck | text-emerald-600 |

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Casa.tsx` | Trocar `≡` por `<Home className="w-5 h-5 text-cyan-600" />` |
| `src/pages/Index.tsx` | Trocar `≡` por `<DollarSign className="w-5 h-5 text-amber-600" />` |
| `src/pages/Saude.tsx` | Trocar `≡` por `<Heart className="w-5 h-5 text-red-600" />` |
| `src/pages/Rotina.tsx` | Trocar `≡` por `<CalendarCheck className="w-5 h-5 text-emerald-600" />` + corrigir h1 duplicado |
| `src/components/casa/RoomManager.tsx` | `defaultRooms = []`, adicionar empty state "Adicione seu primeiro cômodo" |
| `src/components/casa/GroceryList.tsx` | `DEFAULT_CATEGORIES = []`, adicionar empty state "Crie categorias para organizar suas compras" |
| `src/components/casa/CleaningRoutine.tsx` | `DEFAULT_SECTIONS = []`, adicionar empty state "Monte sua rotina de limpeza" |
| `src/components/casa/MealPlanner.tsx` | `defaultRecipes = []`, adicionar empty state "Cadastre suas receitas favoritas" |
| `src/components/casa/MaintenanceLog.tsx` | `defaultMaintenance = []`, adicionar empty state "Cadastre tarefas de manutenção da casa" |

