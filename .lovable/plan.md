## Fixes para o fluxo de win-back em /planos

### 1. Bloquear disparo duplo da roleta

**Problema**: ao apertar "voltar" rápido (ou back do navegador seguido do botão da UI), o `popstate` e o `handleBack` podem entrar em corrida — `alreadyShown` ainda é `false` quando o segundo disparo começa.

**Correção em `src/hooks/use-winback-trigger.ts`**:
- Mover o "lock" `triggeringRef.current = true` para a primeira linha do `triggerNow`, antes de qualquer `await`, e mantê-lo ligado **mesmo após sucesso** (só liberar em erro). Hoje ele libera no `finally`, deixando uma janela aberta entre o `await` e o `setAlreadyShown`.
- Adicionar checagem dupla: `if (alreadyShown || open || triggeringRef.current) return false`.

**Correção em `src/pages/Planos.tsx`**:
- Adicionar guarda local `if (winback.open) return` no `onPopState` e no `handleBack` para nunca tentar abrir quando já existe roleta na tela.

### 2. Sair de primeira após fechar a roleta

**Problema**: `handleWinbackClose` apenas marca `allowExitRef = true` e fecha o modal. O usuário precisa apertar voltar de novo para realmente sair.

**Correção em `src/pages/Planos.tsx`**:
- No `handleWinbackClose`, após `winback.close()`, chamar `navigate(-1)` direto (com pequeno timeout para o modal animar de saída) e remover o sentinel state via `window.history.back()` apenas se já tivermos consumido o push extra.
- Implementação simples: setar `allowExitRef.current = true`, fechar o modal e disparar `navigate(-1)` imediatamente. O listener de `popstate` vai ver `allowExitRef.current === true` e deixar passar.

### 3. Remover texto da escolha de planos

**Em `src/pages/Planos.tsx`** (linhas 227-230): remover o parágrafo:
> "Você escolhe Pix ou Cartão na próxima tela · Cartão renova automaticamente · Pix você renova manualmente a cada mês/ano"

### Arquivos modificados
- `src/hooks/use-winback-trigger.ts`
- `src/pages/Planos.tsx`
