## Mudança

Substituir a `WelcomeScreen` atual (tela única com headline + botão verde "Começar") por um **carrossel de 5 telas de onboarding** baseadas nos mockups enviados. Ao final da 5ª tela, o usuário é redirecionado para `/financas` — exatamente como hoje — e o tutorial existente (spotlight do Meu Financeiro, etc.) continua rolando normal, sem nenhuma alteração.

## As 5 telas (conteúdo dos mockups)

1. **Organize sua vida financeira em um só lugar** — ilustração com cards flutuantes (Receitas, Despesas, Investimentos, Desejos) + resumo do mês.
2. **Veja seu mês com clareza** — cards Receitas/Despesas/Saldo/Investimentos + alertas inteligentes + donut de gastos por categoria.
3. **Controle seus gastos e limites** — barras de progresso por categoria + chips de categorias populares.
4. **Planeje seus desejos e objetivos** — card de desejo (iPad) com Guardado/Falta, progresso, tempo estimado.
5. **Comece pela sua primeira receita** — mock de formulário "Nova receita" + botão preto **"Começar agora"**.

Cada tela tem:
- Wordmark **CORE** no topo
- Headline + subtítulo
- Mockup visual ilustrativo (estático, sem precisar puxar dados reais)
- Rodapé com: `Pular` / `Voltar` à esquerda, indicadores de página (dots), `Continuar` à direita (botão preto)
- Última tela: sem "Continuar", apenas o CTA grande preto `Começar agora`

## Comportamento

- `Continuar` avança para a próxima tela (animação slide horizontal com framer-motion)
- `Voltar` (telas 3–5) volta uma tela
- `Pular` (telas 1–2) e `Começar agora` (tela 5) → mesmo destino atual: `window.location.href = "/financas"`
- Link "Já tem uma conta? Entrar" permanece, posicionado de forma discreta (provavelmente só na 1ª tela, abaixo do rodapé, mantendo o fluxo de login intacto)
- Analytics: mantém `landing_view` no mount + `start_clicked` no CTA final; adiciona `onboarding_step_view` por tela (opcional, mesmo padrão de `trackEvent`)

## Arquivos

- **Editar** `src/components/WelcomeScreen.tsx` — transformar em carrossel de 5 slides. Mantém a mesma API (`onComplete`, `onLogin`) e mesmo redirect final, então `Inicio.tsx` e qualquer outro consumidor não mudam.
- Sub-componentes inline no mesmo arquivo (ou pasta `src/components/welcome/onboarding-slides/`) para cada um dos 5 mockups visuais — usando tokens do design system (`bg-card`, `text-foreground`, `--chart-1..5`, etc.), Inter, sem hex hardcoded, emojis só onde já aparecem nos mockups (nenhum nos headers).

## O que NÃO muda

- Tutorial (`QuickStartOnboarding`, spotlights, `spotlight-done-*`)
- Lógica de `activeTab` inicial em `Index.tsx` (continua "financeiro" durante tutorial, "dashboard" depois)
- Rotas, auth, `Inicio.tsx`
- Qualquer dado/feature de negócio
