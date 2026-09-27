import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Instagram, Loader2 } from "lucide-react";
import type { Badge } from "@/components/gamification/types";
import { CapaPlanner, Espiral, MEDIDAS_CAPA, ARGOLAS_APP, type CapaId } from "./CapaPlanner";
import { AlbumDeAdesivos, type DadosAlbum } from "./Album";
import { PAPEL_PONTILHADO } from "./papel";
import "./conquistas.css";

/**
 * O PLANNER QUE ABRE (B1 · Página, aprovada 27/09; o álbum no lugar das
 * insígnias na mesma tarde): toque na capa e ela gira na lombada (rotateY até
 * 168°, com a sombra correndo sobre a página) e revela o ÁLBUM DE ADESIVOS —
 * papel pontilhado com furos, "MEU ÁLBUM · SETEMBRO · 2026", a página dos
 * mais raros pipocando um a um e as páginas da coleção pra virar. A espiral
 * fica no lugar, numa camada própria. O bloco cresce da altura da capa pra da
 * página.
 *
 * 3D só nas faces (o filtro do selo mora na face, não no nó que gira); a
 * página é pintada por cima da capa a partir de 90° (z-index vira 0), e nada
 * gira com movimento reduzido: só um fade.
 */

const W = MEDIDAS_CAPA.app.w;
const H = MEDIDAS_CAPA.app.h;
const EASE: [number, number, number, number] = [0.45, 0, 0.55, 1];
const ANGULO = -168;

interface Props {
  capa: CapaId;
  nome: string;
  membroDesde: string;
  dias: number;
  nivel: string;
  onSelo: () => void;
  album: DadosAlbum;
  onSelecionar: (b: Badge) => void;
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onCompartilhar: () => void;
  compartilhando?: boolean;
}

type Fase = "fechado" | "abrindo" | "aberto" | "fechando";

/** "SETEMBRO · 2026" */
export const mesDaPagina = (d = new Date()): string =>
  `${d.toLocaleDateString("pt-BR", { month: "long" }).toUpperCase()} · ${d.getFullYear()}`;

