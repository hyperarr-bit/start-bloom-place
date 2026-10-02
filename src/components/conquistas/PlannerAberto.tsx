import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Clapperboard, Loader2 } from "lucide-react";
import { CapaPlanner, Espiral, MEDIDAS_CAPA, ARGOLAS_APP, type CapaId } from "./CapaPlanner";
import { PaginaInsignias, type DadosPagina } from "./PaginaInsignias";
import type { Insignia } from "./insignias";
import { PAPEL_PONTILHADO } from "./papel";
import "./conquistas.css";

/**
 * O PLANNER QUE ABRE (B1 · Página, aprovada 27/09; as INSÍGNIAS v3 dentro,
 * e a MOLDURA FIXA — dono, 27/09 à noite: "o planner abre mas o que tem
 * dentro é maior que o próprio planner; na primeira versão parecia que abria
 * de verdade porque era do MESMO tamanho"): toque na capa e ela gira na
 * lombada (rotateY até 168°, com a sombra correndo sobre a página) e revela
 * a página das insígnias — do mesmo tamanho e na mesma posição da capa. O
 * bloco NÃO cresce: capa fechada e página aberta têm a mesma largura e a
 * mesma altura (`data-moldura` nas duas, saído da mesma conta). O que muda
 * entre os dois estados fica FORA da moldura, embaixo: "Postar minha
 * conquista" e "Fechar o planner".
 *
 * 3D só nas faces (o filtro do selo mora na face, não no nó que gira); a
 * página é pintada por cima da capa a partir de 90° (z-index vira 0), e nada
 * gira com movimento reduzido: só um fade.
 */

const W = MEDIDAS_CAPA.app.w;
const H = MEDIDAS_CAPA.app.h;
const EASE: [number, number, number, number] = [0.45, 0, 0.55, 1];
const ANGULO = -168;

/** A moldura do planner numa largura de tela: a MESMA pra capa e pra página. */
export const molduraDoPlanner = (largura: number) => {
  const k = Math.min(1, largura / W);
  return { k, w: Math.round(W * k * 100) / 100, h: Math.round(H * k * 100) / 100 };
};

interface Props {
  capa: CapaId;
  nome: string;
  membroDesde: string;
  dias: number;
  nivel: string;
  onSelo: () => void;
  pagina: DadosPagina;
  onSelecionar: (i: Insignia) => void;
  onValores: () => void;
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onPostar: () => void;
  compartilhando?: boolean;
  /** O toque animado da dica (fica por cima da capa fechada). */
  dica?: ReactNode;
}

type Fase = "fechado" | "abrindo" | "aberto" | "fechando";

/** "SETEMBRO · 2026" */
export const mesDaPagina = (d = new Date()): string =>
  `${d.toLocaleDateString("pt-BR", { month: "long" }).toUpperCase()} · ${d.getFullYear()}`;

