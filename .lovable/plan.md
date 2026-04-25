# Reverter aviso visual em Biblioteca → minimalista e dispensável

## O que mudar

Em `src/pages/Biblioteca.tsx`:

1. Remover o aviso amarelo grande adicionado na aba Desafio (linhas 674-678).
2. Substituir por um aviso **minimalista**: apenas uma linha de texto cinza (cor `text-muted-foreground`), com um botão `X` à direita para dispensar.
3. Persistir a dispensa em `lib-pages-hint-dismissed` via `usePersistedState`. Uma vez fechado, **não aparece mais**.

## Código

```tsx
// Adicionar no topo do componente Biblioteca:
const [pagesHintDismissed, setPagesHintDismissed] = usePersistedState("lib-pages-hint-dismissed", false);
const showPagesHint = !pagesHintDismissed && books.length > 0 && books.some(b => (b.pages || 0) === 0);

// Substituir o aviso atual por:
{showPagesHint && (
  <div className="flex items-start gap-2 text-[11px] text-muted-foreground border-b border-border/50 pb-2">
    <span className="flex-1">Dica: adicione o total de páginas dos seus livros na Estante para ver as estatísticas.</span>
    <button onClick={() => setPagesHintDismissed(true)} className="text-muted-foreground/60 hover:text-foreground flex-shrink-0" aria-label="Dispensar">
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
)}
```

Backend (correções em `use-persisted-state.ts` e `use-user-data.tsx`) **fica como está** — eram correções reais de race condition e não afetam o visual.

## Arquivo alterado
- `src/pages/Biblioteca.tsx`
