/**
 * PEÇAS DA DEMO GUIADA (28/09) — só descem dentro da demo, junto com a missão.
 *
 * Cara de PLANNER (memória feedback_identidade_planner): faixa colorida com
 * título em CAIXA ALTA, quadradinho de marcar (não bolinha). Tokens do funil
 * ROI 2 (pecas-roi2).
 *
 * A COMEMORAÇÃO é a da Missão do teste grátis (28/09, dono: "quando o usuário
 * faz algo aparece comemoração, porque isso converteu bem lá") — e SEM adesivo:
 * a 1.0.6, que vendeu bem, não tinha festa de adesivo; a 1.0.7 pôs a festa por
 * cima da comemoração e a 1.0.8 tirou.
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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { VERDE_OK } from "@/pages/funis/dia14/pecas-roi2";
import type { Retangulo } from "./alvos";
import { Quadradinho } from "./Quadradinho";

export const GRAFITE = "#16121c";

/* ------------------------------------------------------------ faixa */

/** A faixa da missão, grudada embaixo da barra de módulos (sticky junto com ela). */
export function FaixaDaMissao({ feitos, texto, aoPular, cumprida = false }: { feitos: number; texto: ReactNode; aoPular?: () => void; cumprida?: boolean }) {
  return (
    <div className="border-t border-border" style={{ background: cumprida ? `${VERDE_OK}14` : "hsl(var(--accent) / 0.07)" }} data-testid="demo-guia-faixa">
      <div className="max-w-5xl mx-auto pl-3 pr-1.5 pt-1 flex items-center gap-2 min-h-9">
        <span aria-hidden className="inline-block w-1.5 h-4 rounded-[3px] shrink-0" style={{ background: cumprida ? VERDE_OK : "hsl(var(--accent))" }} />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] whitespace-nowrap text-foreground">Missão de 1 minuto</span>
        <span className="flex items-center gap-1" role="img" aria-label={`${feitos} de 3 feitos`}>
          {[0, 1, 2].map((i) => <Quadradinho key={i} marcado={i < feitos} />)}
        </span>
        <span className="text-[11px] font-extrabold tabular-nums text-foreground/80">{feitos}/3</span>
        {aoPular && (
          <button type="button" onClick={aoPular} className="ml-auto min-h-9 px-2 text-[12px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="demo-guia-pular">
            Pular
          </button>
        )}
      </div>
      <p className="max-w-5xl mx-auto pl-[22px] pr-3 pb-1.5 text-[12px] leading-snug text-foreground/85" data-testid="demo-guia-texto">{texto}</p>
    </div>
  );
}

/* ------------------------------------------------------------ passo 1 */

/**
 * PASSO 1 DE 3 (30/09): o passo que já nasce feito ("área escolhida ✓") agora
 * aparece — antes a demo trocava de aba e rolava até o botão em 1,2 s, sem
 * mostrar nada. Cartão solto embaixo do topo fixo: não escurece nada, a demo
 * continua tocável; só o botão recebe toque. Sai pelo tempo ou por "Mostrar onde".
 */
