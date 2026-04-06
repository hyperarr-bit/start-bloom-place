

# Plano: Tornar cards/tabelas sempre visíveis (estilo planilha) em Viagens e Carreira

## Problema
Atualmente quando não há dados, vários componentes mostram apenas um botão "Adicionar" e a tabela/card colorido fica invisível. O usuário quer ver a estrutura da planilha sempre presente, mesmo vazia, com texto "Nenhum item" e input inline.

## Mudanças

### Carreira (`src/pages/Carreira.tsx`)

**JobTracker**: O Pipeline aparece só com `jobs.length > 0`. A tabela de vagas já tem header colorido mas o body fica vazio sem mensagem.
- Adicionar mensagem "Nenhuma candidatura ainda" dentro da tabela quando vazia
- Mover o botão "+" para dentro do header da tabela
- Pipeline continua condicional (só faz sentido com dados)

**Portfolio**: Tabela com header "CONQUISTAS & PORTFOLIO" já existe mas body vazio sem feedback.
- Adicionar "Nenhuma conquista ainda" quando vazio
- Mover botão para header

**Networking**: Tabela "REDE DE CONTATOS" — mesmo padrão.
- Adicionar "Nenhum contato ainda" + mover botão

**SkillsTracker**: Tabela "SKILLS & COMPETÊNCIAS" — mesmo padrão.
- Adicionar "Nenhuma skill ainda" + mover botão

**InterviewPrep**: Já tem estrutura boa, só adicionar "Nenhuma pergunta ainda" quando lista vazia.

### Viagens

**BucketList** (`BucketList.tsx`): Tabela "BUCKET LIST" já existe com headers de coluna. Quando vazia, adicionar linha "Nenhum destino ainda". Mover botão para header.

**PlacesBoard** (`PlacesBoard.tsx`): Quando vazio, só mostra botão. Criar card com header colorido "LUGARES SALVOS" sempre visível + "Nenhum lugar salvo" + botão no header.

**TravelDiary** (`TravelDiary.tsx`): Quando vazio, só mostra botão. Criar card "DIÁRIO DE VIAGEM" sempre visível + "Nenhuma entrada" + botão no header.

**BillSplitter** (`BillSplitter.tsx`): Card "PESSOAS" e "DESPESAS" sempre visíveis com "Nenhuma pessoa/despesa" quando vazios.

**CurrencyConverter** (`CurrencyConverter.tsx`): Já tem design bom com "MOEDAS RÁPIDAS" sempre visível.

**TripCountdown** (`TripCountdown.tsx`): Quando vazio, adicionar card "CONTAGENS REGRESSIVAS" com "Nenhuma viagem" + botão no header.

**SafetyCard**: Já perfeito — campos sempre visíveis.

**TravelBudget**: Já perfeito — categorias sempre visíveis.

**PackingChecklist** (`PackingChecklist.tsx`): Quando vazio, mostrar card "LISTAS DE MALA" sempre visível + "Nenhuma lista criada" + botão no header.

**DailyTimeline** (`DailyTimeline.tsx`): Quando vazio, mostrar card "ROTEIRO" sempre visível + "Nenhum dia planejado" + botão no header.

## Padrão aplicado em cada componente

```text
┌──────────────────────────────────────────┐
│ bg-color-200  📊 TÍTULO         [+ Add] │  ← header sempre visível
├──────────────────────────────────────────┤
│ bg-color-100  Col1  Col2  Col3  Col4    │  ← sub-header (se tabela)
├──────────────────────────────────────────┤
│ Nenhum item ainda                        │  ← quando vazio
│ ou                                       │
│ item 1                                   │  ← quando tem dados
│ item 2                                   │
└──────────────────────────────────────────┘
```

## Arquivos alterados (8)

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Carreira.tsx` | JobTracker, Portfolio, Networking, SkillsTracker, InterviewPrep: empty state "Nenhum item" + botão no header |
| `src/components/travel/BucketList.tsx` | Empty state na tabela + botão no header |
| `src/components/travel/PlacesBoard.tsx` | Card permanente "LUGARES SALVOS" + empty state |
| `src/components/travel/TravelDiary.tsx` | Card permanente "DIÁRIO DE VIAGEM" + empty state |
| `src/components/travel/BillSplitter.tsx` | Cards PESSOAS e DESPESAS sempre visíveis |
| `src/components/travel/TripCountdown.tsx` | Card permanente + empty state |
| `src/components/travel/PackingChecklist.tsx` | Card permanente + empty state |
| `src/components/travel/DailyTimeline.tsx` | Card permanente + empty state |

