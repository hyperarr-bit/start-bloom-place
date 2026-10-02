/**
 * PEÇAS DA DEMO GUIADA (28/09 · redesenho 30/09) — só descem dentro da demo,
 * junto com a missão.
 *
 * Cara de PLANNER (memória feedback_identidade_planner): faixa colorida com
 * título em CAIXA ALTA, quadradinho de marcar (não bolinha), POST-IT amarelo
 * com fita magenta pros chips. Tokens do funil ROI 2 (pecas-roi2).
 *
 * Redesenho de 30/09 (dono, no iPhone: "fica um tempo e o usuário fica meio
 * que perdido, não sabe onde clicar pra continuar"; "o passo 3 só aparece o
 * popup mas não tem botão"; "quando escrevemos a tela fica escura"):
 *   · toda peça tem UMA ação óbvia e um botão de seguir; nada some sem dizer
 *     o que fazer (o que anda sozinho é rede de segurança, não o caminho);
 *   · o post-it do passo 2 tem os chips prontos (1 toque) e "✎ escrever o meu";
 *   · com o teclado aberto (campo em foco OU o visualViewport encolheu, que é
 *     como o Safari do iPhone avisa) o anel não desenha NADA: sem escuro, sem
 *     balão em cima do campo; fechou o teclado, volta no lugar;
 *   · a "Missão cumprida" é UMA peça só (comemoração + as duas saídas), não
 *     duas empilhadas — a festa empilhada da 1.0.7 atrapalhou no app.
 *
 * O holofote segue as regras de aço da Missão do teste grátis
 * (MissaoDoTrial.tsx — "sempre que fizemos overlay, bugou"):
 *   1. o escuro NUNCA intercepta toque (é a sombra do anel, pointer-events:none);
 *      só o balão/post-it e os botões das comemorações recebem toque;
 *   2. fail-open: sem âncora, nada monta (a faixa guia por texto);
 *   3. nenhum caminho deixa peça pendurada: tudo tem saída por botão, tempo ou
 *      pela âncora sumir;
 *   4. z-index abaixo de diálogo/folha do sistema.
 * A barra de módulos sobe acima do escuro enquanto o anel existe: trocar de
 * módulo tem que continuar à mão a missão inteira.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { VERDE_OK } from "@/pages/funis/dia14/pecas-roi2";
import { reais } from "@/lib/demo-guiada";
import type { ChipDaMissao, Retangulo } from "./alvos";
import { Quadradinho } from "./Quadradinho";

export const GRAFITE = "#16121c";
const AMARELO_POST_IT = "#FFF3B0";
const TINTA_POST_IT = "#262626";
const MAGENTA = "hsl(330 65% 50%)";

/* ------------------------------------------------------------ viewport */

/** O que está VISÍVEL de verdade: no Safari do iPhone, com o teclado aberto, a
 *  janela continua com a altura de sempre e é o visualViewport que encolhe. */
const vv = () => (typeof window !== "undefined" ? window.visualViewport : null);
export const alturaVisivel = (): number => vv()?.height ?? window.innerHeight;
export const topoVisivel = (): number => vv()?.offsetTop ?? 0;
/** Teclado aberto: a área visível encolheu bem mais do que uma barra do navegador. */
export const tecladoAberto = (): boolean => {
  const v = vv();
  return !!v && v.height < window.innerHeight - 140;
};

/* ------------------------------------------------------------ faixa */

