## Objetivo
Inserir o script da UTMify (`https://cdn.utmify.com.br/scripts/utms/latest.js`) na primeira página que o usuário acessa (landing `/inicio` — "Organize sua vida em 1 só lugar" com botão "Quero começar"), sem que o script apareça na UI ou cause regressões.

## Análise
- A landing page é a rota `/inicio`, renderizada pelo componente `WelcomeScreen.tsx`.
- Scripts de rastreamento de UTM precisam carregar o mais cedo possível na primeira visualização (PV) para capturar corretamente os parâmetros de origem antes de qualquer redirecionamento ou navegação interna.
- O script possui `async` e `defer`, portanto não bloqueia o parsing nem o render da página.

## Plano de implementação
1. **Inserir o script no `index.html`** dentro do `<head>`, logo após os metas/title e antes de fechar `</head>`.
   - Garante carregamento imediato em qualquer página que seja a primeira visualizada (PV).
   - É invisível para o usuário.
   - Não depende do React montar para executar.
   - `async` + `defer` evita qualquer impacto no tempo de carregamento percebido.

2. **Manter os atributos exatos** fornecidos pelo usuário:
   ```html
   <script
     src="https://cdn.utmify.com.br/scripts/utms/latest.js"
     data-utmify-prevent-xcod-sck
     data-utmify-prevent-subids
     async
     defer
   ></script>
   ```

## O que NÃO será alterado
- Nenhum componente React.
- Nenhuma lógica de routing, theming ou analytics existente.
- Nenhum estilo ou layout da landing page.

## Validação
- Recarregar a preview e confirmar no DevTools (aba Network ou Elements) que a requisição para `cdn.utmify.com.br` aparece sem erros 404/403.
- Confirmar que a landing page continua renderizando normalmente e o botão "Quero começar" funciona.