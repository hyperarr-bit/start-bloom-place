

# Ajustes no Card de Vencimentos das Contas

## 2 mudanças:

### 1. Padding no header preto
O texto "VENCIMENTOS DAS CONTAS" e o botão "+" estão colados nas bordas. Adicionar `px-4` ao header para dar respiro.

### 2. Modo edição toggle
Atualmente o ícone de lápis e o input "Adicionar conta..." ficam sempre visíveis. O ideal é ter uma visualização limpa por padrão, e um botão "Editar" que ativa o modo de edição.

**Modo visualização (padrão):**
- Header do card mostra apenas "Dia X" e o contador (sem lápis, sem botão remover)
- Lista de contas mostra apenas checkbox + nome (sem X de remover)
- Input "Adicionar conta..." oculto
- Botão "+" no header preto oculto

**Modo edição (ao clicar no botão):**
- Botão "Editar" no header preto vira "Concluído"
- Lápis aparece nos dias, X aparece nas contas, input de adicionar aparece
- Botão "+" e "−" nos cards ficam visíveis

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/BillsDueCards.tsx` | Adicionar estado `editing` (boolean). Condicionar exibição de lápis, X, input adicionar, +, − ao modo edição. Adicionar `px-4` ao header. Botão Editar/Concluído no header preto. |

