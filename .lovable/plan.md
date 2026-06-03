## O que fazer

Remover completamente a tela "Abrir no navegador" que aparece dentro do TikTok. O app vai carregar normalmente no webview do TikTok, indo direto para `/financas` (passo 1 — adicionar receita), igual a qualquer outro navegador.

## Mudanças

**`src/App.tsx`**
- Remover o import de `useIsTikTokBrowser` e `AccessGateUI`.
- Remover o bloco `if (isTikTok) return <AccessGateUI />` no componente `App`.
- O app passa a renderizar o fluxo normal (`QueryClientProvider` → `BrowserRouter` → rotas) independentemente do user-agent.

**Não mexer em:**
- `src/components/AccessGateUI.tsx` — fica no projeto (ainda é usado pela rota `/acesso` caso você queira linkar manualmente no futuro).
- `src/pages/Acesso.tsx` e a rota `/acesso` — ficam intactas.
- `src/hooks/use-in-app-browser.ts` — fica no projeto, só não é mais chamado.

## Resultado

Quando o usuário abrir o link do TikTok, o webview carrega direto `/financas` com o tutorial no passo 1, sem nenhuma tela intermediária pedindo para abrir no navegador.
