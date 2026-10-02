import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
 * A VIRADA (02/10, vídeo do dono no iPhone: a animação passava por uma PÁGINA
 * BEGE VAZIA antes da página seguinte). A virada antiga girava a folha de 0°
 * a 180° com `backface-visibility: hidden` e um fade por keyframes, e a capa
 * trocava de z-index no instante em que começava a girar — três coisas que
 * cada motor (WebKit do iPhone, Chromium) resolve de um jeito, e no iPhone
 * sobrava uma folha em branco. Agora:
 *   · a folha que SAI gira só de 0° a −90° (até ficar de perfil) e some; a
 *     página de destino já está montada e inteira por baixo desde o 1º
 *     quadro — não existe estado em que a mesa mostra uma folha sem conteúdo;
 *   · voltar é o espelho: a página de destino DESDOBRA da lombada (−90° → 0°)
 *     por cima da atual;
 *   · a capa gira só até o perfil (0° → −90°), sempre na frente, e as
 *     figurinhas da 1ª página começam a colar no instante em que a capa
 *     revela a página (não 400 ms depois);
 *   · cada página é um contexto de empilhamento (`isolation`): a pílula do
 *     progresso de uma página não vaza por cima da folha que está virando.
 * Nada de backface nem de ordenação 3D entre irmãos: só uma folha girando até
 * o perfil por cima de uma página pronta.
 */
export const DURACAO_VIRADA_MS = 340;
/** A capa fica parada este tempo antes de virar (a pessoa vê a capa). */
export const CAPA_PARADA_MS = 500;
export const CAPA_GIRO_MS = 420;
/** O instante em que a capa revela a 1ª página = quando as figurinhas começam a colar. */
export const CAPA_REVELA_MS = CAPA_PARADA_MS + CAPA_GIRO_MS;

