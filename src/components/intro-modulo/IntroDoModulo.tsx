import { useEffect, useRef, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { INTROS, doseNaTela, introAbertaNesteAparelho, marcarIntroAbertaNoAparelho, marcarIntroVista, porQueNaoMostrar } from "@/lib/intro-modulo";
import { guiaDoModuloAtiva } from "@/components/cartoes-modulo/CartoesDoModulo";
import { IntroGuiada } from "./IntroGuiada";
import { EstadoVazio } from "./EstadoVazio";

/** Só a camada de guia de OUTRO componente conta (a própria intro também é uma camada). */
const OUTRA_GUIA = '[data-camada-guia]:not([data-camada-guia="intro-modulo"])';

/**
 * A PORTA DA INTRO (16/10): decide UMA vez, quando a conta está CARREGADA, se este módulo mostra a
 * intro guiada (Finanças/Rotina/Saúde) ou o estado vazio (os outros), e grava "vista" no aparelho E
 * na conta ao terminar (feita ou pulada). As regras moram em lib/intro-modulo (porQueNaoMostrar):
 *   · chave desligada · módulo sem intro · já vista (aparelho ou conta) · módulo já apresentado de
 *     outro jeito · módulo COM dado (conta de antes) · missão (dose de hoje, dose na tela, dose feita,
 *     missão em andamento) · outra guia por cima (holofote, festa, tutorial antigo).
 * Espera o `loaded` porque a lista "vistas" da conta e o dado do módulo chegam na hidratação — sem
 * isso, o 2º aparelho mostraria a intro de novo antes de saber que a conta já viu.
 * Fechar o app no meio: volta 1 vez; na 2ª aparição já marca vista (nunca vira insistência).
 */
export function IntroDoModulo({ moduleId }: { moduleId: string }) {
  const { get, set, loaded } = useUserData();
  const config = INTROS[moduleId];
  const [estado, setEstado] = useState<"decidindo" | "visivel" | "nada">("decidindo");
  const getRef = useRef(get); getRef.current = get;
  const setRef = useRef(set); setRef.current = set;

  useEffect(() => {
    if (!loaded || estado !== "decidindo") return;
    let outraGuia = false;
    try { outraGuia = guiaDoModuloAtiva(moduleId, getRef.current) || !!document.querySelector(OUTRA_GUIA); } catch { outraGuia = false; }
    if (porQueNaoMostrar(moduleId, getRef.current, { outraGuiaAtiva: outraGuia }) !== null) { setEstado("nada"); return; }
    if (introAbertaNesteAparelho(moduleId)) marcarIntroVista(moduleId, getRef.current, setRef.current); // 2ª aparição: a última
    else marcarIntroAbertaNoAparelho(moduleId);
    setEstado("visivel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, estado, moduleId]);

  // uma guia que monta logo depois (a dose da missão, o holofote que espera o `loaded`): a intro sai sem marcar vista
  useEffect(() => {
    if (estado !== "visivel") return;
    const conferir = () => { try { if (doseNaTela() || document.querySelector(OUTRA_GUIA)) setEstado("nada"); } catch { /* noop */ } };
    const t = window.setTimeout(conferir, 700);
    return () => window.clearTimeout(t);
  }, [estado]);

  if (estado !== "visivel" || !config) return null;
  const terminar = () => { marcarIntroVista(moduleId, getRef.current, setRef.current); setEstado("nada"); };
  return config.formato === "guiada"
    ? <IntroGuiada config={config} aoTerminar={terminar} />
    : <EstadoVazio config={config} aoTerminar={terminar} />;
}
