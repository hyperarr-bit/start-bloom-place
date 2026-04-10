

## Trocar estilo dos links de ação para texto inline com cor

O estilo atual com `bg-foreground` está pesado demais. A referência mostra um estilo leve: texto normal + link colorido (verde/primary), tudo dentro de um card sutil com borda.

### Mudanças em `src/pages/Auth.tsx`

**Linhas 173-200** — Trocar os 3 links de ação (Esqueci senha, Crie agora, Faça login) de botões escuros para texto inline com link colorido:

1. **Container**: Envolver cada bloco em um `rounded-xl border border-border bg-card p-4` (card sutil como na imagem)
2. **"Esqueci minha senha"**: Texto simples com `text-primary font-medium` (cor verde/primary do tema), sem fundo
3. **"Não tem conta? Crie agora — 24h grátis"**: "Não tem conta?" em `text-muted-foreground` + "Crie agora — 24h grátis" em `text-primary font-medium`
4. **"Já tem conta? Faça login"**: "Já tem conta?" em `text-muted-foreground` + "Fazer login" em `text-primary font-medium`

Resultado: estilo limpo como na imagem — texto com link colorido dentro de um card com borda suave.

