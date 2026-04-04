

# Reorganizar Treino em abas claras e separadas

## Problema atual
O módulo já tem 5 abas, mas a aba "TREINO" ainda acumula tudo: barra de stats, timer de descanso, accordion de configuração, e os cards de treino. O usuário abre e vê muita coisa junta.

## Solução: separar em 6 abas focadas

```text
🏋️ HOJE  |  📅 SEMANA  |  ⚙️ CONFIG  |  📈 PROGRESSÃO  |  🏆 RECORDES  |  📊 STATS
```

### Aba 🏋️ HOJE (padrão)
- Apenas o card do treino de hoje (protagonista)
- Barra de stats compacta no topo (exercícios, feitos, streak)
- Timer de descanso inline (aparece quando marca exercício)
- Zero configuração visível

### Aba 📅 SEMANA
- Grid com todos os dias da semana (o que já existe no viewMode "grid")
- Visão geral da semana inteira

### Aba ⚙️ CONFIG
- Seleção de dias ativos (chips)
- Templates (Push/Pull/Legs, ABC, etc.)
- Grupos musculares por dia
- Tudo que hoje fica no accordion "Configurar Semana"

### Abas existentes mantidas
- 📈 PROGRESSÃO — gráfico de carga + calculadora 1RM
- 🏆 RECORDES — PRs + conquistas
- 📊 STATS — histórico, volume semanal, distribuição muscular (juntar stats + history)

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Treino.tsx` | (1) Substituir tab "treino" por duas: "hoje" e "semana". (2) Criar tab "config" com o conteúdo do Collapsible (dias, templates, músculos). (3) Remover accordion Collapsible e toggle viewMode (hoje/semana) — agora são abas separadas. (4) Juntar "stats" e "history" numa aba só. (5) Mover barra de stats compacta para dentro da aba "hoje" apenas. (6) Remover botões Hoje/Semana da bottom bar (virou aba). (7) Simplificar bottom bar: só "Iniciar/Finalizar Sessão" + timer shortcut. |

Nenhum arquivo novo. Nenhuma informação removida — tudo reorganizado em abas dedicadas.