/** A faixa da missão, grudada embaixo da barra de módulos (sticky junto com ela). */
export function FaixaDaMissao({ feitos, texto, aoPular, cumprida = false, titulo = "Missão de 1 minuto" }: { feitos: number; texto: ReactNode; aoPular?: () => void; cumprida?: boolean; /** o título à esquerda (a missão em doses diz "Missão · dia 1 de 3") */ titulo?: ReactNode }) {
  const reduzir = useReducedMotion();
  return (
    <div className="border-t border-border" style={{ background: cumprida ? `${VERDE_OK}14` : "hsl(var(--accent) / 0.07)" }} data-testid="demo-guia-faixa">
      <div className="max-w-5xl mx-auto pl-3 pr-1.5 pt-1 flex items-center gap-2 min-h-9">
        <span aria-hidden className="inline-block w-1.5 h-4 rounded-[3px] shrink-0" style={{ background: cumprida ? VERDE_OK : "hsl(var(--accent))" }} />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] whitespace-nowrap text-foreground">{titulo}</span>
        <span className="flex items-center gap-1" role="img" aria-label={`${feitos} de 3 feitos`}>
          {[0, 1, 2].map((i) => (
            // o quadradinho recém-marcado dá um pulo (planner: o ✓ é a recompensa)
            <motion.span key={i} className="inline-flex" animate={i < feitos && !reduzir ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.45, ease: "easeOut" }}>
              <Quadradinho marcado={i < feitos} />
            </motion.span>
          ))}
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

/* ------------------------------------------------------------ botões */

/** O botão de seguir de cada passo: branco em fundo grafite, grafite em fundo claro. */
export function BotaoSeguir({ children, onClick, claro = false, testid, cheio = false }: { children: ReactNode; onClick: () => void; claro?: boolean; testid?: string; cheio?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`${cheio ? "w-full min-h-12 rounded-xl text-[15px]" : "min-h-10 px-4 rounded-full text-[13px]"} inline-flex items-center justify-center gap-1.5 font-bold active:scale-[0.98] transition-transform`}
      style={claro ? { background: "#fff", color: GRAFITE } : { background: GRAFITE, color: "#fff" }}
    >
      {children} <ArrowRight className="w-4 h-4" />
    </button>
  );
}

/* ------------------------------------------------------------ passo 1 */

/** Onde acaba o que gruda no topo (barra de módulos + cabeçalho do módulo). */
const fundoDoTopoFixo = (): number => {
  let fundo = 0;
  document.querySelectorAll(".demo-tour-nav, header.sticky").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < alturaVisivel() / 2) fundo = Math.max(fundo, r.bottom);
  });
  return fundo;
};
/** Altura do CTA fixo de baixo ("Quase lá"), pra o balão não cair atrás dele. */
const alturaDoRodapeFixo = (): number => {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--teste-banner-h");
  return parseFloat(v) || 0;
};

/**
 * PASSO 1 DE 3 (30/09): o passo que já nasce feito ("área escolhida ✓") aparece
 * antes de a demo andar sozinha. Cartão solto embaixo do topo fixo: não
 * escurece nada, a demo continua tocável; só o botão recebe toque. Sai pelo
 * tempo ou por "Começar →".
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
      <div className="w-[88%] max-w-[340px] rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15 pointer-events-auto" style={{ background: GRAFITE }} role="status" data-testid="demo-guia-passo1">
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1.5">
          <Quadradinho marcado claro tam={13} /> Passo 1 de 3 · feito
        </span>
        <span className="block text-[14px] font-semibold leading-snug">Você começou por {modulo}. Próximo passo: <strong className="font-extrabold">{pedido}</strong> — é 1 toque, eu te mostro onde.</span>
        <div className="mt-3">
          <BotaoSeguir claro onClick={aoContinuar} testid="demo-guia-mostrar">Começar</BotaoSeguir>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

/* ------------------------------------------------------------ holofote */

/** Campo de texto em foco (o teclado do celular abre pra ele). */
const ehCampo = (el: unknown) => el instanceof HTMLElement
  && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

/**
 * DIGITANDO (30/09, print do dono no iPhone): com o teclado aberto o Safari
 * encolhe a área visível — o anel ia parar em cima das abas, o balão tapava o
 * campo e a tela ficava escura enquanto ela escrevia. Campo em foco OU teclado
 * aberto (visualViewport encolhido) = nada desenhado; fechou, volta no lugar.
 */
