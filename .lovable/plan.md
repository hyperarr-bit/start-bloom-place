## Problema

Na tela `/inicio` (`WelcomeScreen`), os botões **"Começar"** e **"Entrar"** só funcionam após recarregar a página. Isso acontece principalmente quando o app é aberto pelo navegador interno do Instagram (visível no print: `Instagram` no topo). In-app webviews engolem o primeiro `onClick` que dispara `navigate()` programático do React Router, especialmente quando há um `<video autoPlay>` competindo pela atenção do gesture handler.

## Causa raiz

1. Os botões usam `onClick={() => navigate("/auth")}` — navegação puramente programática. Webviews do Instagram/TikTok costumam ignorar o primeiro gesto se o JS ainda está hidratando ou se outro elemento (o `<video>`) acabou de receber foco.
2. Há uma camada `absolute inset-0` sobre o vídeo com `pointerEvents: "auto"` e `touchAction: "none"` que captura todos os pointer events da área do iPhone — não cobre os botões diretamente, mas indica que a página luta contra o WebView por controle de toque.
3. Não há `type="button"` nos `<button>` (não crítico aqui, mas boa prática).

## Plano

**Arquivo:** `src/components/WelcomeScreen.tsx`

1. Trocar o `<button>` "Começar" e o `<button>` "Já tem uma conta? Entrar" por componentes `<Link>` do `react-router-dom` (renderizam `<a href>` real). Isso faz o WebView tratar como navegação nativa de link, que funciona no primeiro toque.
   - "Começar" → `<Link to="/auth?signup=1">`
   - "Entrar" → `<Link to="/auth">`
2. Manter exatamente as mesmas classes/estilos visuais.
3. Remover as props `onComplete` e `onLogin` do `WelcomeScreen` (ou mantê-las opcionais para não quebrar outros usos — verificar `Inicio.tsx`).

**Arquivo:** `src/pages/Inicio.tsx`

4. Simplificar para apenas `<WelcomeScreen />` já que a navegação passa a ser feita via `<Link>` interno.

## Detalhes técnicos

- `<Link>` do React Router intercepta o clique e chama `navigate` internamente, mas como o elemento subjacente é `<a href>`, o WebView reconhece o gesto e a navegação acontece no primeiro toque mesmo se o JS estiver ocupado.
- Nenhuma alteração em rotas, auth ou lógica de negócio.
- Nenhum impacto visual.

## Fora do escopo

- Não vou mexer no vídeo, no autoplay, nem no overlay do iPhone mockup.
- Não vou alterar `/auth` nem o fluxo de signup/login.
