

## Estilizar links da tela de Login como botões

Na tela de **login** (isLogin = true), há dois links com estilo de texto simples que precisam do mesmo tratamento de botão dado ao "Faça login" na tela de cadastro.

### Mudanças em `src/pages/Auth.tsx`

**1. "Esqueci minha senha" (linha 175)**:
- Trocar de link de texto simples para estilo de botão: `bg-foreground text-background rounded-lg px-4 py-2 font-medium text-sm hover:opacity-90 transition-opacity`
- Manter como `Link to="/reset-password"`

**2. "Não tem conta? Crie agora — 24h grátis" (linhas 179-185)**:
- Separar em dois elementos como foi feito no "Faça login": texto "Não tem conta?" em `text-muted-foreground` + botão "Crie agora — 24h grátis" com `bg-foreground text-background rounded-lg px-4 py-2 font-medium text-sm hover:opacity-90 transition-opacity`
- Usar `flex items-center gap-2 justify-center` no container

### Resultado
Os três links de ação (Esqueci senha, Crie agora, Faça login) terão o mesmo estilo visual de botão escuro em ambas as telas.

