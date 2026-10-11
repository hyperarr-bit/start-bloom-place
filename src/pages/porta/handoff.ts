/**
 * PORTA → APP JÁ LOGADO (10/10) — o lado do SITE.
 *
 * Depois da conta, o site pede um código de uso único à função `porta-handoff` (24 h, 1 uso; a
 * mesma chamada manda o e-mail "Seu plano está salvo — entre no CORE" com esse código). Na volta da
 * loja, a tela 7 mostra "Abrir o CORE" → `core://entrar?h=<código>`: o app troca o código por sessão
 * e abre já logado. A página /abrir?h=<código> é a reserva (link do e-mail que não abre core://).
 * ÁREA DE TRANSFERÊNCIA É PROIBIDA (dono 10/10: o "CORE quer colar…" do iOS é feio e, negado,
 * quebra o atalho) — nada aqui copia nem lê o clipboard.
 * Mesmas regras do servidor (supabase/functions/_shared/porta-handoff.ts), repetidas aqui pra o
 * bundle do site não importar de fora do src/.
 */
export const RE_CODIGO_PORTA = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
export const codigoDaPortaOk = (c: unknown): c is string => typeof c === "string" && RE_CODIGO_PORTA.test(c);
export const abrirAppComCodigo = (codigo: string): string => `core://entrar?h=${encodeURIComponent(codigo)}`;
