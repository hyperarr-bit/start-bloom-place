import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight, Instagram, Lock, X } from "lucide-react";
import { RARIDADE_PLURAL, categoriaDe, fracaoDe, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { parseLocalDay } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { AdesivoRaro, ChipRaridade } from "./adesivos-raridade";
import { giroDoAdesivo } from "./adesivos-arte";
import { CapaAlbum } from "./CapaAlbum";
import { Destacar } from "./GradeAdesivos";
import { ORDEM_RARIDADE, RARIDADE_FEM, TITULO_SECAO, contagemDaPagina, resumoRaridades, tituloDaPagina, type PaginaAlbum } from "./album-paginas";
import "./conquistas.css";

/**
 * O ÁLBUM DE FIGURINHAS EM TELA CHEIA (27/09): mesa escura, o álbum com a
 * lombada magenta e a pilha de páginas à direita; a capa VIRA na lombada e
 * revela a página 1, e as figurinhas COLAM uma a uma. Páginas: OS MAIS RAROS
 * (banda magenta; com pouca figurinha, PRÓXIMAS A COLAR e a dica), depois
 * LENDÁRIOS (foil ouro) · ÉPICOS (holográfico) · RAROS (azul) · COMUNS
 * (grafite) — cada VAGA numerada ("Nº 46"), tracejada quando vazia com a
 * silhueta e a pílula do progresso; colada, a figurinha cobre o número, um
 * pouco torta. Abas coloridas na borda pulam de seção; setas e bolinhas
 * embaixo; a página vira como folha. Toque numa vaga abre o detalhe.
 *
 * A lógica das páginas é a de `album-paginas.ts` (não muda nada dela).
 */

/** O número da figurinha = a posição na coleção (a ordem do catálogo, como num álbum de verdade). */
export const numeroDaFigurinha = (adesivos: Badge[], id: string): number => adesivos.findIndex((b) => b.id === id) + 1;
export const nDeDois = (n: number) => String(n).padStart(2, "0");

const ROTA_PADRAO = (b: Badge) => b.rota ?? { caminho: categoriaDe(b.category).rota, nome: b.category === "sequencia" || b.category === "geral" ? "Home" : categoriaDe(b.category).label };

interface VagaProps {
  b: Badge;
  n: number;
  tam: number;
  indice: number;
  /** Atraso (ms) pra colar com o pop; undefined = já colada. */
  cola?: number;
  ativa: boolean;
  onSelecionar: (b: Badge) => void;
}

const Vaga = ({ b, n, tam, indice, cola, ativa, onSelecionar }: VagaProps) => {
  const raridade = raridadeDe(b);
  const cx = tam + 14;
  const rotulo = b.unlocked ? null : rotuloProgresso(b);
  return (
    <button type="button" className="vaga" data-id={b.id} data-vaga={b.id} data-aberta={b.unlocked ? "true" : "false"} data-rar={raridade} onClick={() => onSelecionar(b)} tabIndex={ativa ? 0 : -1} style={{ width: cx }}>
      <span className="vaga-caixa" style={{ width: cx, height: cx }}>
        <span className="vaga-n">Nº {nDeDois(n)}</span>
        {b.unlocked ? (
          <span className="vaga-fig" data-cola={cola !== undefined ? "" : undefined} style={{ "--d": `${cola ?? 0}ms` } as CSSProperties}>
            <AdesivoRaro id={b.id} raridade={raridade} tamanho={tam} giro={giroDoAdesivo(indice)} />
          </span>
        ) : (
          <span className="vaga-fig" style={{ opacity: 0.9 }}>
            <AdesivoRaro id={b.id} raridade={raridade} tamanho={tam - 8} trancado />
          </span>
        )}
        {!b.unlocked && b.progresso && b.progresso.atual > 0 && <span className="vaga-pill" data-testid="pilula-figurinha">{rotulo ?? <Lock className="w-3 h-3" aria-label="Trancado" />}</span>}
      </span>
      <span className="vaga-nome" data-falta={b.unlocked ? undefined : ""}>{b.name}</span>
    </button>
  );
};

interface PaginaProps {
  p: PaginaAlbum;
  indice: number;
  total: number;
  largura: number;
  adesivos: Badge[];
  ativa: boolean;
  /** Ids que colam com o pop nesta montagem (com o atraso base). */
  colar: Set<string> | null;
  atrasoBase: number;
  diasDeSequencia: number;
  onSelecionar: (b: Badge) => void;
}

const Pagina = ({ p, indice, total, largura, adesivos, ativa, colar, atrasoBase, diasDeSequencia, onSelecionar }: PaginaProps) => {
  const grande = p.tipo === "mais-raros";
  const col = grande ? 3 : 4, gap = grande ? 10 : 6;
  const tam = grande ? Math.min(84, Math.floor((largura - 34 - gap * 2) / 3) - 14) : Math.min(60, Math.floor((largura - 34 - gap * 3) / 4) - 14);
  const proximo = p.proximos[0];
  const colaDe = (b: Badge, j: number) => (colar && b.unlocked && colar.has(b.id) ? atrasoBase + j * 90 : undefined);
  return (
    <div className="alb-pag" data-pagina={p.id} data-testid={`album-tela-pagina-${indice}`} aria-hidden={!ativa}>
      {grande ? (
        <div className="alb-secao" data-rar="destaque"><span>{p.titulo}</span><b>{p.abertos} de {p.total}</b></div>
      ) : (
        <div className="alb-secao" data-rar={p.raridade}><span>{tituloDaPagina(p)}</span><b>{p.total > p.abertos ? contagemDaPagina(p) : `${p.abertos} de ${p.total} · completa!`}</b></div>
      )}
      <div className="alb-grade" style={{ gridTemplateColumns: `repeat(${col}, 1fr)`, gap: `${grande ? 10 : 4}px ${gap}px` }}>
        {p.vagas.map((b, j) => <Vaga key={b.id} b={b} n={numeroDaFigurinha(adesivos, b.id)} tam={tam} indice={j} cola={colaDe(b, j)} ativa={ativa} onSelecionar={onSelecionar} />)}
      </div>
      {grande && p.proximos.length > 0 && (
        <>
          <div className="alb-subsecao">PRÓXIMAS A COLAR</div>
          <div className="alb-grade" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: `10px ${gap}px` }}>
            {p.proximos.map((b, j) => <Vaga key={b.id} b={b} n={numeroDaFigurinha(adesivos, b.id)} tam={tam} indice={j} ativa={ativa} onSelecionar={onSelecionar} />)}
          </div>
        </>
      )}
      {grande && proximo && (
        <p className="alb-dica" data-testid="album-tela-dica">
          {p.vagas.length ? "As próximas já têm vaga marcada. " : "Cada coisa anotada cola uma figurinha aqui. "}
          A mais perto: <b>{proximo.name}</b> — <mark><Destacar texto={textoFalta(proximo, diasDeSequencia)} /></mark>.
        </p>
      )}
      <div className="alb-pag-num">{indice + 1} / {total}</div>
    </div>
  );
};

