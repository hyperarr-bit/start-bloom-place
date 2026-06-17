import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

const SEEN_KEY = "downsell_seen_session";

/**
 * Dispara a roleta de oferta de saída na tela de planos quando o usuário tenta
 * sair: seta de voltar (via `maybeIntercept`) e, no desktop, o mouse saindo pelo
 * topo da janela (intenção de fechar/trocar de aba).
 *
 * Mostra no máximo 1x por sessão e só quando `enabled` (logado e sem assinatura).
 * Não mexe no history do navegador de propósito — interceptar o botão "voltar"
 * do navegador exige empilhar um estado fantasma que quebra o navigate(-1) da
 * própria página; preferimos um gatilho confiável a um que corrompe a navegação.
 */
export function useExitDownsell(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  const canShow = useCallback(() => {
    if (!enabled || shownRef.current) return false;
    try {
      return sessionStorage.getItem(SEEN_KEY) !== "1";
    } catch {
      return true;
    }
  }, [enabled]);

  const show = useCallback(() => {
    shownRef.current = true;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* noop */ }
    trackEvent("downsell_shown", {});
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  /** Chamado pela seta de voltar da página. Retorna true se interceptou (mostrou). */
  const maybeIntercept = useCallback(() => {
    if (!canShow()) return false;
    show();
    return true;
  }, [canShow, show]);

  // Desktop: mouse saindo pelo topo da janela (intenção de sair/trocar de aba).
  useEffect(() => {
    if (!enabled) return;
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget && canShow()) show();
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [enabled, canShow, show]);

  return { open, close, maybeIntercept };
}
