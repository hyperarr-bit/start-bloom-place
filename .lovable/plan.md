## Objetivo

Detectar quando o app está rodando dentro do navegador in-app do TikTok (que tem bugs conhecidos com PWA/Supabase/cookies/storage) e mostrar um overlay tela cheia explicando, com identidade visual do app, como abrir no navegador padrão (Safari/Chrome) via os 3 pontinhos do topo.

## Como detectar TikTok

UserAgent contém uma destas marcas (case-insensitive):
- `musical_ly`
- `Bytedance`
- `TikTok`
- `BytedanceWebview`

Hook novo: `src/hooks/use-in-app-browser.ts` → retorna `{ isTikTok: boolean }`. SSR-safe (checa `typeof navigator`).

## Componente do overlay

Novo: `src/components/TikTokBrowserGate.tsx`

Estrutura (segue identidade visual — Inter, tokens semânticos, sem hex hardcoded, ícones Lucide):

- `fixed inset-0 z-[100] bg-background` cobrindo tudo (bloqueia interação com o app atrás).
- Centro:
  - Ícone `AlertCircle` (text-amber-500 via token) no topo.
  - Título: "Abra no seu navegador" (text-lg font-bold).
  - Subtítulo curto: "O navegador do TikTok não funciona bem com o app. Em 2 cliques você abre direto no Safari/Chrome e cai na tela de Finanças."
- Bloco de instrução visual (card com border, rounded-lg, p-4):
  - Passo 1: ícone `MoreHorizontal` + "Toque nos 3 pontinhos no canto superior direito"
  - Passo 2: ícone `ExternalLink` + "Escolha 'Abrir no navegador' (ou 'Open in browser')"
  - Seta animada (CSS pulse) apontando pra cima-direita, mimetizando o vídeo.
- Botão secundário pequeno embaixo, em `text-muted-foreground text-xs underline`: "Copiar link" — copia `window.location.href` (com `?from=tiktok` removido e `/financas` como path) pro clipboard, com toast "Link copiado, cole no navegador".
- Sem botão "continuar mesmo assim" (conforme escolha do usuário).

## Onde montar

`src/App.tsx`, no topo do `<BrowserRouter>` (ou logo dentro do root, antes das rotas), renderizar `<TikTokBrowserGate />`. O componente decide sozinho se aparece (early return `null` quando `!isTikTok`).

Como cobre `inset-0 z-[100]`, fica por cima de qualquer rota — inclusive `/financas` pra onde o `RootGate` já redireciona.

## Link a divulgar no TikTok

A bio do TikTok deve apontar pra `https://coreaplicativo.lovable.app/financas` (ou `/` que já redireciona pra `/financas`). Nada muda no roteamento — o redirect atual já cobre.

## O que NÃO muda

- Nenhuma alteração em `WelcomeScreen`, `Index`, spotlight, auth.
- Nenhuma alteração em rotas além de montar o gate global.
- Sem dependências novas.

## Verificação

1. Abrir preview com DevTools → Network conditions → custom UA contendo `musical_ly` → overlay aparece.
2. UA normal → overlay não aparece, app funciona igual.
3. Botão "Copiar link" copia URL correta e mostra toast.

## Limitações honestas

- iOS: não dá pra forçar abertura no Safari programaticamente. O overlay com instrução é a melhor solução possível.
- Android: também não conseguimos abrir externo via `intent://` de dentro do webview do TikTok de forma confiável. Mesma estratégia.
- Por isso o overlay manual é o caminho — é o que apps grandes (Spotify, Notion, etc.) fazem nessa situação.
