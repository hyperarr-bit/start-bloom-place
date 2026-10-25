import { CelebracaoFigurinha } from "./CelebracaoFigurinha";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ChevronRight, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { RARIDADE_LABEL, raridadeDe, type Badge } from "@/components/gamification/types";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { AdesivoRaro } from "../adesivos-raridade";
import { ARTES_CADERNO } from "../artes-caderno";
import { proximasFigurinhas } from "../capa-pessoal";
import { requisitoDaFigurinha } from "../textos-figurinhas";
import { RARIDADES_EM_TESTE } from "../MarcaRaridade";
import { giroDoAdesivo } from "../adesivos-arte";
import { FolhaSequencia } from "@/components/fogo/FolhaSequencia";
import { useNavigate } from "react-router-dom";
import { IconeMarcaAlbum } from "../IconeMarcaAlbum";
import type { Sequencia } from "../use-conquistas";
import { EVENTOS2, podeCompartilhar } from "./recompensas";
import { type ColecaoNova, type EstadoConquistasNova } from "./use-conquistas-nova";
import "../conquistas.css";
import "./conquistas-nova.css";
import "./colecao-caderno.css";

/**
 * As CAMADAS da Conquistas 2 (16/10): o toast do adesivo comum/raro, a festa
 * do marco (7/30/100), o detalhe da sequência (4 semanas, protetores, próximos
 * prêmios, lembrete) e a coleção inteira em grade ("ver todos", secundária).
 */

/* ------------------------------------------------------------------ toast */

export interface PropsToast {
  badge: Badge;
  /** Vários no mesmo dia viram um toast só ("3 adesivos novos"). */
  quantidade?: number;
  colecao?: string;
  /** No teste grátis com a Missão valendo: "Seu adesivo está esperando no álbum" — mais baixo, sem festa. */
  suave?: boolean;
  onToque?: () => void;
  onFechar?: () => void;
}

/** Comuns: cartão breve, agrupado e sem roubar o foco. */
export const ToastAdesivo = ({ badge, quantidade = 1, suave, onToque, onFechar }: PropsToast) => {
  const r = raridadeDe(badge);
  useEffect(() => { trackEvent(EVENTOS2.toastView, { id: badge.id, raridade: r, quantidade, suave: !!suave }); }, [badge.id, r, quantidade, suave]);
  return <CelebracaoFigurinha badge={badge} quantidade={quantidade} onFechar={onFechar} onColar={() => { trackEvent(EVENTOS2.toastToque, { id: badge.id, quantidade, suave: !!suave }); onToque?.(); }} />;
};

/** Os marcos usam a mesma linguagem, preservando a opção de compartilhar. */
export const CelebracaoMarco = ({ badge, dias, seq: _seq, onContinuar, onCompartilhar, onColar }: { badge: Badge; dias: number; seq: Sequencia; onContinuar: () => void; onCompartilhar?: () => unknown; onColar?: () => void }) => {
  useEffect(() => { trackEvent(EVENTOS2.marcoView, { dias }); }, [dias]);
  return <CelebracaoFigurinha badge={badge} marco={{ dias, protetor: dias % 7 === 0 }} onFechar={onContinuar} onColar={onColar} onCompartilhar={podeCompartilhar(badge) && onCompartilhar ? () => { trackEvent(EVENTOS2.marcoShare, { dias }); return onCompartilhar(); } : undefined} />;
};

/* ------------------------------------------------------------------ o detalhe da sequência */

/**
 * 26/10 (dono): a folha da sequência é UMA só — components/fogo/FolhaSequencia (a mesma do toque no fogo da Home nova):
 * fogo unificado + dias seguidos (recorde só se maior), status/ação do dia, a semana em bolinhas (4 semanas no "Ver mais"),
 * "Sua evolução" compacta já no próximo marco (as artes daqui), protetores numa linha, "O que conta". Sai a grade
 * cinza e o lembrete. Tocar numa figurinha segue ampliando (onAdesivo → a camada de sempre).
 */
export const DetalheSequencia = ({ e, aberto, onFechar, onAdesivo }: { e: EstadoConquistasNova; aberto: boolean; onFechar: () => void; onAdesivo: (b: Badge) => void }) => {
  const navigate = useNavigate();
  return <FolhaSequencia aberta={aberto} onFechar={onFechar} seq={e.seq} trilha={e.trilha} origem="conquistas" onAdesivo={onAdesivo} onIr={(rota) => navigate(rota)} />;
};

