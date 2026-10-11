/**
 * "Esta sessão do app entrou pelo link da Porta" (core://entrar?h=… resgatado com sucesso). Quem entra pelo link
 * É da Porta por definição: a tela "Você ganhou 3 dias grátis" aparece mesmo se o `user_metadata.porta` da conta
 * não tiver sido gravado (10/10, visto no Simulador). Memória + sessionStorage (morre com o processo).
 */
const CHAVE = "porta-entrou-pelo-link";
let naMemoria = false;
export const marcarEntrouPeloLink = (): void => { naMemoria = true; try { sessionStorage.setItem(CHAVE, "1"); } catch { /* noop */ } };
export const entrouPeloLinkDaPorta = (): boolean => {
  if (naMemoria) return true;
  try { return sessionStorage.getItem(CHAVE) === "1"; } catch { return false; }
};
/** só testes */
export const _zerarEntrouPeloLink = (): void => { naMemoria = false; try { sessionStorage.removeItem(CHAVE); } catch { /* noop */ } };
