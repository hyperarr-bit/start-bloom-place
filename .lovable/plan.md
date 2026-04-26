Vou corrigir o fluxo de voltar na tela de planos para não deixar o usuário preso.

O problema atual é que a página adiciona uma entrada extra no histórico para interceptar o botão voltar. Quando a roleta abre/fecha, essa entrada pode ficar ativa e o app continua em `/planos`, dando a sensação de travamento.

Plano de ajuste:

1. Simplificar o botão de seta da tela de planos
   - Ao tocar na seta, tentar abrir a roleta/descontos uma única vez.
   - Depois que o usuário fechar a roleta, sair da tela de planos direto para a tela anterior.
   - Se não houver histórico anterior confiável, navegar para `/` como fallback.

2. Corrigir o botão voltar do navegador/celular
   - Manter a interceptação só enquanto a roleta ainda não foi exibida.
   - Quando a roleta abrir, segurar o usuário em `/planos` apenas durante a oferta.
   - Ao fechar a roleta, remover o bloqueio e executar a navegação de saída sem exigir outro clique.

3. Evitar loop/trava de histórico
   - Trocar o controle atual por flags explícitas: `pendingExit`, `isHandlingBack`, `allowExit`.
   - Não chamar `navigate(-1)` repetidamente quando o sentinel do histórico ainda estiver ativo.
   - Preferir navegar para `/` quando a saída via histórico não for segura.

4. Garantir a experiência desejada
   - Fluxo esperado: tela de trial acabou → Ver planos → clicar voltar/seta uma vez → aparece descontos/roleta → fechar → volta para a tela de trial acabou.
   - Não deve precisar clicar duas vezes.
   - Não deve ficar preso na tela de planos.

Arquivos a ajustar:

- `src/pages/Planos.tsx`
  - Refatorar a lógica de `popstate`, `handleBack` e `handleWinbackClose`.

- `src/hooks/use-winback-trigger.ts`
  - Se necessário, liberar o lock interno ao fechar a roleta para evitar bloqueios em tentativas futuras.

Também vou remover/evitar logs de debug desnecessários se não forem mais úteis.