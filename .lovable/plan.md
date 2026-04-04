

# Reorganizar o módulo Treino — menos poluição visual, mesma informação

## Problema
A aba TREINO mostra tudo de uma vez: 4 stat cards + volume semanal + timer de descanso + config de dias/templates + controles de sessão + grid de treino. São ~7 blocos empilhados antes do usuário chegar no treino em si. Sobrecarga visual.

## Estratégia: hierarquia visual com seções colapsáveis e agrupamento inteligente

### 1. Header compacto com stats inline
Em vez de 4 cards grandes ocupando uma fileira, condensar em uma barra horizontal compacta:
- Uma linha com: `6 exercícios · 3 feitos · 42 séries/sem · 🔥 12 treinos`
- Economiza ~100px de altura e reduz ruído visual

### 2. Timer de descanso — esconder até precisar
O timer ocupa espaço enorme mas só é útil durante o treino. Mudar para:
- Um botão pequeno "⏱ Descanso" no header ou nos controles de sessão
- Ao clicar, expande um mini-timer inline (ou um bottom sheet)
- Quando o timer está rodando, ele fica visível automaticamente
- Quando parado e fechado, some completamente

### 3. Config de dias e templates — colapsar por padrão
Já tem toggle mas o card inteiro (dias da semana + botões) ocupa espaço fixo.
- Mover para um único botão "⚙️ Configurar Semana" que expande um drawer/accordion
- Templates ficam dentro desse accordion
- Dias da semana ficam como chips compactos dentro dele
- Quando fechado: apenas uma linha mostrando o split atual (ex: "Push/Pull/Legs · 5 dias")

### 4. Volume semanal — integrar nos stats
O card de volume semanal com comparação pode virar parte da barra de stats compacta:
- Adicionar o `↑12%` como badge ao lado dos stats
- Ou mover para a aba ESTATÍSTICAS onde faz mais sentido

### 5. Controles de sessão — fixar no bottom
"Iniciar Sessão" e "Hoje/Semana" são ações primárias. Fixar como barra inferior sticky:
- Barra fixa no bottom com: `[▶ Iniciar Sessão] [Hoje | Semana] [⏱ Timer] [progresso 65%]`
- Remove a necessidade de scroll até os controles

### 6. Treino do dia — protagonista
Com os itens acima colapsados/movidos, o card do treino do dia fica como elemento principal, visível logo abaixo do header.

## Resultado visual (scroll mínimo)

```text
┌─────────────────────────────┐
│ ← 🏋️ TREINO                │  Header sticky
│ 6 ex · 3✓ · 42 séries · ↑12% │  Stats inline
├─────────────────────────────┤
│ ▸ Configurar Semana (PPL·5d)│  Accordion fechado
├─────────────────────────────┤
│ ┌───────────────────────┐   │
│ │ QUARTA ⬅️ HOJE        │   │  Card do dia
│ │ 🫁 Peito + Ombros     │   │  (protagonista)
│ │ ────────────────────  │   │
│ │ 1. Supino   3×12×80kg │   │
│ │ 2. Crucifixo 3×15×... │   │
│ │ ...                   │   │
│ └───────────────────────┘   │
├─────────────────────────────┤
│ [▶ Iniciar] [Hoje|Semana] ⏱│  Bottom bar sticky
└─────────────────────────────┘
```

## Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Treino.tsx` | (1) Substituir grid de 4 stat cards por barra inline compacta. (2) Mover timer de descanso para estado colapsável, visível só quando aberto ou rodando. (3) Envolver config de dias/templates em Collapsible (accordion) fechado por padrão, mostrando resumo do split. (4) Mover volume semanal para stats inline ou aba ESTATÍSTICAS. (5) Criar barra de ação sticky no bottom com Iniciar Sessão, toggle Hoje/Semana, botão timer, e barra de progresso. (6) Corrigir `<h1>` duplicado no header. |

Nenhum arquivo novo. Nenhuma informação removida — tudo continua acessível, só reorganizado com hierarquia visual clara.