export function useDigitando(): boolean {
  const [digitando, setDigitando] = useState(false);
  useEffect(() => {
    const conferir = () => setDigitando(ehCampo(document.activeElement) || tecladoAberto());
    const entrou = (e: FocusEvent) => { if (ehCampo(e.target)) setDigitando(true); };
    // o Safari demora um instante pra devolver a área visível depois do blur
    const saiu = () => { window.setTimeout(conferir, 80); window.setTimeout(conferir, 400); };
    conferir();
    document.addEventListener("focusin", entrou);
    document.addEventListener("focusout", saiu);
    const v = vv();
    v?.addEventListener("resize", conferir);
    return () => {
      document.removeEventListener("focusin", entrou);
      document.removeEventListener("focusout", saiu);
      v?.removeEventListener("resize", conferir);
    };
  }, []);
  return digitando;
}

/**
 * `fixo` (30/09, dono: "quando clicamos em algo ela simplesmente pula o passo"):
 * toque fora, toque no próprio alvo e rolagem NÃO fecham o anel — ele segue o
 * alvo na rolagem e o escuro fica mais claro (a demo continua 100% tocável; o
 * escuro nunca intercepta toque). Só sai se o alvo sumir da tela (troca de aba)
 * ou pelo tempo (`duracao`; `null` = sem tempo). Sem `fixo`, as saídas de antes.
 *
 * `balao` é a peça que acompanha o anel (o post-it dos chips, o número do
 * passo 3) — com `interativo`, ela recebe toque (chips, botão de seguir).
 */
