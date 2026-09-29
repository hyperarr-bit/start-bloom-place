import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Roteiro } from "@/components/conquistas/video/camadas";
import { prepararRoteiroDoCard } from "./video-card";
import { FORMATOS, type DadosCard } from "./tipos";

/**
 * A PRÉVIA AO VIVO do card (29/09): a mesma animação do vídeo tocando num
 * canvas do tamanho do palco, em laço (com 1 s parado no fim), por cima do
 * card parado — que fica visível até as camadas ficarem prontas. O roteiro
 * fica guardado: o "Postar vídeo" logo depois não fotografa de novo. Pausa
 * enquanto o vídeo é gerado (o fio é um só).
 */
interface Props {
  dados: DadosCard;
  formato: "stories" | "feed";
  largura: number;
  pausado?: boolean;
  moeda?: ReactNode;
}

const AnimacaoDoCard = ({ dados, formato, largura, pausado, moeda }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const roteiro = useRef<Roteiro | null>(null);
  const t0 = useRef(0);
  const [pronto, setPronto] = useState(false);
  const { w: W, h: H } = FORMATOS[formato];

  useEffect(() => {
    let vivo = true;
    setPronto(false);
    prepararRoteiroDoCard(dados, formato, moeda).then((r) => {
      if (!vivo) return;
      roteiro.current = r;
      if (r) { t0.current = performance.now(); setPronto(true); }
    }).catch(() => { /* fica o card parado */ });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, formato]);

  useEffect(() => {
    const canvas = ref.current;
    const r = roteiro.current;
    if (!pronto || !canvas || !r || pausado) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(largura * dpr);
    const h = Math.round(((largura * H) / W) * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let raf = 0;
    const ciclo = r.duracao + 1;
    const passo = () => {
      const t = ((performance.now() - t0.current) / 1000) % ciclo;
      r.desenhar(ctx, Math.min(t, r.duracao - 1 / 30), w / W);
      raf = requestAnimationFrame(passo);
    };
    passo();
    return () => cancelAnimationFrame(raf);
  }, [pronto, largura, pausado, W, H]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      data-aovivo={pronto ? (pausado ? "pausado" : "tocando") : "preparando"}
      style={{ display: "block", width: largura, height: Math.round((largura * H) / W), opacity: pronto ? 1 : 0, transition: "opacity .25s" }}
    />
  );
};

export default AnimacaoDoCard;
