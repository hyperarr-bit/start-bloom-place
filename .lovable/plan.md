## Por que está bugado

Quando eu populei sua conta com dados de demo (119 chaves), em várias eu **inventei o formato** em vez de ler o componente que consome. O app abre a aba, faz `goal.actionGroups.map(...)`, mas no banco está `goal.actions` → crash / tela branca / aba quebrada.

### Exemplo confirmado: aba **Metas** (Desenvolvimento Pessoal)

`GoalsBoardV2` espera cada meta assim:
```
{ id, title, heroImage, actionGroups[], referenceLinks[], referenceImages[],
  vision: { meta, objetivo, tempo }, problems[] }
```

Mas no banco está:
```
{ id, title, category, deadline, priority, status, actions[], references[], problems[] }
```

→ `goal.actionGroups` é `undefined` → `.map` quebra → aba não renderiza.

Esse mesmo erro de "shape inventado" está espalhado por outras chaves seeded. Os crashes anteriores (`saude-workout-log`, `dieta-meals-config`, `core-rotina-habits` virando array de objetos) eram a mesma causa raiz. Eu corrigi pontualmente, mas nunca fiz a auditoria completa.

## O que vou fazer

1. **Auditoria completa**: para cada uma das 119 chaves seeded, abrir o componente que consome (`usePersistedState("chave", ...)`) e comparar o tipo TypeScript esperado com o `jsonb` salvo.

2. **Migration única de correção** (UPDATE em `user_data`) que para cada chave faz uma de três coisas:
   - **Corrige o shape** mantendo dados realistas (caso fácil — ex: renomear `actions`→`actionGroups`, adicionar `vision`).
   - **Substitui por seed novo no shape correto** (caso o shape esteja muito divergente).
   - **DELETA a chave** se eu não tiver certeza do shape exato (volta pro default vazio do componente — sem dado de demo, mas sem crash).

3. **Nenhuma alteração em código `.ts/.tsx`**. O bug é nos dados, não no app.

4. **Não mexo em**: `auth`, `subscriptions`, `profiles`, `user_roles`, configs, secrets, storage.

## Chaves que já sei que estão erradas (vão na migration)

| Chave | Problema | Ação |
|---|---|---|
| `goals-board-v2` | `actions` em vez de `actionGroups`, falta `vision` | Reescrever no shape correto, mantendo as 2 metas |
| Outras a confirmar na auditoria | — | Conforme regra acima |

## Resultado esperado

- Aba **Metas** abre e mostra "Lançar curso" e "Inglês fluente" com as tarefas marcadas.
- Todas as outras abas de todos os módulos abrem sem crash.
- Onde eu deletar a chave (não tive 100% de certeza), o módulo abre vazio com o estado default — você me avisa qual e eu preencho aquele específico com cuidado depois.

## O que NÃO vou fazer

- Não vou editar componente nenhum (`.tsx`).
- Não vou criar tabela.
- Não vou "chutar" um shape — se não tiver certeza, deleto a chave.

Posso aplicar?