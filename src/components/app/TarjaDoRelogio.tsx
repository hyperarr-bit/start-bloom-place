import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * TARJA DO RELÓGIO COM O TECLADO (1.0.17 — gravação do dia 1 no Simulador, iPhone 17 Pro e SE). Numa tela que ROLA
 * (o cadastro pós-compra), o teclado do iPhone rola a página pra mostrar o campo e o que estava em cima ("Agora crie sua
 * conta…", o "Continuar com a Apple") passava por baixo do relógio e da ilha — a barra de status do app é transparente.
 * Só enquanto o teclado está aberto E a página rolou, uma tarja da cor do fundo cobre a área segura de cima. Sem teclado
 * (ou no Simulador com o teclado do Mac) não aparece nada e a tela fica como sempre foi.
 *
 * No WKWebView com o teclado, um `fixed` em top = visualViewport.offsetTop cai no topo da tela (o mesmo que o
 * useFolhaAcimaDoTeclado faz com a folha do Montar); no Safari, o offsetTop também é o topo visível.
 */
export function TarjaDoRelogio() {
  const [topo, setTopo] = useState<number | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const medir = () => {
      const alturaCheia = Math.max(window.innerHeight, typeof screen !== "undefined" ? screen.height || 0 : 0);
      const aberto = vv.height < alturaCheia - 140;
      const rolou = window.scrollY > 0 || vv.offsetTop > 0;
      // o topo da tela, em coordenadas de `fixed`: o offsetTop (no WKWebView = a rolagem da página; no Safari, o topo visível)
      setTopo(aberto && rolou ? Math.max(0, vv.offsetTop) : null);
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    window.addEventListener("scroll", medir, { passive: true });
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
      window.removeEventListener("scroll", medir);
    };
  }, []);
  if (topo === null || typeof document === "undefined") return null;
  return createPortal(
    <div aria-hidden data-testid="tarja-do-relogio" className="fixed inset-x-0 z-[60] pointer-events-none bg-background"
      style={{ top: topo, height: "var(--app-safe-top, 0px)" }} />,
    document.body,
  );
}
