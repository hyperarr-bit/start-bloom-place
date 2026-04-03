

# Novo Módulo: HIPERFOCO

Módulo inspirado no vídeo — sistema de captura de pensamentos por horário, tags inteligentes e metas com framework de PNL (Programação Neurolinguística).

---

## Funcionalidades

### 1. Registro de Pensamentos por Horário
- Timeline vertical com blocos de hora (6h–23h)
- Cada bloco permite registrar pensamentos, ideias, insights
- Calendário para navegar entre dias
- Persistido com `usePersistedState`

### 2. Sistema de Tags
- Tags pré-definidas: Pergunta, Decisão, Meta, Insight, Problema, Ideia
- Cada pensamento pode ter uma ou mais tags
- Filtro/busca por tag para encontrar registros rapidamente
- Tags com cores distintas (badges coloridos)

### 3. Painel de Metas com PNL
- 3 colunas: Curto prazo, Médio prazo, Longo prazo
- Cada meta tem:
  - Tipo: Empresa, Pessoal, Saúde
  - Título
  - Framework PNL com perguntas:
    - O que deseja especificamente?
    - Como saberá que conseguiu?
    - Onde, quando e com quem?
    - O que ainda impede?
    - Quais recursos precisa?
    - Qual o primeiro passo?
  - Lista de objetivos/sub-tarefas com checkbox
  - Anel de progresso que preenche conforme objetivos são concluídos

---

## Abas do módulo
| Aba | Conteúdo |
|-----|----------|
| 🧠 CAPTURA | Timeline de pensamentos + calendário + tags |
| 🎯 METAS | Painel curto/médio/longo prazo com framework PNL |

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Hiperfoco.tsx` | **Criar** — página principal com header padrão (ArrowLeft + título HIPERFOCO) e 2 abas |
| `src/components/hiperfoco/ThoughtCapture.tsx` | **Criar** — timeline de blocos por hora, input de pensamento, seletor de tags, calendário lateral |
| `src/components/hiperfoco/GoalsPanel.tsx` | **Criar** — 3 colunas de metas (curto/médio/longo), card de meta com framework PNL, objetivos com checkbox e anel de progresso |
| `src/App.tsx` | **Editar** — adicionar rota `/hiperfoco` |
| `src/components/home/ModuleDrawer.tsx` | **Editar** — adicionar módulo Hiperfoco na lista (ícone `Brain`, cor roxa) |

---

## Design
- Segue o padrão visual existente: cards com `bg-card border-border`, texto `text-foreground`, tags como badges pequenos coloridos
- Timeline usa linhas conectoras verticais com dots por hora
- Anel de progresso das metas usa SVG circular (como `DayScoreRing`)
- Mobile-first (viewport 430px), colunas de metas empilham em mobile

