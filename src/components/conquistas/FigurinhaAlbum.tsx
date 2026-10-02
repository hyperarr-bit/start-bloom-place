import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Raridade } from "@/components/gamification/types";
import { Adesivo } from "./adesivos-arte";
import "./conquistas.css";

/**
 * A FIGURINHA DO ÁLBUM 3D (02/10, direção C "3D/foil" + o melhor da A):
 *
 *  · COLADA: a arte de sempre com RELEVO de adesivo de verdade (sombra de
 *    contato curta + sombra difusa, no CSS, pintadas UMA vez);
 *  · ÉPICA e LENDÁRIA: uma camada de FOIL (holográfico / ouro escovado)
 *    recortada na silhueta da própria figurinha (a arte vira máscara em
 *    CSS, com a borda branca) que REAGE AO DEDO —
 *    enquanto se toca, a faixa de cor e o reflexo correm com a posição do
 *    dedo (`--fx/--fy` na figurinha) — e ao GIROSCÓPIO, só quando o
 *    aparelho já entrega `deviceorientation` (`--gx/--gy` na raiz do álbum;
 *    no iPhone isso exige uma permissão que só se pede com toque: NUNCA
 *    pedimos sozinhos — sem permissão, o dedo manda). Parada, a figurinha
 *    tem um brilho fixo discreto. NADA em loop: o brilho em loop com
 *    mix-blend engasgou o iPhone em 27/09;
 *  · ao colar uma nova, o "PEEL": a figurinha desce de um canto levantado e
 *    assenta no papel, com o canto do papel-base encolhendo;
 *  · VAZIA: a silhueta cinza média, visível (a vaga é o convite);
 *  · "reduzir movimento": sem foil, sem peel (CSS em `[data-reduzir]`).
 *
 * Tudo é transform/opacity ou pintura estática; o foil só repinta a
 * própria figurinha, e só durante o toque/movimento.
 */

/** Quanto (em unidades da arte, 0–100) a faixa anda com o dedo no limite. */
const CURSO = 70;

export const temFoil = (r: Raridade): r is "epico" | "lendario" => r === "epico" || r === "lendario";

/**
 * A camada de foil por cima da arte: a PRÓPRIA arte (o SVG irmão, já com a
 * borda branca recortada pelo filtro) vira a máscara em CSS (`mask-image`
 * com o SVG serializado — robusto no Chromium e no WebKit; o `<mask>` do
 * SVG com filtro dentro saía deslocado no Chromium). Dentro, uma faixa de
 * cor de 300 % que corre com `--fx/--fy` (ou `--gx/--gy`) por transform e um
 * reflexo branco que corre mais rápido (paralaxe).
 */
export const FoilDoAdesivo = ({ raridade }: { raridade: "epico" | "lendario" }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const svg = el?.parentElement?.querySelector("svg[data-adesivo]");
    if (!el || !svg || typeof XMLSerializer === "undefined") return;
    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}")`;
    el.style.setProperty("-webkit-mask-image", url);
    el.style.setProperty("mask-image", url);
  }, []);
  return (
    <div ref={ref} className="fig-foil" data-foil={raridade} aria-hidden>
      <i className="fig-foil-faixa" />
      <i className="fig-foil-reflexo" />
    </div>
  );
};

/** Posição do dedo dentro da figurinha → `--fx/--fy` (−CURSO…CURSO). */
const posicionar = (el: HTMLElement, clientX: number, clientY: number) => {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const fx = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1));
  const fy = Math.max(-1, Math.min(1, ((clientY - r.top) / r.height) * 2 - 1));
  el.style.setProperty("--fx", (fx * CURSO).toFixed(1));
  el.style.setProperty("--fy", (fy * CURSO * 0.6).toFixed(1));
};

/** Os manipuladores do toque numa figurinha com foil: brilha enquanto o dedo está nela. */
export const manipuladoresDoFoil = (ref: RefObject<HTMLElement>) => ({
  onPointerDown: (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-foil-ativo", "");
    posicionar(el, e.clientX, e.clientY);
  },
  onPointerMove: (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el || !el.hasAttribute("data-foil-ativo")) return;
    posicionar(el, e.clientX, e.clientY);
  },
  onPointerUp: () => ref.current?.removeAttribute("data-foil-ativo"),
  onPointerCancel: () => ref.current?.removeAttribute("data-foil-ativo"),
  onPointerLeave: () => ref.current?.removeAttribute("data-foil-ativo"),
});

/** Solta todo foil ativo dentro de `raiz` (o arrasto da página assume o dedo). */
export const soltarFoils = (raiz: ParentNode | null) => {
  raiz?.querySelectorAll("[data-foil-ativo]").forEach((el) => el.removeAttribute("data-foil-ativo"));
};

