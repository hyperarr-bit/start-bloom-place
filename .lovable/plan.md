Plano para corrigir o bug do modo escuro no Android:

1. Ajustar a base global do tema
- Garantir que `html`, `body` e `#root` sempre herdem `color: hsl(var(--foreground))`.
- Fixar `color-scheme: light` no modo claro e `color-scheme: dark` no modo escuro para o Chrome Android não aplicar cores nativas erradas em inputs, selects e textos.

2. Corrigir o carregamento inicial do tema
- Atualizar o script inicial de tema para aplicar também `color-scheme` antes do React carregar.
- Manter sincronizado com o hook `use-theme` para quando o usuário alternar claro/escuro.

3. Ajustar textos/componentes que dependem de cor padrão
- Revisar componentes visíveis no Android, principalmente `ThemeToggle`, tabs e blocos como Rotina/ModuleTip, para usar `text-foreground` ou tokens semânticos em vez de depender da cor padrão do navegador.
- Não alterar layout nem funcionalidades.

4. Validar no viewport móvel
- Conferir no tamanho mobile atual que modo claro continua legível e modo escuro não fica com textos pretos desaparecendo.