interface Virada {
  /** A folha que gira por cima: pra frente é a página que sai; pra trás, a que entra. */
  sobre: PaginaAlbum;
  sobreIndice: number;
  /** O que fica por baixo enquanto gira: pra frente é a página de destino; pra trás, a que sai. */
  fundo: PaginaAlbum;
  fundoIndice: number;
  dir: 1 | -1;
  chave: number;
}

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
    const t1 = setTimeout(() => setCapaGirada(true), CAPA_PARADA_MS);
    // rede de segurança: se o fim da animação não avisar, a capa sai no tempo dela
    const t2 = setTimeout(() => setCapaVisivel(false), CAPA_REVELA_MS + 120);
    return () => { clearTimeout(t1); clearTimeout(t2); };
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
  const irPara = useCallback((i: number) => {
    const alvo = Math.max(0, Math.min(n - 1, i));
    if (alvo === atual) return;
    if (!reduzir) {
      const dir: 1 | -1 = alvo > atual ? 1 : -1;
      // toques rápidos em sequência: cada toque é uma virada nova (chave própria); a anterior sai na hora
      chaveDaVirada.current += 1;
      setVirando(dir > 0
        ? { sobre: paginas[atual], sobreIndice: atual, fundo: paginas[alvo], fundoIndice: alvo, dir, chave: chaveDaVirada.current }
        : { sobre: paginas[alvo], sobreIndice: alvo, fundo: paginas[atual], fundoIndice: atual, dir, chave: chaveDaVirada.current });
    }
    setAtual(alvo);
    setAbertura(false);
    trackEvent("album_pagina", { indice: alvo, secao: paginas[alvo]?.id });
  }, [atual, n, paginas, reduzir]);

  // a folha some quando a animação termina (onAnimationComplete); este relógio é a rede de segurança
  useEffect(() => {
    if (!virando) return;
    const t = setTimeout(() => setVirando((v) => (v && v.chave === virando.chave ? null : v)), DURACAO_VIRADA_MS + 200);
    return () => clearTimeout(t);
  }, [virando]);
  const terminarVirada = useCallback((chave: number) => setVirando((v) => (v && v.chave === chave ? null : v)), []);

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
          <div className="alb-folha" data-folha="" style={{ perspective: 1200 }}>
            {/* a página de baixo: pra frente já é a de destino (inteira, desde o 1º quadro); pra trás é a que sai */}
            <Pagina p={virando ? virando.fundo : pagina} indice={virando ? virando.fundoIndice : atual} total={n} largura={largura} adesivos={adesivos} ativa={!virando} colar={colar} atrasoBase={capaVisivel ? CAPA_REVELA_MS : 260} diasDeSequencia={diasDeSequencia} onSelecionar={setDetalhe} />
            {/* a folha que gira: sem animação de saída (a −90° ela está de perfil, invisível) — some na hora, e um
                toque rápido em sequência troca a folha pela nova (chave) sem sobra */}
            {virando && (
              <motion.div
                key={virando.chave}
                className="alb-pag-vira"
                data-testid="album-virando"
                data-dir={virando.dir > 0 ? "frente" : "tras"}
                data-pagina={virando.sobre.id}
                initial={{ rotateY: virando.dir > 0 ? 0 : -90 }}
                animate={{ rotateY: virando.dir > 0 ? -90 : 0 }}
                transition={{ duration: DURACAO_VIRADA_MS / 1000, ease: virando.dir > 0 ? [0.5, 0, 0.9, 0.4] : [0.1, 0.6, 0.5, 1] }}
                onAnimationComplete={() => terminarVirada(virando.chave)}
                aria-hidden
              >
                <Pagina p={virando.sobre} indice={virando.sobreIndice} total={n} largura={largura} adesivos={adesivos} ativa={false} colar={null} atrasoBase={0} diasDeSequencia={diasDeSequencia} onSelecionar={() => undefined} />
                {/* a sombra da folha dobrando (escurece conforme deita) */}
                <motion.div aria-hidden className="alb-pag-sombra" initial={{ opacity: virando.dir > 0 ? 0 : 0.35 }} animate={{ opacity: virando.dir > 0 ? 0.35 : 0 }} transition={{ duration: DURACAO_VIRADA_MS / 1000 }} />
              </motion.div>
            )}
          </div>
          <div className="alb-abas" role="tablist" aria-label="Seções do álbum">
            {abas.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={!!ativaAba(s)} className="alb-aba" data-rar={s.rar} data-ativa={ativaAba(s) ? "" : undefined} onClick={() => irPara(paginas.findIndex((p) => p.id === s.id))} data-testid={`album-aba-${s.rar}`}>{s.rot}</button>
            ))}
          </div>
          {/* a capa, por cima, girando na lombada ao abrir — sempre NA FRENTE, só até o perfil (−90°), e sai */}
          {capaVisivel && (
            <>
              <motion.div
                aria-hidden
                className="absolute inset-0"
                style={{ transformOrigin: "0 50%", zIndex: 6, borderRadius: "6px 14px 14px 6px", willChange: "transform" }}
                initial={{ rotateY: 0 }}
                animate={{ rotateY: capaGirada ? -90 : 0 }}
                transition={{ duration: CAPA_GIRO_MS / 1000, ease: [0.5, 0, 0.85, 0.5] }}
                onAnimationComplete={() => { if (capaGirada) setCapaVisivel(false); }}
                data-testid="album-capa-3d"
                data-girada={capaGirada ? "" : undefined}
              >
                <CapaAlbum largura={largura} altura={alturaCapa} maisRaros={maisRaros} abertos={abertos} total={total} nome={nome} ano={ano} style={{ height: "100%" }} />
              </motion.div>
              <motion.div aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 5, borderRadius: "6px 14px 14px 6px", background: "linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,0) 70%)" }} initial={{ opacity: 0 }} animate={{ opacity: capaGirada ? 0.4 : 0 }} transition={{ duration: CAPA_GIRO_MS / 1000 }} />
            </>
          )}
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
