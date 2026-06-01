## Bugs / ajustes

**1. Tela de Finanças renderiza por trás (spotlight "PASSO 2 DE 11" vaza por cima)**

Hoje o `TikTokBrowserGate` é um overlay `fixed inset-0 z-[100]`, mas o resto do app (rotas, `RootGate` → `/financas`, spotlight tutorial) continua montado por baixo. O spotlight usa portal/z-index alto e fura o overlay.

Correção: detectar TikTok bem no topo do `App` e, quando for TikTok, **renderizar APENAS** a `AccessGateUI` — sem `BrowserRouter`, sem `UserDataProvider`, sem Financas, sem spotlight. Nada do app monta.

```tsx
// src/App.tsx (esqueleto)
const App = () => {
  const { isTikTok } = useIsTikTokBrowser();
  if (isTikTok) {
    return (
      <ThemeProvider>
        <Sonner />
        <AccessGateUI />
      </ThemeProvider>
    );
  }
  // ...resto igual (sem o <TikTokBrowserGate /> que existe hoje)
};
```

Mantém a rota `/acesso` igual (renderiza `AccessGateUI` direto, sem providers pesados que importam) — independe da detecção.

**2. Seta apontando pros 3 pontinhos (estilo Porquim, mas na cor do Core)**

Adicionar no canto superior direito da `AccessGateUI`:
- Círculo grande com fundo `bg-muted` (cinza claro do tema), posicionado `absolute top-0 right-0`, formato meio-círculo (raio grande) saindo da borda — igual o verde do Porquim.
- Dentro, `ArrowUp` (Lucide) em `text-foreground`, com `animate-bounce` leve.
- Sem texto "3 pontinhos" embaixo (Porquim não tem, fica mais limpo).

Cor: tokens semânticos (`bg-muted` + `text-foreground`), nada de verde nem hex.

**3. Copy**

Trocar título + subtítulo por:

- Título: `Para ter acesso ao site do CORE, siga esses 2 passos`
- Remover o subtítulo "Pra ter a melhor experiência..."

Logo CORE continua acima do título.

## Arquivos

- `src/App.tsx` — adicionar early return no topo quando `isTikTok`; remover `<TikTokBrowserGate />` do meio da árvore (não precisa mais, vira redundante).
- `src/components/AccessGateUI.tsx` — adicionar seta no canto, trocar copy, remover subtítulo.
- `src/components/TikTokBrowserGate.tsx` — pode deletar (não é mais usado) ou deixar como wrapper fino caso queira reusar em outro lugar. Sugiro deletar pra não confundir.

## Verificação

1. Simular UA do TikTok no DevTools → só vê a gate, sem nenhum tooltip/spotlight vazando.
2. `/acesso` em navegador normal → mesma tela.
3. UA normal → app funciona igual, sem overlay.
