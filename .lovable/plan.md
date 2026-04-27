
## Problema

Quando o usuário toca em uma aba (em qualquer módulo: Finanças, Rotina, Saúde, etc.), o retângulo da aba ativa fica **totalmente branco** no modo escuro, contrastando feio com o fundo escuro do app.

### Causa

Em `src/index.css`, a classe `.notion-tab-active` usa:

```css
.notion-tab-active {
  @apply bg-foreground text-background;
}
```

No modo escuro, `--foreground` é branco e `--background` é escuro — então a aba ativa vira um bloco branco gritante. Funciona bem no light, mas quebra a hierarquia "escura premium" no dark.

## Solução

Manter o comportamento atual no **light mode** (aba ativa preta com texto branco — fica elegante) e, no **dark mode**, trocar por uma superfície escura sutilmente elevada com texto claro e borda visível — exatamente o padrão "card destacado" do tema escuro.

Editar **apenas** a regra `.notion-tab-active` em `src/index.css`:

```css
.notion-tab-active {
  @apply bg-foreground text-background 
         dark:bg-muted dark:text-foreground dark:border-border;
}
```

Resultado no dark:
- Fundo: `hsl(var(--muted))` — cinza-escuro sutil, alinhado aos cards.
- Texto: `hsl(var(--foreground))` — claro mas não branco puro.
- Borda mantida (`border-border`) para reforçar que é a aba selecionada.

Isso conserta a aparência **em todas as 17+ páginas** que usam `.notion-tab` (Finanças, Rotina, Casa, Saúde, Hiperfoco, Pet, Detox, Beleza, Treino, Dieta, Estudos, Carreira, Viagens, Relacionamentos, Biblioteca, Desenvolvimento Pessoal, Index) — em uma única alteração.

## Arquivos alterados

- `src/index.css` — regra `.notion-tab-active` (3 linhas).
