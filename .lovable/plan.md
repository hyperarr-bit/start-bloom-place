## Pivot para app de Finanças

Mantém todo o código de outros módulos no repo (acessíveis só por URL direta), mas remove qualquer entrada visível pra eles. O usuário entra → cai direto em `/financas`. Sem Home, sem escolha de módulo.

---

### 1. Roteamento e entrada do app (`src/App.tsx`)

- Rota `/` deixa de renderizar `Home` e passa a redirecionar para `/financas` (`<Navigate to="/financas" replace />`), mantendo `allowGuest`.
- `Home.tsx` continua no repo (não apagar), só sai do roteamento principal.
- `QuickSignupModal` continua disparando, mas após cadastro vai pra `/financas` (já é hoje, confirmar).

### 2. Landing / Welcome (`src/components/WelcomeScreen.tsx`)

- Subtítulo: trocar de _"Organize sua vida — finanças, treino, dieta e rotina — em um só lugar."_ para **"Organize sua vida financeira."**
- Título `Bem-vindo ao CORE` mantém.
- Botão `Quero começar` mantém o texto.

### 3. Tutorial pré-signup → eliminado

O usuário não quer mais a tela de slides antes do cadastro. Fluxo novo:

```text
Landing "Quero começar"  →  Tela de cadastro (Nome, Email, Senha)  →  /financas (com tutorial spotlight)
```

- Em `WelcomeScreen.handleStart`: em vez de abrir `PreSignupTutorial`, navega direto para `/auth?signup=1`.
- `PreSignupTutorial.tsx` permanece no repo mas deixa de ser usado.
- `QuickStartOnboarding` (escolha de módulo) também sai do fluxo — não roda mais.

### 4. Cadastro com Nome (`src/pages/Auth.tsx`)

- Adicionar campo **Nome** no modo signup (acima do email).
- Email e Senha já existem; rótulo do email vira "Email" (placeholder pode sugerir Gmail, sem validação restritiva — qualquer provedor passa).
- Após `signUp(email, password, { data: { full_name: nome } })`, salvar nome via `useUserData().set("user-name", nome)` e navegar pra `/financas`.
- Login normal também redireciona pra `/financas` em vez de `/`.

### 5. Tutorial spotlight de Finanças expandido (`src/pages/Index.tsx`)

Hoje tem 5 passos só na aba "Meu Financeiro". Expandir cobrindo mais abas com profundidade:

```text
1. Dashboard          → "Aqui você vê sua saúde financeira geral."
2. Tab Financeiro     → "Abra Meu Financeiro."
3. Add Receita        → "Adicione sua receita (salário, freelas…)."   [advanceOnAction]
4. Add Custo Fixo     → "Cadastre um custo fixo (aluguel, internet…)." [advanceOnAction]
5. Add Conta          → "Adicione 1 conta no vencimento."              [advanceOnAction]
6. Add Nota           → "Escreva uma anotação financeira."             [advanceOnAction]
7. Tab Investimentos  → "Acompanhe seus investimentos aqui."
8. Add Investimento   → "Cadastre seu primeiro aporte."                [advanceOnAction]
9. Tab Desejos        → "Liste o que quer comprar e priorize."
10. Add Desejo        → "Adicione um item da sua wishlist."            [advanceOnAction]
11. Tab Metas         → "Defina metas de economia e acompanhe."
12. Tab Relatórios    → "Veja relatórios mensais automáticos."
13. Tab Saúde         → "Acompanhe sua saúde financeira em um índice."
```

Para passos que mudam de aba, o spotlight precisa fazer `setActiveTab(...)` antes do passo aparecer. Implementar via callback `onStepEnter` no `SpotlightOverlay` (ou ajustando os steps para incluir `tab`).

Adicionar `data-spotlight="..."` nos botões/tabs/itens correspondentes em:
- tabs do header (`investimentos`, `desejos`, `metas`, `relatorios`, `saude`)
- botões "Adicionar" em `InvestmentsTracker`, `WishlistItems`

### 6. Esconder outros módulos da UI

- `GreetingHeader` / `ModuleDrawer` / `QuickActions` não rodam mais (Home fora do fluxo).
- `Inicio.tsx` continua pra rota `/inicio` (landing pra deslogado) — apenas o conteúdo do `WelcomeScreen` com copy nova.
- Não tocar nas páginas dos outros módulos.

### 7. O que NÃO mudar

- Nenhuma página de módulo além de Finanças.
- Nenhuma tabela do Supabase.
- Admin, analytics, billing, edge functions.
- Visual identity (cores, fontes, ícones).

---

### Detalhes técnicos

**App.tsx**: substituir
```tsx
<Route path="/" element={<ProtectedRoute allowGuest><PageTransition><Home /></PageTransition></ProtectedRoute>} />
```
por
```tsx
<Route path="/" element={<Navigate to="/financas" replace />} />
```

**SpotlightOverlay**: adicionar suporte opcional a `onEnter?: () => void` em cada step, chamado quando o passo vira ativo (antes de medir o `rect`). Isso permite trocar de aba antes do spotlight procurar o elemento.

**Auth.tsx**: estado `name`, input controlado, validação simples (não vazio em signup), passar `options.data.full_name` no `supabase.auth.signUp`. Salvar também em `user_data` pra usar no app.

**Persistência do tutorial**: `spotlight-done-financas` continua sendo a chave única (não regerar pra usuários atuais, a menos que o usuário queira — confirmar se quer replay forçado pra todo mundo).