export function Anel({ alvo, recorte, balao, interativo = false, duracao = 12_000, aoSair, fixo = false, testid, abaixo = false }: {
  alvo: Element;
  recorte?: (el: Element) => Retangulo | null;
  balao: ReactNode;
  interativo?: boolean;
  duracao?: number | null;
  aoSair: (motivo: string) => void;
  fixo?: boolean;
  testid?: string;
  /** o balão prefere ficar EMBAIXO do anel (se couber) */
  abaixo?: boolean;
}) {
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [leve, setLeve] = useState(false);
  const digitando = useDigitando();
  const [posicao, setPosicao] = useState<{ top: number } | null>(null);
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
      const livre = alturaVisivel() - alturaDoRodapeFixo() - topo;
      // (balão embaixo: o anel sobe pra perto do topo, e o balão cabe abaixo dele)
      const destino = r.height > livre - 40 ? topo + 20 : topo + (livre - r.height) * (abaixo ? 0.22 : 0.62);
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
        // formulário cresceu, o teclado fechou) — o anel segue o alvo onde ele estiver
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
    vv()?.addEventListener("resize", aoRolar);
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
      vv()?.removeEventListener("resize", aoRolar);
      if (barra) barra.style.zIndex = zAntes;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);

  // balão: acima do anel se couber entre o topo fixo e o anel; senão, embaixo
  useLayoutEffect(() => {
    if (!rect || !balaoRef.current || digitando) return;
    const h = balaoRef.current.offsetHeight;
    const topoLivre = fundoDoTopoFixo() + 8;
    const fundoLivre = topoVisivel() + alturaVisivel() - alturaDoRodapeFixo() - 8;
    const emCima = rect.top - 14 - h;
    const embaixo = rect.bottom + 16;
    const cabeEmbaixo = embaixo + h <= fundoLivre;
    const top = abaixo && cabeEmbaixo ? embaixo : emCima >= topoLivre ? emCima : Math.min(embaixo, fundoLivre - h);
    setPosicao({ top: Math.max(topoLivre, top) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, digitando]);

  if (!rect || digitando) return null;
  const pad = 8;
  const largura = Math.min(window.innerWidth - 12, rect.width + pad * 2);
  const esquerda = Math.max(6, Math.min(rect.left - pad, window.innerWidth - 6 - largura));
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] pointer-events-none"
      data-camada-guia="demo-holofote"
      data-testid={testid}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
    >
      {/* o escuro é a sombra do anel — um elemento só, nada clicável */}
      <div
        className="absolute rounded-2xl pointer-events-none"
        style={{ top: rect.top - pad, left: esquerda, width: largura, height: rect.height + pad * 2, boxShadow: `0 0 0 9999px rgba(15,12,20,${leve ? 0.22 : 0.5})`, transition: "box-shadow .3s ease" }}
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
        className={`absolute left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] ${interativo ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ top: posicao?.top ?? -9999, visibility: posicao ? "visible" : "hidden" }}
      >
        {balao}
      </div>
    </motion.div>,
    document.body,
  );
}

/* ------------------------------------------------------------ post-it dos chips (passo 2) */

/**
 * O POST-IT DO PASSO 2: papel amarelo com fita magenta (o post-it do planner),
 * a pergunta e os chips prontos — 1 toque = o registro dela. "✎ escrever o
 * meu" leva o foco pro campo do módulo (o teclado abre e o anel sai de cena).
 * Sem chips (Rotina, Saúde): só a instrução — a ação é no próprio módulo.
 */
export function PostItDaMissao({ pergunta, chips, tocado, aoChip, aoEscrever, dica, rotulo = "Passo 2 de 3 · 1 toque", descricao }: {
  pergunta: string;
  chips: ChipDaMissao[];
  /** o chip que ela acabou de tocar (vira ✓ enquanto o registro aparece) */
  tocado?: string | null;
  aoChip: (chip: ChipDaMissao) => void;
  aoEscrever?: () => void;
  /** frase pequena embaixo (ex.: "ou escreve direto no campo") */
  dica?: string;
  /** o rótulo pequeno em cima da pergunta (a missão em doses diz "Agora · 1 toque") */
  rotulo?: string;
  /** uma frase explicando o toque, entre a pergunta e os chips */
  descricao?: string;
}) {
  const reduzir = useReducedMotion();
  return (
    <div className="relative" data-testid="demo-guia-postit">
      <span aria-hidden className="absolute -top-2 left-1/2 -translate-x-1/2 rotate-2 w-[76px] h-4 rounded-[2px] z-10" style={{ background: "hsl(330 65% 50% / 0.55)" }} />
      <motion.div
        className="rounded-md px-4 pt-3.5 pb-3.5 text-left shadow-[0_22px_44px_-18px_rgba(0,0,0,.7)]"
        style={{ background: AMARELO_POST_IT, color: TINTA_POST_IT, rotate: "-0.6deg" }}
        initial={reduzir ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] mb-1" style={{ color: "rgba(38,38,38,.6)" }}>{rotulo}</span>
        <span className="block text-[15px] font-extrabold leading-snug tracking-[-0.01em]">{pergunta}</span>
        {descricao && <span className="block text-[12.5px] leading-snug mt-1" style={{ color: "rgba(38,38,38,.75)" }}>{descricao}</span>}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c, i) => {
              const marcado = tocado === c.nome;
              return (
                <motion.button
                  key={c.nome}
                  type="button"
                  onClick={() => aoChip(c)}
                  data-testid="demo-guia-chip"
                  className="min-h-11 pl-3 pr-3.5 rounded-full text-[13.5px] font-bold inline-flex items-center gap-1.5 shadow-[0_2px_0_rgba(0,0,0,.12)] active:scale-95 transition-[transform,background-color,color]"
                  style={marcado ? { background: GRAFITE, color: "#fff" } : { background: "#fff", color: TINTA_POST_IT }}
                  initial={reduzir ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, scale: marcado ? [1, 1.08, 1] : 1 }}
                  transition={{ delay: reduzir ? 0 : 0.12 + i * 0.07, duration: 0.3 }}
                >
                  {marcado ? <Check className="w-4 h-4" strokeWidth={3.5} /> : <span aria-hidden>{c.emoji}</span>}
                  <span>{c.nome}</span>
                  {c.valor != null && <span className={marcado ? "text-white/70 font-semibold" : "font-semibold"} style={marcado ? undefined : { color: "rgba(38,38,38,.55)" }}>· R$ {reais(c.valor)}</span>}
                </motion.button>
              );
            })}
            {aoEscrever && (
              <motion.button
                type="button"
                onClick={aoEscrever}
                data-testid="demo-guia-escrever"
                className="min-h-11 px-3.5 rounded-full text-[13px] font-semibold border border-dashed active:scale-95 transition-transform"
                style={{ borderColor: "rgba(38,38,38,.45)", color: "rgba(38,38,38,.85)" }}
                initial={reduzir ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduzir ? 0 : 0.12 + chips.length * 0.07, duration: 0.3 }}
              >
                ✎ escrever o meu
              </motion.button>
            )}
          </div>
        )}
        {dica && <span className="block mt-2 text-[11.5px] font-semibold" style={{ color: "rgba(38,38,38,.6)" }}>{dica}</span>}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------ balão grafite (passo 3) */

/** O balão do passo 3: o número dela subindo e o botão de seguir. */
export function BalaoDoPasso3({ titulo, antes, depois, formatar, aoContinuar }: {
  titulo: ReactNode;
  antes: number;
  depois: number;
  formatar: (n: number) => string;
  aoContinuar: () => void;
}) {
  return (
    <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: GRAFITE }} data-testid="demo-guia-passo3">
      <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">Passo 3 de 3 · olha</span>
      <span className="block text-[13px] font-semibold text-white/85 leading-snug">{titulo}</span>
      <span className="flex items-baseline gap-2 mt-1">
        <span className="text-[13px] text-white/50 line-through tabular-nums">{formatar(antes)}</span>
        <span className="text-white/50 text-[13px]">→</span>
        <span className="text-[26px] font-black tracking-tight leading-none">
          <ContaSubindo de={antes} para={depois} formatar={formatar} />
        </span>
      </span>
      <div className="mt-3">
        <BotaoSeguir claro onClick={aoContinuar} testid="demo-guia-continuar">Continuar</BotaoSeguir>
      </div>
    </div>
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

/* ------------------------------------------------------------ comemoração (1º registro) */

/** O fundo escuro das comemorações: pointer-events none — o cartão é a única coisa tocável. */
function FundoDaFesta({ children, testid, camada }: { children: ReactNode; testid: string; camada: string }) {
  const reduzir = !!useReducedMotion();
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[210] pointer-events-none grid place-items-center px-6"
      data-camada-guia={camada}
      data-testid={testid}
      initial={reduzir ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0 : 0.3 }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(15,12,20,.55)" }} />
      {children}
    </motion.div>,
    document.body,
  );
}

/**
 * A COMEMORAÇÃO DO 1º REGISTRO — cópia parametrizada da `Celebracao` da
 * Missão do teste grátis (src/components/missao/MissaoDoTrial.tsx, "B3
 * pico"), a peça que converte no app. Copiada, não importada: aquele arquivo
 * é o caminho do teste grátis e não se mexe. O visual é o mesmo: fundo
 * rgba(15,12,20,.55), cartão branco com spring, o GRÁFICO QUE SOBE (path
 * magenta com pathLength animado + a bolinha no fim), título, chip preto com
 * 🔥 e a barra verde que pula de `de` pra `para`.
 *
 * 30/09: ganhou o BOTÃO de seguir ("Ver meu mês →") — o cartão não some mais
 * sem dizer o que fazer; andar sozinho (`duracao`) é só rede de segurança.
 * Texto do cartão com cor fixa (no modo escuro o título herdaria branco), por
 * portal (a barra de módulos tem backdrop-blur, que prende `fixed`), e com
 * "reduzir movimento" aparece o cartão pronto, sem animação.
 */
export function ComemoracaoDaMissao({ titulo, chip, de, para, rodape, duracao, aoFim, botao, aoBotao }: {
  titulo: string;
  chip: string;
  de: number;
  para: number;
  rodape: string;
  duracao: number | null;
  aoFim: () => void;
  botao: string;
  aoBotao: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const aoFimRef = useRef(aoFim);
  aoFimRef.current = aoFim;
  useEffect(() => {
    if (duracao == null) return;
    const t = window.setTimeout(() => aoFimRef.current(), duracao);
    return () => window.clearTimeout(t);
  }, [duracao]);
  return (
    <FundoDaFesta testid="demo-guia-comemoracao" camada="demo-comemoracao">
      <motion.div
        initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
        className="relative w-full max-w-[320px] rounded-3xl bg-white p-6 text-center text-[#16121c] shadow-2xl pointer-events-auto"
      >
        {/* o gráfico que sobe (Stripe: "o gráfico criou um cliente") */}
        <svg viewBox="0 0 200 84" className="w-full h-[84px] mb-3">
          <motion.path
            d="M8 72 L58 58 L104 62 L150 30 L192 12"
            fill="none" stroke={MAGENTA} strokeWidth="4" strokeLinecap="round"
            initial={reduzir ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.25 }}
          />
          <motion.circle
            cx="192" cy="12" r="6" fill={MAGENTA}
            initial={reduzir ? false : { scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 16, delay: 1.3 }}
          />
        </svg>
        <p className="text-[19px] font-black tracking-[-0.02em] leading-tight mb-1.5">{titulo}</p>
        <span className="inline-block max-w-full truncate rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3.5 py-1.5 mb-4">{chip}</span>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            data-testid="demo-guia-comemoracao-barra"
            initial={reduzir ? false : { width: `${de}%` }} animate={{ width: `${para}%` }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[11px] text-black/50 mt-1.5 font-semibold">{rodape}</p>
        <div className="mt-4">
          <BotaoSeguir cheio onClick={aoBotao} testid="demo-guia-ver">{botao}</BotaoSeguir>
        </div>
      </motion.div>
    </FundoDaFesta>
  );
}

/* ------------------------------------------------------------ confete */

const CORES_DO_CONFETE = [MAGENTA, "#FFD84D", VERDE_OK, "#3B82F6", GRAFITE];

/** Uma chuva curta de quadradinhos de papel (planner), sem biblioteca: 22 pedaços, 1,8 s, nunca toca nada. */
export function Confete({ pedacos = 22 }: { pedacos?: number }) {
  const reduzir = useReducedMotion();
  if (reduzir) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden data-testid="demo-guia-confete">
      {Array.from({ length: pedacos }).map((_, i) => {
        const x = 4 + ((i * 37) % 92);
        const largura = 6 + (i % 3) * 2;
        const lado = i % 2 ? 1 : -1;
        return (
          <motion.span
            key={i}
            className="absolute rounded-[2px]"
            style={{ left: `${x}%`, top: "-4%", width: largura, height: largura * 1.7, background: CORES_DO_CONFETE[i % CORES_DO_CONFETE.length] }}
            initial={{ y: 0, opacity: 0, rotate: 0, x: 0 }}
            animate={{ y: ["0vh", "110vh"], opacity: [0, 1, 1, 0.9, 0], rotate: lado * (240 + (i % 5) * 60), x: lado * (14 + (i % 4) * 10) }}
            transition={{ duration: 1.9 + (i % 4) * 0.25, delay: 0.15 + (i % 6) * 0.06, ease: [0.3, 0.6, 0.6, 1] }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ missão cumprida (final) */

/**
 * MISSÃO CUMPRIDA — a comemoração grande e a folha das duas saídas numa peça
 * só (30/09). O cartão do planner: a lista da missão com os 3 quadradinhos
 * marcando um a um (o que ela construiu), a barra 66 → 100%, confete, e as
 * duas saídas sempre visíveis: "Levar pros meus números →" (o mesmo destino do
 * "Quase lá", com o item) e "Ver os outros módulos". Não some sozinha: é ela
 * quem escolhe.
 */
export function MissaoCumprida({ linhas, destaque, titulo, sub, aoLevar, aoExplorar }: {
  /** as 3 linhas da missão, na ordem (a 2ª é o item dela) */
  linhas: [string, string, string];
  /** o rótulo do item ("Café · R$ 12") */
  destaque: string;
  titulo: string;
  sub: string;
  aoLevar: () => void;
  aoExplorar: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const passo = reduzir ? 0 : 0.28;
  return (
    <FundoDaFesta testid="demo-guia-cumprida" camada="demo-missao-cumprida">
      <Confete />
      <motion.div
        role="dialog"
        aria-modal="false"
        aria-label="Missão cumprida"
        data-state="open"
        initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
        className="relative w-full max-w-[340px] rounded-3xl bg-white text-[#16121c] shadow-2xl overflow-hidden pointer-events-auto"
      >
        {/* faixa verde do planner */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: VERDE_OK }}>
          <Quadradinho marcado claro tam={15} />
          <span className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white">Missão cumprida</span>
          <span className="text-[11px] font-extrabold text-white/85 tabular-nums">3/3</span>
          <motion.span
            aria-hidden
            className="ml-auto text-[22px] leading-none"
            initial={reduzir ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.25 + passo * 3 }}
          >
            🏆
          </motion.span>
        </div>
        <div className="px-5 pt-4 pb-4 text-left">
          {/* a lista da missão: os 3 quadradinhos marcando um a um */}
          <div className="rounded-xl border border-black/10 overflow-hidden divide-y divide-black/10" data-testid="demo-guia-lista">
            {linhas.map((l, i) => (
              <motion.div
                key={l}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-[13.5px] leading-snug ${i === 1 ? "font-bold" : ""}`}
                style={i === 1 ? { background: "#FFF8D6" } : undefined}
                initial={reduzir ? false : { opacity: 0.35, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * passo, duration: 0.25 }}
              >
                <motion.span className="inline-flex" initial={reduzir ? false : { scale: 0.6 }} animate={{ scale: [0.6, 1.3, 1] }} transition={{ delay: 0.2 + i * passo, duration: 0.4 }}>
                  <Quadradinho marcado tam={16} />
                </motion.span>
                <span className="min-w-0 flex-1">{l}</span>
              </motion.div>
            ))}
          </div>
          <div className="h-2 rounded-full bg-black/10 overflow-hidden mt-3.5">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              data-testid="demo-guia-comemoracao-barra"
              initial={reduzir ? false : { width: "66%" }} animate={{ width: "100%" }}
              transition={{ duration: 0.7, delay: 0.2 + passo * 3, ease: "easeOut" }}
            />
          </div>
          <p className="text-[11px] text-black/50 mt-1.5 font-semibold text-center">Missão de 1 minuto · 100%</p>
          <p className="text-[17px] font-extrabold tracking-tight leading-[1.25] mt-3.5">
            <span className="px-1 -mx-1 rounded-sm" style={{ background: "#FFF3B0", color: TINTA_POST_IT }}>{destaque}</span>{" "}
            {titulo}
          </p>
          <p className="text-[12.5px] leading-snug text-black/60 mt-1.5">{sub}</p>
          <div className="mt-4">
            <BotaoSeguir cheio onClick={aoLevar} testid="demo-guia-levar">Levar pros meus números</BotaoSeguir>
          </div>
          <button
            type="button"
            onClick={aoExplorar}
            data-testid="demo-guia-explorar"
            className="mt-1 w-full min-h-11 rounded-xl text-[13.5px] font-semibold text-black/65 hover:text-black"
          >
            Ver os outros módulos
          </button>
        </div>
      </motion.div>
    </FundoDaFesta>
  );
}