export const PlannerAberto = ({ capa, nome, membroDesde, dias, nivel, onSelo, album, onSelecionar, aberto, onAbrir, onFechar, onCompartilhar, compartilhando }: Props) => {
  const reduzir = useReducedMotion();
  const caixa = useRef<HTMLDivElement>(null);
  const pagina = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(() => (typeof window === "undefined" ? W : Math.min(W, Math.max(240, window.innerWidth - 32))));
  useLayoutEffect(() => {
    const el = caixa.current;
    if (el && el.clientWidth) setLargura(el.clientWidth);
  }, []);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (el.clientWidth) setLargura(el.clientWidth); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = Math.min(1, largura / W);
  const wCapa = W * k;
  const hCapa = H * k;

  const [fase, setFase] = useState<Fase>("fechado");
  const rot = useMotionValue(0);
  const altura = useMotionValue(hCapa);
  const zCapa = useTransform(rot, (v) => (v > -90 ? 3 : 0));
  const sombra = useTransform(rot, (v) => Math.sin((Math.abs(v) / -ANGULO) * Math.PI) * 0.4);
  const mostrarPagina = fase !== "fechado";

  // fechado: a altura segue a largura (360 ↔ 390)
  useEffect(() => { if (fase === "fechado") altura.set(hCapa); }, [hCapa, fase, altura]);

  useEffect(() => {
    if (aberto) {
      setFase((f) => (f === "aberto" || f === "abrindo" ? f : "abrindo"));
      return;
    }
    setFase((f) => {
      if (f === "fechado" || f === "fechando") return f;
      return "fechando";
    });
  }, [aberto]);

  // abrindo: a página acabou de montar → mede e gira
  useLayoutEffect(() => {
    if (fase !== "abrindo") return;
    const h = Math.max(hCapa, pagina.current?.offsetHeight ?? 0);
    const a = animate(rot, ANGULO, { duration: reduzir ? 0 : 0.7, ease: EASE });
    const b = animate(altura, h, { duration: reduzir ? 0 : 0.55, ease: EASE });
    let vivo = true;
    a.then(() => { if (vivo) setFase("aberto"); });
    return () => { vivo = false; a.stop(); b.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // fechando: volta a capa e a altura, depois some com a página
  useEffect(() => {
    if (fase !== "fechando") return;
    const a = animate(rot, 0, { duration: reduzir ? 0 : 0.42, ease: EASE });
    const b = animate(altura, hCapa, { duration: reduzir ? 0 : 0.42, ease: EASE });
    let vivo = true;
    a.then(() => { if (vivo) setFase("fechado"); });
    return () => { vivo = false; a.stop(); b.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // aberto: se a página mudar de altura (360 ↔ 390, outra página do álbum), o bloco acompanha
  useEffect(() => {
    if (fase !== "aberto" || !pagina.current || typeof ResizeObserver === "undefined") return;
    const el = pagina.current;
    const ro = new ResizeObserver(() => { if (el.offsetHeight) altura.set(Math.max(hCapa, el.offsetHeight)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fase, hCapa, altura]);

  const toque = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // o selo abre o nível, não o planner
    if (fase === "abrindo" || fase === "fechando") return;
    if (fase === "aberto") onFechar();
    else onAbrir();
  };

  const pagLargura = wCapa;
  const animando = (fase === "abrindo" || fase === "aberto") && !reduzir;

  return (
    <div ref={caixa} style={{ width: "100%", maxWidth: W, margin: "0 auto" }} data-planner={fase}>
      <motion.div style={{ position: "relative", height: altura, perspective: 1400 }}>
        {/* a capa (frente + verso), girando na lombada */}
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={fase === "aberto" ? "Fechar o planner" : "Abrir o planner"}
          aria-expanded={fase === "aberto"}
          data-testid="capa-3d"
          onClick={toque}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (fase === "aberto" ? onFechar : onAbrir)(); } }}
          style={{ position: "absolute", left: 0, top: 0, width: wCapa, height: hCapa, transformStyle: "preserve-3d", transformOrigin: `${14 * k}px 50%`, rotateY: rot, zIndex: zCapa, cursor: "pointer", opacity: reduzir && mostrarPagina ? 0 : 1, transition: reduzir ? "opacity .18s" : undefined }}
        >
          <div className="entra-capa" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
            <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "top left" }}>
              <CapaPlanner capa={capa} nome={nome} membroDesde={membroDesde} dias={dias} nivel={nivel} onSelo={onSelo} semEspiral={mostrarPagina} formato="app" />
            </div>
          </div>
          <div aria-hidden style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "#35363c", borderRadius: `${18 * k}px ${5 * k}px ${5 * k}px ${18 * k}px`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)" }} />
        </motion.div>

        {mostrarPagina && (
          <>
            {/* a espiral fica no lugar, numa camada própria */}
            <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 30 * k, height: hCapa, zIndex: 5, pointerEvents: "none" }}>
              <div style={{ position: "relative", width: 30, height: H, transform: `scale(${k})`, transformOrigin: "top left" }}>
                <Espiral f="app" />
              </div>
            </div>
            {/* a página: o álbum */}
            <motion.div
              ref={pagina}
              data-testid="pagina-album"
              initial={reduzir ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="bg-[#fffdf8] dark:bg-card border border-border"
              style={{ ...PAPEL_PONTILHADO, position: "absolute", left: 0, top: 0, width: pagLargura, borderRadius: 18, padding: "12px 14px 12px 24px", zIndex: 1 }}
            >
              <div aria-hidden style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 12 }}>
                {ARGOLAS_APP.map((y, i) => (
                  <i key={i} style={{ position: "absolute", left: 2, top: y * k - 4, width: 8, height: 8, borderRadius: "50%", background: "hsl(var(--background))", boxShadow: "inset 0 1px 2px rgba(0,0,0,.25)" }} />
                ))}
              </div>
              <AlbumDeAdesivos {...album} largura={pagLargura - 38} animar={animando} reduzir={!!reduzir} onSelecionar={onSelecionar} />
              {/* a sombra da capa correndo sobre a página */}
              <motion.div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 18, background: "linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,0) 70%)", opacity: sombra, pointerEvents: "none" }} />
            </motion.div>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {(fase === "abrindo" || fase === "aberto") && (
          <motion.div
            key="cta"
            data-testid="cta-planner-aberto"
            className="flex flex-col items-center gap-1 mt-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: reduzir ? 0 : 1.0, duration: reduzir ? 0 : 0.28 }}
          >
            <button
              type="button"
              onClick={onCompartilhar}
              disabled={compartilhando}
              className="w-full h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-70"
            >
              {compartilhando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Instagram className="w-[18px] h-[18px]" aria-hidden />}
              Compartilhar meu álbum
            </button>
            <button type="button" onClick={onFechar} className="py-2 text-[12px] font-semibold text-muted-foreground">
              Fechar o planner
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