/* ------------------------------------------------------------------ a coleção inteira (ver todos, secundária) */

/**
 * ARTE SOB DEMANDA (23/10): a coleção tem ~98 figurinhas e as trancadas usam a própria imagem como máscara — tudo
 * montado de uma vez dava ~160 MB de imagem decodificada (risco de derrubar o app em iPhone antigo). Só a célula
 * PERTO da tela (1 tela acima/abaixo) monta a arte; a que fica BEM longe (2 telas) solta. A moldura da célula fica
 * no mesmo tamanho e lugar, então nada visível muda. Sem IntersectionObserver (teste/navegador velho): tudo monta.
 */
const MARGEM_CARREGA = 1; // telas
const MARGEM_SOLTA = 2;
type Observador = { observar: (el: HTMLElement, id: string) => () => void; perto: (id: string) => boolean };
const useArteSobDemanda = (rolagem: RefObject<HTMLElement>): Observador => {
  const semIO = typeof IntersectionObserver === "undefined";
  const [perto, setPerto] = useState<ReadonlySet<string>>(() => new Set());
  const celulas = useRef(new Map<HTMLElement, string>());
  const ios = useRef<{ carrega: IntersectionObserver; solta: IntersectionObserver } | null>(null);
  const juntar = useCallback((ids: string[]) => {
    if (ids.length) setPerto((p) => (ids.every((id) => p.has(id)) ? p : new Set([...p, ...ids])));
  }, []);
  // a conta na hora (antes de pintar): a célula que já nasce na tela nunca aparece vazia nem por 1 quadro
  const pertoAgora = useCallback((els: HTMLElement[]) => {
    const raiz = rolagem.current;
    if (!raiz) return;
    const r = raiz.getBoundingClientRect();
    const m = (r.height || window.innerHeight) * MARGEM_CARREGA;
    juntar(els.filter((el) => { const b = el.getBoundingClientRect(); return b.bottom >= r.top - m && b.top <= r.bottom + m; }).map((el) => celulas.current.get(el)!).filter(Boolean));
  }, [rolagem, juntar]);
  useLayoutEffect(() => {
    const raiz = rolagem.current;
    if (semIO || !raiz) return;
    const idDe = (el: Element) => celulas.current.get(el as HTMLElement);
    // a que chega rolando: a imagem já vem decodificada ANTES de montar (nunca um quadro com a célula vazia na tela)
    const carrega = new IntersectionObserver((es) => {
      for (const e of es) {
        const id = e.isIntersecting ? idDe(e.target) : undefined;
        // 26/10 (rodada 2b, Simulador): um "fora" entregue a quem está na tela não pode deixar a célula vazia — a conta na mão decide
        if (!id) { pertoAgora([e.target as HTMLElement]); continue; }
        const url = ARTES_CADERNO[id];
        if (!url) { juntar([id]); continue; }
        const img = new Image();
        img.src = url;
        // 1.0.19 (páginas em branco na "Sua coleção", TestFlight do dono): no WebKit o decode() pode demorar muito ou nem
        // voltar com dezenas pedidas juntas (rolagem rápida) — a célula esperava pra sempre, vazia. Espera no máximo 250 ms.
        const decodificada = typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve();
        Promise.race([decodificada, new Promise((r) => window.setTimeout(r, 250))]).then(() => juntar([id]));
      }
    }, { root: raiz, rootMargin: `${MARGEM_CARREGA * 100}% 0px` });
    const solta = new IntersectionObserver((es) => {
      // 26/10 (rodada 2b, Simulador do iPhone 17 Pro): depois de uma rolagem rápida até o FIM da coleção, o WebKit entregou
      // "fora" pras duas últimas células — que estavam NA TELA — e a arte delas sumia (figurinhas em branco até a próxima
      // rolagem). Só solta quem está longe DE VERDADE, pela geometria na hora da entrega.
      const r = raiz.getBoundingClientRect();
      const m = (r.height || window.innerHeight) * MARGEM_SOLTA;
      const longe = es.filter((e) => !e.isIntersecting).map((e) => e.target as HTMLElement)
        .filter((el) => { const b = el.getBoundingClientRect(); return b.bottom < r.top - m || b.top > r.bottom + m; })
        .map((el) => idDe(el)!).filter(Boolean);
      if (longe.length) setPerto((p) => (longe.some((id) => p.has(id)) ? new Set([...p].filter((id) => !longe.includes(id))) : p));
    }, { root: raiz, rootMargin: `${MARGEM_SOLTA * 100}% 0px` });
    ios.current = { carrega, solta };
    for (const el of celulas.current.keys()) { carrega.observe(el); solta.observe(el); }
    pertoAgora([...celulas.current.keys()]);
    // rede de segurança: o WebKit nem sempre entrega o IntersectionObserver de um rolador `fixed` durante a rolagem
    // com inércia (só no fim) — a conta na mão a cada quadro de rolagem garante a arte de quem está na tela.
    let quadro = 0;
    const aoRolar = () => {
      if (quadro) return;
      quadro = window.requestAnimationFrame(() => { quadro = 0; pertoAgora([...celulas.current.keys()]); });
    };
    raiz.addEventListener("scroll", aoRolar, { passive: true });
    return () => { carrega.disconnect(); solta.disconnect(); ios.current = null; raiz.removeEventListener("scroll", aoRolar); if (quadro) window.cancelAnimationFrame(quadro); };
  }, [rolagem, semIO, juntar, pertoAgora]);
  const observar = useCallback((el: HTMLElement, id: string) => {
    celulas.current.set(el, id);
    if (ios.current) { ios.current.carrega.observe(el); ios.current.solta.observe(el); pertoAgora([el]); }
    return () => { celulas.current.delete(el); ios.current?.carrega.unobserve(el); ios.current?.solta.unobserve(el); };
  }, [pertoAgora]);
  return { observar, perto: (id: string) => semIO || perto.has(id) };
};

