## Objetivo

Reformular a página `/admin/tutorial-inicial` para mostrar **todas** as etapas do funil de onboarding (da primeira visita até aceitar os 7 dias grátis), com números absolutos, % de conversão em relação ao passo anterior e % de drop, no lugar do funil atual que só tem landing + 5 slides + start_clicked.

## Etapas do funil que serão exibidas

Todas baseadas nos eventos que **já** são disparados em `analytics_events` hoje (nenhum tracking novo precisa ser adicionado):

1. **Abriu a landing inicial** — `landing_view` sem `source=quickstart`
2. **Iniciou o tutorial "Quero começar"** — `pre_signup_tutorial_started`
3. **Slide 1 — Tenha controle da sua vida financeira** — `pre_signup_tutorial_step` step=1
4. **Slide 2 — Veja seu mês com clareza** — step=2
5. **Slide 3 — Controle seus gastos e limites** — step=3
6. **Slide 4 — Planeje seus desejos e objetivos** — step=4
7. **Slide 5 — Comece pela sua primeira receita** — step=5
8. **Clicou em "Quero começar"** — `start_clicked`
9. **Entrou em "Por onde você quer começar?"** — `landing_view` com `source=quickstart`
10. **Clicou em um módulo** — `quickstart_module_chosen` (com breakdown por módulo: Finanças, Dieta, Rotina, Desenvolvimento Pessoal)
11. **Entrou no módulo (tutorial abriu)** — `spotlight_shown` (com breakdown por módulo)
12. **Fez passo 1, 2, 3, … do módulo** — `spotlight_step_view` agrupado por `step` (com breakdown por módulo)
13. **Finalizou o módulo** — `quickstart_completed` (com breakdown por módulo)
14. **Form de cadastro apareceu** — `quicksignup_step_shown`
15. **Terminou o form / Aceitou os 7 dias grátis** — `quicksignup_completed`

## Layout da página

- Mantém os filtros de período que já existem (1h, Hoje, 24h, 7d, 30d, Tudo, Dia+Hora).
- **Seção 1 — Funil macro:** lista vertical das 15 etapas acima, cada linha com:
  - Nome da etapa (descritivo, em português, igual ao que o usuário pediu)
  - Número absoluto de pessoas únicas
  - % em relação à etapa anterior (verde se ≥80%, vermelho se <80%)
  - % em relação ao topo do funil (passo 1)
  - Barra de progresso proporcional
- **Seção 2 — Detalhe por módulo:** tabela com uma linha por módulo (Finanças, Dieta, Rotina, Desenvolvimento Pessoal) e colunas:
  - Clicou no card
  - Tutorial abriu
  - Passo 1, Passo 2, Passo 3, … (colunas dinâmicas conforme `max(step)` daquele módulo)
  - Finalizou
  - % conclusão (finalizou / clicou)
- **Seção 3 — Conversão final:** card destacando "Form apareceu → Form terminado → Aceitou 7 dias" com os 3 números e as 2 taxas de conversão.

## Mudanças técnicas

- **Nova RPC `admin_onboarding_funnel(_from, _to)`** (migration) que devolve JSON com:
  - `macro`: array das 15 etapas `{ key, label, users }` (distinct user_id, com fallback pra session_id quando user_id é null — guests).
  - `by_module`: array `{ module, clicked, tutorial_opened, steps: [{step, users}], completed }` para cada um dos 4 módulos.
- A RPC substitui `admin_pre_signup_funnel`, que continuará existindo só para compat se for usada em outro lugar (vou verificar — se for só nessa página, removo).
- `AdminTutorialInicial.tsx` reescrito pra consumir a nova RPC e renderizar as 3 seções.
- Sem mudanças em código de tracking (eventos já existem todos).

## Detalhes técnicos

```text
Seção 1 (exemplo de linha):
┌─────────────────────────────────────────────────────────────────┐
│ 👁  Abriu a landing inicial             1.240   100%   ▓▓▓▓▓▓▓▓ │
│ ▶  Iniciou o tutorial "Quero começar"   1.180    95%   ▓▓▓▓▓▓▓░ │
│ 📄 Slide 1 — Tenha controle...          1.120    94%   ▓▓▓▓▓▓▓░ │
│ ...                                                              │
│ 🎯 Aceitou os 7 dias grátis                85     71%   ▓░       │
└─────────────────────────────────────────────────────────────────┘

Seção 2:
Módulo        Clicou  Tutorial  P1   P2   P3   P4   Finalizou  Conv%
Finanças       420     410      390  370  340  310    290        69%
Dieta          180     175      ...
Rotina         150     ...
Desenv. Pess.  120     ...
```

Pessoas únicas = `count(distinct coalesce(user_id::text, session_id))` filtrado pela janela de tempo escolhida nos filtros.
