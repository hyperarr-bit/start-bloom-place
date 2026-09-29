/**
 * PEÇAS DA DEMO GUIADA (28/09) — só descem dentro da demo, junto com a missão.
 *
 * Cara de PLANNER (memória feedback_identidade_planner): faixa colorida com
 * título em CAIXA ALTA, quadradinho de marcar (não bolinha), tabela com grade,
 * adesivo das Conquistas. Tokens do funil ROI 2 (pecas-roi2).
 *
 * O holofote segue as regras de aço da Missão do teste grátis
 * (MissaoDoTrial.tsx — "sempre que fizemos overlay, bugou"):
 *   1. NADA intercepta toque — tudo pointer-events:none; o escuro é a sombra
 *      do anel, não um véu clicável;
 *   2. fail-open: sem âncora, nada monta (a faixa guia por texto);
 *   3. morre com rolagem, toque, troca de tamanho, app em segundo plano ou
 *      tempo — nenhum caminho deixa ele pendurado;
 *   4. z-index abaixo de diálogo/folha do sistema.
 * A barra de módulos sobe acima do escuro enquanto o anel existe: trocar de
 * módulo tem que continuar à mão a missão inteira.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Adesivo } from "@/components/conquistas/adesivos-arte";
import { VERDE_OK } from "@/pages/funis/dia14/pecas-roi2";
import { ADESIVO_DO_TIPO, type TipoDoItem } from "@/lib/demo-guiada";
import type { Retangulo } from "./alvos";

export const GRAFITE = "#16121c";

/* ------------------------------------------------------------ quadradinho */

export function Quadradinho({ marcado, tam = 14, claro = false }: { marcado: boolean; tam?: number; claro?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center shrink-0 rounded-[3px] border-2 transition-colors duration-300"
      style={{
        width: tam, height: tam,
        borderColor: marcado ? (claro ? "#fff" : VERDE_OK) : claro ? "rgba(255,255,255,.7)" : "hsl(var(--foreground) / .35)",
        background: marcado ? (claro ? "#fff" : VERDE_OK) : "transparent",
      }}
    >
      {marcado && <Check strokeWidth={4} style={{ width: tam - 5, height: tam - 5, color: claro ? VERDE_OK : "#fff" }} />}
    </span>
  );
}

/* ------------------------------------------------------------ faixa */

/** A faixa da missão, grudada embaixo da barra de módulos (sticky junto com ela). */
export function FaixaDaMissao({ feitos, texto, aoPular, cumprida = false, adesivo = null }: { feitos: number; texto: ReactNode; aoPular?: () => void; cumprida?: boolean; adesivo?: TipoDoItem | null }) {
  return (
    <div className="border-t border-border" style={{ background: cumprida ? `${VERDE_OK}14` : "hsl(var(--accent) / 0.07)" }} data-testid="demo-guia-faixa">
      <div className="max-w-5xl mx-auto pl-3 pr-1.5 pt-1 flex items-center gap-2 min-h-9">
        <span aria-hidden className="inline-block w-1.5 h-4 rounded-[3px] shrink-0" style={{ background: cumprida ? VERDE_OK : "hsl(var(--accent))" }} />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] whitespace-nowrap text-foreground">Missão de 1 minuto</span>
        <span className="flex items-center gap-1" role="img" aria-label={`${feitos} de 3 feitos`}>
          {[0, 1, 2].map((i) => <Quadradinho key={i} marcado={i < feitos} />)}
        </span>
        <span className="text-[11px] font-extrabold tabular-nums text-foreground/80">{feitos}/3</span>
        <span className="ml-auto flex items-center gap-0.5">
          {adesivo && <AdesivoNaFaixa tipo={adesivo} />}
          {aoPular && (
            <button type="button" onClick={aoPular} className="min-h-9 px-2 text-[12px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="demo-guia-pular">
              Pular
            </button>
          )}
        </span>
      </div>
      <p className="max-w-5xl mx-auto pl-[22px] pr-3 pb-1.5 text-[12px] leading-snug text-foreground/85" data-testid="demo-guia-texto">{texto}</p>
    </div>
  );
}

/* ------------------------------------------------------------ holofote */