export function CartaoDoPasso1({ modulo, pedido, aoContinuar }: { modulo: string; pedido: string; aoContinuar: () => void }) {
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => { setTop(fundoDoTopoFixo() + 12); }, []);
  return createPortal(
    <motion.div
      className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none"
      style={{ top: top ?? -9999, visibility: top == null ? "hidden" : "visible" }}
      data-camada-guia="demo-passo-1"
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
    >
      <div className="w-[88%] max-w-[340px] rounded-2xl px-4 py-3 text-white shadow-2xl ring-1 ring-white/15 pointer-events-auto" style={{ background: GRAFITE }} role="status" data-testid="demo-guia-passo1">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">Passo 1 de 3 · feito ✓</span>
        <span className="block text-[13.5px] font-semibold leading-snug">Você começou por {modulo}. Agora: {pedido} — eu te mostro onde.</span>
        <button type="button" onClick={aoContinuar} className="mt-2.5 min-h-9 px-3.5 rounded-full bg-white text-[12.5px] font-bold" style={{ color: GRAFITE }} data-testid="demo-guia-mostrar">
          Mostrar onde →
        </button>
      </div>
    </motion.div>,
    document.body,
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

/**
 * `fixo` (30/09, dono: "quando clicamos em algo ela simplesmente pula o passo"):
 * toque fora, toque no próprio alvo e rolagem NÃO fecham o anel — ele segue o
 * alvo na rolagem e o escuro fica mais claro (a demo continua 100% tocável; o
 * escuro nunca intercepta toque). Só sai se o alvo sumir da tela (troca de aba)
 * ou pelo tempo (`duracao`; `null` = sem tempo). Sem `fixo`, as saídas de antes.
 */
export function Anel({ alvo, recorte, rotulo, children, duracao = 12_000, aoSair, fixo = false }: {
  alvo: Element;
  recorte?: (el: Element) => Retangulo | null;
  rotulo: string;
  children: ReactNode;
  duracao?: number | null;
  aoSair: (motivo: string) => void;
  fixo?: boolean;
}) {
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [leve, setLeve] = useState(false);
  /* DIGITANDO (30/09, print do dono no iPhone): com o teclado aberto o Safari
   * mexe na área visível — o anel ia parar em cima das abas, o balão tapava o
   * campo e a tela ficava escura enquanto ela escrevia. Campo em foco = o anel
   * sai de cena (sem escuro, sem balão); fechou o teclado, volta no lugar. */
  const [digitando, setDigitando] = useState(false);
  useEffect(() => {
    const ehCampo = (el: unknown) => el instanceof HTMLElement
      && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const entrou = (e: FocusEvent) => { if (ehCampo(e.target)) setDigitando(true); };
    const saiu = () => { window.setTimeout(() => { if (!ehCampo(document.activeElement)) setDigitando(false); }, 60); };
    if (ehCampo(document.activeElement)) setDigitando(true);
    document.addEventListener("focusin", entrou);
    document.addEventListener("focusout", saiu);
    return () => { document.removeEventListener("focusin", entrou); document.removeEventListener("focusout", saiu); };
  }, []);
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
    let quadro = 0;
    const aoRolar = () => {
      if (!fixo) { sair("rolagem"); return; }
      // fixo: o anel acompanha o alvo (um quadro por vez, barato em Android fraco)
      if (quadro) return;
      quadro = window.requestAnimationFrame(() => {
        quadro = 0;
        if (!vivo) return;
        const r = medir();
        if (!alvo.isConnected || r.width < 8 || r.height < 8) { sair("ancora_invisivel"); return; }
        setRect(r);
      });
    };
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
        // fixo: a tela muda de tamanho sem rolar (ela abriu a edição de outra conta, um
        // formulário cresceu) — o anel segue o alvo onde ele estiver
        if (fixo) {
          const seguir = window.setInterval(() => {
            if (!vivo) return;
            const n = medir();
            if (!alvo.isConnected || n.width < 8 || n.height < 8) { sair("ancora_invisivel"); return; }
            setRect((ant) => (ant && Math.abs(ant.top - n.top) < 1 && Math.abs(ant.left - n.left) < 1
              && Math.abs(ant.width - n.width) < 1 && Math.abs(ant.height - n.height) < 1 ? ant : n));
          }, 250);
          timers.push(seguir);
        }
        return;
      }
      if (y !== ultimoY) { estaveis = 0; ultimoY = y; }
      timers.push(window.setTimeout(assentar, 200));
    };
    timers.push(window.setTimeout(assentar, 300));
    if (duracao != null) timers.push(window.setTimeout(() => sair("timeout"), duracao));

    // Saídas passivas — NUNCA preventDefault: a demo continua 100% tocável.
    const aoTocar = (e: Event) => {
      if (fixo) { setLeve(true); return; } // fixo: o passo continua na tela, só o escuro clareia
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
      timers.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); });
      if (quadro) window.cancelAnimationFrame(quadro);
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

  if (!rect || digitando) return null;
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
        style={{ top: rect.top - pad, left: esquerda, width: largura, height: rect.height + pad * 2, boxShadow: `0 0 0 9999px rgba(15,12,20,${leve ? 0.22 : 0.58})`, transition: "box-shadow .3s ease" }}
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
        className="absolute left-1/2 -translate-x-1/2 w-[88%] max-w-[340px] rounded-2xl px-4 py-3 text-white shadow-2xl ring-1 ring-white/15 pointer-events-none"
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

