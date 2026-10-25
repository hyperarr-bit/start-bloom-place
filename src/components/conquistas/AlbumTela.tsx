import { textoConquistado, requisitoDaFigurinha } from "./textos-figurinhas";
import "@fontsource/instrument-serif/latin-400-italic.css";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useIsPresent, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight, Instagram, X } from "lucide-react";
import { categoriaDe, fracaoDe, raridadeDe, type Badge, type BadgeCategoria, type Raridade } from "@/components/gamification/types";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { parseLocalDay } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";
import { ChipRaridade } from "./adesivos-raridade";
import { Adesivo, giroDoAdesivo } from "./adesivos-arte";
import { IconeMarcaAlbum } from "./IconeMarcaAlbum";
import { CapaAlbum } from "./CapaAlbum";
import { CORES_CAPA } from "./capa-pessoal";
import { FigurinhaColada, FigurinhaVazia, soltarFoils, useGiroscopioDoFoil } from "./FigurinhaAlbum";
import { quaseConquistada } from "./FigurinhaOculta";
import { Destacar } from "./GradeAdesivos";
import { ORDEM_RARIDADE, RARIDADE_FEM, contagemDaPagina, proximosDoAlbum, resumoRaridades, tituloDaPagina, type PaginaAlbum } from "./album-paginas";
import { fraseDaPagina } from "./nova/recompensas";
import "./conquistas.css";
import "./nova/album-sequencia-prototipo.css";
import "./nova/album-acabamento.css";

/**
 * O ÁLBUM DE FIGURINHAS EM TELA CHEIA — 3D (02/10; dono: "essa direção 3
 * ficou massa, quero algo 3D mesmo — e hoje está dando uns engasgos ao
 * trocar de página").
 *
 * O LIVRO: capa que herda a capa premium do planner, lombada com volume,
 * pilha de páginas na lateral e embaixo, leve inclinação na mesa. Cada
 * página é um CAPÍTULO (linha fina + "CAPÍTULO 02 · LENDÁRIOS", título em
 * serif, a frase do material), molduras de papel com o NÚMERO grande,
 * silhueta visível nas vagas vazias, barrinha fina de progresso (sai a
 * pílula preta), até 16 figurinhas por página, marca-d'água da figurinha
 * emblemática. Figurinha colada com relevo; épicas e lendárias com FOIL que
 * reage ao dedo (e ao giroscópio quando já há permissão). Ao colar uma
 * nova, o "peel". Abas com ícone + nome.
 *
 * POR QUE ENGASGAVA (medido no Chromium com CPU 4× mais lenta e no WebKit):
 *   1. a folha que gira era MONTADA no toque (React + layout de 12 SVGs com
 *      filtro) → o 1º quadro da virada levava 50–66 ms;
 *   2. as sobreposições de sombra/dobra mudavam `opacity` e `left` DENTRO da
 *      mesma camada da face → a face inteira (12 SVGs filtrados) era repintada
 *      e re-rasterizada a cada quadro (Paint ×48, Raster ×360 por virada);
 *   3. parado, anel/brilho/faíscas em loop mantinham o compositor ocupado
 *      (Layerize ×61 por segundo sem gesto nenhum).
 * COMO FICOU:
 *   · as páginas VIZINHAS (atual −1, atual, atual +1) ficam PRÉ-MONTADAS como
 *     FOLHAS próprias (uma camada cada, `will-change: transform` só enquanto
 *     o álbum está aberto), rasterizadas uma vez; virar = trocar o PAPEL da
 *     folha (fundo / sobre / espera) — nenhuma montagem, nenhum re-render
 *     da página (`memo`) durante a animação;
 *   · o ângulo é um motion value que escreve DIRETO no DOM (transform e
 *     opacity de camadas promovidas): sombra, dobra, luz, verso e a sombra
 *     projetada são camadas próprias com `will-change`, nada de `left`;
 *   · nenhuma animação em loop; o foil só repinta a própria figurinha e só
 *     durante o toque/movimento.
 * A lógica das páginas é a de `album-paginas.ts`.
 */

/** O número da figurinha = a posição na coleção (a ordem do catálogo, como num álbum de verdade). */
export const numeroDaFigurinha = (adesivos: Badge[], id: string): number => adesivos.findIndex((b) => b.id === id) + 1;
export const nDeDois = (n: number) => String(n).padStart(2, "0");

const ROTA_PADRAO = (b: Badge) => b.rota ?? { caminho: categoriaDe(b.category).rota, nome: b.category === "sequencia" || b.category === "geral" ? "Home" : categoriaDe(b.category).label };

/** O capítulo de cada raridade: o material, a frase, o ícone da aba e a figurinha emblemática (marca-d'água). */
export const CAPITULO: Record<Raridade, { titulo: string; material: string; frase: string; icone: string; aba: string; emblema: string }> = {
  lendario: { titulo: "Lendárias", material: "Foil dourado", frase: "As mais difíceis do álbum.", icone: "♛", aba: "LENDÁRIAS", emblema: "ano-365" },
  epico: { titulo: "Épicas", material: "Holográficas", frase: "Só quem persiste por meses.", icone: "✦", aba: "ÉPICAS", emblema: "rotina-21" },
  raro: { titulo: "Raras", material: "Borda azul", frase: "Pra quem já pegou o ritmo.", icone: "◆", aba: "RARAS", emblema: "rotina-7" },
  comum: { titulo: "Comuns", material: "Grafite", frase: "Os primeiros passos de cada área.", icone: "●", aba: "COMUNS", emblema: "first-income" },
};

/**
 * (16/10, Conquistas 2) O capítulo de cada MÓDULO, quando o álbum é por módulo
 * (album-paginas.montarAlbumPorModulo): a frase do módulo e a cor da placa.
 */
export const CAPITULO_MODULO: Record<BadgeCategoria, { frase: string; cor: string }> = {
  carreira: { frase: "Seu caminho profissional.", cor: "#455b75" },
  sequencia: { frase: "Dias seguidos anotando — qualquer módulo conta.", cor: "#d22d80" },
  finance: { frase: "Cada gasto anotado é uma figurinha a caminho.", cor: "#b7791f" },
  rotina: { frase: "Hábitos marcados, dia após dia.", cor: "#0f9d6a" },
  leitura: { frase: "Páginas e livros que você leu.", cor: "#7c3aed" },
  treino: { frase: "Treinos marcados na semana.", cor: "#2563eb" },
  dieta: { frase: "Refeições e água no lugar.", cor: "#16a34a" },
  saude: { frase: "Cuidar de você, todo dia.", cor: "#dc2626" },
  vida: { frase: "Casa, pet, humor, detox — a vida inteira.", cor: "#0d9488" },
  geral: { frase: "O álbum inteiro do CORE.", cor: "#2b2b2f" },
};

/* ------------------------------------------------------------ a vaga */

/**
 * A vaga só responde na página de BAIXO (a visível). Checado no DOM, e não
 * por `pointer-events` no papel da folha: `pointer-events` é herdado, e
 * trocá-lo na folha recalculava o estilo das ~400 vagas por baixo no 1º
 * quadro de cada virada (20 ms num celular médio).
 */
const ehFundo = (el: Element): boolean => (el.closest("[data-papel]") as HTMLElement | null)?.dataset.papel !== "espera" && (el.closest("[data-papel]") as HTMLElement | null)?.dataset.papel !== "sobre";

interface VagaProps {
  b: Badge;
  n: number;
  tam: number;
  indice: number;
  /** Atraso (ms) pra colar com o peel; undefined = já colada. */
  cola?: number;
  /** (16/10) Figurinha nova ESPERANDO pra ser colada: solta por cima da vaga, com "COLAR"; o toque cola (peel). */
  pendente?: boolean;
  /** (16/10) A pílula "AMANHÃ"/"HOJE"/"EM 2 DIAS" numa vaga vazia: o próximo prêmio da sequência. */
  destaque?: string;
  onSelecionar: (b: Badge) => void;
  onColar?: (b: Badge) => void;
}

