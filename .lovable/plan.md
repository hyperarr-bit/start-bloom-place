# Corrigir tabs que precisam de duplo clique para abrir

## Causa

Em mobile, todas as barras de tabs do app usam `overflow-x-auto` (scroll horizontal). Quando uma tab está parcialmente fora da viewport (ex: "FOCO" em Rotina, que é a última e fica cortada na tela de 430px), o **primeiro toque** é interpretado pelo Safari mobile como "scroll/foco" — não como clique. Só o **segundo toque** dispara o `onClick`.

Esse problema afeta **17 páginas** que têm a mesma estrutura de header com tabs roláveis:

Beleza, Biblioteca, Carreira, Casa, Desenvolvimento Pessoal, Detox, Dieta, Estudos, Finanças, Hiperfoco, Pet, Relacionamentos, Rotina, Saúde, Treino, Viagens — além das sub-tabs de dias da semana dentro de Rotina e Dieta.

## Correção

Duas mudanças globais que resolvem todos os casos sem ter que mexer em cada página:

### 1. Classe utilitária `.notion-tab` recebe `touch-action: manipulation`

Isso desabilita o atraso de 300ms do Safari e o "tap-to-scroll" — o clique vira instantâneo mesmo quando o tab está sendo arrastado horizontalmente.

```css
.notion-tab {
  @apply px-4 py-1.5 text-sm border border-border rounded-sm cursor-pointer transition-colors;
  touch-action: manipulation;
  user-select: none;
}
```

### 2. Tab ativa rola sozinha para a viewport

Adiciono `data-active` + `scroll-margin-inline: 16px` no botão e um `useEffect` no `Rotina` (e demais páginas com muitas tabs) que faz `scrollIntoView({ inline: 'center', block: 'nearest' })` quando `activeTab` muda.

Para reaproveitar, crio um pequeno hook `useScrollActiveTabIntoView(activeTab)` que pega o elemento com `data-active="true"` dentro do header e o rola.

### 3. Aplicar nos 17 headers

Adiciono `data-active={activeTab === tab.id}` em todos os botões de tab das 17 páginas (mudança mínima, só atributo) e plugo o hook em cada uma. É repetitivo mas mecânico.

## Por que isso resolve

- `touch-action: manipulation` mata o duplo-tap-zoom e o delay → primeiro clique já entra como `click`.
- `user-select: none` impede que o tap inicie seleção de texto (outro caso que rouba o evento).
- Auto-scroll garante que a tab clicada nunca mais fique cortada → o usuário vê para onde acabou de navegar.

Não precisa migração de banco. Tudo CSS + um hook + atributos `data-active`.

Posso aplicar?
