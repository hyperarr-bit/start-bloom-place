/**
 * A DEMO DA LANDING NUNCA VIRA O APP DE VERDADE (29/10).
 *
 * O iframe /organizar/demo é o app inteiro, na MESMA origem da página. Depois da compra a sessão é real (a conta que
 * pagou), e os componentes de fora do módulo (barra de abas, retomada pós-compra, links com <a href>) conseguiam levar o
 * iframe pra /home, /voce… — o app de verdade, logado, DENTRO da landing. Caso de 29/10: dali a conta foi excluída
 * (Você → Excluir minha conta), o `localStorage.clear()` da exclusão rodou na mesma origem e a página, que guarda o
 * estado do Pix no localStorage, voltou na oferta → 2º pagamento.
 *
 * Regra: dentro do iframe da landing, qualquer rota que não seja a própria demo volta pra demo (replace).
 */
export const CAMINHO_DEMO_LANDING = "/organizar/demo";

/** O caminho da janela de cima é a landing (/organizar), não a própria demo aberta direto. */
export const ehPaginaDaLanding = (caminhoDeCima: string | null | undefined): boolean => {
  const p = String(caminhoDeCima ?? "").replace(/\/+$/, "");
  return p === "/organizar";
};

/** Pra onde o iframe volta (null = fica). */
export function voltaDaDemoDaLanding(caminhoDoIframe: string, caminhoDeCima: string | null): string | null {
  if (!ehPaginaDaLanding(caminhoDeCima)) return null;
  const p = caminhoDoIframe.replace(/\/+$/, "") || "/";
  return p === CAMINHO_DEMO_LANDING ? null : CAMINHO_DEMO_LANDING;
}

/** O caminho da janela de cima, se for da mesma origem e eu estiver num iframe (senão null). */
export function caminhoDeCima(): string | null {
  try {
    if (window.parent === window) return null;
    if (window.parent.location.origin !== window.location.origin) return null;
    return window.parent.location.pathname;
  } catch { return null; }
}
