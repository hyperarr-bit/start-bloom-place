## Diagnóstico confirmado

O problema não está mais no revert do código: ele está nos dados salvos no Supabase e no cache local do navegador.

Encontrei três pontos principais:

1. A conta autenticada `jv20101958@gmail.com` continua correta no Supabase Auth: o metadata mostra `João Victor`.
2. O dado que o app usa para o nome está em `public.user_data` e hoje está assim: `core-user-name = "Lucas"`.
3. Os dados inseridos junto com o Lucas foram gravados todos no mesmo minuto (`2026-05-02 01:58`) e alguns estão em formato incompatível com o app. Exemplo: `finance-dueDays` veio com `dueDay/isPaid`, mas o app espera `day` e `bills[].paid`. Isso explica o erro atual: `undefined is not an object (evaluating 'z.paid')`.

Por isso você reverteu e mesmo assim continuou aparecendo Lucas: o histórico do Lovable voltou o código, mas não limpou o `user_data` nem o cache local antigo.

## Plano de correção

### 1. Restaurar os dados da conta para João Victor

Vou aplicar uma correção no banco para o usuário `jv20101958@gmail.com`:

- Trocar `core-user-name` de `Lucas` para `João Victor`.
- Restaurar as chaves financeiras para o formato correto usado pelo app:
  - `finance-incomes`
  - `finance-expenses`
  - `finance-fixed-expenses`
  - `finance-dueDays`
  - `finance-installments`
  - `finance-investments`
  - `finance-goals`
  - meses históricos de janeiro, fevereiro, março e abril.
- Manter o usuário como admin/premium como já estava.
- Não mexer em senha, auth, assinatura, roles, storage ou configuração do `/admin`.

Antes de sobrescrever, vou guardar uma cópia de segurança dos dados atuais em uma tabela privada de backup, para termos como recuperar se precisar.

### 2. Corrigir o cache para não ficar preso no “Lucas”

Vou ajustar `useUserData` para o Supabase sempre vencer o cache local quando o app abre.

Hoje o app lê o localStorage primeiro e marca como “carregado” cedo demais. Se o localStorage tiver `Lucas`, alguns módulos podem hidratar esse valor antigo antes do banco responder.

Vou mudar para:

- usar o localStorage só como pré-carregamento visual;
- só considerar os dados oficialmente carregados depois da resposta do Supabase;
- sobrescrever o localStorage com os valores corretos vindos do banco;
- remover a query inválida `length(value::text)` que está gerando erro 400 no Supabase.

### 3. Evitar que dados em formato errado quebrem a tela

Vou adicionar uma normalização/defesa para `finance-dueDays` e pontos onde o app faz `.bills.filter(...)`.

Assim, mesmo que algum dado antigo venha no formato errado, o app não quebra com erro `paid`; ele converte/ignora com segurança e continua renderizando.

### 4. Verificação final

Depois da correção, vou conferir:

- nome exibido como `João Victor`;
- módulos voltando a mostrar informações;
- módulo financeiro sem erro de `paid`;
- console sem o erro `undefined is not an object (evaluating 'z.paid')`;
- requisições de `user_data` sem o 400 causado por `length(value::text)`.

Resultado esperado: a conta `jv20101958@gmail.com` volta a aparecer como João/João Victor, com dados compatíveis com os módulos, sem o bug causado pelo seed do Lucas.