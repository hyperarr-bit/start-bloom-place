## Objetivo

O tutorial (`src/components/WelcomeScreen.tsx`) hoje usa `max-w-sm` numa única coluna ocupando a tela toda — fica ótimo no celular mas vira uma fita estreita no meio do notebook/Mac/PC. Vou deixar responsivo cobrindo iPhone, Android, tablet, notebook e desktop, sem mexer no design mobile que você já aprovou.

## O que muda

Arquivo único: `src/components/WelcomeScreen.tsx`.

### Mobile (até `md`, ~768px) — inalterado
- Continua igual ao atual: coluna única, `max-w-sm`, CORE no topo, título → subtítulo → mock → dots/CTA embaixo. Animações iguais.

### Tablet / Notebook / Desktop (`md:` em diante)
- Container vira split-screen 2 colunas (`md:grid md:grid-cols-2`) ocupando a tela toda com `max-w-6xl` centralizado e `gap` generoso.
- **Coluna esquerda:** logo CORE no topo, título maior (`md:text-5xl lg:text-6xl`), subtítulo (`md:text-base`), dots de progresso e botões (Voltar / Continuar ou Começar agora) fixos na base da coluna. Link "Já tem conta? Entrar" também aqui no step 0.
- **Coluna direita:** apenas o `mock` do slide atual, centralizado verticalmente, com `max-w-md` e leve aumento de escala (`md:scale-110 lg:scale-125`) pra preencher o espaço sem distorcer o design dos cards.
- Padding lateral aumenta progressivamente (`md:px-12 lg:px-20`).

### Telas muito largas (`xl`/`2xl`)
- Trava em `max-w-6xl` para não esticar demais e mantém proporção agradável.

### Animações
- Mantém o `AnimatePresence`/stagger atual. As variantes funcionam igual nas duas colunas.

## Detalhes técnicos

- Wrapper externo continua `fixed inset-0 z-[100] bg-background overflow-hidden` com safe-area.
- Substituir o `flex flex-col w-full max-w-sm mx-auto` por estrutura responsiva:
  - mobile: `flex flex-col max-w-sm mx-auto`
  - md+: `grid grid-cols-2 max-w-6xl mx-auto items-center gap-12`
- Refatorar os blocos de navegação (botões + dots + link "Entrar") pra ficarem na coluna esquerda no md+ e no fluxo normal no mobile.
- Nenhuma mudança em lógica, analytics, estado, slides, mocks ou cores.

## Fora do escopo

- Não mudar copy, ícones, cores, animações ou estrutura dos mocks (slides 1–5).
- Não mexer em outros componentes (OnboardingWizard, PreSignupTutorial, etc.).
