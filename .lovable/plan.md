## Resumo
Atualizar a função `getBarHsl` em `CategoryBudgets.tsx` para usar a paleta Apple Health escolhida pelo usuário:
- Muito longe do limite → verde menta (#30D158)
- Se aproximando → amarelo dourado (#FFD60A)
- Próximo do limite → laranja vivo (#FF9F0A)
- Ultrapassou → vermelho coral (#FF453A)

A interpolação será suave via HSL/RGB entre os pontos de corte da porcentagem.

## Arquivo
- `src/components/CategoryBudgets.tsx` — função `getBarHsl`

## Abordagem Técnica
Substituir a interpolação HSL genérica por uma interpolação entre 4 cores fixas (Apple Health palette), com transições suaves entre elas conforme a porcentagem avança de 0% a 100%+.