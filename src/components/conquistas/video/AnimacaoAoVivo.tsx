import { useEffect, useRef, useState } from "react";
import type { ArteComVideo, DadosArtes } from "../artes-dados";
import { ALTURA, DURACAO, LARGURA, desenharQuadro, type Camadas } from "./animacao";
import { prepararCamadas } from "./camadas";

/**
 * A PRÉVIA AO VIVO (27/09): a mesma animação do vídeo tocando num canvas do
 * tamanho do palco, em laço, por cima da arte parada (que fica visível até
 * as camadas ficarem prontas). As camadas ficam guardadas: o "Postar vídeo"
 * logo depois não fotografa de novo. Pausa enquanto o vídeo é gerado (o fio
 * é um só).
 */
interface Props {
  arte: ArteComVideo;
  dados: DadosArtes;
  largura: number;
  pausado?: boolean;
}

const AnimacaoAoVivo = ({ arte, dados, largura, pausado }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const camadas = useRef<Camadas | null>(null);
  const t0 = useRef(0);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    setPronto(false);
    prepararCamadas(arte, dados).then((c) => {
      if (!vivo) return;
      camadas.current = c;
      if (c) {
        t0.current = performance.now();
        setPronto(true);
      }
    }).catch(() => { /* fica a arte parada */ });
    return () => { vivo = false; };
  }, [arte, dados]);

  useEffect(() => {
    const canvas = ref.current;
    const c = camadas.current;
    if (!pronto || !canvas || !c || pausado) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(largura * dpr);
    const h = Math.round(((largura * ALTURA) / LARGURA) * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let raf = 0;
    const passo = () => {
      desenharQuadro(ctx, c, ((performance.now() - t0.current) / 1000) % DURACAO, w / LARGURA);
      raf = requestAnimationFrame(passo);
    };
    passo();
    return () => cancelAnimationFrame(raf);
  }, [pronto, largura, pausado]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      data-aovivo={pronto ? (pausado ? "pausado" : "tocando") : "preparando"}
      style={{ display: "block", width: largura, height: Math.round((largura * ALTURA) / LARGURA), opacity: pronto ? 1 : 0, transition: "opacity .25s" }}
    />
  );
};

export default AnimacaoAoVivo;
