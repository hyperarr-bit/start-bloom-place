

# Plano: Aplicar estilo notion-tab em todos os módulos

## Situação atual
12 módulos ainda usam o `<Tabs>/<TabsList>/<TabsTrigger>` antigo do Shadcn. Saúde, Rotina e Casa já usam o estilo notion-tab com header sticky + abas no header.

## Padrão alvo (igual Rotina/Casa)
```text
┌─────────────────────────────────┐
│ ←  ≡  TÍTULO                   │
│ 🔥Tab1  📋Tab2  ⚙️Tab3 ...    │  ← scroll horizontal, notion-tab
└─────────────────────────────────┘
<main>
  {activeTab === "tab1" && <Component1 />}
</main>
```

- Header sticky com `border-b border-border bg-card sticky top-0 z-50`
- Abas como `<button>` com classe `notion-tab` / `notion-tab-active`
- `useState` para controlar aba ativa + `reportTab?.()` no onChange
- Conteúdo renderizado com `{activeTab === "x" && <Comp />}`
- Remove imports de `Tabs, TabsContent, TabsList, TabsTrigger`
- Remove `motion.div` wrappers desnecessários do header (simplifica para o padrão Notion)

## Módulos a alterar (12 arquivos)

| # | Arquivo | Título | Abas (emoji + label) |
|---|---------|--------|---------------------|
| 1 | `Hiperfoco.tsx` | MENTE | DIA, BUSCA, METAS, ESTRATÉGIA, TIMELINE, 🌙 SONHOS |
| 2 | `Relacionamentos.tsx` | RELAÇÕES | 💜 PESSOAS, 📅 AGENDA, ✨ MOMENTOS, 🎁 PRESENTES, 📋 EVENTOS |
| 3 | `Detox.tsx` | DETOX | 🌿 RASTREADOR, 📓 DIÁRIO, 🏆 CONQUISTAS, 📊 STATS |
| 4 | `Pet.tsx` | PET | 🐾 PETS, 💉 SAÚDE, 📋 ROTINA, 💸 GASTOS, 📸 DIÁRIO |
| 5 | `Viagens.tsx` | VIAGENS | 🧭 Destinos, 🗺️ Roteiro, 🎒 Mala, 💰 Budget, 👥 Rachar, 📍 Lugares, 📖 Diário, 🔄 Câmbio, 🛡️ SOS, ⏱️ Timer |
| 6 | `Beleza.tsx` | BELEZA | ✨ Rotina, 🧪 Bancada, 📷 Diário |
| 7 | `Dieta.tsx` | DIETA | 🍽️ CARDÁPIO, ⏱️ JEJUM, 👩‍🍳 RECEITAS, 🛒 LISTA, 📊 DIÁRIO |
| 8 | `Treino.tsx` | TREINO | 🏋️ HOJE, 📅 SEMANA, ⚙️ CONFIG, 📊 RESUMO, 📈 PROGRESSÃO, 🏆 RECORDES |
| 9 | `Estudos.tsx` | ESTUDOS | 📝 Estudos, 🎓 Grade, ✅ Tarefas, 📓 Caderno, 🍅 Pomodoro |
| 10 | `Carreira.tsx` | CARREIRA | 💼 Vagas, 🏆 Portfolio, 👥 Rede, ⚡ Skills, 📖 Prep |
| 11 | `DesenvolvimentoPessoal.tsx` | DESENV. PESSOAL | SOBRE MIM, METAS, DIÁRIO, HUMOR & SCORE, RESPIRAÇÃO, GRATIDÃO, CARTA, 30 DIAS |
| 12 | `Biblioteca.tsx` | BIBLIOTECA | (mantém tabs existentes com notion-tab) |

## Mudança em cada arquivo (mesmo padrão)
1. Remover import de `Tabs, TabsContent, TabsList, TabsTrigger`
2. Adicionar `useState` para `activeTab` (default = primeira aba)
3. Header: sticky com título + barra de abas notion-tab com scroll horizontal
4. Conteúdo: `{activeTab === "x" && <Component />}` em vez de `TabsContent`
5. Manter `reportTab?.(tabId)` no handler de troca de aba
6. Remover `motion.div` wrappers do header onde existirem (Hiperfoco, Relacionamentos, Detox, Pet)

