

# Plano: Enriquecer Viagens e Carreira com estrutura de planilha viva

## Problema
Muitos componentes mostram apenas 1 card com "Nenhum item ainda" + botao. O usuario quer ver estrutura rica sempre visivel, como TravelBudget (6 categorias com inputs inline) e SafetyCard (campos sempre visiveis).

## Referencia de design rico (ja existente no app)
- **TravelBudget**: 6 cards de categoria (Passagens, Hotel, Passeios...) cada um com header colorido + tabela Descricao/Estimado/Real + input inline
- **SafetyCard**: 2 grupos de campos sempre visiveis com labels + inputs inline
- **PackingChecklist**: Cards por categoria (Roupas, Higiene...) com checkboxes

## Mudancas

### VIAGENS

**1. BucketList** — Mostrar 3 cards de prioridade sempre visiveis
Em vez de 1 tabela unica, mostrar 3 sections coloridas (Sonho/Planejando/Proximo) com destinos filtrados dentro de cada uma + input inline "Adicionar destino..." em cada card. Stats continuam no topo.

**2. DailyTimeline** — Mostrar cards de tipo de atividade quando nao tem dia selecionado
Quando nao ha dias OU nenhum dia selecionado, mostrar os 6 tipos de atividade (Voo, Hotel, Restaurante, Atividade, Transporte, Compras) como cards coloridos informativos — servindo como "legenda visual" da timeline. Manter o form de novo dia inline no card principal (nao atras de botao).

**3. TripCountdown** — Form inline dentro do card principal
Mover os inputs (nome, data, foto URL) para dentro do card "CONTAGENS REGRESSIVAS" quando vazio, em vez de esconder atras de botao separado.

**4. TravelDiary** — Quick-entry inline no card principal
Mostrar o seletor de humor + input "melhor momento" diretamente dentro do card "DIARIO DE VIAGEM" quando vazio, permitindo adicionar sem clicar em botao primeiro.

**5. PlacesBoard** — Mostrar 5 cards de categoria sempre visiveis
Em vez de 1 lista unificada, mostrar 5 cards (Comida, Turistico, Compras, Cafe, Bar) com header colorido proprio + lugares filtrados + input inline em cada.

### CARREIRA

**6. JobTracker** — Input inline de quick-add na tabela
Adicionar uma linha com inputs (Empresa, Cargo, Status) diretamente no body da tabela para adicionar vaga sem abrir form separado. Manter form completo como opcao.

**7. Portfolio** — Input inline na tabela
Adicionar linha com inputs (Titulo, Tipo, Data) no body da tabela.

**8. Networking** — Card FOLLOW-UP sempre visivel + input inline
Mostrar o card de follow-up pendente sempre (com "Nenhum pendente" quando vazio). Adicionar input inline na tabela (Nome, Empresa).

**9. SkillsTracker** — 5 cards de categoria sempre visiveis
Em vez de 1 tabela, mostrar 5 cards (Tecnica, Soft Skill, Idioma, Ferramenta, Certificacao) com header colorido, skills dentro + input inline em cada.

**10. InterviewPrep** — Input inline dentro do card principal
Mover o input "Nova pergunta..." para dentro do card com header colorido, nao fora dele.

## Padrao visual aplicado

```text
BUCKETLIST (exemplo):
┌──────────────────────────────────┐
│ bg-purple-200  💭 SONHO    0    │
├──────────────────────────────────┤
│ bg-purple-50                     │
│  Nenhum destino sonho ainda      │
│  ────────────────────────────    │
│  ☐ Adicionar destino...    [🌍] │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ bg-yellow-200  📋 PLANEJANDO 0  │
├──────────────────────────────────┤
│  ...                             │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ bg-green-200  🔜 PROXIMO    0   │
├──────────────────────────────────┤
│  ...                             │
└──────────────────────────────────┘

SKILLS (exemplo):
┌──────────────────────────────────┐
│ bg-blue-200  💻 TECNICA     0   │
├──────────────────────────────────┤
│  Nenhuma skill ainda             │
│  ────────────────────────────    │
│  Adicionar skill...        [+]  │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ bg-pink-200  🗣️ SOFT SKILL  0  │
│  ...                             │
└──────────────────────────────────┘
```

## Arquivos alterados (8)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/travel/BucketList.tsx` | 3 cards de prioridade sempre visiveis + inline input em cada |
| `src/components/travel/DailyTimeline.tsx` | Cards de tipo de atividade como legenda + form inline |
| `src/components/travel/TripCountdown.tsx` | Form inline dentro do card principal |
| `src/components/travel/TravelDiary.tsx` | Quick-entry inline no card principal |
| `src/components/travel/PlacesBoard.tsx` | 5 cards de categoria sempre visiveis |
| `src/pages/Carreira.tsx` (JobTracker) | Input inline quick-add na tabela |
| `src/pages/Carreira.tsx` (Portfolio) | Input inline na tabela |
| `src/pages/Carreira.tsx` (Networking) | Follow-up sempre visivel + input inline |
| `src/pages/Carreira.tsx` (SkillsTracker) | 5 cards de categoria sempre visiveis |
| `src/pages/Carreira.tsx` (InterviewPrep) | Input dentro do card principal |

