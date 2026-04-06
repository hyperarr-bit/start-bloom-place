

# Plano: Aplicar design Casa nos módulos Viagens e Carreira + remover stat cards

## Situacao atual

**Viagens**: Os componentes ja usam cards coloridos (notion-style), mas varios tem dados pre-preenchidos de exemplo (destinos, roteiro, etc.)

**Carreira**: Tem 4 stat cards (TOTAL, ATIVAS, ENTREVISTAS, OFERTAS) + card RESUMO + dados pre-preenchidos (vagas, portfolio, contatos, skills, perguntas de entrevista)

## Mudancas

### 1. Carreira — Remover stat cards e dados pre-preenchidos

| Item | De | Para |
|------|----|------|
| Stat cards (4 cards grid) | Grid com TOTAL/ATIVAS/ENTREVISTAS/OFERTAS | Removido |
| Card RESUMO | Card com skills/contatos/conquistas | Removido |
| `DEFAULT_JOBS` | 2 vagas exemplo | `[]` |
| `DEFAULT_PORTFOLIO` | 1 item exemplo | `[]` |
| `DEFAULT_CONTACTS` | 1 contato exemplo | `[]` |
| `DEFAULT_SKILLS` | 3 skills exemplo | `[]` |
| Interview Prep defaults | 5 perguntas pre-cadastradas | `[]` |

O Pipeline visual da aba Vagas continua (so aparece quando tem dados). As tabelas notion-style com headers coloridos ja existem e ficam.

### 2. Viagens — Remover dados pre-preenchidos

| Componente | De | Para |
|------------|----|------|
| `BucketList` DEFAULT_DESTINATIONS | 3 destinos exemplo | `[]` |
| `DailyTimeline` DEFAULT_DAYS | 2 dias com atividades exemplo | `[]` |

Os outros componentes de viagem (PackingChecklist, BillSplitter, PlacesBoard, SafetyCard, CurrencyConverter, TravelDiary, TripCountdown, TravelBudget) ja iniciam vazios.

## Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Carreira.tsx` | (1) Remover bloco stat cards linhas 496-512 (2) Remover bloco RESUMO linhas 514-524 (3) `DEFAULT_JOBS = []` (4) `DEFAULT_PORTFOLIO = []` (5) `DEFAULT_CONTACTS = []` (6) `DEFAULT_SKILLS = []` (7) Interview prep default `[]` (8) Remover leitura de stats no componente principal |
| `src/components/travel/BucketList.tsx` | `DEFAULT_DESTINATIONS = []` |
| `src/components/travel/DailyTimeline.tsx` | `DEFAULT_DAYS = []` |

