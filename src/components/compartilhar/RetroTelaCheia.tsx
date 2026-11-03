import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { useReducedMotion } from "framer-motion";
import { Clapperboard, Download, Loader2, Share, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { suporteVideo } from "@/components/conquistas/video/suporte";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";
import { aplicarBarraDeStatus } from "@/lib/status-bar";
import { CardDeCompartilhar, CORES_AGUA } from "./cards";
import { postarCardImagem, postarCardVideo, prepararCapas } from "./postar";
import { comEscolhas, type CardDaRetro, type RetroOutubro as DadosDaRetro } from "./retro-outubro-dados";
import { encaixeDoCard, fundoClaro, fundoEsticado, lerFundoDoCard, tempoDoCard, texturaEsticada, TEMPOS } from "./retro-tela-cheia";
import { capitalizar, nomeDoMes } from "./textos";
import { FORMATOS, type DadosCard } from "./tipos";

const AnimacaoDoCard = lazy(() => import("./AnimacaoDoCard"));

/**
 * A RETROSPECTIVA DE OUTUBRO EM TELA CHEIA (02/11, protótipo — chave em
 * retro-tela-cheia.ts). O principal é VER o mês: cada card de ponta a ponta
 * (o fundo dele esticado até as bordas, respeitando a ilha e a barra de
 * baixo), barrinhas no topo, passa sozinho; toque à direita avança, à
 * esquerda volta, SEGURAR pausa, arrastar pra baixo (ou o X) fecha. Com
 * "reduzir movimento" do sistema: sem animação e sem passar sozinho.
 *
 * Compartilhar é secundário: o ícone do canto (e o botão grande do último
 * card) abre a folha de baixo com Stories | Feed, "Postar nos Stories",
 * "Salvar" e — no card de Finanças com valor — "Mostrar valores em R$".
 * A folha aberta pausa.
 *
 * Eventos (todos com mes: "outubro", versao: "tela-cheia", sem e-mail/uid):
 * wrapped_cards · wrapped_tela (+ como chegou: inicio/auto/toque/deslizou/
 * tecla) · wrapped_auto_avancou · wrapped_pausou · wrapped_compartilhar_aberto
 * (origem icone/final) · wrapped_share · wrapped_valores · wrapped_fechou
 * (+ como: x/arrastou/esc/saiu).
 */

const MES = "outubro";
const VERSAO = "tela-cheia";
const ROTULOS: Record<CardDaRetro["id"], string> = { abertura: "Abertura", financas: "Finanças", treino: "Treino", rotina: "Rotina", agua: "Água", leitura: "Leitura", metas: "Metas", resumo: "Meu outubro", fechamento: "Até novembro" };
const FUNDO_ESCURO = "#0e0e11";

type Como = "inicio" | "auto" | "toque" | "deslizou" | "tecla" | "voltou";

const CardEscalado = memo(({ elemento, largura, w, h }: { elemento: ReactElement; largura: number; w: number; h: number }) => {
  const s = largura / w;
  return (
    <div style={{ width: largura, height: Math.round(h * s), overflow: "hidden", position: "relative" }}>
      <div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }}>{elemento}</div>
    </div>
  );
});
CardEscalado.displayName = "CardEscalado";

const temReais = (d: DadosCard) => d.tipo === "azul" && d.meses.some((m) => (m.saldo ?? 0) > 0);
const temTextos = (d: DadosCard) => d.tipo === "metas" && (d.textos ?? []).some(Boolean);
/** Cards com a água até o pé (Finanças no azul): embaixo do card a água continua, na cor do fundo dela. */
const temAguaNoPe = (d: DadosCard) => d.tipo === "azul" || d.tipo === "poupanca";

/** A folha é sempre escura: o interruptor com cores fixas (no modo escuro do app o padrão sumia no fundo). */
const SWITCH_NA_FOLHA = "data-[state=unchecked]:bg-white/25 data-[state=checked]:bg-[#db2777] [&>span]:bg-white";

const ESTILOS = `
@keyframes retroTcBarra { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes retroTcEntra { from { opacity: 0 } to { opacity: 1 } }
@keyframes retroTcFolha { from { transform: translateY(100%) } to { transform: translateY(0) } }
`;

interface Props {
  retro: DadosDaRetro;
  onClose: () => void;
}

