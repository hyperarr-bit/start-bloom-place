# Reformulação do Admin — foco no módulo Finanças

## O que sai

- `AdminDashboard.tsx` (a tela "Hoje" / visão geral) — removida da navegação e do arquivo.
- Itens da sidebar que não fazem mais sentido com um único módulo: **Dashboard, Aquisição, Tutorial (compare), Analytics, Conversão, Ativação, Onboarding, Funil módulos**.
- Rota raiz `/admin/*` passa a redirecionar para `/admin/funil`.

## O que fica

Sidebar enxuta:
- **Funil** (nova, padrão)
- **Usuários**
- **E-mails**
- **Churn**
- **Retention**

## Nova aba: Funil (única visão)

Uma página só, com filtro de período (7 / 30 / 90 dias) no topo, dividida em duas seções verticais:

### 1. Funil de aquisição (landing → trial)

Barras horizontais com contagem absoluta + % de conversão entre etapas:

```text
Landing "Tenha controle da sua vida financeira"   ████████████ 1.240
Clicaram em "Começar grátis"                      ████████ 820 (66%)
Iniciaram o tutorial pré-cadastro                 ███████ 710 (87%)
Terminaram o tutorial pré-cadastro                ██████ 540 (76%)
Criaram conta                                     █████ 410 (76%)
```

Fontes (já existem no banco):
- `landing_view`, `start_clicked`, `pre_signup_tutorial_started`, `pre_signup_tutorial_completed` em `analytics_events`
- Cadastros em `auth.users`
- RPC base: `admin_landing_funnel(_days)` — já retorna todos esses campos.

### 2. Funil do tutorial do módulo Finanças (passo a passo)

Lista vertical de passos com o label real de cada passo do spotlight (ex.: "Receitas", "Despesas fixas", "Vencimentos", "Investimentos", "Desejos"…), mostrando:

- Quantos usuários chegaram naquele passo
- % vs. passo anterior
- **Drop-off destacado em vermelho** quando a queda é > 20% (assim fica claro "saíram no passo de investimentos")
- Linha final: "Concluíram o tutorial" (`quickstart_completed`)

Fonte: RPC `admin_tutorial_dropoff(_days)` já existente — retorna `modules[].steps[{ step, label, total, reached }]`. Vamos filtrar só `module_id = 'financas'`.

## Detalhes técnicos

- Arquivo novo: `src/pages/admin/AdminFinanceFunnel.tsx` consumindo as duas RPCs em paralelo.
- `AdminLayout.tsx`: limpar `navItems`, manter apenas as 5 abas acima.
- `App.tsx` (ou onde estão as rotas admin): remover rotas mortas, apontar `index` de `/admin/*` para `<Navigate to="funil" />`, adicionar `<Route path="funil" element={<AdminFinanceFunnel />} />`.
- Deletar arquivos não usados: `AdminDashboard.tsx`, `AdminAnalyticsPage.tsx`, `AdminConversion.tsx`, `AdminActivation.tsx`, `AdminOnboarding.tsx`, `AdminTutorialCompare.tsx`, `AdminLandingFunnel.tsx`, `AdminFunnel.tsx` (o antigo de módulos).
- Sem migrations — todas as RPCs necessárias já existem.
- Estilo visual mantém o dark zinc + accent emerald do admin atual.

## Pergunta rápida antes de implementar

Confirma que posso **deletar fisicamente** os arquivos das telas removidas (Dashboard, Analytics, Conversão, Ativação, Onboarding, Tutorial Compare, Aquisição, Funil de módulos)? Ou prefere que eu só tire da sidebar e deixe os arquivos parados?