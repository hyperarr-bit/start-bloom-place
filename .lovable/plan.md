

# Plano: Corrigir layout da linha quick-add na Bancada (Beleza)

## Problema
A linha de quick-add (Nome, Marca, Categoria, botoes) usa `grid-cols-12` que fica apertado no mobile (430px). Os inputs ficam cortados e os botoes sobrepostos.

## Solucao
Trocar o grid da linha quick-add (linhas 202-239) de `grid-cols-12` horizontal para layout vertical empilhado:
- Linha 1: Input Nome (full width)
- Linha 2: Input Marca + Select Categoria lado a lado
- Linha 3: Botoes Add + Detalhes

Tambem ajustar o header da tabela (linhas 150-156) para esconder colunas Validade e Acoes no mobile, mostrando apenas Produto/Marca/Categoria.

## Arquivo alterado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/beleza/ProductShelf.tsx` | Trocar grid-cols-12 da quick-add row para layout empilhado vertical; simplificar header no mobile |

