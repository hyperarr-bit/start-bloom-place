/**
 * ONDE É DEMONSTRAÇÃO (14/10, funil /experimente).
 *
 * Os módulos de verdade rodam com dado de exemplo em DOIS endereços da web: a demo antiga
 * (/preview/:módulo) e o funil novo da campanha (/experimente?m=…). Vários pedaços dos módulos
 * se desligam na demo (foto não sobe, sem pedido de lembrete/avaliação, sem aviso do limite…) e
 * decidiam isso por `pathname.startsWith("/preview")` — no /experimente eles ligariam. Todos
 * perguntam aqui agora.
 * 16/10: + /liberar (a mesma demo, que vende o CORE no site com Pix antes do app).
 * 19/10: + /hoje/demo (variante "demo" do funil /hoje: Finanças com os números da pessoa). O /hoje em si NÃO é demo.
 */
export const ehCaminhoDeDemo = (pathname: string | null | undefined): boolean => {
  const p = String(pathname ?? "");
  return p.startsWith("/preview") || p === "/experimente" || p.startsWith("/experimente/") || p === "/liberar" || p.startsWith("/liberar/")
    || p === "/hoje/demo" || p.startsWith("/hoje/demo/")
    // 28/10: a demo dentro da landing nova (/organizar → iframe /organizar/demo)
    || p === "/organizar/demo";
};

/** O mesmo, lendo o endereço da página (fora de componente). Sem window = false. */
export const emCaminhoDeDemo = (): boolean => {
  try { return ehCaminhoDeDemo(window.location.pathname); } catch { return false; }
};
