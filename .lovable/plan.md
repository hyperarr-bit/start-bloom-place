# Plano: Remover dados pré-preenchidos do Casa + Emojis coloridos nos headers

## 1. Remover dados pré-preenchidos (manter estrutura visual)


| Componente            | Default atual                                                                                                | Novo default                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `CleaningRoutine.tsx` | 3 seções com 4 itens cada (Diária, Semanal, Mensal)                                                          | 3 seções vazias (mesmos nomes e cores, `items: []`) |
| `MaintenanceLog.tsx`  | 4 tarefas pré-cadastradas (filtro, ar-cond, colchão, máquina)                                                | `[]` vazio                                          |
| `SafetyChecks.tsx`    | 6 itens emergência + 6 itens viagem pré-cadastrados                                                          | `[]` vazio para ambos                               |
| `MealPlanner.tsx`     | 4 receitas (arroz, macarrão, frango, salada)                                                                 | `[]` vazio                                          |
| `RoomManager.tsx`     | 6 cômodos pré-cadastrados ( pode deixar os cômodos ) errado era se estivesse o que limpar dentro dos cômodos | `[]` vazio                                          |
| `types.ts`            | `defaultCleaningTasks` com 6 itens, `defaultEmergencyItems` com 6, `defaultTravelChecklist` com 6            | Todos `[]`                                          |


**Nota**: GroceryList mantém as categorias (HortiFrutti, Açougue, etc.) pois são estruturais, não dados do usuário.

## 2. Adicionar emoji colorido no header de cada módulo

Atualmente todos os headers mostram só texto (ex: `CASA`). Vou adicionar o emoji do módulo com a cor correspondente da Home.

Cores por módulo (extraídas do `ModuleDrawer.tsx`):


| Módulo       | Emoji | Cor do texto       |
| ------------ | ----- | ------------------ |
| Finanças     | 💰    | `text-amber-600`   |
| Casa         | 🏠    | `text-cyan-600`    |
| Rotina       | 📋    | `text-emerald-600` |
| Saúde        | ❤️    | `text-red-600`     |
| Treino       | 💪    | `text-blue-600`    |
| Dieta        | 🍎    | `text-green-600`   |
| Estudos      | 🎓    | `text-indigo-600`  |
| Biblioteca   | 📚    | `text-orange-600`  |
| Beleza       | 💧    | `text-pink-600`    |
| Viagens      | ✈️    | `text-teal-600`    |
| Carreira     | 💼    | `text-slate-600`   |
| Mente        | 🧠    | `text-violet-600`  |
| Relações     | 👥    | `text-rose-600`    |
| Pet          | 🐾    | `text-amber-500`   |
| Detox        | 🌿    | `text-lime-600`    |
| Dev. Pessoal | ✨     | `text-purple-600`  |


Formato do header: `<span className="text-cyan-600">🏠</span>` antes do `<h1>CASA</h1>`

## Arquivos alterados


| Arquivo                                   | Mudança                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/components/casa/CleaningRoutine.tsx` | Seções com `items: []`                                                                   |
| `src/components/casa/MaintenanceLog.tsx`  | `defaultMaintenance = []`                                                                |
| `src/components/casa/SafetyChecks.tsx`    | Listas vazias                                                                            |
| `src/components/casa/MealPlanner.tsx`     | `defaultRecipes = []`                                                                    |
| `src/components/casa/RoomManager.tsx`     | `defaultRooms = []`                                                                      |
| `src/components/casa/types.ts`            | `defaultCleaningTasks = []`, `defaultEmergencyItems = []`, `defaultTravelChecklist = []` |
| 15 páginas de módulo                      | Adicionar emoji colorido no `<h1>` do header                                             |
