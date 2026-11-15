# Upsell da /oferta: "Leve alguém junto" a R$ 24,90 (15/11)

Ramo `upsell-oferta-2490` (worktree `/Users/joao/core/wt-upsell-oferta-15-11`). **Nada foi publicado**: nenhum push, nenhum deploy de function, nenhuma migração, nenhum secret alterado. Tudo está atrás de chave **desligada**.

## O que mudou e por quê

| Mudança | Número que justificou |
|---|---|
| A /oferta agora tem upsell no pós-pago (o presente de hoje, a R$ 24,90) | 21 compras pela Stripe desde 09/11 e 0 upsell visto |
| **Cartão: 1 toque.** "Sim, adicionar · R$ 24,90" cobra no mesmo cartão, sem digitar nada | O 2º pagamento é o gargalo: 44 copiaram o Pix e só 19 pagaram (metade some). No 2027, 38% tocaram e só 3 de 20 pagaram |
| **Pix:** "Quero · copiar o Pix" gera um Pix novo de 24,90 da **Stripe** (um gateway só na /oferta) | É o mesmo fluxo do presente de hoje (Pix pronto em 0,7 s): fica igual, só troca o gateway |
| Âncora numa linha: "R$ 24,90 · em vez de R$ 67,90 · uma vez" | 75% recusam na hora (falta de valor percebido). Na /oferta ela acabou de pagar 67,90 |
| Cartão recusado: "O banco não aprovou este valor. Sua compra do CORE continua garantida." + "Pagar com Pix · R$ 24,90" | Recusa não pode virar beco sem saída: o mesmo PI aceita o Pix |
| 1º passo no cartão vira "Você confirma aqui" (no Pix continua "Você paga o Pix") | Copy curta e honesta pro 1 toque |

O que **não** mudou: título, ilustração, passos 2 e 3, a nota "Vale pra 1 pessoa…", "Agora não", o cartão do WhatsApp e a cara da página. /organizar e /simples continuam a 14,90 (o módulo sem `valor` = `VALOR_PRESENTE_LP`). O /vitalicio fica de fora (o pedido era só a /oferta).

### Escopo extra (pedido do dono: "pode querer fazer isso depois, mas não encontra a opção")
1. **Entrada fixa** "🎁 Dar o CORE de presente" na página Você / menu da conta **do site**. Não tem ×, não some e não espera 5 dias. Aparece pra quem tem vitalício pago na web (Pix ou Stripe). iPhone e Android da loja nunca mostram. Com ela ligada, ocupa o lugar do aviso fechável (nunca aparecem os dois). Nada na Home.
2. **Linha depois do "Agora não"** no pago da /oferta: "Dá pra dar de presente depois, pelo site: Você → Dar o CORE de presente." Aparece só com a entrada ligada (nunca manda procurar o que não existe). Coloquei "pelo site" porque a entrada não existe no app da loja.
3. **/presente/dar com o preço certo, decidido no servidor.** Quem comprou a 67,90 na /oferta paga 24,90. Com cartão salvo é 1 toque ("Sim, dar de presente", com "Prefiro pagar no Pix"); sem cartão salvo, ou se o cartão for recusado, vai pro Pix da Stripe. Os demais seguem com 14,90 no Pix Asaas. O `presente-resgatar` recusa o Pix de 14,90 pra quem é comprador da /oferta.

## Como funciona (técnico, curto)
- **Salvar o cartão:** com a chave ligada, o pedido leva `salvar_cartao`. O stripe-criar põe `payment_method_options[card][setup_future_usage]=on_session` só no **atualizar** (na hora de pagar); o criar idempotente (`oferta-<ref>`) não muda. O Pix não é afetado. Não entra customer na compra principal (zero latência a mais). Nenhum texto ou campo novo na tela dos 67,90.
- **Nova function `stripe-presente`** (`acao` estado | cartao | pix | nome). A prova é `{ref, pi}` da aba (a mesma do stripe-status) ou o token `t` do dia 3 / da entrada. O servidor confere que a compra principal está paga, é da /oferta, de 6790 BRL e da mesma ref.
  - **Um PaymentIntent de presente por compra** (Idempotency-Key `presente-oferta-<pi>`, 2490 BRL, cartão + Pix, metadata `pagina=presente_oferta`, `pi_principal`). Um PI só paga uma vez, então nunca há 2 cobranças.
  - **1 toque:** pega o cartão da compra principal (só se ela teve `setup_future_usage`), cria um customer só daquela compra (`presente-cus-<pi>`), anexa o cartão e confirma com `Idempotency-Key presente-cartao-<pi do presente>`: 2 toques dão 1 tentativa. Se o cartão já tiver outro customer, o servidor recusa sem cobrar. Se o banco pedir 3DS, devolve `client_secret` e a página termina com `handleNextAction`. Recusa leva ao Pix no mesmo PI.
