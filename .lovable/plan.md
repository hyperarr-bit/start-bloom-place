

# Plano: Remover emoji da aba Estrategia + adicionar ModuleTip nos 4 modulos faltantes

## 1. Remover emoji da aba Estrategia no Hiperfoco

No `src/pages/Hiperfoco.tsx`, a tab "ESTRATEGIA" tem o emoji `♟️`. Remover o emoji do icon da tab (trocar por string vazia ou remover o span).

## 2. Adicionar ModuleTip nos 4 modulos sem dicas

| Arquivo | moduleId | Dicas |
|---------|----------|-------|
| `src/pages/Hiperfoco.tsx` | `hiperfoco` | Capture pensamentos rapidos na aba Dia / Use a busca para encontrar ideias antigas / Defina metas e estrategias para manter o foco / Registre sonhos no diario noturno |
| `src/pages/Relacionamentos.tsx` | `relacionamentos` | Cadastre pessoas importantes e seus aniversarios / Use a agenda para nunca esquecer datas / Registre momentos especiais na timeline / Salve ideias de presentes para cada pessoa |
| `src/pages/Pet.tsx` | `pet` | Cadastre seus pets com foto e dados / Registre vacinas e consultas na aba Saude / Monte a rotina diaria do seu pet / Fotografe momentos no diario |
| `src/pages/Detox.tsx` | `detox` | Adicione habitos que quer largar / Use o check-in diario para reforcar sua determinacao / Acompanhe seu streak no calendario / Registre reflexoes no diario |

## Arquivos alterados (5)

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Hiperfoco.tsx` | Remover emoji `♟️` da tab estrategia, adicionar ModuleTip |
| `src/pages/Relacionamentos.tsx` | Adicionar ModuleTip |
| `src/pages/Pet.tsx` | Adicionar ModuleTip |
| `src/pages/Detox.tsx` | Adicionar ModuleTip |
| `src/components/ModuleTip.tsx` | Remover emoji `{icon}` do titulo "Dicas para comecar" (ja tem o icone Lightbulb ao lado) |

