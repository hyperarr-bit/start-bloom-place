

# Plano: Adicionar aba IDEIAS no modulo Mente

## O que muda

Adicionar uma nova aba "IDEIAS" (penultima, antes de SONHOS) que mostra todas as ideias capturadas — tanto as do modulo Mente quanto as das Acoes Rapidas da Home. Ambas ja salvam no mesmo storage key `hiperfoco-thoughts` com tag `ideia`.

## Implementacao

### 1. Novo componente `src/components/hiperfoco/IdeasPanel.tsx`

- Le `hiperfoco-thoughts` e filtra apenas thoughts com tag `ideia`
- Lista todas as ideias em ordem cronologica reversa (mais recente primeiro)
- Cada card mostra: texto, data/hora, botao remover
- Input inline no topo para adicionar ideia rapida (mesmo formato do ThoughtCapture — salva com tag `ideia` na hora atual)
- Design de planilha viva (card com header, input sempre visivel)

### 2. Atualizar `src/pages/Hiperfoco.tsx`

- Importar `IdeasPanel`
- Adicionar tab `{ id: "ideias", label: "IDEIAS", icon: "💡" }` como penultima (antes de SONHOS)
- Renderizar `{activeTab === "ideias" && <IdeasPanel />}`

## Arquivos alterados (2)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/hiperfoco/IdeasPanel.tsx` | **NOVO** — lista + input de ideias filtradas de hiperfoco-thoughts |
| `src/pages/Hiperfoco.tsx` | Adicionar tab IDEIAS e renderizar IdeasPanel |