const Vaga = memo(({ b, n, tam, indice, cola, pendente, destaque, onSelecionar, onColar }: VagaProps) => {
  const raridade = raridadeDe(b);
  const cx = tam + 14;
  // o "colar" é de UMA vez: quem já recebeu o atraso fica com ele (uma troca de papel da folha não descola a figurinha)
  const colaFixo = useRef(cola);
  if (cola !== undefined) colaFixo.current = cola;
  const atraso = colaFixo.current;
  const rotulo = b.unlocked ? null : rotuloProgresso(b);
  const comProgresso = !b.unlocked && !!b.progresso && b.progresso.atual > 0;
  return (
    <button type="button" className="vaga" data-id={b.id} data-vaga={b.id} data-aberta={b.unlocked ? "true" : "false"} data-rar={raridade} data-pendente={pendente ? "" : undefined} data-destaque={destaque ? "" : undefined} onClick={(e) => { if (!ehFundo(e.currentTarget)) return; if (pendente && onColar) onColar(b); else onSelecionar(b); }} style={{ width: cx }} aria-label={pendente ? `Colar ${b.name}` : undefined}>
      <span className="vaga-caixa" style={{ width: cx, height: cx }}>
        <span className="vaga-n"><small>Nº</small> {nDeDois(n)}</span>
        {destaque && !b.unlocked && <span className="vaga-destaque" data-testid="vaga-destaque">{destaque}</span>}
        {pendente ? (
          <span className="vaga-fig vaga-fig-solta" data-testid="vaga-pendente">
            <FigurinhaColada id={b.id} raridade={raridade} tamanho={tam} giro={giroDoAdesivo(indice) - 7} />
            <span className="vaga-colar" aria-hidden>Colar</span>
          </span>
        ) : b.unlocked ? (
          <span className="vaga-fig" data-cola={atraso !== undefined ? "" : undefined} style={{ "--d": `${atraso ?? 0}ms` } as CSSProperties}>
            <FigurinhaColada id={b.id} raridade={raridade} tamanho={tam} giro={giroDoAdesivo(indice)} peel={atraso !== undefined} />
          </span>
        ) : (
          <span className="vaga-fig">
            <FigurinhaVazia id={b.id} raridade={raridade} tamanho={tam - 6} progresso={b.progresso} />
          </span>
        )}
      </span>
      <span className="vaga-nome" data-falta={b.unlocked ? undefined : ""}>{b.name}</span>
      {comProgresso && (
        <span className="vaga-barra" data-testid="barra-figurinha" aria-label={rotulo ?? undefined} title={rotulo ?? undefined}>
          <i style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, fracaoDe(b)))})` }} />
        </span>
      )}
    </button>
  );
});
Vaga.displayName = "Vaga";

/* ------------------------------------------------------------ a página */

interface PaginaProps {
  p: PaginaAlbum;
  indice: number;
  total: number;
  largura: number;
  adesivos: Badge[];
  /** É a página visível (de baixo)? Só nela as figurinhas colam agora. */
  ativa: boolean;
  /** É a página de ABERTURA, ainda abrindo: todas as coladas dela colam com o peel (uma vez; as mesmas figurinhas nas páginas de seção não). */
  abertura: boolean;
  /** As NOVAS (colam com o peel na página delas; conjunto estável, os ids saem dele depois de colar). */
  colar: Set<string>;
  atrasoBase: number;
  diasDeSequencia: number;
  /** (16/10) As que esperam pra ser coladas (toque) e as vagas com a pílula do próximo prêmio. */
  pendentes: ReadonlySet<string>;
  destaques: Readonly<Record<string, string>>;
  /** (16/10, Conquistas 2) o rodapé das páginas de seção diz "Faltam N figurinhas nesta página". */
  rodapeFaltam: boolean;
  editorial?: boolean;
  /** (17/10) Colou a desta página e tem mais figurinha nova em OUTRA página: o rodapé leva até lá. */
  proximaNova: { indice: number; titulo: string; quantas: number } | null;
  onIrPara: (indice: number) => void;
  onSelecionar: (b: Badge) => void;
  onColar?: (b: Badge) => void;
}

const Pagina = memo(({ p, indice, total, largura, adesivos, ativa, abertura, colar, atrasoBase, diasDeSequencia, pendentes, destaques, rodapeFaltam, editorial, proximaNova, onIrPara, onSelecionar, onColar }: PaginaProps) => {
  const prototipo = editorial && !!p.modulo;
  const grande = p.tipo === "mais-raros";
  const col = editorial && !grande ? (largura < 350 ? 3 : 2) : grande ? 3 : 4;
  const gapX = grande || editorial ? 10 : 6;
  const interno = largura - 24 - 14;
  const tam = editorial && !grande ? Math.min(82, Math.floor((interno - gapX * (col - 1)) / col) - 16, col === 2 ? Math.floor((largura * 1.56 - 315) / 3) : 82) : grande ? Math.min(82, Math.floor((interno - gapX * 2) / 3) - 16) : Math.min(54, Math.floor((interno - gapX * 3) / 4) - 14);
  // (02/10, dono: "os mais raros é só pra mostrar os mais raros do usuário") as próximas a colar só aparecem com o álbum
  // ainda vazio ("Começando o álbum"); com alguma colada, a página é só delas — a grade desce pro meio da folha
  const vazia = grande && !p.vagas.length;
  const proximas = useMemo(() => (vazia ? (p.proximos.length ? p.proximos : proximosDoAlbum(adesivos)) : []), [vazia, p.proximos, adesivos]);
  const proximo = proximas[0];
  const cap = p.raridade ? CAPITULO[p.raridade] : null;
  const mod = p.modulo ? { ...categoriaDe(p.modulo), ...CAPITULO_MODULO[p.modulo] } : null;
  // a pendente não cola na abertura: ela espera o toque (e então cola com o peel, atraso 0)
  const colaDe = (b: Badge, j: number) => (ativa && b.unlocked && !pendentes.has(b.id) && ((abertura && !editorial) || colar.has(b.id)) ? (colar.has(b.id) && (!abertura || editorial) ? 0 : atrasoBase + j * 90) : undefined);
  // nas páginas de seção: a vaga vazia mais perto de colar (o rodapé convida)
  const perto = useMemo(() => (grande ? null : p.vagas.filter((b) => !b.unlocked && b.progresso && b.progresso.atual > 0).sort((a, b) => fracaoDe(b) - fracaoDe(a))[0] ?? null), [grande, p.vagas]);
  const titulo = grande ? (p.vagas.length ? "Os mais raros" : "Começando o álbum") : mod ? (p.modulos ? p.titulo : mod.label) : cap!.titulo;
  const coladasAqui = p.vagas.filter((b) => b.unlocked && !pendentes.has(b.id)).length;
  const completa = p.vagas.length > 0 && coladasAqui === p.vagas.length;
  const contagem = editorial && !grande ? `${coladasAqui} de ${p.vagas.length} coladas` : grande ? `${editorial ? p.abertos - pendentes.size : p.abertos} de ${p.total}` : p.total > p.abertos ? contagemDaPagina(p) : `${p.abertos} de ${p.total} · completa!`;
  const frase = grande ? (p.vagas.length ? "O orgulho da coleção." : "Cada coisa anotada cola uma figurinha.") : mod ? mod.frase : `${editorial ? (p.raridade === "lendario" ? "Acabamento dourado" : p.raridade === "epico" ? "Reflexo holográfico" : "Figurinhas de vinil") : cap!.material} · ${cap!.frase}`;
  // (16/10) as figurinhas novas desta página (esperando o toque) e as vagas vazias DESTA página (uma seção pode ter 2 páginas)
  const pendentesAqui = p.vagas.filter((b) => pendentes.has(b.id)).length;
  return (
    <div className="alb-pag" data-pagina={p.id} data-prototipo={prototipo ? "sequencia" : undefined} data-inicio={editorial && vazia ? "" : undefined} data-galeria={editorial && grande && !vazia ? "" : undefined} data-vagas={p.vagas.length} data-completa={completa && !grande ? "" : undefined} data-rar={p.raridade ?? (mod ? "modulo" : "destaque")} data-modulo={p.modulo} style={mod ? ({ "--mod": mod.cor } as CSSProperties) : undefined} data-testid={`album-tela-pagina-${indice}`}>
      <span className="alb-marca" aria-hidden><Adesivo id={cap ? cap.emblema : mod ? (p.vagas[p.vagas.length - 1]?.id ?? "sequencia-100") : "sequencia-100"} tamanho={Math.round(largura * 0.5)} /></span>
      <header className="alb-cap" data-acabamento={p.raridade ?? (grande && !vazia ? "destaque" : "comum")}>
        {!editorial ? <div className="alb-cap-linha"><span>Capítulo {nDeDois(indice + 1)} · {grande ? p.titulo : tituloDaPagina(p)}</span><i /></div> : grande && !vazia ? <div className="alb-cap-linha"><span>SELEÇÃO ESPECIAL</span><i /></div> : null}
        <div className="alb-cap-titulo"><h3>{titulo}</h3>{(!editorial || !grande) && <b className="tabular-nums">{contagem}</b>}</div>
        <p className="alb-cap-frase">{frase}</p>
      </header>
      {editorial && grande && !vazia && <div className="alb-galeria-legenda"><strong>Pequenas provas de grandes passos.</strong></div>}
      {editorial && vazia && <div className="alb-inicio-intro"><strong>Seu primeiro capítulo.</strong><p>Faça uma destas ações para ganhar sua primeira figurinha.</p></div>}
      {prototipo && <div className="alb-jornada-intro"><strong>{p.modulo === "sequencia" ? (p.parte?.[0] === 1 ? "O começo de uma constância." : "Uma história que continua.") : mod?.frase}</strong><i aria-hidden><IconeMarcaAlbum modulo={p.modulo} /></i></div>}
      <div className="alb-grade" data-raros-no-meio={grande && !vazia ? "" : undefined} style={{ gridTemplateColumns: `repeat(${col}, ${tam + 14}px)`, gap: `${editorial ? 14 : grande ? (vazia ? 8 : 22) : 5}px ${gapX}px`, marginBlock: grande && !vazia ? "auto" : undefined }}>
        {p.vagas.map((b, j) => <Vaga key={b.id} b={b} n={numeroDaFigurinha(adesivos, b.id)} tam={prototipo ? Math.min(j === 2 && p.vagas.length % 2 ? 100 : 84, Math.floor(largura * (j === 2 && p.vagas.length % 2 ? .28 : .23))) : editorial && grande ? Math.min(110, Math.floor(largura * .29)) : tam} indice={j} cola={colaDe(b, j)} pendente={pendentes.has(b.id)} destaque={destaques[b.id]} onSelecionar={onSelecionar} onColar={onColar} />)}
      </div>
      {grande && proximas.length > 0 && (
        <>
          {editorial && vazia ? <div className="alb-inicio-opcoes">{proximas.map(b=><button key={b.id} type="button" onClick={e=>{if(ehFundo(e.currentTarget))onSelecionar(b);}}><FigurinhaVazia id={b.id} raridade={raridadeDe(b)} tamanho={52} progresso={b.progresso} /><span><b>{b.name}</b><small>{b.description}</small></span><ChevronRight size={14} aria-hidden /></button>)}</div> : <><div className="alb-subsecao">PRÓXIMAS A COLAR</div><div className="alb-grade" style={{ gridTemplateColumns: `repeat(3, ${tam + 14}px)`, gap: `8px ${gapX}px` }}>
            {proximas.map((b, j) => <Vaga key={b.id} b={b} n={numeroDaFigurinha(adesivos, b.id)} tam={tam} indice={j} onSelecionar={onSelecionar} />)}
          </div></>}
        </>
      )}
      {grande && proximo && !(editorial && vazia) && (
        <p className="alb-dica" data-testid="album-tela-dica">
          Cada coisa anotada cola uma figurinha aqui. A mais perto: <b>{proximo.name}</b> — <mark><Destacar texto={textoFalta(proximo, diasDeSequencia)} /></mark>.
        </p>
      )}
      <footer className="alb-pe">
        {pendentesAqui > 0 ? (
          <span className="alb-pe-perto" data-testid="album-pe-colar"><b>{pendentesAqui === 1 ? "1 figurinha nova" : `${pendentesAqui} figurinhas novas`}</b> · toque pra colar</span>
        ) : proximaNova ? (
          <button type="button" className="alb-pe-perto alb-pe-proxima" onClick={() => onIrPara(proximaNova.indice)} data-testid="album-pe-proxima">
            <b>{proximaNova.quantas === 1 ? "Mais 1 figurinha nova" : `Mais ${proximaNova.quantas} figurinhas novas`}</b> em {proximaNova.titulo} <ChevronRight className="inline w-3 h-3 -mt-0.5" aria-hidden />
          </button>
        ) : (mod || rodapeFaltam) && !grande ? (
          <span className="alb-pe-perto" data-testid="album-pe-pagina">{p.vagas.length > coladasAqui ? <><b>{fraseDaPagina(coladasAqui, p.vagas.length)}</b>{perto ? <> · a mais perto: {perto.name}</> : null}</> : "Página completa — todas coladas."}</span>
        ) : perto ? (
          <span className="alb-pe-perto">A mais perto: <b>{perto.name}</b> · <Destacar texto={textoFalta(perto, diasDeSequencia)} /></span>
        ) : !grande && p.abertos >= p.total ? (
          <span className="alb-pe-perto">Página completa — todas coladas.</span>
        ) : <span />}
        {!editorial && <span className="alb-pag-num">{indice + 1} / {total}</span>}
      </footer>
    </div>
  );
});
Pagina.displayName = "Pagina";

/* ------------------------------------------------------------ o detalhe */

interface DetalheProps {
  b: Badge;
  n: number;
  desbloqueadoEm?: string;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  diasDeSequencia: number;
  onFechar: () => void;
  onPostar: (b: Badge) => void;
  onUsarNaCapa?: (b: Badge) => void;
  onIr: (caminho: string) => void;
}

/** O detalhe da vaga (folha por cima da mesa): "FIGURINHA Nº 46", o chip, o que falta ou quando colou. */
export const DetalheFigurinha = ({ b, n, desbloqueadoEm, porRaridade, diasDeSequencia, onFechar, onPostar, onIr, onUsarNaCapa }: DetalheProps) => {
  const reduzir = useReducedMotion();
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    painel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (anterior?.isConnected) anterior.focus(); };
  }, []);
  const raridade = raridadeDe(b);
  const colada = desbloqueadoEm ? parseLocalDay(desbloqueadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : null;
  const destino = ROTA_PADRAO(b);
  return (
    <>
      <motion.div className="absolute inset-0 z-[5]" style={{ background: "rgba(0,0,0,.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} aria-hidden />
      <motion.div ref={painel} className="fig-detalhe fig-detalhe-ampliado" role="dialog" aria-modal="true" aria-label={b.name} data-testid="detalhe-vaga" data-vaga-detalhe={b.id} data-rar={raridade} initial={{ y: reduzir ? 0 : "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduzir ? 0 : "100%", opacity: 0 }} transition={reduzir ? { duration: 0.1 } : { type: "spring", stiffness: 380, damping: 36 }} onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const botoes = painel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!botoes?.length) return;
        const primeiro = botoes[0], ultimo = botoes[botoes.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }}>
        <div className="fig-detalhe-puxador" />
        <button type="button" className="fig-detalhe-fechar" aria-label="Fechar visualização da figurinha" onClick={onFechar}><X size={21} aria-hidden /></button>
        <div className="fig-detalhe-arte" role="img" aria-label={b.unlocked ? b.name : `${b.name}: ainda não conquistada`}>
          {!b.unlocked && quaseConquistada(b.progresso) && <span className="fig-detalhe-quase" data-rar={raridade}>Quase lá</span>}
          {b.unlocked ? <FigurinhaColada id={b.id} raridade={raridade} tamanho={360} grande /> : <FigurinhaVazia id={b.id} raridade={raridade} tamanho={360} progresso={b.progresso} />}
        </div>
        <div className="text-center">
          <div className="min-w-0">
            <div className="pin-rot text-muted-foreground">Figurinha Nº {nDeDois(n)}</div>
            <h2 className="text-[24px] font-black tracking-tight leading-[1.1] mt-1 mb-2">{b.name}</h2>
            <ChipRaridade raridade={raridade} tam="m" texto={b.unlocked ? RARIDADE_FEM[raridade] : `A caminho · ${RARIDADE_FEM[raridade]}`} />
            <p className="text-[14px] text-muted-foreground mt-2 leading-snug">{b.unlocked ? textoConquistado(b) : requisitoDaFigurinha(b)}</p>
          </div>
        </div>
        {b.unlocked ? (
          <p className="text-[13px] text-muted-foreground mt-3.5 leading-[1.4]">
            {colada ? <>Conquistada em <b className="text-foreground">{colada}</b>.</> : "Já faz parte da sua coleção."}
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
          {b.unlocked && onUsarNaCapa && <button type="button" onClick={() => onUsarNaCapa(b)} className="h-11 rounded-xl border border-border font-bold text-[13px]" data-testid="figurinha-usar-capa">Usar na capa</button>}
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

/* ------------------------------------------------------------ a folha 3D */

export const DURACAO_VIRADA_MS = 600;
/** A capa fica parada este tempo antes de virar (02/10, dono: "parece só um pulo da capa" — 0,5 s era pouco pra ver a capa). */
export const CAPA_PARADA_MS = 1400;
export const CAPA_GIRO_MS = 700;
/** O instante em que a capa revela a 1ª página (passa do perfil) = quando as figurinhas começam a colar. */
export const CAPA_REVELA_MS = CAPA_PARADA_MS + Math.round(CAPA_GIRO_MS * 0.45);
/** Quando a capa deitou de vez e sai da tela (com a folga da rede de segurança). */
export const CAPA_SAI_MS = CAPA_PARADA_MS + CAPA_GIRO_MS + 120;
/** Passada desta fração, soltar completa a virada. */
export const FRACAO_PRA_COMPLETAR = 0.34;
/** Velocidade (graus/ms) que completa mesmo antes da fração. */
/** Quanto tempo o "✓ As N figurinhas foram coladas" fica na tela depois da última colagem (QA 1.0.18). */
export const AVISO_FIM_COLAGEM_MS = 3000;
const VELOCIDADE_PRA_COMPLETAR = 0.35;
/** Arrasto mínimo (px) pra virar um gesto. */
const ARRASTO_MINIMO = 8;
/** … e quando o toque começou numa figurinha com foil (o dedo passeia nela antes de virar). */
const ARRASTO_MINIMO_NO_FOIL = 40;
const EASE_FRENTE: [number, number, number, number] = [0.4, 0, 0.26, 1];
/** O ângulo por onde a folha passa de perfil (a frente some, o verso aparece). */
const PERFIL = -90;
/** A face que não aparece fica nisto, nunca em 0 (ver pintarFolha). Medido no WebKit: a 0,4 % ele já descarta a camada e repinta ao voltar; a 1,2 % não. */
export const OPACIDADE_ESCONDIDA = 0.012;

/** Câmera lenta SÓ no servidor de desenvolvimento (prints/vídeo): `window.__coreCameraLenta = 6` deixa a virada 6× mais lenta. */
const lento = (): number => {
  if (!import.meta.env.DEV || typeof window === "undefined") return 1;
  const v = Number((window as unknown as { __coreCameraLenta?: unknown }).__coreCameraLenta);
  return Number.isFinite(v) && v >= 1 ? v : 1;
};

type Papel = "fundo" | "sobre" | "espera" | "capa";

interface Virada {
  /** A folha que gira por cima: pra frente é a página que sai; pra trás, a que entra. */
  sobreIndice: number;
  /** O que fica por baixo enquanto gira: pra frente é a página de destino; pra trás, a que sai. */
  fundoIndice: number;
  dir: 1 | -1;
  chave: number;
  /** Onde a folha termina quando completa (índice de página). */
  alvo: number;
  /** Veio do dedo (o ângulo é do gesto) ou de um toque (anima sozinha). */
  manual: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rampa = (v: number, de: number, ate: number) => clamp01((v - de) / (ate - de));

/**
 * ESCREVE o quadro da folha direto no DOM a partir do ângulo (0 → −180):
 * transform da folha, qual face aparece (por ângulo, não por
 * backface-visibility: no WebKit o verso era pintado por cima da frente),
 * o sombreamento da frente, a luz do verso, o brilho da dobra correndo pela
 * folha, a folha esmaecendo nos últimos graus e a sombra projetada na página
 * de baixo. Nada disto passa pelo React.
 */
export interface PartesDaFolha {
  el: HTMLElement;
  /** A largura da folha (px): as tiras de luz/sombra são escaladas por ela. */
  largura: number;
  /** A profundidade da folha (px): a que gira fica à frente da de baixo, a capa à frente de tudo — ordem por translateZ, nunca z-index
   *  (no WebKit, trocar o z-index de uma camada composta repinta a camada inteira). */
  z: number;
  frente: HTMLElement | null;
  verso: HTMLElement | null;
  sombra: HTMLElement | null;
  dobra: HTMLElement | null;
  luz: HTMLElement | null;
  sombraProjetada?: HTMLElement | null;
}
export const PROFUNDIDADE: Record<string, number> = { capa: 3, sobre: 1, fundo: 0, espera: -2 };
export const partesDaFolha = (el: HTMLElement, largura: number, sombraProjetada?: HTMLElement | null): PartesDaFolha => ({
  el,
  largura,
  z: PROFUNDIDADE[el.dataset.papel ?? "sobre"] ?? 1,
  frente: el.querySelector<HTMLElement>(".alb-face-frente"),
  verso: el.querySelector<HTMLElement>(".alb-face-verso"),
  sombra: el.querySelector<HTMLElement>(".alb-face-sombra"),
  dobra: el.querySelector<HTMLElement>(".alb-face-dobra"),
  luz: el.querySelector<HTMLElement>(".alb-face-luz"),
  sombraProjetada,
});
export const pintarFolha = ({ el, largura, z, frente, verso, sombra, dobra, luz, sombraProjetada }: PartesDaFolha, v: number) => {
  const naFrente = v > PERFIL;
  // QUAL FACE APARECE é decidida pelo ângulo, por opacidade: o WebKit não ordena as duas faces pela profundidade nem respeita
  // backface-visibility (02/10, provado de novo no headless: o verso pintava por cima da frente em repouso) — e a face
  // "escondida" fica a 1,2 %, NUNCA 0: uma camada que volta de opacidade 0 é repintada inteira no WebKit (45–70 ms no quadro
  // do perfil / de voltar a página), e a 1,2 % por baixo da face opaca ninguém vê. Deitada (os últimos 22°) a folha esmaece
  // pelas FACES (planas, sem filhos compostos): NUNCA opacidade na folha — obrigaria o preserve-3d a virar flat e achataria
  // as faces numa camada nova (re-raster da página inteira).
  const fade = Math.max(OPACIDADE_ESCONDIDA, 1 - rampa(v, -158, -180));
  el.style.transform = `rotateY(${v}deg) translateZ(${z}px)`;
  if (frente) frente.style.opacity = (naFrente ? fade : OPACIDADE_ESCONDIDA).toFixed(3);
  if (verso) verso.style.opacity = (naFrente ? OPACIDADE_ESCONDIDA : fade).toFixed(3);
  if (sombra) sombra.style.opacity = (naFrente ? rampa(v, 0, PERFIL) * 0.55 : 0).toFixed(3);
  if (dobra) {
    const t = rampa(v, 0, PERFIL);
    // a dobra (tira de 4 px esticada a 42 % da folha) corre da borda externa (78 % da folha) até a lombada (−20 %)
    dobra.style.transform = `translateX(${((0.78 - 0.98 * t) * largura).toFixed(1)}px) translateZ(.6px) scaleX(${(largura * 0.105).toFixed(2)})`;
    dobra.style.opacity = (naFrente ? Math.min(rampa(v, 0, -25), 1 - rampa(v, -70, PERFIL)) * 0.35 : 0).toFixed(3);
  }
  if (luz) luz.style.opacity = (naFrente ? 0 : 0.5 * (1 - rampa(v, PERFIL, -180)) * fade).toFixed(3);
  if (sombraProjetada) {
    const o = v > -30 ? rampa(v, 0, -30) * 0.3 : v > PERFIL ? 0.3 + rampa(v, -30, PERFIL) * 0.2 : v > -150 ? 0.5 - rampa(v, PERFIL, -150) * 0.2 : 0.3 * (1 - rampa(v, -150, -180));
    sombraProjetada.style.opacity = o.toFixed(3);
    sombraProjetada.style.transform = `translateZ(.3px) scaleX(${(Math.max(0.05, Math.abs(Math.sin((v * Math.PI) / 180))) * (largura / 4)).toFixed(2)})`;
  }
};

/** Põe a folha em repouso (0°, faces como no CSS). */
const repousarFolha = (el: HTMLElement) => {
  el.removeAttribute("style");
  for (const parte of Array.from(el.querySelectorAll<HTMLElement>(".alb-face, .alb-face-sombra, .alb-face-dobra, .alb-face-luz"))) parte.removeAttribute("style");
};
/**
 * "Deita" a folha de vez: as duas faces apagadas (a 1,2 %) e a folha de volta a 0° por trás da página de baixo — e não
 * deitada a −180° fora do livro, onde 1,2 % de papel creme sobre a mesa escura ainda se via. Em pé, atrás da página (ou,
 * no WebKit, por cima dela a 1,2 %: creme sobre creme), não se vê nada.
 */
const deitarFolha = (partes: PartesDaFolha) => {
  pintarFolha({ ...partes, z: PROFUNDIDADE.espera }, -180);
  partes.el.style.transform = `rotateY(0deg) translateZ(${PROFUNDIDADE.espera}px)`;
};

/** Conduz a folha `seletor` (dentro de `raiz`) pelo motion value, enquanto `ativo`. */
const useConduzir = (raiz: React.RefObject<HTMLDivElement>, seletor: string, rot: MotionValue<number>, largura: number, ativo: unknown) => {
  useLayoutEffect(() => {
    if (!ativo) return;
    const base = raiz.current;
    const el = base?.querySelector<HTMLElement>(seletor);
    if (!base || !el) return;
    const partes = partesDaFolha(el, largura, base.querySelector<HTMLElement>(`[data-sombra-projetada="${el.dataset.papel}"]`));
    // a folha de FUNDO precisa estar em repouso (uma folha que já virou guarda o ângulo deitado): só mexe se não estiver
    const fundo = base.querySelector<HTMLElement>('[data-papel="fundo"]');
    if (fundo && fundo !== el && fundo.style.transform && fundo.style.transform !== "rotateY(0deg)") repousarFolha(fundo);
    // um quadro por rAF: o dedo manda pointermove a 60–120 Hz, e cada escrita de estilo fora do quadro era um recálculo a mais
    let quadro = 0;
    let pendente = rot.get();
    const aplicar = (v: number) => {
      pendente = v;
      if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; pintarFolha(partes, pendente); });
    };
    pintarFolha(partes, pendente);
    const parar = rot.on("change", aplicar);
    return () => {
      parar();
      if (quadro) cancelAnimationFrame(quadro);
      // a folha vai pro repouso do PAPEL novo (o React já trocou o atributo): espera = deitada (−180°, faces apagadas), fundo = em pé
      // (0°, como o CSS). Nada de opacidade na folha; uma virada interrompida no meio (toques rápidos) não fica saindo do livro.
      if (el.dataset.papel === "espera") deitarFolha(partes);
      else if (el.dataset.papel === "fundo") repousarFolha(el);
    };
  }, [raiz, seletor, rot, largura, ativo]);
};

/**
 * UMA FOLHA do livro: frente (a página) e verso (o papel), as camadas de
 * sombra/dobra/luz (promovidas: mudar a opacidade delas não repinta a
 * página). O PAPEL diz o que ela é agora: `fundo` (parada, visível, é a
 * página de verdade), `sobre` (a que gira), `espera` (pré-montada e
 * rasterizada, invisível, pronta pra virar fundo sem montar nada) ou `capa`.
 */
const Folha = ({ papel, dir, pagina, frente, verso, testid }: { papel: Papel; dir?: 1 | -1; pagina?: string; frente: ReactNode; verso: ReactNode; testid?: string }) => (
  <div
    className="alb-sheet"
    data-papel={papel}
    data-pagina={pagina}
    data-dir={dir ? (dir > 0 ? "frente" : "tras") : undefined}
    data-testid={testid}
    aria-hidden={papel !== "fundo"}
  >
    <div className="alb-face alb-face-frente">{frente}</div>
    <div className="alb-face alb-face-verso">{verso}</div>
    {/* as camadas de luz são IRMÃS das faces (profundidade própria): uma face com filho composto + opacidade fracionária
        obriga o WebKit a agrupar e repintar a página inteira no instante em que o verso começa a esmaecer */}
    <div className="alb-face-sombra" aria-hidden />
    <div className="alb-face-dobra" aria-hidden />
    <div className="alb-face-luz" aria-hidden />
  </div>
);

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

/* ------------------------------------------------------------ a tela */

export interface AlbumTelaProps {
  figurinhasCapa?: Badge[];
  corCapa?: import("./capa-pessoal").CorCapa;
  onUsarNaCapa?: (b: Badge) => void;
  aberto: boolean;
  paginas: PaginaAlbum[];
  adesivos: Badge[];
  desbloqueadas: Record<string, string>;
  /** Coladas desde a última abertura: colam com o peel quando a página aparece. */
  novas: string[];
  maisRaros: Badge[];
  abertos: number;
  total: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  nome: string;
  /** (16/10) opcional: a Conquistas 2 não tem nível. */
  nivel?: string;
  ano: number;
  diasDeSequencia: number;
  /** Abre direto nesta página (o pacotinho abre na página da figurinha nova). */
  paginaInicial?: number;
  /** De onde veio a abertura (vai no evento `album_abrir`). */
  via?: "card" | "pacotinho" | "toast" | "missao" | "capa" | "vaga" | "colecao";
  /**
   * (16/10, Conquistas 2) Figurinhas novas ESPERANDO pra ser coladas: ficam
   * soltas por cima da vaga com "COLAR"; o toque cola com o peel e chama
   * `onColar` (quem grava o "visto" é a tela).
   */
  pendentes?: string[];
  onColar?: (b: Badge) => void;
  /** (16/10) Pílula numa vaga vazia: { "sequencia-14": "AMANHÃ" } — o próximo prêmio da sequência. */
  destaques?: Record<string, string>;
  /** (16/10) Rodapé "Faltam N figurinhas nesta página" nas páginas de seção (a tela nova liga; a de hoje fica igual). */
  rodapeFaltam?: boolean;
  /** Páginas com três colunas, papel neutro e animação apenas ao colar. */
  editorial?: boolean;
  onFechar: () => void;
  /** (16/10) opcional: sem ele, os botões de compartilhar o álbum somem. */
  onCompartilhar?: () => void;
  onCompartilharFigurinha: (b: Badge) => void;
}

const SEM_PENDENTES: string[] = [];
const SEM_DESTAQUES: Record<string, string> = {};

export const AlbumTela = ({ aberto, paginas, adesivos, desbloqueadas, novas, maisRaros, abertos, total, porRaridade, nome, nivel, ano, diasDeSequencia, paginaInicial = 0, via = "card", pendentes = SEM_PENDENTES, onColar, destaques = SEM_DESTAQUES, rodapeFaltam = false, editorial = false, onFechar, onCompartilhar, onCompartilharFigurinha, figurinhasCapa, corCapa, onUsarNaCapa }: AlbumTelaProps) => {
  const reduzir = !!useReducedMotion();
  const navigate = useNavigate();
  const n = paginas.length;
  const inicial = Math.max(0, Math.min(n - 1, paginaInicial));
  const [atual, setAtual] = useState(inicial);
  const [virando, setVirando] = useState<Virada | null>(null);
  // já no 1º render (a página de abertura calcula o atraso do "colar" a partir da capa): o efeito de abrir confirma
  const presente = useIsPresent();
  const mostrarCapa = !editorial || via === "capa";
  const [capaVisivel, setCapaVisivel] = useState(aberto && !reduzir && mostrarCapa);
  const [capaGirada, setCapaGirada] = useState(false);
  const [detalhe, setDetalhe] = useState<Badge | null>(null);
  const [largura, setLargura] = useState(330);
  /**
   * As folhas MONTADAS: as vizinhas de `base` (que só muda quando NÃO há
   * virada em curso — montar uma página no 1º quadro da virada custava
   * 60–80 ms) e, aos poucos depois da abertura, TODAS as outras (uma a cada
   * 160 ms, nunca durante uma virada): daí em diante virar nunca monta nada.
   */
  const [base, setBase] = useState(inicial);
  const [extras, setExtras] = useState(0);
  /**
   * O que cola com o peel: as NOVAS (na página delas, quando ela aparece) e,
   * UMA vez, todas as coladas da página de abertura (`abertura`, que vira
   * falso 2,6 s depois — e vale só pra ESSA página: as mesmas figurinhas nas
   * páginas de seção não colam de novo, mesmo virando logo depois de abrir;
   * 02/10: era a "página bege vazia" do vídeo do dono). As novas ficam num
   * conjunto ESTÁVEL (ref) desde o 1º render: os ids saem dele 2,6 s depois
   * de a página deles aparecer, sem re-render.
   */
  const colar = useRef<Set<string>>(new Set(novas));
  const [abertura, setAbertura] = useState(!reduzir);
  /** (16/10) As pendentes que a pessoa JÁ tocou: saem de "soltas" e colam com o peel (atraso 0), mesmo antes de a tela gravar o visto. */
  const [coladasAgora, setColadasAgora] = useState<ReadonlySet<string>>(() => new Set());
  const pendentesTxt = pendentes.join(",");
  const pendentesEfetivas = useMemo(() => new Set(pendentesTxt.split(",").filter((id) => id && !coladasAgora.has(id))), [pendentesTxt, coladasAgora]);
  const [ultimaColagem, setUltimaColagem] = useState<string | null>(null);
  const [colando, setColando] = useState(false);
  const colagensFeitas = useRef(new Set<string>());
  // O CTA autoriza todas as pendentes daquele toque, em ordem de página.
  // O snapshot não inclui conquistas que cheguem depois de abrir o álbum.
  const [filaColagem] = useState(() => via === "pacotinho"
    ? [...new Set([...paginas.slice(inicial), ...paginas.slice(1, inicial)].flatMap(p => p.vagas.filter(b => b.unlocked && pendentes.includes(b.id)).map(b => b.id)))]
    : []);
  const [filaAtiva, setFilaAtiva] = useState(via === "pacotinho");
  const coladasDaFila = filaColagem.filter(id => !pendentesEfetivas.has(id)).length;
  const filaConcluida = filaColagem.length > 0 && coladasDaFila === filaColagem.length;
  /* QA 1.0.18: o "✓ As N figurinhas foram coladas" ficava na tela pra sempre e cobria o contador e a seta ‹.
     Some sozinho em 3 s, ou antes, assim que a pessoa vira a página. */
  const [fimDispensado, setFimDispensado] = useState(false);
  const [paginaDoFim, setPaginaDoFim] = useState<number | null>(null);
  useEffect(() => {
    if (!filaConcluida || fimDispensado) return;
    if (paginaDoFim === null) { setPaginaDoFim(atual); return; }
    if (atual !== paginaDoFim) { setFimDispensado(true); return; }
    const t = setTimeout(() => setFimDispensado(true), AVISO_FIM_COLAGEM_MS);
    return () => clearTimeout(t);
  }, [filaConcluida, fimDispensado, paginaDoFim, atual]);
  const avisoDoFim = filaConcluida && !fimDispensado && (paginaDoFim === null || paginaDoFim === atual);
  useEffect(() => {
    if (!ultimaColagem) return;
    const movimento = setTimeout(() => setColando(false), reduzir ? 0 : 740);
    const aviso = setTimeout(() => setUltimaColagem(null), 2400);
    return () => { clearTimeout(movimento); clearTimeout(aviso); };
  }, [ultimaColagem, reduzir]);
  const colarPendente = useCallback((b: Badge) => {
    if (colagensFeitas.current.has(b.id)) return;
    colagensFeitas.current.add(b.id);
    if (editorial) { setColando(true); setUltimaColagem(b.name); }
    colar.current.add(b.id);
    setColadasAgora((s) => new Set([...s, b.id]));
    onColar?.(b);
  }, [onColar, editorial]);
  /** (17/10) Depois de colar as desta página (só então — não em qualquer página): a próxima página de seção que ainda tem figurinha nova. */
  const proximaNovaDe = useCallback((daqui: number): { indice: number; titulo: string; quantas: number } | null => {
    if (!pendentesEfetivas.size || !coladasAgora.size || !paginas[daqui]?.vagas.some((b) => coladasAgora.has(b.id))) return null;
    const ordem = paginas.map((_, i) => i).filter((i) => i > 0 && i !== daqui).sort((a, b) => ((a > daqui ? 0 : 1) - (b > daqui ? 0 : 1)) || a - b);
    for (const i of ordem) {
      const quantas = paginas[i].vagas.filter((b) => pendentesEfetivas.has(b.id)).length;
      if (quantas) return { indice: i, titulo: paginas[i].modulo ? categoriaDe(paginas[i].modulo!).label : paginas[i].raridade ? CAPITULO[paginas[i].raridade!].titulo : paginas[i].titulo, quantas };
    }
    return null;
  }, [paginas, pendentesEfetivas, coladasAgora]);
  /** O ângulo da folha que está virando (0 → −180 pra frente; −180 → 0 pra trás). */
  const rot = useMotionValue(0);
  const rotCapa = useMotionValue(0);
  const animacao = useRef<ReturnType<typeof animate> | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const livro = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const alturaUtil = (window.visualViewport?.height ?? window.innerHeight) - 172;
      setLargura(Math.max(240, Math.floor(Math.min(editorial ? 400 : 330, window.innerWidth - (editorial ? 68 : 48), alturaUtil / (editorial ? 1.56 : 1.42)))));
    };
    medir();
    window.addEventListener("resize", medir);
    window.visualViewport?.addEventListener("resize", medir);
    return () => { window.removeEventListener("resize", medir); window.visualViewport?.removeEventListener("resize", medir); };
  }, [aberto, editorial]);

  // a base das vizinhas acompanha a página atual, mas só com a folha parada
  useEffect(() => { if (!virando) setBase(atual); }, [virando, atual]);
  // depois da abertura, as outras páginas montam uma a uma — e nunca no meio de uma virada (o relógio para e volta com a folha parada)
  // 17/10 (desempenho): nem no meio das figurinhas colando na abertura (`abertura`, até ~4,3 s). Começavam aos ~3,1 s: cada
  // página montada (e pintada com as figurinhas, os filtros e o foil) dava um quadro de 120–250 ms no WebKit bem no fim do
  // "colar" (5 quadros assim por abertura). Agora a 1ª entra 300 ms depois que a abertura assenta; as vizinhas da página
  // aberta continuam montadas desde o início, então virar pra frente/pra trás não muda nada.
  const extrasComecaram = useRef(false);
  useEffect(() => {
    if (!aberto || editorial || extras >= n || virando || abertura || colando) return;
    const t = setTimeout(() => { extrasComecaram.current = true; setExtras((e) => e + 1); }, extrasComecaram.current ? 160 : 300);
    return () => clearTimeout(t);
  }, [aberto, editorial, extras, n, virando, abertura, colando]);

  // abrir: a capa vira na lombada e as figurinhas da página de abertura colam uma a uma
  useEffect(() => {
    if (!aberto) { setAtual(0); setVirando(null); setDetalhe(null); setCapaVisivel(false); setCapaGirada(false); setExtras(0); return; }
    setAtual(inicial);
    setBase(inicial);
    setExtras(0);
    extrasComecaram.current = false;
    setVirando(null);
    colar.current = new Set(novas);
    setAbertura(!reduzir);
    const esperaCapa = editorial ? 360 : CAPA_PARADA_MS;
    const tAbertura = setTimeout(() => setAbertura(false), editorial ? (mostrarCapa && !reduzir ? esperaCapa + CAPA_GIRO_MS + 150 : 0) : 2600 + (reduzir ? 0 : CAPA_REVELA_MS));
    trackEvent("album_abrir", { adesivos: abertos, novas: novas.length, via, pagina: inicial });
    if (reduzir || !mostrarCapa) { setCapaVisivel(false); return () => clearTimeout(tAbertura); }
    setCapaVisivel(true);
    setCapaGirada(false);
    rotCapa.set(0);
    let a: ReturnType<typeof animate> | null = null;
    const t1 = setTimeout(() => {
      setCapaGirada(true);
      a = animate(rotCapa, -180, { duration: (CAPA_GIRO_MS * lento()) / 1000, ease: EASE_FRENTE, onComplete: () => setCapaVisivel(false) });
    }, esperaCapa);
    // rede de segurança: se o fim da animação não avisar, a capa sai no tempo dela
    const t2 = setTimeout(() => setCapaVisivel(false), esperaCapa + CAPA_GIRO_MS * lento() + 120);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(tAbertura); a?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // a tela por baixo não rola enquanto o álbum está aberto; Esc fecha
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // as animações da tela de trás (o fogo da capa, a entrada) param: nada pinta por baixo do álbum
    document.documentElement.setAttribute("data-album-aberto", "");
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector(".share-fig")) return;
      if (detalhe) setDetalhe(null);
      else onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = anterior; document.documentElement.removeAttribute("data-album-aberto"); window.removeEventListener("keydown", tecla); };
  }, [aberto, detalhe, onFechar]);

  // o giroscópio (só quando já funciona) move o foil das épicas/lendárias
  useGiroscopioDoFoil(raiz, aberto && !reduzir && !editorial);

  const chaveDaVirada = useRef(0);
  const terminarVirada = useCallback((chave: number) => setVirando((v) => (v && v.chave === chave ? null : v)), []);

  /** Monta a virada de `de` pra `alvo` (sem animar): a folha e o que fica por baixo. */
  const montarVirada = useCallback((de: number, alvo: number, manual: boolean): Virada => {
    const dir: 1 | -1 = alvo > de ? 1 : -1;
    chaveDaVirada.current += 1;
    return dir > 0
      ? { sobreIndice: de, fundoIndice: alvo, dir, chave: chaveDaVirada.current, alvo, manual }
      : { sobreIndice: alvo, fundoIndice: de, dir, chave: chaveDaVirada.current, alvo, manual };
  }, []);

  const irPara = useCallback((i: number, automatico = false) => {
    if (!automatico) setFilaAtiva(false);
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
    trackEvent("album_pagina", { indice: alvo, secao: paginas[alvo]?.id });
  }, [atual, n, paginas, reduzir, montarVirada, rot, terminarVirada]);

  // Cada passo só é persistido depois de revelar sua página. Fechar cancela
  // o timer; navegar manualmente pausa o restante sem marcar nada como colado.
  useEffect(() => {
    if (!aberto || !presente || !editorial || !onColar || !filaAtiva || capaVisivel || virando || colando || detalhe) return;
    const id = filaColagem.find(item => pendentesEfetivas.has(item));
    const b = adesivos.find(item => item.id === id && item.unlocked);
    if (!b) return;
    const paginaAlvo = paginas.findIndex((p, i) => i > 0 && p.vagas.some(item => item.id === b.id));
    if (paginaAlvo >= 0 && paginaAlvo !== atual) {
      const t = setTimeout(() => irPara(paginaAlvo, true), reduzir ? 0 : 120);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => colarPendente(b), reduzir ? 0 : coladasDaFila ? 80 : 450);
    return () => clearTimeout(t);
  }, [aberto, presente, editorial, onColar, filaAtiva, capaVisivel, virando, colando, detalhe, filaColagem, pendentesEfetivas, adesivos, paginas, atual, coladasDaFila, reduzir, irPara, colarPendente]);

  // a folha some quando a animação termina (onComplete); este relógio é a rede de segurança
  useEffect(() => {
    if (!virando || virando.manual) return;
    const t = setTimeout(() => setVirando((v) => (v && v.chave === virando.chave ? null : v)), DURACAO_VIRADA_MS * lento() + 200);
    return () => clearTimeout(t);
  }, [virando]);

  // a folha que gira e a capa: o ângulo escreve direto no DOM
  useConduzir(raiz, '[data-papel="sobre"]', rot, largura, virando);
  useConduzir(raiz, '[data-papel="capa"]', rotCapa, largura, capaVisivel);

  /* ------------------------------------------------------------ o dedo */
  const gesto = useRef<{ x0: number; t0: number; ultimoX: number; ultimoT: number; virada: Virada | null; limiar: number } | null>(null);
  const aoPressionar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (detalhe || capaVisivel || e.pointerType === "mouse" && e.button !== 0) return;
    // o dedo numa figurinha com foil pode passear nela (o brilho corre) sem virar a página: o arrasto só começa mais longe
    const noFoil = !!(e.target as Element | null)?.closest?.("[data-foil-tem]");
    gesto.current = { x0: e.clientX, t0: Date.now(), ultimoX: e.clientX, ultimoT: Date.now(), virada: null, limiar: noFoil ? ARRASTO_MINIMO_NO_FOIL : ARRASTO_MINIMO };
  };
  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    if (!g.virada) {
      if (Math.abs(dx) < g.limiar) return;
      const alvo = dx < 0 ? atual + 1 : atual - 1;
      if (alvo < 0 || alvo >= n) { gesto.current = null; return; }
      setFilaAtiva(false);
      if (reduzir) { gesto.current = null; irPara(alvo); return; }
      animacao.current?.stop();
      // o arrasto assume o dedo: o foil que estava brilhando solta
      soltarFoils(e.currentTarget);
      // uma folha já animando: o gesto assume o controle dela
      const v = montarVirada(atual, alvo, true);
      g.virada = v;
      rot.set(v.dir > 0 ? 0 : -180);
      setVirando(v);
      try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
      // o que está dentro da folha sai do teste de toque enquanto o dedo arrasta (CSS [data-arrastando]); direto no DOM, sem render
      e.currentTarget.setAttribute("data-arrastando", "");
    }
    const v = g.virada;
    // o ângulo acompanha o dedo: a largura inteira = 180° (um pouco mais rápido que o dedo, como papel)
    const fracao = Math.max(0, Math.min(1, (Math.abs(dx) / Math.max(120, largura)) * 1.25));
    rot.set(v.dir > 0 ? -180 * fracao : -180 + 180 * fracao);
    g.ultimoX = e.clientX;
    g.ultimoT = Date.now();
  };
  const aoSoltar = (e?: React.PointerEvent<HTMLDivElement>) => {
    e?.currentTarget.removeAttribute("data-arrastando");
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

  // cada figurinha cola UMA vez: depois que a página dela apareceu, sai da lista (voltar à página não cola de novo)
  useEffect(() => {
    if (!aberto) return;
    const ids = [...paginas[Math.min(atual, n - 1)].vagas, ...paginas[Math.min(atual, n - 1)].proximos].map((b) => b.id);
    const t = setTimeout(() => { for (const id of ids) colar.current.delete(id); }, 2600);
    return () => clearTimeout(t);
  }, [aberto, atual, paginas, n]);

  useFaixaDoRelogioTransparente(aberto);
  if (!aberto) return null;
  const pagina = paginas[Math.min(atual, n - 1)];
  // (16/10) álbum por módulo: uma aba por módulo (só o emoji — 10 abas cabem na borda); por raridade, as de sempre
  const porModulo = paginas.some((p) => p.modulo);
  const abas: { id: string; icone: string; nome: string; rar: string; modulo?: BadgeCategoria; cor?: string }[] = porModulo
    ? [
        { id: "mais-raros", icone: "★", nome: "MAIS RAROS", rar: "destaque" },
        ...ORDEM_RARIDADE.flatMap(r => { const p = paginas.find(p => p.raridade === r); return p ? [{ id: p.id, icone: CAPITULO[r].icone, nome: CAPITULO[r].aba, rar: r }] : []; }),
        ...paginas.filter((p) => p.modulo && !(p.parte && p.parte[0] > 1)).map((p) => ({ id: p.id, icone: categoriaDe(p.modulo!).emoji, nome: (p.modulos ? p.titulo : categoriaDe(p.modulo!).label).toUpperCase(), rar: "modulo", modulo: p.modulo, cor: CAPITULO_MODULO[p.modulo!].cor })),
      ]
    : [
        { id: "mais-raros", icone: "★", nome: "MAIS RAROS", rar: "destaque" },
        ...ORDEM_RARIDADE.map((r) => ({ id: paginas.find((p) => p.raridade === r)?.id ?? "", icone: CAPITULO[r].icone, nome: CAPITULO[r].aba, rar: r })).filter((s) => s.id),
      ];
  const ativaAba = (s: { id: string; rar: string; modulo?: BadgeCategoria }) => pagina.id === s.id || (pagina.raridade && pagina.raridade === s.rar) || (!!s.modulo && pagina.modulo === s.modulo);
  const alturaLivro = Math.round(largura * (editorial ? 1.56 : 1.42));
  /**
   * As folhas montadas: as vizinhas da página atual (pré-rasterizadas) e as
   * duas da virada em curso. Cada uma tem a chave da página: trocar o papel
   * não remonta nada.
   */
  // da mais perto da base pra mais longe, as `extras` já montadas
  const porDistancia = paginas.map((_, i) => i).filter((i) => Math.abs(i - base) > 1).sort((a, b) => Math.abs(a - base) - Math.abs(b - base) || a - b).slice(0, extras);
  /**
   * ORDEM NO DOM = ordem de pintura no WebKit (ele não ordena as folhas pela profundidade, e trocar z-index repinta a camada):
   * da página de MAIOR índice pra MENOR. A folha que gira é sempre a de menor índice do par (pra frente é a que sai; pra trás,
   * a que entra) e assim fica por cima da de baixo; as em espera somem pelas faces a 1,2 %. No Chromium a profundidade (translateZ)
   * decide igual.
   */
  const montadas = [...new Set([base - 1, base, base + 1, ...porDistancia, virando?.sobreIndice, virando?.fundoIndice].filter((i): i is number => i !== undefined && i >= 0 && i < n))].sort((a, b) => b - a);
  const papelDe = (i: number): Papel => (virando ? (i === virando.sobreIndice ? "sobre" : i === virando.fundoIndice ? "fundo" : "espera") : i === atual ? "fundo" : "espera");

  return (
    <motion.div ref={raiz} className="alb-tela" data-editorial={editorial ? "" : undefined} data-cor-capa={editorial ? corCapa ?? "azul" : undefined} style={editorial ? { "--capa-cor": CORES_CAPA[corCapa ?? "azul"].cor, "--capa-clara": CORES_CAPA[corCapa ?? "azul"].clara } as CSSProperties : undefined} role="dialog" aria-modal="true" aria-label="Álbum de figurinhas" data-testid="album-tela" data-atual={atual} data-reduzir={reduzir ? "" : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0.1 : 0.2 }}>
      {/* 27/09 (dono: "o X não tá aparecendo"): a faixa tinha 56 px FIXOS com o recuo da
          câmera dentro — no iPhone o X subia pra baixo da barra de status. Recuo por fora, e pela
          --app-safe-top (a compensação do Android de WebView velho), igual à prévia. */}
      <div className="shrink-0" style={{ paddingTop: "var(--app-safe-top)" }}>
      {/* `border-0` nos botões redondos (varredura 27/09): a regra global do alvo de toque pegava os botões
          só-ícone "sem fundo" (o fundo deles vem do conquistas.css). */}
      <div className="alb-topo">
        <button type="button" className="alb-redondo border-0" onClick={onFechar} aria-label="Fechar o álbum" data-testid="album-fechar"><X className="w-5 h-5" /></button>
        <div className="flex-1 leading-[1.2] min-w-0">
          <b className="block text-[14px] font-black truncate">Álbum CORE {ano}</b>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,.65)" }}>{abertos} de {total}{abertos === total && !pendentesEfetivas.size ? " · coleção completa" : editorial ? " coladas" : ` · faltam ${total - abertos}`}{pendentesEfetivas.size > 0 ? ` · ${pendentesEfetivas.size} pra colar` : ""}</span>
        </div>
        {onCompartilhar && <button type="button" className="alb-redondo border-0" onClick={onCompartilhar} aria-label="Compartilhar meu álbum"><Instagram className="w-[18px] h-[18px]" /></button>}
      </div>
      </div>

      <div className="alb-mesa">
        {/* (sem inclinação do livro: ela exigia perspectiva na mesa, que somava com a da cena das folhas) */}
        <motion.div ref={livro} className="alb-livro" style={{ width: largura, height: alturaLivro }} initial={reduzir ? false : { y: 26, scale: 0.965, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.48, ease: "easeOut" }}>
          <div className="alb-pilha" aria-hidden><i /><i /><i /><i /></div>
          <div className="alb-lombada" aria-hidden />
          <div
            className="alb-folha"
            data-folha=""
            data-arrastavel=""
            style={{ "--w": largura } as CSSProperties}
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
            onClickCapture={aoClicarCapturando}
          >
            {/* a sombra que a folha projeta na página de baixo (só existe durante a virada) */}
            {montadas.map((i) => {
              const p = paginas[i];
              const papel = papelDe(i);
              return (
                <Fragment key={p.id}>
                  <Folha
                    papel={papel}
                    dir={papel === "sobre" ? virando?.dir : undefined}
                    pagina={p.id}
                    testid={papel === "sobre" ? "album-virando" : undefined}
                    frente={<Pagina p={p} indice={i} total={n} largura={largura} adesivos={adesivos} ativa={papel === "fundo"} abertura={abertura && i === inicial} colar={colar.current} atrasoBase={i === inicial && capaVisivel ? CAPA_REVELA_MS : 260} diasDeSequencia={diasDeSequencia} pendentes={pendentesEfetivas} destaques={destaques} rodapeFaltam={rodapeFaltam} editorial={editorial} proximaNova={papel === "fundo" ? proximaNovaDe(i) : null} onIrPara={irPara} onSelecionar={setDetalhe} onColar={colarPendente} />}
                    verso={<VersoDaPagina ano={ano} />}
                  />
                  {/* a sombra que a folha projeta na página de baixo: logo DEPOIS dela no DOM (por cima dela, por baixo da que gira) */}
                  {virando && papel === "fundo" && <div className="alb-sombra-projetada" data-sombra-projetada="sobre" aria-hidden />}
                </Fragment>
              );
            })}
            {/* a capa, por cima, girando na lombada ao abrir — sempre NA FRENTE, deita até −180° e sai; a partir do
                perfil as figurinhas da 1ª página começam a colar */}
            {capaVisivel && (
              <>
                <div className="alb-sombra-projetada" data-sombra-projetada="capa" style={{ zIndex: 5 }} aria-hidden />
                <div data-testid="album-capa-3d" data-girada={capaGirada ? "" : undefined} style={{ zIndex: 6, position: "absolute", inset: 0, pointerEvents: "none", transformStyle: "preserve-3d" }}>
                  <Folha
                    papel="capa"
                    dir={1}
                    testid="album-capa-folha"
                    frente={<CapaAlbum referencia={editorial} largura={largura} altura={alturaLivro} maisRaros={maisRaros} figurinhasCapa={figurinhasCapa} corCapa={corCapa} abertos={abertos} total={total} nome={nome} ano={ano} style={{ height: "100%" }} />}
                    verso={<VersoDaCapa nome={nome} ano={ano} />}
                  />
                </div>
              </>
            )}
          </div>
          <div className="alb-abas" role="tablist" aria-label="Seções do álbum">
            {abas.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={!!ativaAba(s)} className="alb-aba" data-rar={s.rar} data-modulo={s.modulo} data-ativa={ativaAba(s) ? "" : undefined} style={s.cor ? ({ "--mod": s.cor } as CSSProperties) : undefined} onClick={() => irPara(paginas.findIndex((p) => p.id === s.id))} data-testid={`album-aba-${s.modulo ?? s.rar}`} aria-label={s.nome} title={s.nome}>
                <IconeMarcaAlbum modulo={s.modulo} />{!porModulo && <span>{s.nome}</span>}
              </button>
            ))}
          </div>
        </motion.div>
        <div className="alb-nav2">
          <button type="button" className="alb-seta border-0" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Página anterior" data-testid="album-tela-anterior"><ChevronLeft className="w-5 h-5" /></button>
          {editorial ? <div className="alb-localizacao" aria-live="polite" aria-atomic="true"><span className="sr-only">{tituloDaPagina(paginas[atual])}, página </span><b>{nDeDois(atual + 1)} <i>/ {nDeDois(n)}</i></b></div> : <div className="alb-dots2" aria-hidden>
            {paginas.map((p, i) => <i key={p.id} data-rar={p.raridade ?? "destaque"} data-ativo={i === atual ? "" : undefined} />)}
          </div>}
          <button type="button" className="alb-seta border-0" onClick={() => irPara(atual + 1)} disabled={atual >= n - 1} aria-label="Próxima página" data-testid="album-tela-proxima"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {editorial && <div className="alb-colagem-status" role="status" aria-live="polite" data-visivel={(filaConcluida ? avisoDoFim : ultimaColagem) ? "" : undefined}>{filaConcluida ? `✓ ${filaColagem.length === 1 ? "Sua figurinha foi colada" : `As ${filaColagem.length} figurinhas foram coladas`} no álbum` : ultimaColagem ? `✓ ${ultimaColagem} colada no álbum` : ""}</div>}
      {editorial && filaColagem.length > 1 && !filaConcluida && <div className="alb-colagem-fila" data-testid="album-colagem-fila">
        <span>{filaAtiva ? "Colando" : "Colagem pausada"} · <b>{coladasDaFila} de {filaColagem.length}</b></span>
        <button type="button" onClick={() => setFilaAtiva(ativa => !ativa)}>{filaAtiva ? "Pausar" : "Continuar"}</button>
      </div>}
      <div className="alb-rodape2">
        {onCompartilhar && (
          <button type="button" onClick={onCompartilhar} className="w-full h-11 rounded-xl font-bold text-[13.5px] inline-flex items-center justify-center gap-2" style={{ background: "#fff", color: "#2b2b2f" }} data-testid="album-tela-compartilhar">
            Compartilhar meu álbum
          </button>
        )}
        {editorial ? <p className="alb-instrucao">Deslize para folhear · toque para ver de perto</p> : <div className="alb-rodape2-linha"><span>{resumoRaridades(porRaridade)}</span>{nivel ? <span>Nível {nivel}</span> : <span>{abertos} de {total}</span>}</div>}
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
            onUsarNaCapa={onUsarNaCapa}
            onPostar={(b) => { setDetalhe(null); onCompartilharFigurinha(b); }}
            onIr={(caminho) => { setDetalhe(null); onFechar(); navigate(caminho); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
