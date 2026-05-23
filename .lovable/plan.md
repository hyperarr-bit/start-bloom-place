## O que está bugado

1. **Modal de signup com blur revelando o Core/“Organize sua vida”** — `QuickSignupModal` usa `bg-background/40 backdrop-blur-md`, então o app/tutorial atrás vaza com aquela imagem borrada.
2. **Clique em “Finanças” (ou qualquer card) vaza o app por baixo** — `handlePick` chama `onComplete()` (desmonta a overlay) e logo em seguida `navigate()`. Como o `AnimatePresence` está dentro do `Home`, quando navega o `Home` desmonta junto, então a overlay some na hora e aparece a próxima página carregando no fundo.

## Mudanças (só visual, escopo mínimo)

### `src/components/onboarding/QuickSignupModal.tsx`
- Trocar a classe do backdrop de `bg-background/40 backdrop-blur-md` para `bg-background` (fundo sólido, sem blur, sem vazar nada).

### `src/components/onboarding/QuickStartOnboarding.tsx`
- Adicionar um estado `transitioning` (boolean).
- Em `handlePick`: setar `transitioning = true` **antes** de chamar `onComplete()` / `navigate()`.
- Quando `transitioning === true`, renderizar **apenas** um loader limpo (spinner Lucide `Loader2` centralizado sobre `bg-background` sólido) no lugar do conteúdo atual, dentro da mesma overlay `fixed inset-0 z-[100] bg-background`. Assim a camada de cima continua sólida cobrindo tudo até a próxima rota montar.
- Não mexer em mais nada (welcome, choice, celebration continuam iguais).

Nenhum outro arquivo é tocado. Sem mudanças de lógica, rotas ou copy.