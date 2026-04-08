

# Plano: Substituir troféu por "Minha Conta" + controlar onboarding

## Resumo

Trocar o botão de troféu no header por um botão de avatar/conta que abre um drawer/sheet "Minha Conta". Mover "Sair da conta" do ModuleDrawer para lá. A caneta de editar nome some após a primeira edição. O onboarding aparece só uma vez (já funciona assim, mas adicionar opção de rever).

## Mudanças

### 1. Criar `src/components/home/AccountDrawer.tsx`

Drawer (usando Sheet do shadcn) com:
- Avatar com inicial do nome + email do usuário
- **Editar nome** (abre o NameEditDialog existente)
- **Conquistas** (navega para `/conquistas`)
- **Gerenciar assinatura** (abre customer-portal ou navega para `/planos`)
- **Alterar senha** (chama `supabase.auth.resetPasswordForEmail`)
- **Rever tutorial** (reseta `core-onboarding-done` e mostra o onboarding)
- **Sair da conta** (signOut)

Design: card `bg-card rounded-2xl border border-border/50`, items com ícones Lucide, estilo lista minimal igual ao app.

### 2. Alterar `src/components/home/GreetingHeader.tsx`

- Trocar o botão Trophy por um botão de avatar (círculo com inicial do nome, ou ícone `UserCircle`)
- Ao clicar, abre o `AccountDrawer`
- Remover a caneta de editar nome: mostrar apenas se `core-user-name` ainda não foi definido (primeira vez)
- Manter ThemeToggle no lugar

### 3. Alterar `src/components/home/ModuleDrawer.tsx`

- Remover o botão "Sair da conta" (vai para AccountDrawer)
- Manter botão admin analytics

### 4. Ajustar `src/pages/Home.tsx`

- O onboarding já usa `core-onboarding-done` — já aparece só na primeira vez
- Nenhuma mudança necessária aqui (o AccountDrawer cuidará do "rever tutorial" resetando a key)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/home/AccountDrawer.tsx` | Criar |
| `src/components/home/GreetingHeader.tsx` | Alterar (troféu → avatar, caneta condicional) |
| `src/components/home/ModuleDrawer.tsx` | Remover "Sair da conta" |

