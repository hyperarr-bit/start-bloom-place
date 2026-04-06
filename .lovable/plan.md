

# Plano: Restaurar cômodos padrão no RoomManager

## Problema
O `defaultRooms` está como `[]`, então usuários novos não veem nenhum cômodo. O correto é já ter os cômodos principais pré-cadastrados, mas com `tasks: []` (sem tarefas pré-preenchidas).

## Solução
Alterar `defaultRooms` em `src/components/casa/RoomManager.tsx` para incluir cômodos padrão:

```ts
const defaultRooms: Room[] = [
  { id: "1", name: "COZINHA", color: "bg-yellow-200 dark:bg-yellow-900/40", tasks: [] },
  { id: "2", name: "SALA", color: "bg-blue-200 dark:bg-blue-900/40", tasks: [] },
  { id: "3", name: "QUARTO", color: "bg-purple-200 dark:bg-purple-900/40", tasks: [] },
  { id: "4", name: "BANHEIRO", color: "bg-cyan-200 dark:bg-cyan-900/40", tasks: [] },
  { id: "5", name: "ÁREA DE SERVIÇO", color: "bg-green-200 dark:bg-green-900/40", tasks: [] },
  { id: "6", name: "ESCRITÓRIO", color: "bg-orange-200 dark:bg-orange-900/40", tasks: [] },
];
```

Cada cômodo aparece com seu card colorido, pronto para o usuário adicionar itens. Sem nenhuma tarefa pré-preenchida.

**Nota**: Usuários que já têm dados em localStorage não serão afetados — o `usePersistedState` só usa o default se não houver dados salvos.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/casa/RoomManager.tsx` | Substituir `defaultRooms = []` pelos 6 cômodos padrão com `tasks: []` |