- **Webhook:** `presente_oferta` de 2490 vira o código do presente na conta da compra principal (`garantirPresente`) e manda o link por e-mail. Grava `stripe_presente_venda`. **Sem Purchase pra Meta e sem crédito pra quem pagou.** Se a conta da compra principal ainda não existe, responde 500 e a Stripe reenvia.

## Medição (pra separar do presente da /organizar)
- Todos os `landing_presente_*` da /oferta levam `pagina: "oferta"`, `valor: 2490` e `via: "cartao_1toque" | "pix"`.
- Eventos novos: `landing_presente_recusado` e `landing_presente_sem_cartao`.
- Servidor: `stripe_presente_criado` e `stripe_presente_venda` (com `metodo` e `pi_principal`).
- App e site: `presente_entrada_view` e `presente_entrada_toque`; na /presente/dar, `presente_d3_cartao`, `presente_d3_recusado` e `presente_d3_view` com `preco`.
- Régua antiga: ≥8% de quem vê compra, com ≥200 vistas.

## Arquivos
- Novos: `supabase/functions/stripe-presente/index.ts`, `supabase/functions/_shared/stripe-presente.ts`, `src/lib/presente-entrada.ts`, `src/presente/EntradaPresente.tsx`, `src/test/stripe-presente.test.ts`, `src/test/oferta-presente.test.ts`, `src/test/presente-entrada.test.ts`
- Alterados: `landing.html` (chave `UPSELL_OFERTA`), `src/landing/landing.ts`, `src/landing/stripe-checkout.ts`, `src/landing/upsell-presente.ts`, `src/pages/presente/DarPresente.tsx`, `src/presente/AvisoPresente.tsx`, `src/presente/FluxoPresente.tsx` (`TelaCartao` aceita `valor`), `src/presente/api.ts`, `supabase/functions/_shared/stripe-criar.ts`, `supabase/functions/_shared/stripe.ts`, `supabase/functions/_shared/presente-dia3.ts`
- Prints (390×844, modo SIMULADO): `prints-upsell/01` a `14` (não commitados)

## Testes
- `npx tsc --noEmit -p tsconfig.app.json`: limpo.
- 29 arquivos de teste, 647 testes passando: oferta-stripe, oferta-presente (novo), stripe-presente (novo), presente-entrada (novo), upsell-presente-organizar, presente*, stripe*, funil-app-web-servidor, presente-dia3, pix-upsell, landing*.
- **Chave off:** os mesmos atributos e a mesma memória do `<head>` de antes da chave existir. O pedido não leva `salvar_cartao` e nada do presente aparece.
- Já falhava antes deste ramo, e não fui eu: `seguranca/env-no-bundle.test.ts` ("as rotas continuam as mesmas", o vercel.json tem 30 rotas e o teste espera 28).

## Consertos da revisão (15/11, 2ª rodada)
- **A1 (link repassado cobrava o cartão do dono):** pelo token (a /presente/dar), o 1 toque só funciona com o **JWT do próprio dono** (o usuário logado tem que ser a conta do token). Sem isso: `cartao` responde `login`, a página vai pro Pix, e o `estado` não mostra bandeira nem final. Pela aba da compra (`ref`+`pi`) segue igual.
- **A2 (presente pago sem código):**
  - O dono agora também é achado pelo registro `pix_pago_em_dobro` (compra que virou "preservado") e pelo e-mail da compra (`acharConta`, só leitura).
  - Compra principal **ignorada** pelo webhook → nenhum presente oferecido nem cobrado: o `estado`, o `cartao` e o `pix` respondem `sem_conta`, e a página fecha o presente.
  - No webhook: compra ignorada → alarme pro dono + 200. Conta que ainda não chegou → 500 nos 4 primeiros reenvios e, no 5º, alarme ("⚠️ Presente Stripe pago SEM conta") + 200.
- **A3 (o cartão salvo podia derrubar a venda):** se a Stripe recusar o atualizar com `setup_future_usage` (ex.: junto com parcelas), o stripe-criar repete **sem ele** e a venda segue (o presente cai pro Pix). A página só manda `salvar_cartao` quando ela paga no **cartão** (no Pix nunca). Tem teste da falha.
- **M1 (mudança sem chave na /presente/dar):** nova env do servidor **`PRESENTE_STRIPE`** (padrão off). Sem `"on"`:
  - a porta do token do `stripe-presente` responde `compra`, e a /presente/dar segue igual à de hoje (14,90);
  - o `presente-resgatar` não recusa o Pix de 14,90 pra comprador da /oferta.
  A porta da aba (upsell) depende só da chave `UPSELL_OFERTA` da página.