/* ------------------------------------------------------------ FUNIL B: o post-it das perguntas */

/**
 * O POST-IT SOLTO DAS PERGUNTAS (Funil B, 30/09): as 2 respostas do quiz viram
 * toques da missão. Papel amarelo com fita magenta, a pergunta e os chips das
 * opções (1 toque = a resposta dela). Sem anel e sem escuro: ele fica preso
 * embaixo do topo fixo, como o cartão do passo 1, e a demo continua tocável.
 * Em `eco`, o mesmo papel devolve o que ela disse (a tela de impacto do quiz
 * de hoje, dentro do app) com o botão de seguir.
 */
export function PostItDaPergunta({ passo, pergunta, chips, tocado, aoChip, eco, testid = "demo-guia-pergunta" }: {
  passo: string;
  pergunta: string;
  chips: Array<{ emoji: string; label: string }>;
  tocado?: string | null;
  aoChip: (label: string) => void;
  /** o eco da resposta: texto + botão de seguir (o papel troca de conteúdo) */
  eco?: { texto: ReactNode; botao: string; aoBotao: () => void } | null;
  testid?: string;
}) {
  const reduzir = useReducedMotion();
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => { setTop(fundoDoTopoFixo() + 12); }, []);
  return createPortal(
    <motion.div
      className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none"
      style={{ top: top ?? -9999, visibility: top == null ? "hidden" : "visible" }}
      data-camada-guia="demo-pergunta"
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
    >
      <div className="relative w-[92%] max-w-[360px] pointer-events-auto" data-testid={testid} data-eco={eco ? "1" : "0"}>
        <span aria-hidden className="absolute -top-2 left-1/2 -translate-x-1/2 rotate-2 w-[76px] h-4 rounded-[2px] z-10" style={{ background: "hsl(330 65% 50% / 0.55)" }} />
        <motion.div
          className="rounded-md px-4 pt-3.5 pb-3.5 text-left shadow-[0_22px_44px_-18px_rgba(0,0,0,.7)]"
          style={{ background: AMARELO_POST_IT, color: TINTA_POST_IT, rotate: "-0.6deg" }}
          initial={reduzir ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] mb-1" style={{ color: "rgba(38,38,38,.6)" }}>{passo}</span>
          {eco ? (
            <div data-testid={`${testid}-eco`}>
              <span className="block text-[15px] font-extrabold leading-snug tracking-[-0.01em]">{eco.texto}</span>
              <div className="mt-3">
                <BotaoSeguir onClick={eco.aoBotao} testid={`${testid}-seguir`}>{eco.botao}</BotaoSeguir>
              </div>
            </div>
          ) : (
            <>
              <span className="block text-[15px] font-extrabold leading-snug tracking-[-0.01em]">{pergunta}</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((c, i) => {
                  const marcado = tocado === c.label;
                  return (
                    <motion.button
                      key={c.label}
                      type="button"
                      onClick={() => aoChip(c.label)}
                      data-testid={`${testid}-chip`}
                      className="min-h-11 pl-3 pr-3.5 rounded-full text-[13.5px] font-bold inline-flex items-center gap-1.5 shadow-[0_2px_0_rgba(0,0,0,.12)] active:scale-95 transition-[transform,background-color,color]"
                      style={marcado ? { background: GRAFITE, color: "#fff" } : { background: "#fff", color: TINTA_POST_IT }}
                      initial={reduzir ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, scale: marcado ? [1, 1.08, 1] : 1 }}
                      transition={{ delay: reduzir ? 0 : 0.1 + i * 0.06, duration: 0.3 }}
                    >
                      {marcado ? <Check className="w-4 h-4" strokeWidth={3.5} /> : <span aria-hidden>{c.emoji}</span>}
                      <span>{c.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>,
    document.body,
  );
}