/* ------------------------------------------------------------ comemoração */

/**
 * A COMEMORAÇÃO DA MISSÃO — cópia parametrizada da `Celebracao` da Missão do
 * teste grátis (src/components/missao/MissaoDoTrial.tsx, "B3 pico"), a peça
 * que converte no app. Copiada, não importada: aquele arquivo é o caminho do
 * teste grátis e não se mexe. O visual é o mesmo, classe por classe: fundo
 * rgba(15,12,20,.55), cartão branco com spring, o GRÁFICO QUE SOBE (path
 * magenta com pathLength animado + a bolinha no fim), título, chip preto com
 * 🔥 e a barra verde que pula de `de` pra `para`.
 *
 * Diferenças, todas de segurança: o texto do cartão tem cor fixa (no modo
 * escuro o título herdaria branco sobre o branco), vai por portal (a barra de
 * módulos tem backdrop-blur, que prende `fixed`), e com "reduzir movimento"
 * aparece só o cartão pronto, sem animação.
 * Regras de sempre: pointer-events none (nada engole toque), some sozinha em
 * `duracao` e se declara camada de guia (`data-camada-guia`).
 */
export function ComemoracaoDaMissao({ titulo, chip, de, para, rodape, duracao, aoFim }: {
  titulo: string;
  chip: string;
  de: number;
  para: number;
  rodape: string;
  duracao: number;
  aoFim: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const aoFimRef = useRef(aoFim);
  aoFimRef.current = aoFim;
  useEffect(() => {
    const t = window.setTimeout(() => aoFimRef.current(), duracao);
    return () => window.clearTimeout(t);
  }, [duracao]);
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[210] pointer-events-none grid place-items-center px-8"
      data-camada-guia="demo-comemoracao"
      data-testid="demo-guia-comemoracao"
      initial={reduzir ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0 : 0.35 }}
      aria-hidden
    >
      <div className="absolute inset-0" style={{ background: "rgba(15,12,20,.55)" }} />
      <motion.div
        initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
        className="relative w-full max-w-[320px] rounded-3xl bg-white p-6 text-center text-[#16121c] shadow-2xl"
      >
        {/* o gráfico que sobe (Stripe: "o gráfico criou um cliente") */}
        <svg viewBox="0 0 200 84" className="w-full h-[84px] mb-3">
          <motion.path
            d="M8 72 L58 58 L104 62 L150 30 L192 12"
            fill="none" stroke="hsl(330 65% 50%)" strokeWidth="4" strokeLinecap="round"
            initial={reduzir ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.25 }}
          />
          <motion.circle
            cx="192" cy="12" r="6" fill="hsl(330 65% 50%)"
            initial={reduzir ? false : { scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 16, delay: 1.3 }}
          />
        </svg>
        <p className="text-[19px] font-black tracking-[-0.02em] leading-tight mb-1.5">{titulo}</p>
        <span className="inline-block rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3.5 py-1.5 mb-4">{chip}</span>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            data-testid="demo-guia-comemoracao-barra"
            initial={reduzir ? false : { width: `${de}%` }} animate={{ width: `${para}%` }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[11px] text-black/50 mt-1.5 font-semibold">{rodape}</p>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ------------------------------------------------------------ folha "missão cumprida" */

export function FolhaCumprida({ rotulo, titulo, sub, aoLevar, aoExplorar }: {
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
        <div className="px-5 pt-3.5 pb-4">
          <p className="text-[19px] font-extrabold tracking-tight leading-[1.2]">
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
