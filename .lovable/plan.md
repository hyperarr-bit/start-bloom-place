

# Plano: Texto motivacional na recaida + mover botao excluir + confirmacao de exclusao

## 1. Texto motivacional no AlertDialog de recaida

Trocar o texto atual frio por algo acolhedor e curto:

**Titulo**: "Ei, tudo bem" (ou similar)
**Texto**: "Recaidas fazem parte do processo. Cada dia que voce resistiu te tornou mais forte. Vamos de novo?"
**Botoes**: "Confirmar recaida" e "Cancelar"

## 2. Mover botao Trash2 para dentro do card expandido

Atualmente o Trash2 fica ao lado do RotateCcw e do ChevronDown no header — muito proximo, causa clique acidental. Solucao:
- Remover Trash2 da linha 126-130 (header do card)
- Colocar dentro da area expandida (`isExpanded`), abaixo do calendario, como botao discreto "Excluir habito"

## 3. Confirmacao de exclusao

Adicionar um segundo AlertDialog (ou reusar com state) para confirmar exclusao:
- State `confirmDeleteId`
- Texto: "Deseja excluir o habito [nome]? Todos os dados serao perdidos."
- Botoes: "Excluir" (destructive) e "Cancelar"

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/detox/DetoxTracker.tsx` | (1) Texto motivacional no dialog de recaida (2) Mover Trash2 para area expandida (3) Novo AlertDialog de confirmacao de exclusao |