interface ColadaProps {
  id: string;
  raridade: Raridade;
  tamanho: number;
  /** Rotação "colada à mão", em graus. */
  giro?: number;
  /** Borda branca mais grossa (a figurinha grande do detalhe e da capa). */
  grande?: boolean;
  /** Vai colar agora (o "peel"): o canto do papel-base aparece e encolhe. */
  peel?: boolean;
  /** Sem a camada de foil (a foto dos Stories). */
  semFoil?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A figurinha COLADA no álbum: relevo + foil nas épicas/lendárias + o peel ao colar. */
export const FigurinhaColada = ({ id, raridade, tamanho, giro = 0, grande, peel, semFoil, className, style }: ColadaProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const foil = !semFoil && temFoil(raridade);
  const toque = foil ? manipuladoresDoFoil(ref) : {};
  return (
    <span
      ref={ref}
      className={`fig${className ? ` ${className}` : ""}`}
      data-rar={raridade}
      data-foil-tem={foil ? "" : undefined}
      data-peel={peel ? "" : undefined}
      style={{ width: tamanho, height: tamanho, "--giro": `${giro}deg`, ...style } as CSSProperties}
      {...toque}
    >
      {temFoil(raridade) && <span className="fig-aro" aria-hidden />}
      <Adesivo id={id} tamanho={tamanho} bordaGrossa={grande} />
      {foil && <FoilDoAdesivo raridade={raridade} />}
      {peel && <span className="fig-canto" aria-hidden />}
    </span>
  );
};

/** A VAGA VAZIA: a silhueta cinza média da figurinha que falta. */
export const FigurinhaVazia = ({ id, raridade, tamanho, className, style }: { id: string; raridade: Raridade; tamanho: number; className?: string; style?: CSSProperties }) => (
  <span className={`fig fig-vazia${className ? ` ${className}` : ""}`} data-rar={raridade} style={{ width: tamanho, height: tamanho, ...style }}>
    <Adesivo id={id} tamanho={tamanho} />
  </span>
);

/** Quantos graus de inclinação levam o foil ao limite. */
const GRAUS_NO_LIMITE = 22;
/** Abaixo disto o aparelho está "parado" (ruído do sensor): nada repinta. */
const BANDA_MORTA = 0.35;
/** Parado este tempo, o brilho volta ao repouso. */
const PARADO_MS = 700;

/**
 * O GIROSCÓPIO, só se já funciona: escuta `deviceorientation` (escutar não
 * pede permissão em canto nenhum — no iPhone, sem permissão, o evento
 * simplesmente não vem) e escreve `--gx/--gy` + `data-giro-ativo` na raiz
 * enquanto o aparelho se move. Nunca chama `requestPermission`.
 */
export const useGiroscopioDoFoil = (raiz: RefObject<HTMLElement>, ativo: boolean) => {
  useEffect(() => {
    if (!ativo || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const el = raiz.current;
    if (!el) return;
    let base: { b: number; g: number } | null = null;
    let ultimo = { x: 0, y: 0 };
    let quadro = 0;
    let pendente: { x: number; y: number } | null = null;
    let parado: ReturnType<typeof setTimeout> | null = null;
    const aplicar = () => {
      quadro = 0;
      if (!pendente) return;
      el.style.setProperty("--gx", (pendente.x * CURSO).toFixed(1));
      el.style.setProperty("--gy", (pendente.y * CURSO * 0.6).toFixed(1));
      el.setAttribute("data-giro-ativo", "");
      if (parado) clearTimeout(parado);
      parado = setTimeout(() => el.removeAttribute("data-giro-ativo"), PARADO_MS);
      pendente = null;
    };
    const ouvir = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (!base) { base = { b: e.beta, g: e.gamma }; return; }
      const x = Math.max(-1, Math.min(1, (e.gamma - base.g) / GRAUS_NO_LIMITE));
      const y = Math.max(-1, Math.min(1, (e.beta - base.b) / GRAUS_NO_LIMITE));
      if (Math.abs(x - ultimo.x) * GRAUS_NO_LIMITE < BANDA_MORTA && Math.abs(y - ultimo.y) * GRAUS_NO_LIMITE < BANDA_MORTA) return;
      ultimo = { x, y };
      pendente = ultimo;
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    };
    window.addEventListener("deviceorientation", ouvir);
    return () => {
      window.removeEventListener("deviceorientation", ouvir);
      if (quadro) cancelAnimationFrame(quadro);
      if (parado) clearTimeout(parado);
      el.removeAttribute("data-giro-ativo");
      el.style.removeProperty("--gx");
      el.style.removeProperty("--gy");
    };
  }, [raiz, ativo]);
};
