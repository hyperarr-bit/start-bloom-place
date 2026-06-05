# Plano: Varredura geral + Redesign de Planos

## Parte 1 — Varredura de bugs e responsividade

Vou rodar uma checagem completa em:

1. **Fluxo principal de onboarding** (após as últimas mudanças):
   - `Index` (picker dos 4 módulos) em 320px, 375px, 430px, tablet e desktop
   - `SpotlightOverlay` (16 módulos em Finanças, e os tutoriais de Dieta/Rotina/Metas)
   - `QuickStartOnboarding` (picker)
   - `DesenvolvimentoPessoal` (novo spotlight de motivação + meta)
   - Fluxo guest → quicksignup → trial → home

2. **Páginas-chave** (verificar overflow, header sobrepondo conteúdo, botão voltar, safe-area iOS):
   - Home, Finanças, Dieta, Rotina, Desenvolvimento, Planos, Auth

3. **Sinais a checar**: console errors, network 4xx/5xx, runtime errors, layout quebrado em 320px (menor mobile), elementos clicáveis cortados.

4. **Correções pontuais** apenas dos bugs encontrados — sem refactor além do necessário.

## Parte 2 — Redesign da tela `/planos`

Estado atual (`src/pages/Planos.tsx`): card único com 5 features só de Finanças, toggle mensal/anual, badge -74%.

### Mudanças

**Lista de benefícios completa** agrupada por módulo (com ícone Lucide pequeno na frente de cada grupo), cobrindo todos os 16 módulos do app:
- 💰 Finanças: receitas, despesas, contas fixas, dívidas, investimentos, metas, desejos
- 🥗 Dieta: planos alimentares, calorias, receitas, lista de compras
- 💪 Treino: rotinas, progressão, registro
- 📅 Rotina: hábitos, agenda, lembretes
- 🎯 Desenvolvimento: motivações, metas pessoais
- 🏠 Casa, ✈️ Viagens, 📚 Estudos, 🧠 Hiperfoco, 💼 Trabalho, 🛒 Lista, 📊 Relatórios, ⚙️ Configurações, 🔔 Notificações, 📈 Patrimônio, 🎁 Recompensas

(Vou ler quais são exatamente os 16 módulos ativos no `Home.tsx` / config dos módulos antes de finalizar a lista para não inventar.)

**Visual mais bonito** mantendo o design system (tokens, sem hex hardcoded):
- Header com gradiente sutil usando `--primary`
- Card do plano com borda gradiente + glow leve (sombra com `--primary`)
- Ícone Crown maior, tipografia da headline em 2 níveis ("Acesso completo" / "Tudo em um só app")
- Toggle mensal/anual mantido, mas com badge "Mais escolhido" no anual
- Preço com risco no valor cheio quando anual (R$ ~~14,90~~ por **R$ 3,90/mês**)
- Lista de módulos em grid 2 colunas no mobile (ícone + nome curto), com seção "E muito mais" listando features detalhadas em accordion/expand
- CTA grande sticky no rodapé no mobile para não exigir scroll
- Indicadores de confiança abaixo do CTA: "Cancele quando quiser • Sem fidelidade • 7 dias grátis"

**Sem mexer** em: lógica de checkout, winback, cancel flow, billing toggle behavior, rotas.

### Arquivos afetados
- `src/pages/Planos.tsx` (redesign visual + nova lista de benefícios)
- Possíveis pequenos fixes em arquivos onde a varredura encontrar bugs (a confirmar durante execução)

## Pergunta antes de implementar

Confirma que posso prosseguir com:
- (a) varredura + correções de bugs encontrados
- (b) redesign de Planos com benefícios de todos os módulos como descrito acima

Ou prefere que eu faça só uma das duas partes primeiro?
