

# Mover botão "Sair" do header para o ModuleDrawer

## Problema
O header da Home tem 4 ícones (Troféu, Paleta, Logout + Pencil no nome) que competem por espaço e cortam nomes longos.

## Solução
- Remover o botão de LogOut do `GreetingHeader.tsx` (linhas 134-141)
- Adicionar uma opção "Sair da conta" no final do `ModuleDrawer.tsx` — um botão com ícone `LogOut` abaixo da lista de módulos, estilizado como texto vermelho discreto

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/home/GreetingHeader.tsx` | Remover botão LogOut e seu import. Ficam só Troféu + ThemeToggle (3 elementos contando o Pencil no nome) |
| `src/components/home/ModuleDrawer.tsx` | Adicionar botão "Sair da conta" com ícone `LogOut` no final da seção de módulos, usando `useAuth().signOut` |

