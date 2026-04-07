

# Plano: Beleza dados vazios + Pet fotos no diario + Casa remover aba VIDA

## 1. Beleza — defaults vazios

Os componentes de Beleza vem com dados pre-preenchidos. Trocar para arrays vazios:

| Arquivo | Variavel | Default atual | Novo default |
|---------|----------|---------------|--------------|
| `SkincareRoutine.tsx` | `DEFAULT_MORNING` | 5 steps (Gel, Tonico, Vit C, Hidratante, FPS) | `[]` |
| `SkincareRoutine.tsx` | `DEFAULT_NIGHT` | 4 steps (Oil, Sabonete, Tratamento, Hidratacao) | `[]` |
| `ProductShelf.tsx` | `DEFAULT_PRODUCTS` | 2 produtos (FPS, Serum Vit C) | `[]` |

A estrutura visual (cards de Manha/Noite, Skin Cycling, Bancada) continua intacta — so os dados dentro ficam vazios com mensagem "Nenhum passo ainda" / "Nenhum produto ainda".

## 2. Pet Diario — campo de foto

Adicionar campo `photoUrl` na interface `DiaryEntry` e um input de URL de foto no form de registro. Na exibicao, mostrar a imagem abaixo do texto quando presente.

| Arquivo | Mudanca |
|---------|---------|
| `PetDiary.tsx` | (1) Adicionar `photoUrl: string` na interface (2) Input de URL no form (3) Exibir `<img>` no card da entrada |

## 3. Casa — remover aba VIDA

Remover `{ id: "plantas", label: "VIDA", icon: "🌱" }` do array `tabs`, remover `{activeTab === "plantas" && <PlantsAndPets />}` e o import de `PlantsAndPets`.

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Casa.tsx` | Remover aba plantas/VIDA, import PlantsAndPets |

## Arquivos alterados (4)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/beleza/SkincareRoutine.tsx` | `DEFAULT_MORNING = []`, `DEFAULT_NIGHT = []` |
| `src/components/beleza/ProductShelf.tsx` | `DEFAULT_PRODUCTS = []` |
| `src/components/pet/PetDiary.tsx` | Campo photoUrl + input URL + exibicao de imagem |
| `src/pages/Casa.tsx` | Remover aba VIDA e import PlantsAndPets |

