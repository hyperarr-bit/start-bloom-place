

## Plano: Trocar ícone Zap na página de Planos

### Contexto
O texto já diz "16 módulos" — nenhuma alteração de texto necessária. O ícone de raio (Zap) na página de Planos será trocado por um ícone mais elegante, mantendo as cores `bg-primary/10` e `text-primary`.

### Alteração em `src/pages/Planos.tsx`

- Trocar `Zap` por `Crown` (coroa — representa plano premium)
- Atualizar o import: remover `Zap`, adicionar `Crown`
- Linha 137: `<Crown className="w-5 h-5 text-primary" />`

Nenhuma outra alteração.