interface DetalheProps {
  b: Badge;
  n: number;
  desbloqueadoEm?: string;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  diasDeSequencia: number;
  onFechar: () => void;
  onPostar: (b: Badge) => void;
  onIr: (caminho: string) => void;
}

/** O detalhe da vaga (folha por cima da mesa): "FIGURINHA Nº 46", o chip, o que falta ou quando colou. */
const DetalheFigurinha = ({ b, n, desbloqueadoEm, porRaridade, diasDeSequencia, onFechar, onPostar, onIr }: DetalheProps) => {
  const raridade = raridadeDe(b);
  const conta = porRaridade[raridade];
  const colada = desbloqueadoEm ? parseLocalDay(desbloqueadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : null;
  const destino = ROTA_PADRAO(b);
  return (
    <>
      <motion.div className="absolute inset-0 z-[5]" style={{ background: "rgba(0,0,0,.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} aria-hidden />
      <motion.div className="fig-detalhe" role="dialog" aria-modal="true" aria-label={b.name} data-testid="detalhe-vaga" data-vaga-detalhe={b.id} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
        <div className="fig-detalhe-puxador" />
        <div className="flex items-center gap-3.5">
          <span className="shrink-0 w-[116px] h-[116px] grid place-items-center"><AdesivoRaro id={b.id} raridade={raridade} tamanho={112} bordaGrossa trancado={!b.unlocked} /></span>
          <div className="min-w-0">
            <div className="pin-rot text-muted-foreground">Figurinha Nº {nDeDois(n)}</div>
            <div className="text-[20px] font-black tracking-tight leading-[1.1] mt-0.5 mb-1.5">{b.name}</div>
            <ChipRaridade raridade={raridade} tam="m" texto={b.unlocked ? RARIDADE_FEM[raridade] : `A caminho · ${RARIDADE_FEM[raridade]}`} />
          </div>
        </div>
        {b.unlocked ? (
          <p className="text-[13px] text-muted-foreground mt-3.5 leading-[1.4]">
            {colada ? <>Colada em <b className="text-foreground">{colada}</b>. </> : null}
            {conta ? `Uma das ${conta.total} ${RARIDADE_PLURAL[raridade]} do CORE` : RARIDADE_FEM[raridade]}{raridade === "epico" ? " — vem com a borda holográfica." : raridade === "lendario" ? " — brilha em ouro." : "."}
          </p>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground mt-3.5 leading-[1.4]">Falta <b className="text-foreground"><Destacar texto={textoFalta(b, diasDeSequencia)} /></b> pra colar.</p>
            {b.progresso && (
              <>
                <div className="det-barra"><i style={{ width: `${Math.round(fracaoDe(b) * 100)}%` }} /></div>
                <div className="text-[11px] font-extrabold text-muted-foreground mt-1 text-right tabular-nums">{rotuloProgresso(b)}</div>
              </>
            )}
          </>
        )}
        <div className="flex flex-col gap-1 mt-4">
          {b.unlocked ? (
            <button type="button" onClick={() => onPostar(b)} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2" data-testid="vaga-postar">
              <Instagram className="w-4 h-4" aria-hidden /> Postar esta figurinha
            </button>
          ) : (
            <button type="button" onClick={() => onIr(destino.caminho)} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2" data-testid="vaga-ir">
              Ir pra {destino.nome} <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          )}
          <button type="button" onClick={onFechar} className="h-10 rounded-xl text-[13px] font-bold text-muted-foreground">Fechar</button>
        </div>
      </motion.div>
    </>
  );
};

export interface AlbumTelaProps {
  aberto: boolean;
  paginas: PaginaAlbum[];
  adesivos: Badge[];
  desbloqueadas: Record<string, string>;
  /** Coladas desde a última abertura: colam com o pop quando a página aparece. */
  novas: string[];
  maisRaros: Badge[];
  abertos: number;
  total: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  nome: string;
  nivel: string;
  ano: number;
  diasDeSequencia: number;
  /** Abre direto nesta página (o pacotinho abre na página da figurinha nova). */
  paginaInicial?: number;
  /** De onde veio a abertura (vai no evento `album_abrir`). */
  via?: "card" | "pacotinho";
  onFechar: () => void;
  onCompartilhar: () => void;
  onCompartilharFigurinha: (b: Badge) => void;
}

/**
 * A VIRADA 2.5D (02/10 à noite; a de b6e2dfad — folha só até o perfil — tirou
 * a página em branco do iPhone, mas o dono viu "sobreposição/bug": "quero
 * parecer um livro de verdade"). Agora a folha é uma FOLHA:
 *   · duas faces (frente = a página, verso = o papel), girando na lombada de
 *     0° a −180° com perspectiva; a partir de 90° aparece o verso;
 *   · o sombreamento da frente escurece conforme deita, o verso nasce com luz
 *     e um brilho de "dobra" corre pela folha com o ângulo (leve curvatura);
 *   · a folha PROJETA sombra na página de baixo (cresce até 90°, some a 180°);
 *   · ARRASTAR com o dedo: a folha acompanha; soltar passada de 1/3 (ou com
 *     velocidade) completa, senão volta; voltar é o espelho (a folha de
 *     destino desdobra da lombada, −180° → 0°);
 *   · NUNCA página em branco: o destino está montado e inteiro por baixo
 *     desde o 1º quadro; toques rápidos trocam a folha na hora (chave nova);
 *   · a capa é a mesma folha (frente = capa, verso = a 2ª capa, "este álbum
 *     pertence a…"), sempre na frente, até deitar;
 *   · tudo em transform/opacity (compositor; fluido no WebView); "reduzir
 *     movimento" = troca simples, sem folha;
 *   · cada página é um contexto de empilhamento (`isolation`): a pílula do
 *     progresso não vaza por cima da folha.
 * Avaliei StPageFlip/react-pageflip: no modo HTML a folha também é rígida
 * (a dobra "soft" é só pra imagens em canvas), exige tamanho fixo e pesa ~45
 * KB gzip — não ganharia nada sobre isto aqui.
 */
export const DURACAO_VIRADA_MS = 560;
/** A capa fica parada este tempo antes de virar (a pessoa vê a capa). */
export const CAPA_PARADA_MS = 500;
export const CAPA_GIRO_MS = 640;
/** O instante em que a capa revela a 1ª página (passa do perfil) = quando as figurinhas começam a colar. */
export const CAPA_REVELA_MS = CAPA_PARADA_MS + Math.round(CAPA_GIRO_MS * 0.45);
/** Quando a capa deitou de vez e sai da tela (com a folga da rede de segurança). */
export const CAPA_SAI_MS = CAPA_PARADA_MS + CAPA_GIRO_MS + 120;
/** Passada desta fração, soltar completa a virada. */
export const FRACAO_PRA_COMPLETAR = 0.34;
/** Velocidade (graus/ms) que completa mesmo antes da fração. */
const VELOCIDADE_PRA_COMPLETAR = 0.35;
/** Arrasto mínimo (px) pra virar um gesto. */
const ARRASTO_MINIMO = 8;
const EASE_FRENTE: [number, number, number, number] = [0.42, 0, 0.3, 1];

interface Virada {
  /** A folha que gira por cima: pra frente é a página que sai; pra trás, a que entra. */
  sobre: PaginaAlbum;
  sobreIndice: number;
  /** O que fica por baixo enquanto gira: pra frente é a página de destino; pra trás, a que sai. */
  fundo: PaginaAlbum;
  fundoIndice: number;
  dir: 1 | -1;
  chave: number;
  /** Onde a folha termina quando completa (índice de página). */
  alvo: number;
  /** Veio do dedo (o ângulo é do gesto) ou de um toque (anima sozinha). */
  manual: boolean;
}

/** O ângulo por onde a folha passa de perfil (a frente some, o verso aparece). */
const PERFIL = -90;
/** Câmera lenta SÓ no servidor de desenvolvimento (prints/vídeo): `window.__coreCameraLenta = 6` deixa a virada 6× mais lenta. */
const lento = (): number => {
  if (!import.meta.env.DEV || typeof window === "undefined") return 1;
  const v = Number((window as unknown as { __coreCameraLenta?: unknown }).__coreCameraLenta);
  return Number.isFinite(v) && v >= 1 ? v : 1;
};

/**
 * A FOLHA 3D: frente, verso, o sombreamento e o brilho de dobra — tudo
 * derivado do ângulo (motion value), sem re-render.
 */
const Folha3D = ({ rot, frente, verso, zIndex, raio, testid, dir, pagina }: {
  rot: MotionValue<number>; frente: ReactNode; verso: ReactNode; zIndex: number; raio: string; testid: string; dir: 1 | -1; pagina?: string;
}) => {
  // a frente escurece até o perfil; o verso nasce iluminado e assenta
  const sombraFrente = useTransform(rot, [0, PERFIL], [0, 0.55]);
  const luzVerso = useTransform(rot, [PERFIL, -180], [0.5, 0]);
  // QUAL FACE APARECE é decidida pelo ângulo, não por `backface-visibility` (02/10: no WebKit, uma face com
  // overflow/stacking próprio ignora o backface e o verso era pintado por cima da frente — a "folha em branco")
  const frenteVisivel = useTransform(rot, (v) => (v > PERFIL ? 1 : 0));
  const versoVisivel = useTransform(rot, (v) => (v > PERFIL ? 0 : 1));
  // o brilho da dobra corre da borda externa até a lombada enquanto a folha levanta
  const dobraX = useTransform(rot, [0, PERFIL], ["78%", "-20%"]);
  const dobraOpacidade = useTransform(rot, [0, -25, -70, PERFIL], [0, 0.35, 0.35, 0]);
  return (
    <motion.div
      className="alb-folha-3d"
      data-testid={testid}
      data-dir={dir > 0 ? "frente" : "tras"}
      data-pagina={pagina}
      style={{ rotateY: rot, zIndex, borderRadius: raio }}
      aria-hidden
    >
      <motion.div className="alb-face alb-face-frente" style={{ borderRadius: raio, opacity: frenteVisivel }}>
        {frente}
        <motion.div className="alb-face-sombra" style={{ opacity: sombraFrente }} />
        <motion.div className="alb-face-dobra" style={{ left: dobraX, opacity: dobraOpacidade }} />
      </motion.div>
      <motion.div className="alb-face alb-face-verso" style={{ borderRadius: raio, opacity: versoVisivel }}>
        {verso}
        <motion.div className="alb-face-luz" style={{ opacity: luzVerso }} />
      </motion.div>
    </motion.div>
  );
};

/** A sombra que a folha projeta na página de baixo (cresce até o perfil, some deitada). */
const SombraProjetada = ({ rot }: { rot: MotionValue<number> }) => {
  const opacidade = useTransform(rot, [0, -30, PERFIL, -150, -180], [0, 0.3, 0.5, 0.3, 0]);
  const escala = useTransform(rot, (v) => Math.max(0.05, Math.abs(Math.sin((v * Math.PI) / 180))));
  return <motion.div className="alb-sombra-projetada" style={{ opacity: opacidade, scaleX: escala }} aria-hidden />;
};

/** O verso de uma página do álbum: papel com a trama e um carimbo discreto. */
const VersoDaPagina = ({ ano }: { ano: number }) => (
  <div className="alb-verso">
    <span className="alb-verso-carimbo">ÁLBUM CORE · {ano}</span>
  </div>
);

/** A 2ª capa (o verso da capa): "este álbum pertence a …". */
const VersoDaCapa = ({ nome, ano }: { nome: string; ano: number }) => (
  <div className="alb-verso alb-verso-capa">
    <div className="alb-verso-dono">
      <span>este álbum pertence a</span>
      <b>{nome}</b>
      <i>CORE · {ano}</i>
    </div>
  </div>
);

export const AlbumTela = ({ aberto, paginas, adesivos, desbloqueadas, novas, maisRaros, abertos, total, porRaridade, nome, nivel, ano, diasDeSequencia, paginaInicial = 0, via = "card", onFechar, onCompartilhar, onCompartilharFigurinha }: AlbumTelaProps) => {
  const reduzir = useReducedMotion();
  const navigate = useNavigate();
  const n = paginas.length;
  const inicial = Math.max(0, Math.min(n - 1, paginaInicial));
  const [atual, setAtual] = useState(inicial);
  const [virando, setVirando] = useState<Virada | null>(null);
  const [capaVisivel, setCapaVisivel] = useState(false);
  const [capaGirada, setCapaGirada] = useState(false);
  const [detalhe, setDetalhe] = useState<Badge | null>(null);
  const [largura, setLargura] = useState(330);
  /**
   * Ainda na página de abertura? As figurinhas dela colam com o pop quando a
   * capa revela a página — e SÓ ali. (02/10: a lista de "colar" levava as 6
   * mais raras, que também moram nas páginas das seções: virar pra LENDÁRIOS
   * ou ÉPICOS logo depois de abrir mostrava a página sem as figurinhas por
   * 260 ms + a cadência — a "página bege vazia" do vídeo.)
   */
  const [abertura, setAbertura] = useState(true);
  const novasSet = useRef<Set<string>>(new Set());
  /** O ângulo da folha que está virando (0 → −180 pra frente; −180 → 0 pra trás). */
  const rot = useMotionValue(0);
  const rotCapa = useMotionValue(0);
  const animacao = useRef<ReturnType<typeof animate> | null>(null);

  useLayoutEffect(() => {
    if (typeof window !== "undefined") setLargura(Math.min(330, Math.max(240, window.innerWidth - 48)));
  }, [aberto]);

  // abrir: a capa vira na lombada e as figurinhas da página de abertura colam uma a uma
  useEffect(() => {
    if (!aberto) { setAtual(0); setVirando(null); setDetalhe(null); setCapaVisivel(false); setCapaGirada(false); return; }
    setAtual(inicial);
    setVirando(null);
    setAbertura(true);
    // só as figurinhas NOVAS colam com o pop nas páginas delas; as da página de
    // abertura colam uma vez, na abertura (ver `colar` abaixo)
    novasSet.current = new Set(novas);
    trackEvent("album_abrir", { adesivos: abertos, novas: novas.length, via, pagina: inicial });
    if (reduzir) return;
    setCapaVisivel(true);
    setCapaGirada(false);
    rotCapa.set(0);
    let a: ReturnType<typeof animate> | null = null;
    const t1 = setTimeout(() => {
      setCapaGirada(true);
      a = animate(rotCapa, -180, { duration: (CAPA_GIRO_MS * lento()) / 1000, ease: EASE_FRENTE, onComplete: () => setCapaVisivel(false) });
    }, CAPA_PARADA_MS);
    // rede de segurança: se o fim da animação não avisar, a capa sai no tempo dela
    const t2 = setTimeout(() => setCapaVisivel(false), CAPA_PARADA_MS + CAPA_GIRO_MS * lento() + 120);
    return () => { clearTimeout(t1); clearTimeout(t2); a?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // a tela por baixo não rola enquanto o álbum está aberto; Esc fecha
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detalhe) setDetalhe(null);
      else onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = anterior; window.removeEventListener("keydown", tecla); };
  }, [aberto, detalhe, onFechar]);

  const chaveDaVirada = useRef(0);
  const terminarVirada = useCallback((chave: number) => setVirando((v) => (v && v.chave === chave ? null : v)), []);

  /** Monta a virada de `de` pra `alvo` (sem animar): a folha e o que fica por baixo. */
  const montarVirada = useCallback((de: number, alvo: number, manual: boolean): Virada => {
    const dir: 1 | -1 = alvo > de ? 1 : -1;
    chaveDaVirada.current += 1;
    return dir > 0
      ? { sobre: paginas[de], sobreIndice: de, fundo: paginas[alvo], fundoIndice: alvo, dir, chave: chaveDaVirada.current, alvo, manual }
      : { sobre: paginas[alvo], sobreIndice: alvo, fundo: paginas[de], fundoIndice: de, dir, chave: chaveDaVirada.current, alvo, manual };
  }, [paginas]);

  const irPara = useCallback((i: number) => {
    const alvo = Math.max(0, Math.min(n - 1, i));
    if (alvo === atual) return;
    if (!reduzir) {
      // toques rápidos em sequência: cada toque é uma virada nova (chave própria); a anterior sai na hora
      animacao.current?.stop();
      const v = montarVirada(atual, alvo, false);
      rot.set(v.dir > 0 ? 0 : -180);
      setVirando(v);
      animacao.current = animate(rot, v.dir > 0 ? -180 : 0, { duration: (DURACAO_VIRADA_MS * lento()) / 1000, ease: EASE_FRENTE, onComplete: () => terminarVirada(v.chave) });
    }
    setAtual(alvo);
    setAbertura(false);
    trackEvent("album_pagina", { indice: alvo, secao: paginas[alvo]?.id });
  }, [atual, n, paginas, reduzir, montarVirada, rot, terminarVirada]);

  // a folha some quando a animação termina (onComplete); este relógio é a rede de segurança
  useEffect(() => {
    if (!virando || virando.manual) return;
    const t = setTimeout(() => setVirando((v) => (v && v.chave === virando.chave ? null : v)), DURACAO_VIRADA_MS * lento() + 200);
    return () => clearTimeout(t);
  }, [virando]);

  /* ------------------------------------------------------------ o dedo */
  const gesto = useRef<{ x0: number; t0: number; ultimoX: number; ultimoT: number; virada: Virada | null; arrastou: boolean } | null>(null);
  const aoPressionar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (detalhe || capaVisivel || e.pointerType === "mouse" && e.button !== 0) return;
    gesto.current = { x0: e.clientX, t0: Date.now(), ultimoX: e.clientX, ultimoT: Date.now(), virada: null, arrastou: false };
  };
  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    if (!g.virada) {
      if (Math.abs(dx) < ARRASTO_MINIMO) return;
      const alvo = dx < 0 ? atual + 1 : atual - 1;
      if (alvo < 0 || alvo >= n) { gesto.current = null; return; }
      if (reduzir) { gesto.current = null; irPara(alvo); return; }
      animacao.current?.stop();
      // uma folha já animando: o gesto assume o controle dela
      const v = montarVirada(atual, alvo, true);
      g.virada = v;
      g.arrastou = true;
      rot.set(v.dir > 0 ? 0 : -180);
      setVirando(v);
      setAbertura(false);
      try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
    }
    const v = g.virada;
    // o ângulo acompanha o dedo: a largura inteira = 180° (um pouco mais rápido que o dedo, como papel)
    const fracao = Math.max(0, Math.min(1, (Math.abs(dx) / Math.max(120, largura)) * 1.25));
    rot.set(v.dir > 0 ? -180 * fracao : -180 + 180 * fracao);
    g.ultimoX = e.clientX;
    g.ultimoT = Date.now();
  };
  const aoSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || !g.virada) return;
    const v = g.virada;
    const angulo = rot.get();
    const fracao = v.dir > 0 ? Math.abs(angulo) / 180 : 1 - Math.abs(angulo) / 180;
    const dt = Math.max(1, Date.now() - g.ultimoT);
    const velocidade = Math.abs(g.ultimoX - g.x0) / Math.max(1, Date.now() - g.t0) * (180 / Math.max(120, largura)) * 1.25; // graus/ms, média do gesto
    const completa = fracao >= FRACAO_PRA_COMPLETAR || (velocidade >= VELOCIDADE_PRA_COMPLETAR && dt < 160);
    const fim = completa ? (v.dir > 0 ? -180 : 0) : (v.dir > 0 ? 0 : -180);
    const restante = Math.abs(fim - angulo) / 180;
    if (completa) {
      setAtual(v.alvo);
      trackEvent("album_pagina", { indice: v.alvo, secao: paginas[v.alvo]?.id, via: "arrasto" });
    }
    animacao.current?.stop();
    animacao.current = animate(rot, fim, { duration: Math.max(0.16, (DURACAO_VIRADA_MS * lento() / 1000) * restante), ease: EASE_FRENTE, onComplete: () => terminarVirada(v.chave) });
    // rede de segurança do gesto
    setTimeout(() => terminarVirada(v.chave), DURACAO_VIRADA_MS * lento() + 200);
  };
  // um arrasto não vira toque numa vaga
  const aoClicarCapturando = (e: React.MouseEvent<HTMLDivElement>) => {
    if (virando?.manual) { e.stopPropagation(); e.preventDefault(); }
  };

  // cada figurinha NOVA cola UMA vez: depois que a página dela apareceu, sai da lista (voltar à página não cola de novo)
  useEffect(() => {
    if (!aberto) return;
    const ids = [...paginas[Math.min(atual, n - 1)].vagas, ...paginas[Math.min(atual, n - 1)].proximos].map((b) => b.id);
    const t = setTimeout(() => { for (const id of ids) novasSet.current.delete(id); }, 2600);
    return () => clearTimeout(t);
  }, [aberto, atual, paginas, n]);

  if (!aberto) return null;
  const pagina = paginas[Math.min(atual, n - 1)];
  // o que cola com o pop nesta página: as novas (sempre) + as da página de abertura (só na abertura)
  const colar: Set<string> | null = abertura && !reduzir
    ? new Set([...novasSet.current, ...paginas[inicial].vagas.map((b) => b.id)])
    : novasSet.current.size ? novasSet.current : null;
  const abas = [{ id: "mais-raros", rot: "★", rar: "destaque" as const }, ...ORDEM_RARIDADE.map((r) => ({ id: paginas.find((p) => p.raridade === r)?.id ?? "", rot: TITULO_SECAO[r].slice(0, 3), rar: r })).filter((s) => s.id)];
  const ativaAba = (s: { id: string; rar: string }) => pagina.id === s.id || (pagina.raridade && pagina.raridade === s.rar);
  const alturaCapa = Math.round(largura * 1.42);
  const RAIO = "6px 14px 14px 6px";
  // o que fica por baixo enquanto a folha gira: pra frente é o destino; pra trás, a que sai. Quando a virada
  // manual volta atrás (soltou cedo), `atual` não mudou e a folha deita de novo sobre a mesma página.
  const fundo = virando ? virando.fundo : pagina;
  const fundoIndice = virando ? virando.fundoIndice : atual;

  return (
    <motion.div className="alb-tela" role="dialog" aria-modal="true" aria-label="Álbum de figurinhas" data-testid="album-tela" data-atual={atual} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0.1 : 0.2 }}>
      {/* 27/09 (dono: "o X não tá aparecendo"): a faixa tinha 56 px FIXOS com o recuo da
          câmera dentro — no iPhone o X subia pra baixo da barra de status. Recuo por fora, e pela
          --app-safe-top (a compensação do Android de WebView velho), igual à prévia. */}
      <div className="shrink-0" style={{ paddingTop: "var(--app-safe-top)" }}>
      {/* `border-0` nos botões redondos (varredura 27/09): o fundo deles vem do conquistas.css, então a regra
          global do alvo de toque (index.css, botão só-ícone "sem fundo") os pegava — 8 px de padding em
          content-box e margem −8 px: o círculo de 40 virava 56 e colava na borda da tela (as setas, 34 → 50).
          A classe "border" é uma das saídas daquela regra; a borda já é 0 no CSS. */}
      <div className="alb-topo">
        <button type="button" className="alb-redondo border-0" onClick={onFechar} aria-label="Fechar o álbum" data-testid="album-fechar"><X className="w-5 h-5" /></button>
        <div className="flex-1 leading-[1.2] min-w-0">
          <b className="block text-[14px] font-black truncate">Álbum CORE {ano}</b>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,.65)" }}>{abertos} de {total} · faltam {total - abertos}</span>
        </div>
        <button type="button" className="alb-redondo border-0" onClick={onCompartilhar} aria-label="Compartilhar meu álbum"><Instagram className="w-[18px] h-[18px]" /></button>
      </div>
      </div>

      <div className="alb-mesa">
        <motion.div className="alb-livro" style={{ width: largura }} initial={reduzir ? false : { y: 26, scale: 0.965 }} animate={{ y: 0, scale: 1 }} transition={{ duration: 0.48, ease: "easeOut" }}>
          <div className="alb-lombada" />
          <div className="alb-pilha" />
          <div
            className="alb-folha"
            data-folha=""
            data-arrastavel=""
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
            onClickCapture={aoClicarCapturando}
          >
            {/* a página de baixo: pra frente já é a de destino (inteira, desde o 1º quadro); pra trás é a que sai */}
            <Pagina p={fundo} indice={fundoIndice} total={n} largura={largura} adesivos={adesivos} ativa={!virando} colar={colar} atrasoBase={capaVisivel ? CAPA_REVELA_MS : 260} diasDeSequencia={diasDeSequencia} onSelecionar={setDetalhe} />
            {virando && <SombraProjetada rot={rot} />}
            {/* a folha que gira: frente = a página, verso = o papel; some deitada (−180°, fora do livro) — um
                toque rápido em sequência troca a folha pela nova (chave) sem sobra */}
            {virando && (
              <Folha3D
                key={virando.chave}
                rot={rot}
                zIndex={3}
                raio={RAIO}
                testid="album-virando"
                dir={virando.dir}
                pagina={virando.sobre.id}
                frente={<Pagina p={virando.sobre} indice={virando.sobreIndice} total={n} largura={largura} adesivos={adesivos} ativa={false} colar={null} atrasoBase={0} diasDeSequencia={diasDeSequencia} onSelecionar={() => undefined} />}
                verso={<VersoDaPagina ano={ano} />}
              />
            )}
            {/* a capa, por cima, girando na lombada ao abrir — sempre NA FRENTE, deita até −180° e sai; a partir do
                perfil as figurinhas da 1ª página começam a colar */}
            {capaVisivel && (
              <>
                <SombraProjetada rot={rotCapa} />
                <div data-testid="album-capa-3d" data-girada={capaGirada ? "" : undefined} style={{ zIndex: 6, position: "absolute", inset: 0, pointerEvents: "none" }}>
                  <Folha3D
                    rot={rotCapa}
                    zIndex={6}
                    raio={RAIO}
                    testid="album-capa-folha"
                    dir={1}
                    frente={<CapaAlbum largura={largura} altura={alturaCapa} maisRaros={maisRaros} abertos={abertos} total={total} nome={nome} ano={ano} style={{ height: "100%" }} />}
                    verso={<VersoDaCapa nome={nome} ano={ano} />}
                  />
                </div>
              </>
            )}
          </div>
          <div className="alb-abas" role="tablist" aria-label="Seções do álbum">
            {abas.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={!!ativaAba(s)} className="alb-aba" data-rar={s.rar} data-ativa={ativaAba(s) ? "" : undefined} onClick={() => irPara(paginas.findIndex((p) => p.id === s.id))} data-testid={`album-aba-${s.rar}`}>{s.rot}</button>
            ))}
          </div>
        </motion.div>
        <div className="alb-nav2">
          <button type="button" className="alb-seta border-0" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Página anterior" data-testid="album-tela-anterior"><ChevronLeft className="w-5 h-5" /></button>
          <div className="alb-dots2" aria-hidden>
            {paginas.map((p, i) => <i key={p.id} data-rar={p.raridade ?? "destaque"} data-ativo={i === atual ? "" : undefined} />)}
          </div>
          <button type="button" className="alb-seta border-0" onClick={() => irPara(atual + 1)} disabled={atual >= n - 1} aria-label="Próxima página" data-testid="album-tela-proxima"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="alb-rodape2">
        <button type="button" onClick={onCompartilhar} className="w-full h-11 rounded-xl font-bold text-[13.5px] inline-flex items-center justify-center gap-2" style={{ background: "#fff", color: "#2b2b2f" }} data-testid="album-tela-compartilhar">
          Compartilhar meu álbum
        </button>
        <div className="alb-rodape2-linha"><span>{resumoRaridades(porRaridade)}</span><span>Nível {nivel}</span></div>
      </div>

      <AnimatePresence>
        {detalhe && (
          <DetalheFigurinha
            key={detalhe.id}
            b={detalhe}
            n={numeroDaFigurinha(adesivos, detalhe.id)}
            desbloqueadoEm={desbloqueadas[detalhe.id]}
            porRaridade={porRaridade}
            diasDeSequencia={diasDeSequencia}
            onFechar={() => setDetalhe(null)}
            onPostar={(b) => { setDetalhe(null); onCompartilharFigurinha(b); }}
            onIr={(caminho) => { setDetalhe(null); onFechar(); navigate(caminho); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
