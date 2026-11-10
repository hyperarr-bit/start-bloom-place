# Jornada web vitalícia

Publicação autorizada por João em 09/11/2026: substituir o antigo `/vitalicio` pela jornada aprovada no laboratório, com preço inicial R$27,90 e Asaas. `/conhecer` redireciona para `/vitalicio`, conservando a query. `/organizar`, `/inicio` e o app nativo mantêm seus fluxos.

## Oferta e pagamento

`checkout-state.ts` é a referência do preço exibido: `LN_sempre279`, vitalício, R$27,90. A oferta já existe no backend Asaas publicado. Nenhum preço/entitlement é concedido pelo cliente. O fluxo reutiliza `landing/pagamento.ts`: e-mail, OTP quando a conta existe, criação de Pix, verificação no servidor, proteção de acesso já ativo, boas-vindas e entrada. Purchase usa o helper existente e o mesmo ID do pedido; confirmação visual não é a fonte financeira de receita.

O pedido é salvo em namespace próprio para recarga, atraso e mudança de aba. Cookies/estado local nunca provam pagamento. Há travas contra clique repetido, Web Locks quando disponíveis e limites de espera. O backend/webhook continuam responsáveis por confirmação e acesso mesmo com a página fechada.

O endereço antigo usava Stripe a R$67,90. Retornos reais com `payment_intent` e `redirect_status` são encaminhados para `/oferta` antes de carregar a nova jornada/medição. Uma tentativa antiga guardada gera um link de retomada; não é convertida em pedido Asaas. O cookie de Pix compartilhado da LP não é importado.

## Demonstração e QA

`/vitalicio/demo` usa `conhecer-demo.html`, entrada separada do App global, e os componentes reais Finanças/Rotina com PreviewUserDataProvider em memória. PreviewAuthProvider mantém usuário nulo. O cliente Supabase nessa rota não lê/persiste/renova sessão; CSP bloqueia conexão externa e envio de formulários. Não há bootstrap de pixels dentro do iframe. Eventos úteis de UI são repassados ao pai por postMessage com origem e source verificados, sem dados digitados.

Na página principal, `?qa=1` e hosts fora de coreaplicativo.com.br bloqueiam auth/Pix/OTP/senha e leitura de recibos reais. Para exercitar a integração em teste de navegador, o harness usa origem de produção sintética e intercepta TODOS os recursos e serviços; nunca envia e-mail ou cobrança real.

## Medição

Eventos próprios levam `funil=conhecer`, `jornada=conhecer_v1`, `jornada_session_id`, caminho `/vitalicio` e identificador do aparelho. O pedido financeiro é ligado pelo `order_id` dos eventos de Pix e pelo `source_url` do servidor. Não se apresenta essa jornada como braço `atual` do teste da LP.

A fonte do pedido é congelada na entrada e compactada para o limite atual de300caracteres do endpoint, priorizando campanha e IDs completos. Campos sem espaço são omitidos inteiros e seus nomes entram em `checkout_source_omitted`; não se envia click ID truncado como válido. Isso não elimina todas as lacunas de atribuição.

`jornada_saida_etapa` também ocorre no avanço normal; não contar como abandono automaticamente. `jornada_payment_confirmed` pode ocorrer em outra visita ao mesmo recibo; receita deve vir de pedidos financeiros únicos. Meta/TikTok inicializam somente no pai em produção; Purchase permanece no helper existente. Links pós-compra carregam identificador próprio no Android e campanha agregada da Apple; não prometem atribuição individual no iOS.

## Verificação e publicação

Validações: testes em `src/conhecer/`, regressão `src/test/landing-travas.test.ts`, TypeScript e build Vite. Evidências de browser em `/Users/joao/core/operacao-core/novo-funil-final/qa-integrada/` (360/390/1280, navegação/cache/retorno, QA sem rede, checkout HTTP simulado). Não foi realizada transferência bancária ou envio de OTP real durante QA.

A publicação foi coordenada com o pacote separado de atribuição da meia-noite. Não antecipar AB_LP off nem alterar o pacote antigo fixado. Preparar a nova base e atualizar a automação antes do push desta jornada; os arquivos operacionais registram SHAs e resultado real.
