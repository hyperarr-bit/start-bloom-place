

# Plano: Trocar input de nome por select de pets no Diario

## Mudanca

No form de adicionar entrada do diario (linhas 80-84), trocar o `Input` com `datalist` por um `Select` (shadcn) que lista os pets cadastrados em `pet-list`.

- Se nao houver pets cadastrados, mostrar option desabilitada "Cadastre um pet primeiro"
- Se houver apenas 1 pet, pre-selecionar automaticamente
- State `petName` continua string (guarda o nome do pet selecionado)

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/pet/PetDiary.tsx` | Trocar Input+datalist por Select com options dos pets cadastrados, import Select do shadcn |

