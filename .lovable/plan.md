

# Plano: Aplicar design de cards coloridos nas abas restantes do Casa

## Situacao atual

As abas **Comodos**, **Mercado** e **Rotina** tem um design rico:
- Cards com **header colorido** (bg-yellow-200, bg-green-500, etc.)
- **Body com cor suave** correspondente (bg-yellow-50, etc.)
- Cards ja existem vazios com texto "Nenhuma tarefa ainda" e input inline
- Checkbox inline com placeholder "Adicionar item..."
- Contadores (0/0) no header

As outras 7 abas (Despensa, Cardapio, Manutencao, Vida, CO-OP, Seguranca, Utilidades) usam cards simples bg-card com bordas neutras e muitas vezes somem quando vazios.

## O que muda

Transformar cada aba para ter cards com **headers coloridos pre-existentes** e inputs inline, mesmo quando vazio. O usuario ve a estrutura pronta e so preenche.

### Despensa (`SmartPantry.tsx`)
- Mostrar as 4 categorias (Geladeira, Armario, Limpeza, Banheiro) sempre, com headers coloridos distintos, mesmo quando vazias
- Cada categoria com input inline "Adicionar produto..."

### Cardapio (`MealPlanner.tsx`)
- Os 7 dias da semana ja existem como cards, mas com estilo simples. Trocar para headers coloridos (cada dia uma cor, usando o padrao border-l que ja existe, mas agora como header colored completo)
- Card do Banco de Receitas com header colorido

### Manutencao (`MaintenanceLog.tsx`)
- 3 secoes (Manutencao, Garantias, Medidas) como cards com headers coloridos permanentes em vez de botoes toggle
- Cada secao mostra vazia com "Nenhum item" e input inline

### Vida/Plantas (`PlantsAndPets.tsx`)
- 2 cards permanentes: "PLANTAS" (header verde) e "PETS" (header amber), sempre visiveis
- Dentro: lista de itens + form inline

### CO-OP (`ChoreRotation.tsx`)
- Card "MORADORES" com header colorido (roxo)
- Card "TAREFAS" com header colorido (azul) com lista e input inline

### Seguranca (`SafetyChecks.tsx`)
- 2 cards permanentes com headers coloridos: "CHECKLIST DE SEGURANCA" (verde) e "ESTOQUE DE EMERGENCIA" (vermelho), ambos sempre visiveis em vez de toggle

### Utilidades (`HomeUtilities.tsx`)
- 4 secoes como cards permanentes todos visiveis: Contatos (azul), Anfitriao (rosa), Desapego (laranja), Consumo (amarelo)
- Cada um com header colorido e body claro

## Padrao de design aplicado (igual Comodos/Mercado/Rotina)

```text
┌──────────────────────────────┐
│ bg-green-200  🌿 PLANTAS   │  ← header colorido
├──────────────────────────────┤
│ bg-green-50                  │  ← body suave
│  item 1                      │
│  item 2                      │
│  Nenhum item ainda (italic)  │
│  ─────────────────────────── │
│  ☐ Adicionar item...         │  ← input inline
└──────────────────────────────┘
```

## Arquivos alterados (7)

| Arquivo | Mudanca |
|---------|---------|
| `SmartPantry.tsx` | 4 categorias sempre visiveis com headers coloridos |
| `MealPlanner.tsx` | Dias da semana com headers coloridos, banco de receitas com header |
| `MaintenanceLog.tsx` | 3 secoes como cards permanentes com headers coloridos (remove toggle) |
| `PlantsAndPets.tsx` | 2 cards permanentes (Plantas verde, Pets amber) |
| `ChoreRotation.tsx` | Cards Moradores e Tarefas com headers coloridos |
| `SafetyChecks.tsx` | 2 cards permanentes com headers coloridos (remove toggle) |
| `HomeUtilities.tsx` | 4 secoes como cards permanentes com headers coloridos (remove toggle) |