- **M2:** a ordem do deploy ficou na seção abaixo.
- **B1:** a Idempotency-Key do 1 toque passou a ser por tentativa (`presente-cartao-<pi>-<n>`, reservada em webhook_events, no máximo 3). Uma recusa não prende mais 24 h, e o return_url diferente entre /oferta e /presente/dar não dá erro de idempotência.
- **B2:** o PI do presente fica guardado com chave única em `webhook_events` (`presente-pi:<pi principal>`), lido antes do analytics. Nunca nasce um 2º PI.
- **B3:** sem o Stripe.js no 3DS, a mensagem é neutra ("Não deu pra confirmar agora…"), não "O banco não aprovou".
- **B5:** a compra fica na aba (`sessionStorage`). Recarregar depois de pagar reabre o presente onde parou (oferta, QR ou cartão), com trava contra abrir 2 vezes.
- **Mantido:** o commit fce990d5 (subtítulo "Dê o CORE vitalício pra quem você quer bem.").
- **Ficou de fora:** depois do "Agora não", uma recarga mostra a página de venda (comportamento de hoje da /oferta depois de pagar, sem LPO). Fica pra outra rodada, se o dono quiser.

## Consertos da 2ª revisão (antes de ligar pra todos)
- **M-novo-1 (presente podia ir pra outra conta da mesma pessoa):** o webhook do presente procura o dono nesta ordem:
  1. a linha da compra principal;
  2. o registro de pago em dobro;
  3. o `user_id` da sessão gravado no PI do presente (a mesma conta que a compra principal prefere), se essa conta existir.
  O **e-mail** só entra no **5º envio**, depois de esperar a compra principal.
- **B-novo-1:** a compra guardada na aba leva a hora. A recarga só reabre o presente nas primeiras **3 horas**, então uma aba velha do Instagram não traz a oferta de volta.
- **B-novo-2:** se o módulo do presente falhar ao carregar, a marca de "abrindo" é limpa e a próxima tentativa funciona.
- **B-novo-4:** a compra que foi ignorada e depois creditada (a linha existe) volta a valer pro presente.
- **B-novo-3 (busca de usuários lenta):** fica como está. É a mesma busca da compra principal e agora só roda no último envio.

## O que falta pra ir ao ar
1. **Deploy, nesta ordem (trava da revisão M2):**
   1. `stripe-webhook`. **Sempre primeiro**: o antigo trata `pagina=presente_oferta` como "outra_pagina" (alarme + 200, sem reenvio, e o presente ficaria sem código).
   2. `stripe-criar`.
   3. `stripe-presente` (nova).
   4. `presente-resgatar` **junto com o site**.
   5. Só então a env `PRESENTE_STRIPE=on` (liga a /presente/dar a 24,90).
   Não há migração.
2. **Secret/env:** a env nova `PRESENTE_STRIPE` (off por padrão; ver o passo 1). A `STRIPE_SECRET_KEY` precisa de escrita em **Customers** e **PaymentMethods** (a do /funil-app já pede isso). Confirmar que a conta aceita Pix com `expires_after_seconds=86400`.
3. **Site (Vercel):** sobe inerte com as chaves off.
4. **Ligar:** `UPSELL_OFERTA = "on"` no `landing.html`. A entrada e a linha do "Agora não" ligam com `PRESENTE_ENTRADA = "web"` em `src/lib/presente-entrada.ts`. QA sem ligar: `/oferta?upoferta=on` e `?presente-entrada=on`. Rollback: "off".
5. **Compra real de teste nos 2 caminhos (é sua):** (a) `/oferta?upoferta=on` no cartão → "Sim, adicionar" (confere que anexar o cartão depois do pagamento funciona na sua conta Stripe; se falhar, a tela cai sozinha no Pix); (b) `/oferta?upoferta=on` no Pix → Pix de 24,90. Depois, a /presente/dar pela entrada e o estorno.

## Riscos
- **`setup_future_usage` na compra principal:** pode aumentar um pouco os pedidos de 3DS. Não mostramos o aviso "cartão salvo" (regra: nada novo na tela dos 67,90). O consentimento fica no toque: a tela diz "No mesmo cartão Visa •••• 4242" antes de cobrar.
- **Anexar o cartão depois do pagamento** (sem customer na compra) segue a doc da Stripe, mas só a compra real confirma. Se falhar, a tela cai no Pix sozinha.
- **Estorno do presente não desliga o código** (igual ao presente Asaas de hoje).
- **A prova do 1 toque é `ref` + `pi`** (o mesmo nível do stripe-status). Quem tiver os dois só consegue dar um presente na conta do próprio comprador.
- **"Voltar" do navegador na tela do presente** fecha o checkout por baixo e conta como "Agora não".

## Decisões que são suas
1. Salvar o cartão sem aviso na tela dos 67,90 (o aviso é a frase "No mesmo cartão…" na hora do toque).
2. A âncora "em vez de R$ 67,90".
3. 1 presente a 24,90 por compra. Quem já deu e volta à /presente/dar vê o link do mesmo presente.
4. A entrada fixa substitui o aviso fechável quando ligada. O e-mail do dia 3 continua só pra compradores Pix (14,90).
5. O texto da linha depois do "Agora não" ("pelo site", porque a entrada não existe no app da loja).
6. Ligar também no /vitalicio? Hoje está fora.
