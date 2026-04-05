

# Plano: Detail view METAS — 1:1 com as fotos

## Diferenças identificadas (atual vs fotos)

1. **SectionHeader**: Atualmente o titulo fica DENTRO da faixa colorida. Nas fotos, a faixa marrom/cinza e apenas decorativa (~80px) com emoji no canto inferior direito, e o titulo "PLANO DE ACAO" aparece ABAIXO da faixa, na area branca do card, como texto grande bold.

2. **Titulo no topo**: Atualmente tem botao voltar + titulo + lixeira. Nas fotos mostra "Casamento → ∨" como texto grande com chevron dropdown, sem botao de voltar visivel no mesmo estilo.

3. **Tasks com prefixo bold**: Nas fotos, tasks tem texto tipo "**Data:** Escolher uma data realista..." onde a primeira palavra e bold. Atualmente e texto plain. Nao precisa mudar logica — e apenas visual do texto que o usuario digita.

4. **Checkbox tamanho**: Nas fotos os circulos parecem um pouco maiores (~22px) e com borda mais fina quando unchecked.

5. **Labels rosa**: Nas fotos sao mais largos (full-width) com padding maior e texto maior (text-sm font-bold, nao text-xs).

6. **Visao**: Nas fotos o label e "**Tempo para bater a meta:**" (nao so "Tempo:"). E tem hr embaixo do ultimo campo, com espaco vazio apos.

7. **Problemas**: Nas fotos a solucao e texto normal (nao textarea), diretamente abaixo do label rosa, sem borda ou box.

## Alteracao

| Arquivo | Mudanca |
|---------|---------|
| `src/components/hiperfoco/GoalsBoardV2.tsx` | (1) `SectionHeader`: separar faixa decorativa (sem titulo) + titulo abaixo como `<h3>` no body do card. (2) Titulo topo: "NomeMeta → ∨" com `ChevronDown`, ao clicar abre overlay de metas, botao voltar como seta menor acima. (3) Checkboxes: w-6 h-6, borda mais fina (border instead of border-2). (4) Labels rosa: text-sm font-bold, py-2.5 px-4, full-width. (5) Visao: label "Tempo para bater a meta:" e hr + espaco vazio apos campos. (6) Problemas: solucao como `<p>` editavel inline (input), nao Textarea, sem borda, diretamente abaixo do label rosa. |

