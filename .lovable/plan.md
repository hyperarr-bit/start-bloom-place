## Escopo

Apenas o layout **mobile** do `WelcomeScreen.tsx` (`md:hidden`). Desktop, slides em si, mocks, tracking e backend ficam inalterados.

## Mudanças

1. **Layout editorial nos slides 2–5 (mobile)**: hoje só o slide 0 usa "mock em cima, hero embaixo". Aplicar o mesmo padrão nos slides 1–4 (índice), removendo o branch que coloca título → subtítulo → mock. Nova ordem para todos os slides:

   ```text
   CORE (centralizado)
   [mock do slide]
   Título
   Subtítulo
   ─────────────
   dots
   botão CTA full-width
   "Já tem uma conta? Entrar" (só slide 0)
   ```

   O `SlideOneHero` deixa de existir como caso especial — o texto hero do slide 0 vira o mesmo bloco `h1`/`p` usado pelos outros (lendo `current.title`/`current.subtitle`), e o mock do slide 0 passa a ser apenas a área visual (4 mini cards + Resumo do mês) sem o texto embutido.

2. **Centralização**: 
   - Logo `CORE`: trocar de left-align para `text-center` (remover `mb-3` solto, manter no fluxo centralizado, container `items-center`)
   - Título e subtítulo: `text-center`, container `items-center`
   - Botão CTA: já full-width no slide 0; padronizar **todos** os slides (incluindo "Continuar" e "Começar agora") como botão full-width pill `h-[56px] rounded-full bg-foreground text-background` centralizado
   - Dots: centralizados acima do CTA em todos os slides (já é o caso no slide 0; replicar)
   - Link "Voltar": vira link pequeno centralizado abaixo do CTA (em vez de na mesma linha dos dots)

3. **Unificar o bloco de navegação mobile**: um único bloco `nav` para todos os slides com a estrutura: dots centralizados → CTA full-width → (Voltar OU Entrar). Remove a duplicação atual entre `step === 0` e o `nav` desktop reaproveitado.

## Fora de escopo

- Desktop (`md:grid`) — sem mudanças
- Conteúdo dos mocks, textos, tracking, rotas, `useUserData`
- Slides do tutorial admin ou qualquer outro componente
