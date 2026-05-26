## Objetivo

Adicionar 2 passos finais no tutorial de Finanças (último módulo do guest):

1. **Passo: clicar no botão de menu (☰)** — abre o drawer lateral
2. **Passo: clicar em "Minha conta"** — abre o modal de cadastro (nome / e-mail / senha)
3. Após criar a conta, o modal mostra uma tela de sucesso: **"Você ganhou 7 dias grátis pra testar o app"** + botão **"Aproveitar teste grátis"** → fecha o modal e o usuário fica no app normalmente.

Reaproveita componentes existentes (`AccountDrawer`, `QuickSignupModal`/`QuickSignupStep`) para evitar duplicação.

## Mudanças

### 1. `src/pages/Index.tsx`
- Adicionar `data-spotlight="menu"` no botão hambúrguer.
- Trocar o `onComplete` do `SpotlightOverlay`: em vez de redirecionar guest para `/auth?signup=1`, não faz nada (o cadastro acontece dentro do fluxo).
- Adicionar 2 steps no fim do array `steps`:
  - `{ selector: '[data-spotlight="menu"]', label: 'Toque no menu pra abrir suas opções.' }`
  - `{ selector: '[data-spotlight="minha-conta"]', label: 'Toque em "Minha conta" pra criar seu cadastro e liberar tudo.' }`

### 2. `src/components/home/AccountDrawer.tsx`
- Adicionar item **"Minha conta"** no topo da lista, com `data-spotlight="minha-conta"`.
- Comportamento: 
  - **Guest** (`isGuest === true`): fecha o drawer e seta `quicksignup-pending = "true"` → abre o `QuickSignupModal`.
  - **Logado**: abre o `NameEditDialog` (mesmo comportamento do atual "Editar nome").
- Para guest, ocultar itens que exigem login (assinatura, alterar senha, sair).

### 3. `src/components/onboarding/QuickSignupStep.tsx`
- Após `signUp` com sucesso e sessão criada, em vez de só fechar:
  - Trocar para uma **tela de sucesso interna** com:
    - Ícone/animação de check
    - Título: **"Você ganhou 7 dias grátis 🎉"**
    - Subtítulo curto explicando o teste
    - Botão grande: **"Aproveitar teste grátis"** → ao clicar, faz `set("quicksignup-pending", "")` e o modal fecha (usuário fica no /index logado).
- Marcar `spotlight-done-financas = "true"` para o tutorial não reabrir.

### 4. `src/components/onboarding/QuickSignupModal.tsx`
- Sem mudança lógica; só garantir que continua abrindo quando `quicksignup-pending === "true"` (já funciona).

## Pontos técnicos

- O `SpotlightOverlay` já bloqueia cliques em outros `[data-spotlight]` fora do passo atual (fix anterior), então o usuário não consegue burlar o fluxo.
- `advanceOnClick` (default true) avança o passo do menu ao clicar no botão; o próximo passo procura `[data-spotlight="minha-conta"]` dentro do `Sheet` aberto — o `SpotlightOverlay` já tem polling de 250ms que detecta o elemento assim que o drawer renderiza.
- Ao clicar em "Minha conta" o passo final completa, dispara `onComplete` (no-op pro guest) e marca `spotlight-done-financas`.
- O `QuickSignupModal` abre por cima como já abre hoje (`z-[100]`).
- Não toca em backend nem em rotas.

## Fora de escopo
- Nenhuma mudança em DB, edge functions ou auth.
- Nenhum refactor além do necessário.