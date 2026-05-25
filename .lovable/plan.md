## Problema
Em vários módulos, ao tocar no campo de data, o input fica branco mas o seletor nativo não abre. Encontrei 35+ usos de `<Input type="date">` espalhados em ~30 arquivos (Finanças, Carreira, Biblioteca, Beleza, Treino, Estudos, Saúde, Casa, Pet, Travel, Relacionamentos, Home widgets, etc.).

A causa provável é a combinação `appearance-none` + `<input type="date">` no iOS/WebKit, que esconde o indicador do picker e, em algumas versões, impede o picker de abrir no toque.

## Correção (centralizada)

Em vez de mexer em 30+ arquivos, alterar **apenas** o componente compartilhado `src/components/ui/input.tsx` para que, quando `type === "date"` (ou `datetime-local`/`time`/`month`/`week`), o input chame `showPicker()` no `onClick`/`onFocus`. Isso garante que o seletor abre em todo lugar.

### Alterações em `src/components/ui/input.tsx`
- Adicionar handler `onClick` que, se for um input de tempo/data e `e.currentTarget.showPicker` existir, chama `showPicker()`.
- Preservar qualquer `onClick` que o consumidor já tenha passado.
- Nenhuma mudança de estilo ou API — totalmente retrocompatível.

## Verificação
Após o build, testar manualmente:
- Finanças: Receitas, Despesas, Parcelas, Investimentos
- Biblioteca: empréstimo/leitura
- Saúde, Beleza, Pet, Travel, Carreira, Estudos, Relacionamentos
em mobile (430px) — tocar no campo deve abrir o picker nativo de imediato.

## Nota técnica
`HTMLInputElement.showPicker()` é suportado no iOS Safari 16+, Chrome 99+, Firefox 101+ — cobre praticamente toda a base. Em browsers sem suporte, o comportamento padrão do navegador continua valendo (sem regressão).