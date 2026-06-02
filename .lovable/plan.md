## Problemas

1. No passo "Adicione um limite pra uma categoria", o balão fica acima do alvo e cobre a lista "Limites por categoria" que está acima.
2. Em passos que apontam para abas (LIMITES, RELATÓRIOS, INVESTIMENTOS, ITENS, SAÚDE), a tira de abas tem scroll horizontal. Se a aba destacada está fora da viewport, o `rect` cai na posição da próxima aba visível e a seta aponta pra aba errada.

## Mudanças

### `src/components/onboarding/SpotlightOverlay.tsx`

Trocar a heurística de posicionamento do balão para preferir **abaixo** do alvo quando há espaço (≥140px até o final da viewport). Só fica acima se não couber abaixo.

```ts
// antes: labelBelow = rect ? rect.top < 90 : false;
const spaceBelow = rect ? (viewportH - (rect.top + rect.height)) : 0;
const labelBelow = rect ? (spaceBelow >= 140 || rect.top < 130) : false;
```

Isso resolve o passo de limites (balão vai pro espaço vazio abaixo do "Adicionar limite") e também melhora os passos de abas (balão fica logo abaixo da tira de abas, com seta pra cima apontando direto no alvo).

### `src/pages/Index.tsx`

Nos passos que apontam pra abas, garantir que a aba alvo entre na viewport horizontal antes de medir. Adicionar `scrollIntoView({ inline: "center" })` no `onEnter` de cada step de aba:

- `tab-investimentos`
- `tab-itens`
- `tab-limites`
- `tab-relatorios`
- `tab-saude`

Padrão:

```ts
onEnter: () => {
  setActiveTab("...");
  setTimeout(() => {
    document.querySelector('[data-spotlight="tab-limites"]')
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, 150);
}
```

Nenhum outro arquivo é tocado.