export const RetroTelaCheia = ({ retro, onClose }: Props) => {
  const reduzir = !!useReducedMotion();
  const cards = retro.cards;
  const total = cards.length;
  const [i, setI] = useState(0);
  /** Recomeçar o mesmo card (toque à esquerda no 1º). */
  const [rodada, setRodada] = useState(0);
  const [valores, setValores] = useState(false);
  const [textosDasMetas, setTextosDasMetas] = useState(false);
  const [capas, setCapas] = useState<DadosCard | null>(null);
  const [video, setVideo] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState<"video" | "imagem" | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [formato, setFormato] = useState<"stories" | "feed">("stories");
  const [folha, setFolha] = useState<null | "icone" | "final">(null);
  const [segurando, setSegurando] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [arrasto, setArrasto] = useState(0);
  /** O relógio do card atual: começa quando a animação dele começa (ou sem animação, na hora). */
  const [relogio, setRelogio] = useState<{ chave: string; ms: number; origem: "animacao" | "espera" | "direto" } | null>(null);
  /** O card de agora já foi visto nesta abertura (voltou nele)? Então aparece pronto, sem refazer a animação. */
  const [revisita, setRevisita] = useState(false);
  /** A animação deste card já tomou a tela (até lá, embaixo dela fica só o fundo do card — sem o card cheio piscar antes). */
  const [cobriu, setCobriu] = useState<string | null>(null);
  const [tela, setTela] = useState({ w: 390, h: 844 });
  const [seguro, setSeguro] = useState({ topo: 0, base: 0 });
  const [fundo, setFundo] = useState<{ css: string; textura: CSSProperties | null; claro: boolean } | null>(null);

  const raiz = useRef<HTMLDivElement>(null);
  const sondaTopo = useRef<HTMLDivElement>(null);
  const sondaBase = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const colunaRef = useRef<HTMLDivElement>(null);
  const vistos = useRef(new Set<number>());
  const comoChegou = useRef<Como>("inicio");
  const comoFechou = useRef<string | null>(null);

  const atual = cards[Math.min(i, total - 1)];
  const ultimo = i === total - 1;
  const chaveDoCard = `${i}-${rodada}`;

  // as capas dos livros viram dataURL uma vez (o que a tela mostra = o que o vídeo e a imagem levam)
  const livros = cards.find((c) => c.id === "leitura")?.dados;
  useEffect(() => {
    if (!livros) return;
    let vivo = true;
    prepararCapas(livros).then((d) => { if (vivo) setCapas(d); }, () => { /* fica a capa tipográfica */ });
    return () => { vivo = false; };
  }, [livros]);

  useEffect(() => {
    let vivo = true;
    suporteVideo().then((s) => { if (vivo) setVideo(!!s); }, () => { if (vivo) setVideo(false); });
    return () => { vivo = false; };
  }, []);

  // a faixa do relógio some (o fundo do card vai até atrás dela); o relógio claro/escuro conforme o card
  useFaixaDoRelogioTransparente(true);
  const claro = !!fundo?.claro;
  useEffect(() => { void aplicarBarraDeStatus(claro ? "light" : "dark"); }, [claro]);
  useEffect(() => () => { void aplicarBarraDeStatus(document.documentElement.classList.contains("dark") ? "dark" : "light"); }, []);

  // quais cards a pessoa tem (1 vez por abertura)
  const contou = useRef(false);
  useEffect(() => {
    if (contou.current) return;
    contou.current = true;
    trackEvent("wrapped_cards", { mes: MES, month: capitalizar(MES), cards: cards.map((c) => c.id).join(","), n: total, pouco_dado: retro.poucoDado, financas: retro.financas ?? "sem", versao: VERSAO });
  }, [cards, total, retro]);

  // cada card visto (1ª vez), com como chegou nele
  useEffect(() => {
    if (vistos.current.has(i)) return;
    vistos.current.add(i);
    trackEvent("wrapped_tela", { mes: MES, month: capitalizar(MES), i, id: atual.id, total, versao: VERSAO, como: comoChegou.current });
  }, [i, atual.id, total]);

  // até onde foi (no fechar e no sair do app)
  useEffect(() => () => {
    trackEventBeacon("wrapped_fechou", { mes: MES, month: capitalizar(MES), vistos: vistos.current.size, total, chegou_ao_fim: vistos.current.has(total - 1), versao: VERSAO, como: comoFechou.current ?? "saiu" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fechar = useCallback((como: string) => { comoFechou.current = como; onClose(); }, [onClose]);

  const ir = useCallback((passo: number, como: Como) => {
    if (passo < 0 && i === 0) { setRodada((r) => r + 1); setRevisita(true); return; }
    const alvo = Math.max(0, Math.min(total - 1, i + passo));
    if (alvo === i) return;
    comoChegou.current = passo < 0 ? "voltou" : como;
    setRevisita(vistos.current.has(alvo));
    setI(alvo);
  }, [i, total]);

  // aba/app em segundo plano: pausa
  useEffect(() => {
    const ver = () => setOculto(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", ver);
    return () => document.removeEventListener("visibilitychange", ver);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (folha) setFolha(null); else fechar("esc"); }
      else if (folha) return;
      else if (e.key === "ArrowRight") ir(1, "tecla");
      else if (e.key === "ArrowLeft") ir(-1, "tecla");
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, fechar, folha]);

  // o tamanho da tela e as áreas seguras (notch/ilha em cima, barra embaixo)
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth || window.innerWidth || 390;
      const h = el.clientHeight || window.innerHeight || 844;
      setTela((t) => (t.w === w && t.h === h ? t : { w, h }));
      const topo = sondaTopo.current?.offsetHeight ?? 0;
      const base = sondaBase.current?.offsetHeight ?? 0;
      setSeguro((s) => (s.topo === topo && s.base === base ? s : { topo, base }));
    };
    medir();
    window.addEventListener("resize", medir);
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", medir);
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => { ro.disconnect(); window.removeEventListener("resize", medir); };
  }, []);

  const base = atual.id === "leitura" && capas ? capas : atual.dados;
  const dados = useMemo(() => comEscolhas(base, { valores, textosDasMetas }), [base, valores, textosDasMetas]);
  const animado = !!video && !reduzir;
  // (relogio.origem "espera": a animação não veio a tempo — o card fica parado, sem pular pro começo dela depois)
  const animarEste = animado && !revisita && !(relogio?.chave === chaveDoCard && relogio.origem === "espera");

  const enc = useMemo(() => {
    const e = encaixeDoCard({ largura: tela.w, altura: tela.h, topoSeguro: seguro.topo, baseSeguro: seguro.base, botaoFinal: ultimo });
    const w = Math.round(e.w);
    return { coluna: Math.round(e.coluna), w, h: Math.round((w * FORMATOS.stories.h) / FORMATOS.stories.w), x: Math.round((e.coluna - w) / 2), y: Math.round(e.y), escala: w / FORMATOS.stories.w };
  }, [tela, seguro, ultimo]);

  // o fundo do card esticado até as bordas (lido do próprio card desenhado: nenhuma cor duplicada aqui)
  useLayoutEffect(() => {
    const el = cardRef.current?.querySelector<HTMLElement>("[data-cartao-share]");
    if (!el) return;
    const lido = lerFundoDoCard(el.style.backgroundImage, el.style.backgroundColor);
    const caixa = { w: enc.coluna, h: tela.h };
    const card = { x: enc.x, y: enc.y, w: enc.w, h: enc.h };
    const tex = el.firstElementChild instanceof HTMLElement ? texturaEsticada(el.firstElementChild.style.backgroundImage, el.firstElementChild.style.backgroundSize, enc.escala, card) : null;
    setFundo({ css: lido ? fundoEsticado(lido, card, caixa) : FUNDO_ESCURO, textura: tex, claro: fundoClaro(lido) });
  }, [chaveDoCard, dados, enc, tela.h]);

  // o relógio do card: sem animação começa na hora; com animação, quando ela começa (ou desiste após a espera máxima)
  useEffect(() => {
    setRelogio(null);
    if (reduzir) return;
    if (video === false || revisita) { setRelogio({ chave: chaveDoCard, ms: tempoDoCard(atual.id), origem: "direto" }); return; }
    // a abertura espera mais (não tem nada antes dela); nos outros, se a animação não vier logo, o card aparece parado
    const espera = i === 0 && rodada === 0 ? TEMPOS.esperaMaxima : TEMPOS.esperaCard;
    const t = window.setTimeout(() => setRelogio((r) => r ?? { chave: chaveDoCard, ms: tempoDoCard(atual.id), origem: "espera" }), espera);
    return () => window.clearTimeout(t);
  }, [chaveDoCard, atual.id, video, reduzir, revisita]); // eslint-disable-line react-hooks/exhaustive-deps
  const animacaoPronta = useCallback((duracao: number) => {
    setRelogio((r) => (r && r.chave === chaveDoCard ? r : { chave: chaveDoCard, ms: tempoDoCard(atual.id, duracao), origem: "animacao" }));
    // depois do fade do canvas, o card cheio volta por baixo (é ele que aparece se a animação for refeita — ex.: o R$ ligado)
    window.setTimeout(() => setCobriu(chaveDoCard), 400);
  }, [chaveDoCard, atual.id]);
  const soFundo = animarEste && cobriu !== chaveDoCard;

  // o próximo card já vai sendo preparado (a animação dele começa sem espera)
  const proximo = cards[i + 1];
  useEffect(() => {
    if (!animado || !relogio || !proximo) return;
    const prox = proximo.id === "leitura" && capas ? capas : proximo.dados;
    const t = window.setTimeout(() => {
      import("./video-card").then((m) => m.prepararRoteiroDoCard(comEscolhas(prox, { valores, textosDasMetas }), "stories")).catch(() => { /* prepara na hora */ });
    }, 300);
    return () => window.clearTimeout(t);
  }, [animado, relogio, proximo, capas, valores, textosDasMetas]);

  const pausado = segurando || !!folha || oculto || !!enviando || arrasto > 0;
  const andando = !reduzir && !!relogio && relogio.chave === chaveDoCard && !pausado;

  const barraTerminou = () => {
    if (ultimo || !andando) return;
    trackEvent("wrapped_auto_avancou", { mes: MES, de: atual.id, i, versao: VERSAO });
    ir(1, "auto");
  };

  /* ----------------------------------------------------------------------- *
   * O dedo: toque (esquerda volta, direita avança), segurar (pausa),
   * deslizar pro lado (troca), arrastar pra baixo (fecha)
   * ----------------------------------------------------------------------- */
  const gesto = useRef<{ x: number; y: number; segurou: boolean; arrastando: boolean; timer: number } | null>(null);
  const engolirClique = useRef(false);
  const soltar = () => {
    const g = gesto.current;
    if (g) window.clearTimeout(g.timer);
    gesto.current = null;
  };
  const aoApertar = (e: ReactPointerEvent) => {
    engolirClique.current = false;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const g = { x: e.clientX, y: e.clientY, segurou: false, arrastando: false, timer: 0 };
    g.timer = window.setTimeout(() => {
      g.segurou = true;
      setSegurando(true);
      trackEvent("wrapped_pausou", { mes: MES, card: atual.id, i, versao: VERSAO });
    }, TEMPOS.segurar);
    gesto.current = g;
  };
  const aoMover = (e: ReactPointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.arrastando && dy > 12 && dy > Math.abs(dx) * 1.2) { g.arrastando = true; window.clearTimeout(g.timer); }
    if (g.arrastando) setArrasto(Math.max(0, dy));
    else if (Math.hypot(dx, dy) > 12) window.clearTimeout(g.timer);
  };
  const aoSoltar = (e: ReactPointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    soltar();
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.arrastando) {
      engolirClique.current = true;
      if (dy > TEMPOS.arrastoFecha) { fechar("arrastou"); return; }
      setArrasto(0);
    } else if (g.segurou) {
      engolirClique.current = true;
    } else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      engolirClique.current = true;
      ir(dx < 0 ? 1 : -1, "deslizou");
    }
    setSegurando(false);
  };
  const aoCancelar = () => { soltar(); setSegurando(false); setArrasto(0); };
  const tocou = (passo: number) => {
    if (engolirClique.current) { engolirClique.current = false; return; }
    ir(passo, "toque");
  };

  const abrirFolha = (origem: "icone" | "final") => {
    setFormato("stories");
    setFolha(origem);
    trackEvent("wrapped_compartilhar_aberto", { mes: MES, card: atual.id, i, origem, versao: VERSAO });
  };

  const compartilhar = async (acao: "postar" | "salvar") => {
    const midia = acao === "postar" ? "video" : "imagem";
    setEnviando(midia);
    setProgresso(0);
    try {
      const resultado = acao === "postar"
        ? await postarCardVideo(dados, formato, `retro-${MES}`, setProgresso)
        : await postarCardImagem(dados, formato, `retro-${MES}`);
      trackEvent("wrapped_share", { mes: MES, month: capitalizar(MES), card: atual.id, acao, midia, formato, resultado, valores: temReais(dados) ? valores : undefined, versao: VERSAO, origem: folha ?? "icone" });
    } finally {
      setEnviando(null);
    }
  };

  const tinta = claro ? "#1f1f24" : "#ffffff";
  const trilho = claro ? "rgba(31,31,36,.18)" : "rgba(255,255,255,.32)";
  const coluna = enc.coluna < tela.w;
  const ms = relogio?.ms ?? tempoDoCard(atual.id);

  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={`Retrospectiva de ${nomeDoMes(retro.mesIdx)}`}
      data-testid="retro-outubro"
      data-modo="tela-cheia"
      data-card-atual={atual.id}
      data-pausado={pausado ? "sim" : "nao"}
      data-relogio={andando ? "andando" : "parado"}
      className="fixed inset-0 z-[400] overflow-hidden select-none"
      style={{ background: coluna ? FUNDO_ESCURO : fundo?.css ?? FUNDO_ESCURO, WebkitTouchCallout: "none" } as CSSProperties}
    >
      <style>{ESTILOS}</style>
      <div ref={sondaTopo} aria-hidden style={{ position: "absolute", top: 0, left: 0, width: 1, height: "var(--app-safe-top)", visibility: "hidden", pointerEvents: "none" }} />
      <div ref={sondaBase} aria-hidden style={{ position: "absolute", bottom: 0, left: 0, width: 1, height: "var(--app-safe-bottom)", visibility: "hidden", pointerEvents: "none" }} />

      <div
        ref={colunaRef}
        data-testid="retro-coluna"
        className="absolute inset-y-0 overflow-hidden"
        style={{
          left: Math.round((tela.w - enc.coluna) / 2),
          width: enc.coluna,
          background: fundo?.css ?? FUNDO_ESCURO,
          transform: arrasto ? `translateY(${arrasto}px) scale(${Math.max(0.86, 1 - arrasto / 1600)})` : undefined,
          transition: arrasto ? "none" : "transform .2s ease-out",
          borderRadius: arrasto ? 22 : 0,
        }}
      >
        {fundo?.textura && <div aria-hidden className="absolute inset-0 pointer-events-none" style={fundo.textura} />}
        {temAguaNoPe(atual.dados) && <div aria-hidden className="absolute left-0 right-0 bottom-0 pointer-events-none" style={{ top: enc.y + enc.h - 1, background: CORES_AGUA.azul[1] }} />}

        <div
          key={chaveDoCard}
          ref={cardRef}
          data-testid="retro-palco"
          className="absolute"
          style={{ left: enc.x, top: enc.y, width: enc.w, height: enc.h, animation: reduzir ? undefined : "retroTcEntra .22s ease-out" }}
        >
          <CardEscalado elemento={<CardDeCompartilhar dados={dados} formato="stories" camada={soFundo ? "fundo" : "tudo"} />} largura={enc.w} w={FORMATOS.stories.w} h={FORMATOS.stories.h} />
          {animarEste && (
            <div className="absolute inset-0" data-testid="retro-ao-vivo">
              <Suspense fallback={null}>
                <AnimacaoDoCard dados={dados} formato="stories" largura={enc.w} laco={false} pausado={pausado} onPronto={animacaoPronta} />
              </Suspense>
            </div>
          )}
        </div>

        {/* o dedo: a tela inteira (os botões de cima e o do fim ficam por cima desta camada) */}
        <div
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoCancelar}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button type="button" aria-label="Card anterior" onClick={() => tocou(-1)} className="absolute inset-y-0 left-0 w-[30%] cursor-default outline-none" data-testid="retro-anterior" />
          <button type="button" aria-label="Próximo card" onClick={() => tocou(1)} className="absolute inset-y-0 right-0 w-[70%] cursor-default outline-none" data-testid="retro-proximo" />
        </div>

        <header
          className="absolute left-0 right-0 top-0 px-3 transition-opacity duration-200"
          style={{ paddingTop: seguro.topo + 8, opacity: segurando || arrasto ? 0 : 1, color: tinta }}
        >
          <div className="flex gap-1" aria-hidden data-testid="retro-barras">
            {cards.map((c, k) => (
              <div key={c.id} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: trilho }}>
                {k < i && <div className="h-full w-full" style={{ background: tinta }} />}
                {k === i && (
                  <div
                    key={chaveDoCard}
                    className="h-full w-full origin-left"
                    data-testid="retro-barra-atual"
                    onAnimationEnd={barraTerminou}
                    style={reduzir ? { background: tinta } : { background: tinta, transform: "scaleX(0)", animation: `retroTcBarra ${ms}ms linear forwards`, animationPlayState: andando ? "running" : "paused" }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="h-[48px] flex items-center justify-end gap-1">
            <span className="sr-only" aria-live="polite" data-testid="retro-rotulo">{ROTULOS[atual.id]} · {i + 1} de {total}</span>
            <button type="button" onClick={() => abrirFolha("icone")} aria-label="Compartilhar este card" className="w-11 h-11 grid place-items-center rounded-full active:scale-95 transition-transform" style={{ background: claro ? "rgba(31,31,36,.06)" : "rgba(0,0,0,.14)" }} data-testid="retro-compartilhar">
              <Share className="w-[19px] h-[19px]" strokeWidth={2.4} />
            </button>
            <button type="button" onClick={() => fechar("x")} aria-label="Fechar" className="w-11 h-11 grid place-items-center rounded-full active:scale-95 transition-transform" style={{ background: claro ? "rgba(31,31,36,.06)" : "rgba(0,0,0,.14)" }} data-testid="retro-fechar">
              <X className="w-[21px] h-[21px]" strokeWidth={2.4} />
            </button>
          </div>
        </header>

        {ultimo && (
          <div className="absolute left-0 right-0 px-5 transition-opacity duration-200" style={{ bottom: seguro.base + 16, opacity: segurando || arrasto ? 0 : 1 }}>
            <button
              type="button"
              onClick={() => abrirFolha("final")}
              className="w-full h-[52px] rounded-2xl font-extrabold text-[15.5px] inline-flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
              style={claro ? { background: "#25242a", color: "#fffdf8" } : { background: "#ffffff", color: "#111114", boxShadow: "0 10px 30px -10px rgba(0,0,0,.5)" }}
              data-testid="retro-compartilhar-final"
            >
              <Share className="w-[18px] h-[18px]" strokeWidth={2.5} aria-hidden /> Compartilhar meu {nomeDoMes(retro.mesIdx)}
            </button>
          </div>
        )}
      </div>

      {folha && (
        <FolhaDeCompartilhar
          titulo={ROTULOS[atual.id]}
          base={base}
          dados={dados}
          formato={formato}
          setFormato={setFormato}
          valores={valores}
          setValores={(v) => { setValores(v); trackEvent("wrapped_valores", { mes: MES, month: capitalizar(MES), ligado: v, versao: VERSAO }); }}
          textos={textosDasMetas}
          setTextos={setTextosDasMetas}
          video={video}
          enviando={enviando}
          progresso={progresso}
          onPostar={() => compartilhar("postar")}
          onSalvar={() => compartilhar("salvar")}
          onFechar={() => { if (!enviando) setFolha(null); }}
          reduzir={reduzir}
          alturaTela={tela.h}
          largura={Math.min(enc.coluna, 520)}
          baseSegura={seguro.base}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * A folha de compartilhar (de baixo)
 * ------------------------------------------------------------------------- */

interface PropsFolha {
  titulo: string;
  base: DadosCard;
  dados: DadosCard;
  formato: "stories" | "feed";
  setFormato: (f: "stories" | "feed") => void;
  valores: boolean;
  setValores: (v: boolean) => void;
  textos: boolean;
  setTextos: (v: boolean) => void;
  video: boolean | null;
  enviando: "video" | "imagem" | null;
  progresso: number;
  onPostar: () => void;
  onSalvar: () => void;
  onFechar: () => void;
  reduzir: boolean;
  alturaTela: number;
  largura: number;
  baseSegura: number;
}

const FolhaDeCompartilhar = ({ titulo, base, dados, formato, setFormato, valores, setValores, textos, setTextos, enviando, progresso, onPostar, onSalvar, onFechar, reduzir, alturaTela, largura, baseSegura }: PropsFolha) => {
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => { painel.current?.focus(); }, []);
  const { w: W, h: H } = FORMATOS[formato];
  // a prévia encolhe em tela baixa (iPhone SE) pra folha nunca passar da tela
  const alturaPrevia = Math.round(Math.max(110, Math.min(200, alturaTela * 0.24 - (temReais(base) || temTextos(base) ? 24 : 0))));
  const larguraPrevia = Math.round((alturaPrevia * W) / H);
  return (
    <div className="absolute inset-0 z-10" data-testid="retro-folha">
      <button type="button" aria-label="Fechar o compartilhar" onClick={onFechar} className="absolute inset-0 w-full h-full cursor-default" style={{ background: "rgba(0,0,0,.55)", animation: reduzir ? undefined : "retroTcEntra .2s ease-out" }} data-testid="retro-folha-fundo" />
      <div
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Compartilhar · ${titulo}`}
        className="absolute bottom-0 left-0 right-0 mx-auto rounded-t-[22px] text-white outline-none"
        style={{ width: largura, background: "#18181c", boxShadow: "0 -20px 50px -20px rgba(0,0,0,.6)", animation: reduzir ? undefined : "retroTcFolha .26s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="px-4 pt-2">
          <div className="mx-auto w-10 h-[5px] rounded-full" style={{ background: "rgba(255,255,255,.22)" }} aria-hidden />
          <div className="h-11 flex items-center">
            <span className="text-[15px] font-extrabold">Compartilhar</span>
            <span className="ml-1.5 text-[13px] font-semibold text-white/55 truncate">· {titulo}</span>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="ml-auto w-9 h-9 -mr-1 grid place-items-center rounded-full hover:bg-white/10" data-testid="retro-folha-fechar"><X className="w-[18px] h-[18px]" /></button>
          </div>

          <div className="flex items-center gap-4 pt-1 pb-3">
            <div className="shrink-0 rounded-[10px] overflow-hidden" style={{ width: larguraPrevia, height: alturaPrevia, boxShadow: "0 10px 26px -12px rgba(0,0,0,.8)", outline: "1px solid rgba(255,255,255,.08)" }} data-testid="retro-folha-previa" data-formato={formato}>
              <CardEscalado elemento={<CardDeCompartilhar dados={dados} formato={formato} />} largura={larguraPrevia} w={W} h={H} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-white/55 mb-1.5">Formato</p>
              <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 rounded-xl p-1" style={{ background: "rgba(255,255,255,.08)" }}>
                {(["stories", "feed"] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={f === formato} onClick={() => setFormato(f)} className={`h-9 rounded-lg text-[13px] font-extrabold ${f === formato ? "bg-white text-black" : "text-white/70"}`} data-formato-opcao={f}>
                    {f === "stories" ? "Stories" : "Feed"}
                  </button>
                ))}
              </div>
              <p className="text-[11.5px] leading-snug text-white/50 mt-2">{formato === "stories" ? "Vertical, pros Stories e o Status do WhatsApp." : "Em pé (4:5), pro feed do Instagram."}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2" style={{ paddingBottom: baseSegura + 14 }}>
            {temReais(base) && (
              <label className="flex items-center justify-between gap-3 rounded-xl px-3.5 h-11 cursor-pointer" style={{ background: "rgba(255,255,255,.07)" }}>
                <span className="text-[13px] font-bold">Mostrar valores em R$</span>
                <Switch className={SWITCH_NA_FOLHA} checked={valores} onCheckedChange={setValores} aria-label="Mostrar valores em R$ no card" data-testid="retro-valores" />
              </label>
            )}
            {temTextos(base) && (
              <label className="flex items-center justify-between gap-3 rounded-xl px-3.5 h-11 cursor-pointer" style={{ background: "rgba(255,255,255,.07)" }}>
                <span className="text-[13px] font-bold">Mostrar o texto das metas</span>
                <Switch className={SWITCH_NA_FOLHA} checked={textos} onCheckedChange={setTextos} aria-label="Mostrar o texto das metas no card" data-testid="retro-textos-metas" />
              </label>
            )}
            <button type="button" onClick={onPostar} disabled={!!enviando} className="h-12 rounded-xl bg-white text-black font-extrabold text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-70" data-testid="retro-postar">
              {enviando === "video" ? <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Preparando o vídeo… {Math.round(progresso * 100)}%</> : <><Clapperboard className="w-[18px] h-[18px]" aria-hidden /> {formato === "stories" ? "Postar nos Stories" : "Postar no feed"}</>}
            </button>
            <button type="button" onClick={onSalvar} disabled={!!enviando} className="h-11 rounded-xl text-[13.5px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "rgba(255,255,255,.1)" }} data-testid="retro-salvar">
              {enviando === "imagem" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" aria-hidden />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetroTelaCheia;
