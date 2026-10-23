/**
 * CONTEÚDO PAGO MORA NO SERVIDOR (segurança, 21/10).
 *
 * O "Seu 2027" (u2027, R$ 19,90) e o Kit / plano de 30 dias (bump h279k/h149k e pk99, R$ 9,90) são liberados por uma
 * chave da CONTA no user_data. Até aqui a própria página gravava a chave depois de pagar — e qualquer conta conseguia
 * gravar a mesma chave sem pagar (o user_data aceita escrita do dono). Agora:
 *   - só o SERVIDOR grava (asaas-pix check / asaas-webhook / pix-reconcile, depois do pagamento confirmado na Asaas;
 *     pix-vincular / destino-hoje copiam pra conta final);
 *   - a migração 20261022130000_conteudo_pago_so_servidor.sql tira do cliente (anon/authenticated) INSERT, UPDATE e
 *     DELETE dessas chaves (o "Começar do zero" também não apaga o que foi pago);
 *   - o app nunca tenta subir essas chaves (useUserData pula — senão a recusa do banco virava 3 tentativas e erro no
 *     console a cada gravação).
 * As chaves de PROGRESSO (core-kit-primeiro-mes-progresso, core-pacote-2027-plano, -cofrinho…) seguem do cliente.
 */
export const CHAVES_SO_DO_SERVIDOR: ReadonlySet<string> = new Set(["core-pacote-2027", "core-kit-primeiro-mes"]);

export const chaveSoDoServidor = (k: string): boolean => CHAVES_SO_DO_SERVIDOR.has(k);