/** Onde acaba o que gruda no topo (barra de módulos + cabeçalho do módulo). */
const fundoDoTopoFixo = (): number => {
  let fundo = 0;
  document.querySelectorAll(".demo-tour-nav, header.sticky").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight / 2) fundo = Math.max(fundo, r.bottom);
  });
  return fundo;
};
/** Altura do CTA fixo de baixo ("Quase lá"), pra o balão não cair atrás dele. */
const alturaDoRodapeFixo = (): number => {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--teste-banner-h");
  return parseFloat(v) || 0;
};

export function Anel({ alvo, recorte, rotulo, children, duracao = 12_000, aoSair }: {
  alvo: Element;
  recorte?: (el: Element) => Retangulo | null;
  rotulo: string;
  children: ReactNode;
  duracao?: number;
  aoSair: (motivo: string) => void;
}) {
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [balao, setBalao] = useState<{ top: number } | null>(null);
  const balaoRef = useRef<HTMLDivElement>(null);
  const reduzir = useReducedMotion();
  const saiuRef = useRef(false);
  const aoSairRef = useRef(aoSair);
  aoSairRef.current = aoSair;

  useEffect(() => {
    let vivo = true;
    const timers: number[] = [];
    const sair = (motivo: string) => {
      if (saiuRef.current) return;
      saiuRef.current = true;
      aoSairRef.current(motivo);
    };
    const medir = () => (recorte ? recorte(alvo) : null) ?? alvo.getBoundingClientRect();
    // rola até o que o anel abraça ficar no meio da área LIVRE (entre o que gruda
    // no topo e o CTA de baixo) — um pouco abaixo do meio, pra caber o balão em cima
    try {
      const r = medir();
      const topo = fundoDoTopoFixo();
      const livre = window.innerHeight - alturaDoRodapeFixo() - topo;
      const destino = r.height > livre - 40 ? topo + 20 : topo + (livre - r.height) * 0.58;
      const delta = r.top - destino;
      if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: reduzir ? "auto" : "smooth" });
    } catch { /* noop */ }
    const aoRolar = () => sair("rolagem");
    // O anel só aparece com a rolagem ASSENTADA (2 leituras iguais): rolagem
    // longa passa de 800 ms, e medir no meio deixava o anel no lugar errado.
    let ultimoY = -1, estaveis = 0;
    const assentar = () => {
      if (!vivo) return;
      const y = window.scrollY;
      if (y === ultimoY && ++estaveis >= 2) {
        const r = medir();
        if (!alvo.isConnected || r.width < 8 || r.height < 8) { sair("ancora_invisivel"); return; }
        setRect(r);
        window.addEventListener("scroll", aoRolar, { passive: true, capture: true });
        return;
      }
      if (y !== ultimoY) { estaveis = 0; ultimoY = y; }
      timers.push(window.setTimeout(assentar, 200));
    };
    timers.push(window.setTimeout(assentar, 300));
    timers.push(window.setTimeout(() => sair("timeout"), duracao));

    // Saídas passivas — NUNCA preventDefault: a demo continua 100% tocável.
    const aoTocar = (e: Event) => {
      if (e.target instanceof Node && alvo.contains(e.target)) {
        // tocou o alvo: a ação segue e o anel se despede sozinho
        window.setTimeout(() => sair("alvo_tocado"), 450);
        return;
      }
      sair("toque_fora");
    };
    const aoEsconder = () => { if (document.visibilityState === "hidden") sair("segundo_plano"); };
    document.addEventListener("pointerdown", aoTocar, { passive: true, capture: true });
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("resize", aoRolar);
    // a barra de módulos (e a faixa da missão) ficam ACIMA do escuro
    const barra = document.querySelector<HTMLElement>(".demo-tour-nav");
    const zAntes = barra?.style.zIndex ?? "";
    if (barra) barra.style.zIndex = "205";
    return () => {
      vivo = false;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", aoRolar, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointerdown", aoTocar, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("resize", aoRolar);
      if (barra) barra.style.zIndex = zAntes;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);

  // balão: acima do anel se couber entre o topo fixo e o anel; senão, embaixo
  useLayoutEffect(() => {
    if (!rect || !balaoRef.current) return;
    const h = balaoRef.current.offsetHeight;
    const topoLivre = fundoDoTopoFixo() + 8;
    const fundoLivre = window.innerHeight - alturaDoRodapeFixo() - 8;
    const acima = rect.top - 14 - h;
    const abaixo = rect.bottom + 16;
    const top = acima >= topoLivre ? acima : Math.min(abaixo, fundoLivre - h);
    setBalao({ top: Math.max(topoLivre, top) });
  }, [rect]);

  if (!rect) return null;
  const pad = 8;
  const largura = Math.min(window.innerWidth - 12, rect.width + pad * 2);
  const esquerda = Math.max(6, Math.min(rect.left - pad, window.innerWidth - 6 - largura));
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] pointer-events-none"
      data-camada-guia="demo-holofote"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      aria-hidden
    >
      {/* o escuro é a sombra do anel — um elemento só, nada clicável */}
      <div
        className="absolute rounded-2xl pointer-events-none"
        style={{ top: rect.top - pad, left: esquerda, width: largura, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(15,12,20,.58)" }}
      />
      {/* o contorno pulsa (elemento pequeno: barato em Android fraco) */}
      <motion.div
        className="absolute rounded-2xl border-[2.5px] border-white pointer-events-none"
        style={{ top: rect.top - pad, left: esquerda, width: largura, height: rect.height + pad * 2 }}
        animate={reduzir ? undefined : { opacity: [1, 0.55, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        ref={balaoRef}
        className="absolute left-1/2 -translate-x-1/2 w-[88%] max-w-[340px] rounded-2xl px-4 py-3 text-white shadow-2xl pointer-events-none"
        style={{ background: GRAFITE, top: balao?.top ?? -9999, visibility: balao ? "visible" : "hidden" }}
      >
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">{rotulo}</span>
        {children}
      </div>
    </motion.div>,
    document.body,
  );
}

/* ------------------------------------------------------------ número subindo */

export function ContaSubindo({ de, para, formatar, atraso = 0.35, duracao = 1.1 }: { de: number; para: number; formatar: (n: number) => string; atraso?: number; duracao?: number }) {
  const reduzir = useReducedMotion();
  const [v, setV] = useState(reduzir ? para : de);
  useEffect(() => {
    if (reduzir) { setV(para); return; }
    setV(de);
    const c = animate(de, para, { duration: duracao, delay: atraso, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [de, para, reduzir, atraso, duracao]);
  // de inteiro pra inteiro, o meio também é inteiro (nada de "R$ 3.728,46" piscando)
  const inteiros = Number.isInteger(de) && Number.isInteger(para);
  return <span className="tabular-nums">{formatar(inteiros ? Math.round(v) : v)}</span>;
}

/* ------------------------------------------------------------ adesivo + confete */

// As cores do confete das Conquistas (Momentos.tsx) e a quantidade da raridade
// COMUM (14): aqui ele estoura em volta do adesivo, no canto — sem festa de
// tela cheia (a do teste grátis foi cortada pelo dono em 28/09).
const CORES = ["#d22d80", "#F5B301", "#4F8BFF", "#22c55e", "#fb923c", "#8b5cf6"];
const CONFETES_COMUM = 14;

function ConfeteNoCanto() {
  const pedacos = useMemo(
    () => Array.from({ length: CONFETES_COMUM }, (_, i) => {
      const ang = (i / CONFETES_COMUM) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
      const r = 44 + ((i * 17) % 30);
      return {
        id: i,
        dx: Math.cos(ang) * r,
        dy: Math.sin(ang) * r * 0.75,
        giro: (i % 2 ? 1 : -1) * (120 + ((i * 37) % 160)),
        cor: CORES[i % CORES.length],
        w: 5 + (i % 3) * 2,
        redondo: i % 3 === 0,
        atraso: 0.28 + (i % 4) * 0.04,
      };
    }),
    [],
  );
  return (
    <>
      {pedacos.map((p) => (
        <motion.span
          key={p.id}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{ width: p.w, height: p.redondo ? p.w : p.w * 1.6, background: p.cor, borderRadius: p.redondo ? "50%" : 2, marginLeft: -p.w / 2, marginTop: -p.w / 2 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
          animate={{ x: p.dx, y: [0, p.dy, p.dy + 34], opacity: [0, 1, 1, 0], rotate: p.giro, scale: 1 }}
          transition={{ duration: 1.5, delay: p.atraso, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

/** O adesivo do 1º registro colando NA FAIXA da missão (raridade comum): o
 *  selo cai, quica e o confete estoura em volta — nada de tela cheia, nada por
 *  cima dos botões do módulo. */
export function AdesivoNaFaixa({ tipo }: { tipo: TipoDoItem }) {
  const reduzir = useReducedMotion();
  return (
    <span className="relative inline-block w-11 h-9 shrink-0" role="img" aria-label="Adesivo do 1º registro" data-testid="demo-guia-adesivo">
      {!reduzir && <ConfeteNoCanto />}
      <motion.span
        className="absolute left-1/2 top-1/2 -ml-[23px] -mt-[23px] leading-none isolate"
        initial={reduzir ? { opacity: 0 } : { y: -90, rotate: -30, scale: 1.4, opacity: 0 }}
        animate={reduzir ? { opacity: 1 } : { y: 0, rotate: -8, scale: 1, opacity: 1 }}
        // o mesmo quique leve do adesivo das Conquistas (Momentos: Colando)
        transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 21, mass: 0.9, opacity: { duration: 0.15 } }}
      >
        <Adesivo id={ADESIVO_DO_TIPO[tipo]} tamanho={46} bordaGrossa />
      </motion.span>
    </span>
  );
}

/* ------------------------------------------------------------ folha "missão cumprida" */

export function FolhaCumprida({ tipo, rotulo, titulo, sub, aoLevar, aoExplorar }: {
  tipo: TipoDoItem;
  rotulo: string;
  titulo: string;
  sub: string;
  aoLevar: () => void;
  aoExplorar: () => void;
}) {
  const reduzir = useReducedMotion();
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-label="Missão cumprida"
      data-state="open"
      data-testid="demo-guia-cumprida"
      className="fixed inset-x-0 bottom-0 z-[95] px-3 pointer-events-none"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      initial={reduzir ? { opacity: 0 } : { y: "110%" }}
      animate={reduzir ? { opacity: 1 } : { y: 0 }}
      exit={reduzir ? { opacity: 0 } : { y: "110%" }}
      transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 320, damping: 32 }}
    >
      <div className="pointer-events-auto relative max-w-md mx-auto rounded-3xl border border-border bg-card text-card-foreground overflow-hidden shadow-[0_-12px_44px_-12px_rgba(0,0,0,.38)]">
        {/* faixa verde do planner */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: VERDE_OK }}>
          <Quadradinho marcado claro tam={15} />
          <span className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white">Missão cumprida</span>
          <span className="text-[11px] font-extrabold text-white/85 tabular-nums">3/3</span>
        </div>
        <motion.div
          className="absolute right-3 top-6 leading-none isolate"
          initial={reduzir ? { opacity: 0 } : { scale: 0.4, rotate: -30, opacity: 0 }}
          animate={reduzir ? { opacity: 1 } : { scale: 1, rotate: 7, opacity: 1 }}
          transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 300, damping: 18, delay: 0.25 }}
          aria-hidden
        >
          <Adesivo id={ADESIVO_DO_TIPO[tipo]} tamanho={64} bordaGrossa />
        </motion.div>
        <div className="px-5 pt-3.5 pb-4">
          <p className="text-[19px] font-extrabold tracking-tight leading-[1.2] pr-[72px]">
            <span className="px-1 -mx-1 rounded-sm" style={{ background: "#FFF3B0", color: "#262626" }}>{rotulo}</span>{" "}
            {titulo}
          </p>
          <p className="text-[13px] leading-snug text-muted-foreground mt-2 pr-8">{sub}</p>
          <button
            type="button"
            onClick={aoLevar}
            data-testid="demo-guia-levar"
            className="mt-4 w-full min-h-12 rounded-xl bg-foreground text-background font-bold text-[15px] inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          >
            Levar isso pros meus números <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={aoExplorar}
            data-testid="demo-guia-explorar"
            className="mt-1.5 w-full min-h-11 rounded-xl text-[13.5px] font-semibold text-foreground/80 hover:text-foreground"
          >
            Ver os outros módulos
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