/** A arte da célula da coleção: monta só perto da tela (ver useArteSobDemanda). */
const ArteDaCelula = ({ b, i, obs }: { b: Badge; i: number; obs: Observador }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const { observar } = obs;
  useLayoutEffect(() => (ref.current ? observar(ref.current, b.id) : undefined), [observar, b.id]);
  return (
    <span ref={ref} className="cn-colecao-arte">
      <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={112} style={{ width: "var(--colecao-arte)", height: "var(--colecao-arte)" }} trancado={!b.unlocked} progresso={b.progresso} giro={b.unlocked ? giroDoAdesivo(i) : 0} semArte={!obs.perto(b.id)} />
      {!b.unlocked && rotuloProgresso(b) && <span className="cn-prog">{rotuloProgresso(b)}</span>}
    </span>
  );
};

export const ColecaoTela = ({ e, inicial, onFechar, onAdesivo }: { e: Pick<EstadoConquistasNova, "colecoes" | "abertos" | "total">; inicial: ColecaoNova | null; onFechar: () => void; onAdesivo: (b: Badge) => void }) => {
  const [filtro, setFiltro] = useState<string>(inicial?.id ?? "todas");
  const [raridadeFiltro, setRaridadeFiltro] = useState("todas");
  const [visao, setVisao] = useState<"todas" | "perto">("todas");
  const fechar = useRef<HTMLButtonElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const obs = useArteSobDemanda(rolagem);
  useEffect(() => {
    const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    fechar.current?.focus({ preventScroll: true });
    return () => { if (origem?.isConnected) origem.focus({ preventScroll: true }); };
  }, []);
  // O detalhe ampliado é outra camada: esta captura só teclas originadas na coleção.
  const teclado = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); onFechar(); return; }
    if (event.key !== "Tab") return;
    const controles = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]');
    const primeiro = controles[0], ultimo = controles[controles.length - 1];
    if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo?.focus(); }
    else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro?.focus(); }
  };
  const secoes = (filtro === "todas" ? e.colecoes : e.colecoes.filter((c) => c.id === filtro))
    .map(c => ({...c, adesivos:c.adesivos.filter(b => raridadeFiltro === "todas" || raridadeDe(b) === raridadeFiltro)}))
    .filter(c => c.adesivos.length > 0);
  const candidatas = secoes.flatMap(c => c.adesivos);
  // A sequência tem sua própria evolução, mas continua consultável pelo filtro do módulo.
  const proximas = filtro === "sequencia" ? candidatas.filter(b => !b.unlocked).slice(0, 2) : proximasFigurinhas(candidatas);
  return (
    <div ref={rolagem} className="cn-tela cn-colecao" role="dialog" aria-modal="true" aria-label="Todos os adesivos" data-testid="cn-colecao-tela" onKeyDown={teclado}>
      <div className="cn-colecao-moldura">
        <div className="cn-tela-cab">
          <button ref={fechar} type="button" onClick={onFechar} aria-label="Fechar" className="cn-colecao-fechar"><X aria-hidden /></button>
          <div className="min-w-0">
            <h2>Sua coleção</h2>
            <p>{e.abertos} de {e.total} figurinhas conquistadas</p>
          </div>
          <span className="cn-colecao-simbolo" aria-hidden><IconeMarcaAlbum /></span>
        </div>
        <div className="cn-colecao-visao" role="group" aria-label="Mostrar figurinhas">
          <button type="button" aria-pressed={visao === "todas"} onClick={() => setVisao("todas")}>Todas</button>
          <button type="button" aria-pressed={visao === "perto"} onClick={() => setVisao("perto")}>Perto de conquistar</button>
        </div>
        <div className="cn-b-chips" role="group" aria-label="Filtrar por módulo">
          <button type="button" className="cn-b-chip" data-ativo={filtro === "todas" ? "" : undefined} aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</button>
          {e.colecoes.map((x) => (
            <button key={x.id} type="button" className="cn-b-chip" data-ativo={filtro === x.id ? "" : undefined} aria-pressed={filtro === x.id} onClick={() => setFiltro(x.id)}><IconeMarcaAlbum modulo={x.id} /> {x.label} <span className="n">{x.abertos}/{x.total}</span></button>
          ))}
        </div>
        <label className="cn-colecao-filtro">Raridade
          <select aria-label="Filtrar por raridade" value={raridadeFiltro} onChange={event => setRaridadeFiltro(event.target.value)}>
            <option value="todas">Todas as raridades</option><option value="comum">Comuns</option><option value="raro">Raras</option><option value="epico">Épicas</option><option value="lendario">Lendárias</option>
          </select>
        </label>
        {visao === "todas" && secoes.length === 0 && <p className="cn-colecao-vazia" role="status">Nenhuma figurinha desta raridade neste módulo.</p>}
        {visao === "perto" ? <section className="cn-colecao-proximas" aria-label="Perto de conquistar">
          {proximas.length ? <><p className="cn-proximas-intro">Ideias para continuar sua coleção.</p><div>{proximas.map(b => <button type="button" key={b.id} onClick={() => onAdesivo(b)} className="cn-proxima-acao">
            <span aria-hidden><AdesivoRaro id={b.id} tamanho={72} raridade={raridadeDe(b)} trancado progresso={b.progresso}/></span>
            <span><b>{b.name}</b><small>{requisitoDaFigurinha(b)}</small>{b.progresso && b.progresso.atual > 0 && <em>{Math.min(100, Math.floor(b.progresso.atual / b.progresso.alvo * 100))}% do caminho</em>}</span><ChevronRight size={17} aria-hidden/>
          </button>)}</div></> : <p className="cn-colecao-vazia" role="status">Nenhuma sugestão com estes filtros. Explore outros módulos ou veja todas as figurinhas.</p>}
        </section> : <div className="cn-colecao-secoes">
          {secoes.map((c) => (
            <section key={c.id} className="cn-card cn-colecao-secao" aria-label={c.label}>
              <div className="cn-colecao-secao-cab">
                <IconeMarcaAlbum modulo={c.id} />
                <h3 className="cn-serif">{c.label}</h3>
                <span>{c.abertos} de {c.total}</span>
              </div>
              <div className="cn-grade4">
                {c.adesivos.map((b, i) => (
                  <button key={b.id} type="button" className="cn-celula" onClick={() => onAdesivo(b)} data-aberto={b.unlocked ? "true" : "false"} aria-label={`${b.name}: ${b.unlocked ? "conquistada" : "a conquistar"}`}>
                    <ArteDaCelula b={b} i={i} obs={obs} />
                    <span className={`cn-celula-nome ${b.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{b.name}</span>
                    {(!b.unlocked || RARIDADES_EM_TESTE) && raridadeDe(b) !== "comum" && <span className="chip-rar" data-rar={raridadeDe(b)} style={{ height: 14, fontSize: 7.5 }}>{RARIDADE_LABEL[raridadeDe(b)]}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>}
      </div>
    </div>
  );
};
