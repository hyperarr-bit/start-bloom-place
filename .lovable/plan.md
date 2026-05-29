Vou ajustar o tutorial inicial para não cortar o conteúdo do mock nos celulares menores.

Plano:
1. No `WelcomeScreen.tsx`, remover a lógica visual que depende de `overflow-hidden` para esconder o excesso do mock no mobile.
2. Envolver o mock do slide em um container com escala responsiva por altura da tela:
   - telas normais: escala 1;
   - telas menores: escala reduzida progressivamente;
   - telas muito baixas: escala mais forte, mantendo o botão e navegação visíveis.
3. Aplicar `transform-origin: top center` e reservar altura ajustada para o mock, para ele diminuir sem empurrar o botão para fora.
4. Reduzir levemente espaços verticais, título e subtítulo apenas em telas baixas, sem mexer no layout desktop.
5. Manter o tracker de tutorial/dropoff já implementado sem alteração.

Resultado esperado: em Android menor, o tutorial mostra o slide inteiro reduzido em vez de cortar a parte de baixo, e o botão “Continuar” fica sempre acessível.