export const PlannerAberto = ({ capa, nome, membroDesde, dias, nivel, onSelo, pagina, onSelecionar, onValores, aberto, onAbrir, onFechar, onPostar, compartilhando, dica }: Props) => {
  const reduzir = useReducedMotion();
  const caixa = useRef<HTMLDivElement>(null);
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
  const { k, w: wCapa, h: hCapa } = molduraDoPlanner(largura);
  const moldura = `${wCapa}x${hCapa}`;

  const [fase, setFase] = useState<Fase>("fechado");
  const rot = useMotionValue(0);
  const zCapa = useTransform(rot, (v) => (v > -90 ? 3 : 0));
  // (02/10) qual face da capa aparece é decidida pelo ÂNGULO, não só pelo backface-visibility: no WebKit, com a
  // face cheia de camadas (textura, filtros do hot stamping), o verso grafite era pintado por cima da capa
  const frenteVisivel = useTransform(rot, (v) => (v > -90 ? 1 : 0));
  const versoVisivel = useTransform(rot, (v) => (v > -90 ? 0 : 1));
  const sombra = useTransform(rot, (v) => Math.sin((Math.abs(v) / -ANGULO) * Math.PI) * 0.4);
  const mostrarPagina = fase !== "fechado";

  useEffect(() => {
    if (aberto) {
      setFase((f) => (f === "aberto" || f === "abrindo" ? f : "abrindo"));
      return;
    }
    setFase((f) => (f === "fechado" || f === "fechando" ? f : "fechando"));
  }, [aberto]);

  // abrindo: a página acabou de montar → gira (a altura do bloco não muda)
  useLayoutEffect(() => {
    if (fase !== "abrindo") return;
    const a = animate(rot, ANGULO, { duration: reduzir ? 0 : 0.7, ease: EASE });
    let vivo = true;
    a.then(() => { if (vivo) setFase("aberto"); });
    return () => { vivo = false; a.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // fechando: volta a capa, depois some com a página
  useEffect(() => {
    if (fase !== "fechando") return;
    const a = animate(rot, 0, { duration: reduzir ? 0 : 0.42, ease: EASE });
    let vivo = true;
    a.then(() => { if (vivo) setFase("fechado"); });
    return () => { vivo = false; a.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const toque = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // o selo abre o nível, não o planner
    if (fase === "abrindo" || fase === "fechando") return;
    if (fase === "aberto") onFechar();
    else onAbrir();
  };

  const animando = (fase === "abrindo" || fase === "aberto") && !reduzir;

  return (
    <div ref={caixa} style={{ width: "100%", maxWidth: W, margin: "0 auto" }} data-planner={fase} data-moldura={moldura}>
      {/* a MOLDURA: altura fixa = a da capa, aberta ou fechada */}
      <div style={{ position: "relative", height: hCapa, perspective: 1400 }} data-testid="moldura-planner" data-moldura={moldura}>
        {/* a capa (frente + verso), girando na lombada.
            UM SÓ "Fechar o planner" (29/09, varredura): com o planner aberto a
            capa virava um SEGUNDO botão "Fechar o planner", ao lado do texto
            de mesmo nome embaixo — o leitor de tela anunciava dois, e o teste
            da tela falhava com a máquina carregada (a animação terminava antes
            do toque e os dois existiam). Aberta, a capa está ATRÁS da página
            (z 0): sai da árvore de acessibilidade e do Tab; quem fecha é o
            botão de baixo. O toque na parte da capa que aparece segue valendo. */}
        <motion.div
          role="button"
          tabIndex={mostrarPagina ? -1 : 0}
          aria-hidden={mostrarPagina || undefined}
          aria-label="Abrir o planner"
          aria-expanded={false}
          data-testid="capa-3d"
          data-moldura={moldura}
          onClick={toque}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (fase === "aberto" ? onFechar : onAbrir)(); } }}
          style={{ position: "absolute", left: 0, top: 0, width: wCapa, height: hCapa, transformStyle: "preserve-3d", transformOrigin: `${14 * k}px 50%`, rotateY: rot, zIndex: zCapa, cursor: "pointer", opacity: reduzir && mostrarPagina ? 0 : 1, transition: reduzir ? "opacity .18s" : undefined }}
        >
          <motion.div className="entra-capa" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", opacity: frenteVisivel }}>
            <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "top left" }}>
              <CapaPlanner capa={capa} nome={nome} membroDesde={membroDesde} dias={dias} nivel={nivel} onSelo={onSelo} semEspiral={mostrarPagina} formato="app" />
            </div>
          </motion.div>
          <motion.div aria-hidden style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "#35363c", borderRadius: `${18 * k}px ${5 * k}px ${5 * k}px ${18 * k}px`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)", opacity: versoVisivel }} />
        </motion.div>

        {fase === "fechado" && dica}

        {mostrarPagina && (
          <>
            {/* a espiral fica no lugar, numa camada própria */}
            <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 30 * k, height: hCapa, zIndex: 5, pointerEvents: "none" }}>
              <div style={{ position: "relative", width: 30, height: H, transform: `scale(${k})`, transformOrigin: "top left" }}>
                <Espiral f="app" />
              </div>
            </div>
            {/* a página: EXATAMENTE a moldura da capa */}
            <motion.div
              data-testid="pagina-insignias"
              data-moldura={moldura}
              initial={reduzir ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="bg-[#fffdf8] dark:bg-card border border-border"
              style={{ ...PAPEL_PONTILHADO, position: "absolute", left: 0, top: 0, width: wCapa, height: hCapa, boxSizing: "border-box", borderRadius: 18, padding: "10px 14px 8px 24px", zIndex: 1, overflow: "hidden" }}
            >
              <div aria-hidden style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 12 }}>
                {ARGOLAS_APP.map((y, i) => (
                  <i key={i} style={{ position: "absolute", left: 2, top: y * k - 4, width: 8, height: 8, borderRadius: "50%", background: "hsl(var(--background))", boxShadow: "inset 0 1px 2px rgba(0,0,0,.25)" }} />
                ))}
              </div>
              <PaginaInsignias {...pagina} largura={wCapa} altura={hCapa} animar={animando} reduzir={!!reduzir} onSelecionar={onSelecionar} onValores={onValores} />
              {/* a sombra da capa correndo sobre a página */}
              <motion.div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 18, background: "linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,0) 70%)", opacity: sombra, pointerEvents: "none" }} />
            </motion.div>
          </>
        )}
      </div>

      {/* FORA da moldura: o que muda entre fechado e aberto */}
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
              onClick={onPostar}
              disabled={compartilhando}
              className="w-full h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-70"
              data-testid="postar-conquista"
            >
              {compartilhando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Clapperboard className="w-[18px] h-[18px]" aria-hidden />}
              Postar minha conquista
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
