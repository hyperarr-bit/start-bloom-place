import { useEffect, useMemo, useRef, type MouseEvent, type TouchEvent } from "react";
import { SEGURAR_PRA_ARRASTAR_MS, TOLERANCIA_DEDO_PX, criarSegurarParado } from "@/lib/arrastar-reordenar";

/**
 * Segurar pra disparar (o "segurar pra editar" dos widgets da Home clássica). 28/10 ("a tela é muito sensível"): só
 * dispara com o dedo PARADO por SEGURAR_PRA_ARRASTAR_MS — mexer o dedo além de TOLERANCIA_DEDO_PX (rolar), rolar a
 * página, soltar ou o sistema cancelar o toque desarma. Antes o tempo seguia correndo durante a rolagem.
 */
export function useLongPress(callback: () => void, ms = SEGURAR_PRA_ARRASTAR_MS) {
  const cb = useRef(callback);
  cb.current = callback;
  const segurar = useMemo(() => criarSegurarParado(() => cb.current(), ms, TOLERANCIA_DEDO_PX), [ms]);

  // rolar a página (inércia, rolagem de um pai) também desarma — o touchmove nem sempre chega durante a rolagem nativa
  useEffect(() => {
    const rolou = () => { if (segurar.armado()) segurar.soltar(); };
    window.addEventListener("scroll", rolou, true);
    return () => { window.removeEventListener("scroll", rolou, true); segurar.soltar(); };
  }, [segurar]);

  return useMemo(() => ({
    onMouseDown: (e: MouseEvent) => segurar.iniciar(e.clientX, e.clientY),
    onMouseMove: (e: MouseEvent) => segurar.mover(e.clientX, e.clientY),
    onMouseUp: () => segurar.soltar(),
    onMouseLeave: () => segurar.soltar(),
    onTouchStart: (e: TouchEvent) => { const t = e.touches[0]; if (t) segurar.iniciar(t.clientX, t.clientY); },
    onTouchMove: (e: TouchEvent) => { const t = e.touches[0]; if (t) segurar.mover(t.clientX, t.clientY); },
    onTouchEnd: () => segurar.soltar(),
    onTouchCancel: () => segurar.soltar(),
  }), [segurar]);
}
