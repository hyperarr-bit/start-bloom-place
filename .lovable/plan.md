# Corrigir persistência de dados (Biblioteca + global)

## Diagnóstico

Inspeção do banco (`user_data`) confirma que dados **estão sendo salvos** para a maioria dos módulos. O caso da Biblioteca:

- O único livro cadastrado tem `pages: 0`, `currentPage: 0`, `status: "lendo"`, `endDate: ""`.
- Por isso as estatísticas mostram 0: `totalPagesRead` soma `pages`/`currentPage`, e `booksRead` filtra por `status === "lido"`. Sem dados, sem números — não é bug de salvamento, é falta de preenchimento.
- A importação por URL traz só título/autor/capa, **nunca** preenche `pages` nem `currentPage`. O usuário precisa editar manualmente, mas os campos podem estar pouco visíveis.

Porém, ao revisar `src/hooks/use-persisted-state.ts` encontrei um **bug real e silencioso** que pode causar perda de edições em qualquer módulo:

```ts
useEffect(() => {
  if (internalUpdate.current) { internalUpdate.current = false; return; }
  const latest = get(key, initial);
  if (JSON.stringify(latest) !== JSON.stringify(state)) setState(latest);
}, [get, key]);
```

Problemas:
1. `get` é recriado **toda vez que qualquer chave muda** no `UserDataContext` (depende de `store`). Logo este efeito roda em **toda gravação de qualquer outra chave** — não só da própria.
2. `state` na comparação é **stale** (closure capturada), então pode reverter um valor recém-digitado por uma versão antiga.
3. A flag `internalUpdate` só protege uma única passada — se houver duas gravações em sequência (ex: dois `usePersistedState` num mesmo handler), a segunda passa o reset e o efeito do primeiro hook reverte o valor.
4. O debounce do `flush` em `use-user-data.tsx` é 500ms; se o usuário fecha a aba antes, o `useEffect` cleanup tenta `flush()`, mas como é assíncrono e a página já desmontou, escritas podem se perder.

## Correções

### 1. `src/hooks/use-persisted-state.ts`
Reescrever para:
- Não comparar com `state` stale — usar a função updater: `setState(prev => latest mais novo se diferir)`.
- Usar `JSON.stringify` apenas como hash leve (já é feito, manter).
- Aumentar o tamanho da janela do `internalUpdate` usando um contador em vez de boolean (decrementa a cada effect run).

### 2. `src/hooks/use-user-data.tsx`
- Reduzir debounce de 500ms para 250ms.
- No cleanup do unmount, fazer **flush síncrono via `navigator.sendBeacon`** quando possível, ou pelo menos disparar o upsert imediatamente sem `setTimeout`.
- Adicionar listener em `visibilitychange === 'hidden'` e `beforeunload` para forçar flush quando o usuário sai da página/troca de aba (cenário muito comum em mobile).
- Tratar erros de `upsert` (hoje silenciosamente ignorados) com `console.error` e re-enfileirar para retry.

### 3. `src/pages/Biblioteca.tsx` — UX dos campos faltantes
- No formulário de cadastro/edição de livro, garantir que os campos `pages` (total) e `currentPage` (página atual) estejam **visíveis e obrigatórios** com placeholder claro.
- Após importação por URL, abrir o editor automaticamente já focado em "páginas totais" para o usuário preencher.
- Mostrar um aviso amarelo na aba Desafio quando há livros com `pages === 0`: "Adicione o total de páginas dos seus livros para ver as estatísticas".

## Arquivos alterados
- `src/hooks/use-persisted-state.ts` — corrigir race conditions
- `src/hooks/use-user-data.tsx` — flush síncrono em unmount/visibilitychange + retry
- `src/pages/Biblioteca.tsx` — UX dos campos `pages`/`currentPage` + aviso na aba Desafio

## Não vamos
- Reescrever o sistema de persistência (funciona para 99% dos casos).
- Migrar para outra solução de storage.
