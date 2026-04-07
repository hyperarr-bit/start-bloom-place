

# Plano: Redesenhar cards de pets com foto (estilo da screenshot)

## Mudanca

Redesenhar `PetList.tsx` para mostrar cada pet como um card individual (como na screenshot) em vez da tabela grid atual:

**Cada pet card terá:**
- Avatar circular à esquerda (emoji de animal como placeholder, ou foto se tiver `photoUrl`)
- Nome em negrito
- Linha de info: Espécie · Raça · Idade
- Peso abaixo
- Botão lixeira à direita

**Header do card amarelo permanece** com "Meus Pets" + contagem + botão "+ Adicionar" no canto direito.

**Form de adicionar:** Mantém o design atual (inputs empilhados dentro do card amarelo) mas fica escondido por default, aparece ao clicar "+ Adicionar". Campos: Nome, Espécie, Raça, Peso, Data nascimento, campo de URL de foto (opcional). Botão "Salvar".

**Interface PetItem:** Adicionar campo `photoUrl?: string` para foto opcional do pet.

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/pet/PetList.tsx` | Trocar tabela grid por cards individuais com avatar/foto, adicionar photoUrl, form toggle com "+ Adicionar" |

