## Objetivo

Transformar `src/components/AccessGateUI.tsx` (a tela que aparece quando o usuário abre o site dentro do WebView do TikTok) em uma mini landing page mobile-first de alta conversão, mantendo o gate de "abrir no navegador" mas com cara de produto, não de erro.

## Arquivo afetado

- `src/components/AccessGateUI.tsx` — redesign completo do JSX e estilos. Nada mais é tocado (a detecção de TikTok em `App.tsx`, `useIsTikTokBrowser` e `pages/Acesso.tsx` continuam idênticos).

## Estrutura da nova tela (de cima pra baixo)

1. **Top bar** — logo Core pequena e centralizada (usa `coreLogo` / `coreLogoBlack` conforme o tema, como já faz hoje).
2. **Seta animada** discreta no canto superior direito apontando pros 3 pontinhos do TikTok — menor que a atual, com `animate-pulse` sutil, sem o halo grande.
3. **Headline** (forte, tracking apertado):
   "Controle sua vida financeira em um só app"
4. **Subheadline** (muted-foreground, 1–2 linhas):
   "Receitas, despesas, investimentos, desejos e limites em um painel simples para você saber exatamente para onde seu dinheiro está indo."
5. **3 cards de benefícios** empilhados, compactos, fundo `bg-card`, borda sutil, sombra leve, ícone Lucide pequeno à esquerda + título + descrição:
   - Veja quanto entra e sai — Acompanhe receitas e despesas sem se perder.
   - Saiba quanto ainda pode gastar — Defina limites e evite passar do ponto.
   - Transforme dinheiro em objetivos — Crie desejos e acompanhe suas metas.
6. **Bloco de instrução** com título "Para acessar o Core, abra pelo navegador do celular:" e dois passos numerados (1 e 2) no mesmo estilo dos atuais, mais compactos:
   - Passo 1: Toque nos ••• no canto superior direito
   - Passo 2: Escolha "Abrir no navegador"
7. **Botão principal preto**, largura total, arredondado, peso forte:
   "Toque nos 3 pontos para continuar"
   (mantém o `<a href={url}>` para preservar o gesto "pressione e segure" como fallback nativo do WebView)
8. **Microcopy abaixo** em `text-muted-foreground` pequeno:
   "O TikTok pode limitar o carregamento completo. No navegador do celular, o Core abre normalmente."
9. **Link "Copiar link"** discreto no final (mantém a funcionalidade `handleCopy` existente, só visual mais sutil).

## Regras de design

- Mobile-first, container `max-w-sm mx-auto`, padding lateral `px-5`.
- Fundo `bg-background` (respeita o tema claro/escuro do app, mantendo a identidade Core — não força branco hardcoded).
- Tipografia: headline `text-2xl font-bold tracking-tight leading-tight`, subheadline `text-sm text-muted-foreground`.
- Cards: `rounded-xl border border-border bg-card shadow-sm p-3`, com ícone Lucide em círculo `bg-muted`.
- Botão: `rounded-full bg-foreground text-background py-3.5 font-semibold text-sm`.
- Espaçamento compacto (`space-y-4` / `gap-3`) para a primeira dobra do iPhone caber tudo até o botão. Página continua scrollável para o microcopy e o "copiar link".
- Sem emojis, sem cara de erro, sem promessa "100% grátis".
- Seta: ícone `ArrowUp` pequeno num círculo `bg-primary` no canto superior direito com `animate-pulse`, sem o halo grande atual.

## Detalhes técnicos

- Mantém imports atuais (`MoreHorizontal`, `Link2`, `ArrowUp`, `toast`, logos, `useTheme`).
- Adiciona ícones Lucide para os 3 benefícios: `Wallet`, `Gauge`, `Target` (ou similares).
- Mantém `handleCopy`, `url`, e a lógica de logo por tema.
- Usa apenas tokens semânticos (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-foreground`, `text-background`) — zero cores hardcoded, respeitando a memória do projeto.
- Nenhuma mudança em rotas, hooks, ou outros componentes.