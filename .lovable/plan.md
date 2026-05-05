## Plano: Rota `/inicio` separada

### 1. Criar `src/pages/Inicio.tsx`
Página pública que renderiza `WelcomeScreen`:
- Botão "Começar" → `navigate("/auth?signup=1")`
- Botão "Entrar" → `navigate("/auth")`

### 2. Atualizar `src/App.tsx`
Adicionar rota pública `/inicio` (fora do `ProtectedRoute`, junto com `/auth`):
```tsx
<Route path="/inicio" element={<PageTransition><Inicio /></PageTransition>} />
```

### 3. Atualizar `src/pages/Auth.tsx`
- Remover import `WelcomeScreen`
- Remover estado `showWelcome`, `handleWelcomeComplete`, `handleWelcomeLogin`
- Remover bloco `if (showWelcome) return <WelcomeScreen .../>`
- Ler `?signup=1` via `useSearchParams` para inicializar `isLogin = false` quando presente

### Resultado
- `/auth` → tela de login direto (sem mockup iPhone)
- `/auth?signup=1` → mesma tela, modo cadastro
- `/inicio` → WelcomeScreen com mockup, pública, pra divulgação
- `/` → continua igual (Home protegida)

### Observação
`WelcomeScreen.tsx` e os assets de vídeo permanecem inalterados.
