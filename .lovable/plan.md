# Ajustar fluxo: preços normais primeiro, roleta como win-back

## Comportamento correto (do usuário)
1. Trial termina → tela bloqueante "Ver planos" (sem oferta especial visível).
2. Usuário cai em `/planos` e vê os preços **normais** (mensal R$ 19,90 · anual R$ 14,90/mês).
3. **Roleta dispara apenas se:**
   - (a) Usuário tenta sair de `/planos` sem assinar (back/fechar/navegar pra outra rota), OU
   - (b) Usuário foi pro checkout e voltou pro app sem ter completado a assinatura.

## Mudanças

### 1. `src/components/TrialBanner.tsx` — voltar ao paywall simples
Reverter a tela "trial expirado" para mostrar apenas:
- Lock + "Seu trial de 7 dias terminou"
- Texto curto: "Continue de onde parou. Escolha o plano que combina com você."
- Botão único "Ver planos" → navega para `/planos?from=trial_expired`
- **Sem** card de oferta 80% OFF, sem mencionar desconto.

### 2. `src/hooks/use-winback-trigger.ts` — remover gatilho automático por trial expirado
- Remover a lógica `fromTrialExpired` que dispara a roleta só por chegar em /planos.
- Manter apenas dois gatilhos válidos:
  - `?canceled=true` na URL (volta do checkout cancelado).
  - `recentIntent` (clicou em "Assinar" nos últimos 10 min e voltou).
- Adicionar **3º gatilho novo**: detectar **abandono de /planos**. Quando o usuário tem trial expirado (ou não-assinante) e está em /planos, escutar:
  - `popstate` (botão voltar do navegador), OR
  - clique no botão "voltar" interno da página, OR
  - tentativa de navegar para outra rota (via React Router `useBlocker` ou interceptando cliques em links/nav).
  - Quando detectado → disparar a roleta no lugar de deixar sair.

### 3. `src/pages/Planos.tsx` — bloquear saída de não-assinantes com trial expirado
- Usar `useBlocker` do React Router (v6.4+) ou listener de `popstate` para interceptar a saída.
- Condição de bloqueio: `trialExpired === true && !isSubscribed && !winbackJaMostrado`.
- Ao tentar sair → cancelar navegação e abrir `WinbackFlow`.
- Após o usuário fechar a roleta (`dismissed_at` registrado), liberar a próxima tentativa de saída (não bloquear infinitamente).
- O botão "voltar" do header da página `/planos` também aciona o mesmo bloqueio.

### 4. Detectar volta do checkout sem pagamento
- Quando usuário clica "Assinar" → `markIntent()` já é chamado (Planos.tsx linha 52) e ele é redirecionado pro AbacatePay.
- Se ele voltar pro app **sem** ter finalizado o pagamento, em qualquer rota com `useWinbackTrigger` montado (já está em `/planos`), o `recentIntent` (10 min) dispara a roleta. **Já funciona hoje.**
- Garantir que o `Home` ou rota raiz também monte um listener leve do winback caso o usuário volte direto pra `/` em vez de `/planos`. Adicionar um `WinbackFlow` mount no `App.tsx` (ou num componente global) que escuta o `recentIntent` em qualquer rota.

## Resultado esperado
- Trial expirado → vê preços normais primeiro, sem desconto à vista.
- Tenta fechar/voltar de /planos → **aí** aparece a roleta com 80% OFF anual.
- Vai pro checkout AbacatePay e desiste → ao voltar pro app, dispara a roleta.
- Cooldown de 30 dias continua valendo (só uma tentativa de winback por mês).

## Arquivos
- editar `src/components/TrialBanner.tsx`
- editar `src/hooks/use-winback-trigger.ts`
- editar `src/pages/Planos.tsx`
- editar `src/App.tsx` (montar WinbackFlow global para capturar volta do checkout em qualquer rota)
