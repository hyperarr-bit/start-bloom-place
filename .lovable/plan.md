## Roleta não dispara ao voltar de /planos

### Causa raiz

O guard está condicionado a `trialExpired === true`:

```ts
const shouldGuard = !!user && !isSubscribed && trialExpired;
```

Se você está testando com trial ainda ativo (ou se `check-subscription` ainda não retornou `trial_expired: true`), `shouldGuard` é `false`, o `popstate` não é interceptado e o `handleBack` cai direto no `navigate(-1)`.

Secundariamente, se já existe um registro recente em `winback_attempts` (cooldown de 30 dias), `triggerNow` retorna `false` silenciosamente — mesmo com o guard ativo.

### Correções

**`src/pages/Planos.tsx`**
- Trocar `shouldGuard` para `!!user && !isSubscribed` (remover a exigência de `trialExpired`). Faz sentido: quem chega em /planos, escolhe não assinar e tenta sair, deve receber a oferta de retenção independentemente do estado do trial.

**`src/hooks/use-winback-trigger.ts`**
- Adicionar `console.debug` curtos em `triggerNow` indicando o motivo do retorno `false` (no user, sub ativa, cooldown 30d, já mostrado, locked) — ajuda a diagnosticar quando a roleta não aparece.

### Observação sobre cooldown
Não vou alterar a lógica de cooldown de 30 dias agora. Se durante o teste a roleta continuar não abrindo após o fix do guard, o motivo será visível no console e podemos limpar `winback_attempts` para o seu user.

### Arquivos modificados
- `src/pages/Planos.tsx`
- `src/hooks/use-winback-trigger.ts`
