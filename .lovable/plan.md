

## Ajustes na tela de Criar Conta (Auth.tsx)

### 1. Link "Faça login" com estilo de botão
**Linha 179-184** — Quando está na tela de criar conta, o texto "Já tem conta? Faça login" precisa parecer um botão. Trocar de texto simples para um estilo com fundo escuro:
- Separar em dois elementos: texto "Já tem conta?" em `text-muted-foreground` + botão "Faça login" com `bg-foreground text-background rounded-lg px-4 py-2 font-medium`
- Ou aplicar ao bloco inteiro um estilo de botão outline/secundário

### 2. Trocar "trial" por "teste grátis"
- **Linha 119**: `"Crie sua conta — 24h grátis"` (já ok, mas verificar consistência)
- **Linha 183**: `"24h grátis"` → manter
- **Linha 197**: `"✨ O que está incluso no trial:"` → `"✨ O que está incluso no teste grátis:"`
- **Linha 199**: `"Acesso a todos os 12 módulos por 24h"` → `"Acesso a todos os 16 módulos por 24h"`

### 3. Trocar 12 por 16 módulos
- **Linha 199**: `12` → `16`

### Arquivos alterados
- `src/pages/Auth.tsx`

