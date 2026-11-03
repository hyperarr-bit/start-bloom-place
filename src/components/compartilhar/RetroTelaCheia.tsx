import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Clapperboard, Download, Loader2, Share, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { suporteVideo } from "@/components/conquistas/video/suporte";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";
import { aplicarBarraDeStatus } from "@/lib/status-bar";
import { AlturaExtraCtx, CardDeCompartilhar, CORES_AGUA, TEMA_DO_MODULO } from "./cards";
import { postarCardImagem, postarCardVideo, prepararCapas } from "./postar";
import { comEscolhas, type CardDaRetro, type RetroOutubro as DadosDaRetro } from "./retro-outubro-dados";
import { adivinhaDaRetro, type Adivinha } from "./retro-tela-cheia-dados";
import { encaixeDoCard, fundoClaro, fundoEsticado, lerFundoDoCard, SUSPENSE, tempoDoCard, texturaEsticada, TEMPOS, type ReservaBase } from "./retro-tela-cheia";
import { fundoDo } from "./temas";
import { capitalizar, nomeDoMes } from "./textos";
import { FORMATOS, type DadosCard, type ModuloDaRetro } from "./tipos";

const AnimacaoDoCard = lazy(() => import("./AnimacaoDoCard"));

/**
 * A RETROSPECTIVA DE OUTUBRO EM TELA CHEIA (02/11, protótipo — chave em
 * retro-tela-cheia.ts). O principal é VER o mês: cada card de ponta a ponta
 * (o conteúdo logo abaixo das barrinhas, o card esticado até o pé da tela —
 * retro-tela-cheia.ts › encaixeDoCard), barrinhas no topo, passa sozinho;
 * toque à direita avança, à esquerda volta, SEGURAR pausa, arrastar pra baixo
 * (ou o X) fecha. Com "reduzir movimento" do sistema: sem animação e sem
 * passar sozinho.
 *
 * (02/11, rodada 2 — pedido do dono depois da pesquisa do Spotify Wrapped):
 *  · SUSPENSE: em cada card a frase aparece primeiro e o número entra contando ~0,7 s depois;
 *  · ADIVINHA: antes de UM card com número bom, "Quantos dias você acha que treinou?" com 3 opções
 *    (retro-tela-cheia-dados.ts › adivinhaDaRetro); sem toque, revela sozinho em 8 s;
 *  · PERFIL: o card "Seu outubro foi…" antes do resumo (e os extras de quem usou pouco) —
 *    vêm prontos em `retro.cards` (RetroOutubro › montarRetroTelaCheia);
 *  · a pílula "Compartilhar" embaixo dos cards bons de postar (Finanças, Treino, Leitura, Perfil);
 *  · o PRÓXIMO PASSO no fim: "Novembro começa agora → registrar algo hoje" leva pro módulo mais usado.
 *
 * Compartilhar: o ícone do canto, a pílula e o botão grande do último card
 * abrem a mesma folha de baixo (Stories | Feed, "Postar nos Stories",
 * "Salvar" e — no card de Finanças com valor — "Mostrar valores em R$").
 * A folha aberta pausa.
 *
 * Eventos (todos com mes: "outubro", versao: "tela-cheia", sem e-mail/uid):
 * wrapped_cards · wrapped_tela (+ como chegou: inicio/auto/toque/deslizou/
 * tecla/voltou) · wrapped_auto_avancou · wrapped_pausou ·
 * wrapped_compartilhar_aberto (origem icone/pilula/final) · wrapped_share ·
 * wrapped_valores · wrapped_adivinha (modulo, respondeu, acertou, como) ·
 * wrapped_perfil (o perfil visto: nome, modulo) · wrapped_proximo_passo
 * (destino) · wrapped_fechou (+ como: x/arrastou/esc/proximo/saiu).
 */

const MES = "outubro";
const VERSAO = "tela-cheia";
const ROTULOS: Record<CardDaRetro["id"] | "adivinha", string> = {
  abertura: "Abertura", financas: "Finanças", treino: "Treino", rotina: "Rotina", agua: "Água", leitura: "Leitura", metas: "Metas",
  resumo: "Meu outubro", fechamento: "Até novembro", perfil: "Seu perfil", primeiro: "O começo", dias: "Seus dias", figurinhas: "Figurinhas", adivinha: "Adivinha",
};
const FUNDO_ESCURO = "#0e0e11";
/** Os cards bons de postar ganham a pílula "Compartilhar" embaixo (os outros, só o ícone do canto). */
export const COM_PILULA: ReadonlySet<CardDaRetro["id"]> = new Set(["financas", "treino", "leitura", "perfil"]);
/** Pra onde o "registrar algo hoje" leva (o módulo mais usado; sem rota própria, a Home). */
export const ROTA_DO_MODULO: Record<ModuloDaRetro, string> = { financas: "/financas", treino: "/treino", rotina: "/rotina", agua: "/saude", leitura: "/biblioteca", metas: "/home" };

type Como = "inicio" | "auto" | "toque" | "deslizou" | "tecla" | "voltou";
type Tela = { tipo: "card"; id: CardDaRetro["id"]; card: CardDaRetro } | { tipo: "adivinha"; id: "adivinha"; a: Adivinha };

/** A sequência da tela: os cards, com o adivinha (se houver) logo antes do card da resposta. */
export function telasDaRetro(cards: CardDaRetro[]): Tela[] {
  const a = adivinhaDaRetro(cards);
  const telas: Tela[] = [];
  for (const c of cards) {
    if (a && c.id === a.antesDe) telas.push({ tipo: "adivinha", id: "adivinha", a });
    telas.push({ tipo: "card", id: c.id, card: c });
  }
  return telas;
}

/** O destino do próximo passo: o módulo do perfil; sem perfil, o 1º módulo da sequência; sem nenhum, a Home. */
export function destinoDoProximoPasso(cards: CardDaRetro[]): string {
  const perfil = cards.find((c) => c.dados.tipo === "retro-perfil")?.dados;
  if (perfil?.tipo === "retro-perfil") return ROTA_DO_MODULO[perfil.modulo];
  const mod = cards.find((c) => c.id in ROTA_DO_MODULO);
  return mod ? ROTA_DO_MODULO[mod.id as ModuloDaRetro] : "/home";
}

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

/**
 * (03/11, dono: "vê se aparece animações em todas transição") AS TRANSIÇÕES. Cada tela (card ou adivinha) é uma
 * CAMADA com o fundo dela; ao trocar, a de antes fica parada embaixo (o conteúdo dela some com um deslize curto) e a
 * nova entra por cima com fade + deslize curto na direção do avanço (de volta: do outro lado). Nunca corte seco nem o
 * fundo piscando: sempre tem uma camada opaca embaixo. Só opacity/transform (nada de blur/filtro animado).
 * Com "reduzir movimento": só fades curtos, sem deslize.
 */
const CURVA = "cubic-bezier(.22,1,.36,1)";
const CURVA_SAI = "cubic-bezier(.4,0,.7,1)";
export const TROCA = { entra: 420, sai: 280, frenteSai: 200, reduzido: 200, limpa: 480 } as const;
export const FECHA_MS = 260;
export const FOLHA_SAI_MS = 230;
const DESLIZE = 28;
const ESTILOS = `
@keyframes retroTcBarra { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes retroTcEntra { from { opacity: 0 } to { opacity: 1 } }
@keyframes retroTcSome { from { opacity: 1 } to { opacity: 0 } }
@keyframes retroTcAbre { from { opacity: 0; transform: scale(.985) } to { opacity: 1; transform: none } }
@keyframes retroTcEntraDir { from { opacity: 0; transform: translate3d(${DESLIZE}px,0,0) } to { opacity: 1; transform: none } }
@keyframes retroTcEntraEsq { from { opacity: 0; transform: translate3d(-${DESLIZE}px,0,0) } to { opacity: 1; transform: none } }
@keyframes retroTcSaiEsq { from { opacity: 1; transform: none } to { opacity: 0; transform: translate3d(-20px,0,0) } }
@keyframes retroTcSaiDir { from { opacity: 1; transform: none } to { opacity: 0; transform: translate3d(20px,0,0) } }
@keyframes retroTcFolha { from { transform: translate3d(0,100%,0) } to { transform: none } }
@keyframes retroTcFolhaSai { from { transform: none } to { transform: translate3d(0,100%,0) } }
@keyframes retroTcSobe { from { opacity: 0; transform: translate3d(0,12px,0) scale(.98) } to { opacity: 1; transform: none } }
`;

type Fundo = { css: string; textura: CSSProperties | null; claro: boolean };
type Palpite = { escolha: number | null; revelado: boolean };
interface EncTela { coluna: number; w: number; h: number; x: number; y: number; escala: number; extra: number }
/** Tudo o que uma tela precisa pra ser desenhada — a de agora e a que está saindo (congelada no instante da troca). */
interface Snap {
  chave: string;
  tela: Tela;
  dados: DadosCard | null;
  enc: EncTela;
  fundo: Fundo | null;
  animar: boolean;
  soFundo: boolean;
  suspense: number;
  palpite: Palpite;
  pilula: boolean;
  ultimo: boolean;
  claro: boolean;
  claroNoPe: boolean;
}

interface Props {
  retro: DadosDaRetro;
  onClose: () => void;
  /** O "Novembro começa agora → registrar algo hoje": quem abriu a retrospectiva leva pra rota (sem isto, só fecha). */
  onProximoPasso?: (rota: string) => void;
}

export const RetroTelaCheia = ({ retro, onClose, onProximoPasso }: Props) => {
  const reduzir = !!useReducedMotion();
  const telas = useMemo(() => telasDaRetro(retro.cards), [retro.cards]);
  const total = telas.length;
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
  const [folha, setFolha] = useState<null | "icone" | "pilula" | "final">(null);
  const [segurando, setSegurando] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [arrasto, setArrasto] = useState(0);
  /** O relógio da tela atual: começa quando a animação dele começa (ou sem animação, na hora). */
  const [relogio, setRelogio] = useState<{ chave: string; ms: number; origem: "animacao" | "espera" | "direto" } | null>(null);
  /** A tela de agora já foi vista nesta abertura (voltou nela)? Então aparece pronta, sem refazer a animação. */
  const [revisita, setRevisita] = useState(false);
  /** A animação deste card já tomou a tela (até lá, embaixo dela fica só o fundo do card — sem o card cheio piscar antes). */
  const [cobriu, setCobriu] = useState<string | null>(null);
  const [tela, setTela] = useState({ w: 390, h: 844 });
  const [seguro, setSeguro] = useState({ topo: 0, base: 0 });
  const [fundo, setFundo] = useState<Fundo | null>(null);
  /** O adivinha: o que a pessoa tocou (null = ainda não) e se já revelou. */
  const [palpite, setPalpite] = useState<Palpite>({ escolha: null, revelado: false });
  /** (03/11) A troca em andamento: a tela de antes (congelada) e pra que lado foi (1 avança, -1 volta, 0 recomeça). */
  const [troca, setTroca] = useState<{ de: Snap; dir: 1 | -1 | 0 } | null>(null);
  /** Fechando (a retrospectiva some suave antes de sair) e a folha descendo. */
  const [fechando, setFechando] = useState(false);
  const [folhaSaindo, setFolhaSaindo] = useState(false);

  const raiz = useRef<HTMLDivElement>(null);
  const sondaTopo = useRef<HTMLDivElement>(null);
  const sondaBase = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const colunaRef = useRef<HTMLDivElement>(null);
  const vistos = useRef(new Set<number>());
  const comoChegou = useRef<Como>("inicio");
  const comoFechou = useRef<string | null>(null);
  const snapRef = useRef<Snap | null>(null);
  const timerTroca = useRef(0);
  const timerFecha = useRef(0);
  const timerFolha = useRef(0);
  useEffect(() => () => { window.clearTimeout(timerTroca.current); window.clearTimeout(timerFecha.current); window.clearTimeout(timerFolha.current); }, []);
  /** Começa a troca: a tela de agora vira a "de antes" (fica embaixo) até a nova terminar de entrar. */
  const comecarTroca = useCallback((dir: 1 | -1 | 0) => {
    const de = snapRef.current;
    if (de) setTroca({ de, dir });
    window.clearTimeout(timerTroca.current);
    timerTroca.current = window.setTimeout(() => setTroca(null), TROCA.limpa);
  }, []);

  const atual = telas[Math.min(i, total - 1)];
  const card = atual.tipo === "card" ? atual.card : null;
  const ultimo = i === total - 1;
  const chaveDoCard = `${i}-${rodada}`;
  const reservaDe = useCallback((k: number): ReservaBase => {
    const t = telas[k];
    if (!t || t.tipo !== "card") return "nada";
    if (k === total - 1) return "final";
    return COM_PILULA.has(t.id) ? "pilula" : "nada";
  }, [telas, total]);

  // as capas dos livros viram dataURL uma vez (o que a tela mostra = o que o vídeo e a imagem levam)
  const livros = retro.cards.find((c) => c.id === "leitura")?.dados;
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
    trackEvent("wrapped_cards", { mes: MES, month: capitalizar(MES), cards: retro.cards.map((c) => c.id).join(","), n: retro.cards.length, pouco_dado: retro.poucoDado, financas: retro.financas ?? "sem", versao: VERSAO, adivinha: telas.some((t) => t.tipo === "adivinha") });
  }, [retro, telas]);

  // cada tela vista (1ª vez), com como chegou nela; o perfil visto ganha o evento dele
  useEffect(() => {
    if (vistos.current.has(i)) return;
    vistos.current.add(i);
    trackEvent("wrapped_tela", { mes: MES, month: capitalizar(MES), i, id: atual.id, total, versao: VERSAO, como: comoChegou.current });
    if (card?.dados.tipo === "retro-perfil") trackEvent("wrapped_perfil", { mes: MES, perfil: card.dados.nome, modulo: card.dados.modulo, versao: VERSAO });
  }, [i, atual.id, total, card]);

  // até onde foi (no fechar e no sair do app)
  useEffect(() => () => {
    trackEventBeacon("wrapped_fechou", { mes: MES, month: capitalizar(MES), vistos: vistos.current.size, total, chegou_ao_fim: vistos.current.has(total - 1), versao: VERSAO, como: comoFechou.current ?? "saiu" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** (03/11) Fechar: a tela some suave (~0,26 s) e só então sai. */
  const fecharDepois = useCallback((como: string, depois: () => void) => {
    if (fechando) return;
    comoFechou.current = como;
    setFechando(true);
    window.clearTimeout(timerFecha.current);
    timerFecha.current = window.setTimeout(depois, reduzir ? TROCA.reduzido : FECHA_MS);
  }, [fechando, reduzir]);
  const fechar = useCallback((como: string) => fecharDepois(como, onClose), [fecharDepois, onClose]);

  const revelar = useCallback((escolha: number | null, como: "escolheu" | "sozinho" | "pulou") => {
    if (atual.tipo !== "adivinha") return;
    setPalpite((p) => {
      if (p.revelado) return p;
      trackEvent("wrapped_adivinha", { mes: MES, modulo: atual.a.modulo, respondeu: escolha != null, acertou: escolha === atual.a.certo, como, versao: VERSAO });
      return { escolha, revelado: true };
    });
  }, [atual]);

  const ir = useCallback((passo: number, como: Como) => {
    if (fechando) return;
    if (passo < 0 && i === 0) { comecarTroca(0); setRodada((r) => r + 1); setRevisita(true); return; }
    const alvo = Math.max(0, Math.min(total - 1, i + passo));
    if (alvo === i) return;
    comecarTroca(passo > 0 ? 1 : -1);
    // saiu do adivinha sem responder: conta como "pulou" (a resposta é o card de agora)
    if (atual.tipo === "adivinha" && !palpite.revelado && passo > 0) revelar(null, "pulou");
    comoChegou.current = passo < 0 ? "voltou" : como;
    setRevisita(vistos.current.has(alvo));
    setI(alvo);
  }, [i, total, atual, palpite.revelado, revelar, fechando, comecarTroca]);

  // aba/app em segundo plano: pausa
  useEffect(() => {
    const ver = () => setOculto(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", ver);
    return () => document.removeEventListener("visibilitychange", ver);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const aberta = !!folha && !folhaSaindo;
      if (e.key === "Escape") { if (aberta) fecharFolha(); else if (!folha) fechar("esc"); }
      else if (aberta) return;
      else if (e.key === "ArrowRight") ir(1, "tecla");
      else if (e.key === "ArrowLeft") ir(-1, "tecla");
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, fechar, folha, folhaSaindo]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const base = card ? (card.id === "leitura" && capas ? capas : card.dados) : null;
  const dados = useMemo(() => (base ? comEscolhas(base, { valores, textosDasMetas }) : null), [base, valores, textosDasMetas]);
  const animado = !!video && !reduzir;
  // (relogio.origem "espera": a animação não veio a tempo — o card fica parado, sem pular pro começo dela depois)
  const animarEste = !!card && animado && !revisita && !(relogio?.chave === chaveDoCard && relogio.origem === "espera");

  const encDe = useCallback((k: number): EncTela => {
    const e = encaixeDoCard({ largura: tela.w, altura: tela.h, topoSeguro: seguro.topo, baseSeguro: seguro.base, reserva: reservaDe(k) });
    const w = Math.round(e.w);
    const escala = w / FORMATOS.stories.w;
    return { coluna: Math.round(e.coluna), w, h: Math.round((FORMATOS.stories.h + e.extra) * escala), x: Math.round((e.coluna - w) / 2), y: Math.round(e.y), escala, extra: e.extra };
  }, [tela, seguro, reservaDe]);
  const enc = useMemo(() => encDe(i), [encDe, i]);

  // o fundo esticado até as bordas (lido do próprio card desenhado: nenhuma cor duplicada aqui); o adivinha usa o tema do módulo
  useLayoutEffect(() => {
    if (atual.tipo === "adivinha") {
      setFundo({ css: fundoDo(TEMA_DO_MODULO[atual.a.modulo]), textura: null, claro: false });
      return;
    }
    const el = cardRef.current?.querySelector<HTMLElement>("[data-cartao-share]");
    if (!el) return;
    const lido = lerFundoDoCard(el.style.backgroundImage, el.style.backgroundColor);
    const caixa = { w: enc.coluna, h: tela.h };
    const c = { x: enc.x, y: enc.y, w: enc.w, h: enc.h };
    const tex = el.firstElementChild instanceof HTMLElement ? texturaEsticada(el.firstElementChild.style.backgroundImage, el.firstElementChild.style.backgroundSize, enc.escala, c) : null;
    setFundo({ css: lido ? fundoEsticado(lido, c, caixa) : FUNDO_ESCURO, textura: tex, claro: fundoClaro(lido) });
  }, [chaveDoCard, dados, enc, tela.h, atual]);

  // o adivinha: sem toque, revela sozinho; revelado, o relógio anda (a resposta fica um instante e passa)
  useEffect(() => {
    if (atual.tipo !== "adivinha" || palpite.revelado || oculto) return;
    const t = window.setTimeout(() => revelar(null, "sozinho"), TEMPOS.adivinha);
    return () => window.clearTimeout(t);
  }, [atual, palpite.revelado, oculto, revelar]);

  // o relógio do card: sem animação começa na hora; com animação, quando ela começa (ou desiste após a espera máxima)
  useEffect(() => {
    setRelogio(null);
    if (reduzir) return;
    if (atual.tipo === "adivinha") {
      if (palpite.revelado) setRelogio({ chave: chaveDoCard, ms: TEMPOS.resposta, origem: "direto" });
      return;
    }
    if (video === false || revisita) { setRelogio({ chave: chaveDoCard, ms: tempoDoCard(atual.id), origem: "direto" }); return; }
    // a abertura espera mais (não tem nada antes dela); nos outros, se a animação não vier logo, o card aparece parado
    const espera = i === 0 && rodada === 0 ? TEMPOS.esperaMaxima : TEMPOS.esperaCard;
    const t = window.setTimeout(() => setRelogio((r) => r ?? { chave: chaveDoCard, ms: tempoDoCard(atual.id), origem: "espera" }), espera);
    return () => window.clearTimeout(t);
  }, [chaveDoCard, atual.id, video, reduzir, revisita, palpite.revelado]); // eslint-disable-line react-hooks/exhaustive-deps
  const animacaoPronta = useCallback((duracao: number) => {
    setRelogio((r) => (r && r.chave === chaveDoCard ? r : { chave: chaveDoCard, ms: tempoDoCard(atual.id, duracao), origem: "animacao" }));
    // depois do fade do canvas, o card cheio volta por baixo (é ele que aparece se a animação for refeita — ex.: o R$ ligado)
    window.setTimeout(() => setCobriu(chaveDoCard), 400);
  }, [chaveDoCard, atual.id]);
  const soFundo = animarEste && cobriu !== chaveDoCard;
  const suspense = card && card.id !== "abertura" ? SUSPENSE : 0;

  // o próximo card já vai sendo preparado (a animação dele começa sem espera) — com o tamanho e o suspense dele
  const kProx = telas[i + 1]?.tipo === "adivinha" ? i + 2 : i + 1;
  const proximo = telas[kProx];
  const extraProx = proximo ? encDe(kProx).extra : 0;
  useEffect(() => {
    if (!animado || !relogio || !proximo || proximo.tipo !== "card") return;
    const prox = proximo.card.id === "leitura" && capas ? capas : proximo.card.dados;
    const t = window.setTimeout(() => {
      import("./video-card").then((m) => m.prepararRoteiroDoCard(comEscolhas(prox, { valores, textosDasMetas }), "stories", undefined, undefined, { extra: extraProx, suspense: SUSPENSE, calmo: true })).catch(() => { /* prepara na hora */ });
    }, 700); // (03/11) depois da troca: fotografar o próximo no meio dela engasgava o deslize
    return () => window.clearTimeout(t);
  }, [animado, relogio, proximo, capas, valores, textosDasMetas, extraProx]);

  const folhaAberta = !!folha && !folhaSaindo;
  const pausado = segurando || folhaAberta || oculto || !!enviando || arrasto > 0 || fechando;
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

  const abrirFolha = (origem: "icone" | "pilula" | "final") => {
    if (!card || fechando) return;
    window.clearTimeout(timerFolha.current);
    setFolhaSaindo(false);
    setFormato("stories");
    setFolha(origem);
    trackEvent("wrapped_compartilhar_aberto", { mes: MES, card: atual.id, i, origem, versao: VERSAO });
  };

  /** A folha desce suave (~0,23 s) e só então sai; a retrospectiva volta a andar na hora. */
  const fecharFolha = () => {
    if (!folha || enviando) return;
    setFolhaSaindo(true);
    window.clearTimeout(timerFolha.current);
    timerFolha.current = window.setTimeout(() => { setFolha(null); setFolhaSaindo(false); }, reduzir ? TROCA.reduzido : FOLHA_SAI_MS);
  };

  const compartilhar = async (acao: "postar" | "salvar") => {
    if (!dados) return;
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

  const destino = useMemo(() => destinoDoProximoPasso(retro.cards), [retro.cards]);
  const proximoPasso = () => {
    if (fechando) return;
    trackEvent("wrapped_proximo_passo", { mes: MES, destino, card: atual.id, versao: VERSAO });
    fecharDepois("proximo", () => { if (onProximoPasso) onProximoPasso(destino); else onClose(); });
  };

  const tinta = claro ? "#1f1f24" : "#ffffff";
  const trilho = claro ? "rgba(31,31,36,.18)" : "rgba(255,255,255,.32)";
  const coluna = enc.coluna < tela.w;
  // (02/11) só o relógio DESTA tela (o da anterior ainda está no estado no 1º render) — e a barra usa as
  // propriedades separadas: trocar o atalho `animation` fazia o navegador voltar o play-state pra "running"
  // e a barra andava (e acabava) com a tela parada; no adivinha isso travava a passagem pro card
  const ms = relogio && relogio.chave === chaveDoCard ? relogio.ms : atual.tipo === "adivinha" ? TEMPOS.resposta : tempoDoCard(atual.id);
  const escondeControles = segurando || !!arrasto;
  const pilula = !!card && !ultimo && COM_PILULA.has(card.id);
  // a pílula fica no PÉ do card: no azul o pé é a água (azul escuro), mesmo com o topo creme
  const claroNoPe = claro && !(dados && temAguaNoPe(dados));

  // (03/11) a tela de agora, do jeito que ela está (é ela que fica congelada embaixo quando a próxima entra)
  const snap: Snap = { chave: chaveDoCard, tela: atual, dados, enc, fundo, animar: animarEste, soFundo, suspense, palpite, pilula, ultimo, claro, claroNoPe };
  useLayoutEffect(() => { snapRef.current = snap; });
  const dir = troca?.dir ?? 1;
  const entraTela = reduzir
    ? `retroTcEntra ${TROCA.reduzido}ms ease-out both`
    : `${dir < 0 ? "retroTcEntraEsq" : dir > 0 ? "retroTcEntraDir" : "retroTcEntra"} ${TROCA.entra}ms ${CURVA} both`;
  const saiConteudo = reduzir ? undefined : `${dir < 0 ? "retroTcSaiDir" : "retroTcSaiEsq"} ${TROCA.sai}ms ${CURVA_SAI} both`;
  const saiFrente = `retroTcSome ${reduzir ? 120 : TROCA.frenteSai}ms ease-out both`;
  const entraFinal = (atraso: number): CSSProperties => (reduzir ? {} : { animation: `retroTcSobe .5s ${CURVA} ${atraso}s backwards` });

  /** O fundo + o card (embaixo do dedo). `saindo`: a tela de antes, parada, com o conteúdo sumindo. */
  const camadaDeTras = (t: Snap, saindo: boolean) => {
    const vivo = !saindo;
    return (
      <div
        key={t.chave}
        aria-hidden={saindo || undefined}
        data-camada={saindo ? "saindo" : "atual"}
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ background: t.fundo?.css ?? FUNDO_ESCURO, animation: vivo && troca ? entraTela : undefined, willChange: troca ? "opacity, transform" : undefined }}
      >
        {t.fundo?.textura && <div aria-hidden className="absolute inset-0" style={t.fundo.textura} />}
        {t.dados && temAguaNoPe(t.dados) && <div aria-hidden className="absolute left-0 right-0 bottom-0" style={{ top: t.enc.y + t.enc.h - 1, background: CORES_AGUA.azul[1] }} />}
        <div className="absolute inset-0" style={{ animation: saindo ? saiConteudo : undefined }}>
          {t.tela.tipo === "card" && t.dados && (
            <div
              ref={vivo ? cardRef : undefined}
              data-testid={vivo ? "retro-palco" : undefined}
              data-extra={t.enc.extra}
              className="absolute"
              style={{ left: t.enc.x, top: t.enc.y, width: t.enc.w, height: t.enc.h }}
            >
              <AlturaExtraCtx.Provider value={t.enc.extra}>
                {/* o card cheio aparece com fade (ex.: a animação não veio a tempo e o card entra parado) */}
                <div key={t.soFundo ? "fundo" : "tudo"} style={{ animation: !t.soFundo && !reduzir ? "retroTcEntra .3s ease-out both" : undefined }}>
                  <CardEscalado elemento={<CardDeCompartilhar dados={t.dados} formato="stories" camada={t.soFundo ? "fundo" : "tudo"} />} largura={t.enc.w} w={FORMATOS.stories.w} h={FORMATOS.stories.h + t.enc.extra} />
                </div>
              </AlturaExtraCtx.Provider>
              {t.animar && (
                <div className="absolute inset-0" data-testid={vivo ? "retro-ao-vivo" : undefined}>
                  <Suspense fallback={null}>
                    <AnimacaoDoCard dados={t.dados} formato="stories" largura={t.enc.w} laco={false} pausado={saindo || pausado} onPronto={vivo ? animacaoPronta : undefined} alturaExtra={t.enc.extra} suspense={t.suspense} calmo />
                  </Suspense>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  /** O que fica por cima do dedo: o adivinha, a pílula e os botões do último card. */
  const camadaDaFrente = (t: Snap, saindo: boolean) => {
    const vivo = !saindo;
    const cardDaTela = t.tela.tipo === "card" ? t.tela.card : null;
    return (
      <div
        key={t.chave}
        aria-hidden={saindo || undefined}
        className="absolute inset-0 pointer-events-none"
        style={{ animation: saindo ? saiFrente : troca ? entraTela : undefined }}
      >
        {t.tela.tipo === "adivinha" && (
          <TelaDoAdivinha
            a={t.tela.a}
            palpite={t.palpite}
            onEscolher={(v) => revelar(v, "escolheu")}
            topo={seguro.topo + 64 + 6}
            base={seguro.base}
            reduzir={reduzir}
            escondido={escondeControles}
            fantasma={saindo}
          />
        )}

        {t.pilula && (
          <div className="absolute left-0 right-0 flex justify-center transition-opacity duration-200" style={{ bottom: seguro.base + 14, opacity: escondeControles ? 0 : 1 }}>
            <button
              type="button"
              tabIndex={vivo ? undefined : -1}
              onClick={vivo ? () => abrirFolha("pilula") : undefined}
              className={`h-11 px-5 rounded-full font-extrabold text-[14.5px] inline-flex items-center gap-2 active:scale-[.97] transition-transform ${vivo ? "pointer-events-auto" : ""}`}
              style={t.claroNoPe ? { background: "rgba(31,31,36,.09)", color: "#1f1f24" } : { background: "rgba(255,255,255,.2)", color: "#ffffff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.28)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              data-testid={vivo ? "retro-compartilhar-pilula" : undefined}
            >
              <Share className="w-[16px] h-[16px]" strokeWidth={2.6} aria-hidden /> Compartilhar
            </button>
          </div>
        )}

        {t.ultimo && cardDaTela && (
          <div className="absolute left-0 right-0 px-5 transition-opacity duration-200" style={{ bottom: seguro.base + 10, opacity: escondeControles ? 0 : 1 }}>
            <button
              type="button"
              tabIndex={vivo ? undefined : -1}
              onClick={vivo ? () => abrirFolha("final") : undefined}
              className={`w-full h-[52px] rounded-2xl font-extrabold text-[15.5px] inline-flex items-center justify-center gap-2 active:scale-[.98] transition-transform ${vivo ? "pointer-events-auto" : ""}`}
              style={{ ...(t.claro ? { background: "#25242a", color: "#fffdf8" } : { background: "#ffffff", color: "#111114", boxShadow: "0 10px 30px -10px rgba(0,0,0,.5)" }), ...entraFinal(0.35) }}
              data-testid={vivo ? "retro-compartilhar-final" : undefined}
            >
              <Share className="w-[18px] h-[18px]" strokeWidth={2.5} aria-hidden /> Compartilhar meu {nomeDoMes(retro.mesIdx)}
            </button>
            <button
              type="button"
              tabIndex={vivo ? undefined : -1}
              onClick={vivo ? proximoPasso : undefined}
              className={`w-full h-11 mt-1.5 rounded-xl text-[14px] font-bold inline-flex items-center justify-center gap-1.5 active:opacity-70 ${vivo ? "pointer-events-auto" : ""}`}
              style={{ color: t.claro ? "#25242a" : "rgba(255,255,255,.92)", ...entraFinal(0.45) }}
              data-testid={vivo ? "retro-proximo-passo" : undefined}
            >
              {capitalizar(nomeDoMes((retro.mesIdx + 1) % 12))} começa agora <ArrowRight className="w-4 h-4" strokeWidth={2.6} aria-hidden /> registrar algo hoje
            </button>
          </div>
        )}
      </div>
    );
  };

  const corTransicao = "color .35s ease-out, background-color .35s ease-out";

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
      data-fechando={fechando ? "sim" : undefined}
      className="fixed inset-0 z-[400] overflow-hidden select-none"
      style={{
        background: coluna ? FUNDO_ESCURO : fundo?.css ?? FUNDO_ESCURO,
        WebkitTouchCallout: "none",
        // abrir: fade + 0,985→1; fechar: some suave (sem corte)
        // ("backwards": depois de aberta a animação solta a opacidade, e o fechar consegue levar pra 0)
        animation: reduzir ? `retroTcEntra ${TROCA.reduzido}ms ease-out backwards` : `retroTcAbre .42s ${CURVA} backwards`,
        opacity: fechando ? 0 : undefined,
        transition: fechando ? `opacity ${reduzir ? TROCA.reduzido : FECHA_MS}ms ease-out` : undefined,
        pointerEvents: fechando ? "none" : undefined,
      } as CSSProperties}
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
          transform: fechando && !reduzir ? `translate3d(0,${arrasto + 36}px,0) scale(${Math.max(0.86, 1 - arrasto / 1600) - 0.02})` : arrasto ? `translateY(${arrasto}px) scale(${Math.max(0.86, 1 - arrasto / 1600)})` : undefined,
          transition: arrasto && !fechando ? "none" : `transform ${fechando ? FECHA_MS : 200}ms ${fechando ? CURVA : "ease-out"}, border-radius .2s ease-out`,
          borderRadius: arrasto || (fechando && !reduzir) ? 22 : 0,
        }}
      >
        {/* as telas: a de antes (parada, embaixo) e a de agora entrando por cima */}
        <div className="absolute inset-0" data-testid="retro-telas">
          {troca && troca.de.chave !== chaveDoCard && camadaDeTras(troca.de, true)}
          {camadaDeTras(snap, false)}
        </div>

        {/* o dedo: a tela inteira (os botões de cima, as opções do adivinha e os de baixo ficam por cima desta camada) */}
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

        <div className="absolute inset-0 pointer-events-none">
          {troca && troca.de.chave !== chaveDoCard && camadaDaFrente(troca.de, true)}
          {camadaDaFrente(snap, false)}
        </div>

        <header
          className="absolute left-0 right-0 top-0 px-3"
          style={{ paddingTop: seguro.topo + 8, opacity: escondeControles ? 0 : 1, color: tinta, transition: `opacity .2s ease-out, ${corTransicao}` }}
        >
          <div className="flex gap-1" aria-hidden data-testid="retro-barras">
            {telas.map((t, k) => (
              <div key={`${t.id}-${k}`} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: trilho, transition: corTransicao }}>
                {k < i && <div className="h-full w-full" style={{ background: tinta, transition: corTransicao }} />}
                {k === i && (
                  <div
                    key={chaveDoCard}
                    className="h-full w-full origin-left"
                    data-testid="retro-barra-atual"
                    onAnimationEnd={barraTerminou}
                    style={reduzir ? { background: tinta } : { background: tinta, transition: corTransicao, transform: "scaleX(0)", animationName: "retroTcBarra", animationDuration: `${ms}ms`, animationTimingFunction: "linear", animationFillMode: "forwards", animationPlayState: andando ? "running" : "paused", willChange: "transform" }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="h-[48px] flex items-center justify-end gap-1">
            <span className="sr-only" aria-live="polite" data-testid="retro-rotulo">{ROTULOS[atual.id]} · {i + 1} de {total}</span>
            {card && (
              <button type="button" onClick={() => abrirFolha("icone")} aria-label="Compartilhar este card" className="w-11 h-11 grid place-items-center rounded-full active:scale-95" style={{ background: claro ? "rgba(31,31,36,.06)" : "rgba(0,0,0,.14)", transition: `transform .15s ease-out, ${corTransicao}`, animation: reduzir ? undefined : "retroTcEntra .25s ease-out backwards" }} data-testid="retro-compartilhar">
                <Share className="w-[19px] h-[19px]" strokeWidth={2.4} />
              </button>
            )}
            <button type="button" onClick={() => fechar("x")} aria-label="Fechar" className="w-11 h-11 grid place-items-center rounded-full active:scale-95" style={{ background: claro ? "rgba(31,31,36,.06)" : "rgba(0,0,0,.14)", transition: `transform .15s ease-out, ${corTransicao}` }} data-testid="retro-fechar">
              <X className="w-[21px] h-[21px]" strokeWidth={2.4} />
            </button>
          </div>
        </header>
      </div>

      {folha && card && base && dados && (
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
          onFechar={fecharFolha}
          saindo={folhaSaindo}
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
 * O adivinha (02/11): a pergunta, 3 opções, a revelação
 * ------------------------------------------------------------------------- */

const TelaDoAdivinha = ({ a, palpite, onEscolher, topo, base, reduzir, escondido, fantasma = false }: { a: Adivinha; palpite: Palpite; onEscolher: (v: number) => void; topo: number; base: number; reduzir: boolean; escondido: boolean; /** (03/11) a cópia que está saindo na troca: sem toque e sem os ids de teste */ fantasma?: boolean }) => {
  const cor = TEMA_DO_MODULO[a.modulo].destaque;
  const acertou = palpite.revelado && palpite.escolha === a.certo;
  // (03/11) entradas suaves: fade + 12 px + 0,98→1, em cascata curta ("backwards": depois o botão fica livre pro :active)
  const entra = (atraso: number): CSSProperties => (reduzir ? {} : { animation: `retroTcSobe .45s ${CURVA} ${atraso}s backwards` });
  const id = (nome: string) => (fantasma ? undefined : nome);
  return (
    <div className="absolute left-0 right-0 px-6 pointer-events-none transition-opacity duration-200" style={{ top: topo + 10, bottom: base + 20, opacity: escondido ? 0 : 1, color: "#ffffff" }} data-testid={id("retro-adivinha")} data-revelado={palpite.revelado ? "sim" : "nao"}>
      <div className="h-full flex flex-col justify-center pb-[14%]">
        <span className="self-start h-8 px-3.5 rounded-full text-[12px] font-extrabold tracking-[.14em] inline-flex items-center" style={{ background: "rgba(255,255,255,.16)", ...entra(0) }}>ADIVINHA</span>
        <p className="mt-5 text-[30px] leading-[1.12] font-black tracking-[-0.03em]" style={entra(0.07)} data-testid={id("retro-adivinha-pergunta")}>{a.pergunta}</p>
        <div className={`mt-7 flex flex-col gap-3 ${fantasma ? "" : "pointer-events-auto"}`} role="group" aria-label="Opções">
          {a.opcoes.map((v, k) => {
            const certa = v === a.certo;
            const escolhida = palpite.escolha === v;
            const mostraCerta = palpite.revelado && certa;
            const errada = palpite.revelado && escolhida && !certa;
            return (
              <button
                key={v}
                type="button"
                disabled={palpite.revelado || fantasma}
                tabIndex={fantasma ? -1 : undefined}
                onClick={() => onEscolher(v)}
                className="h-[64px] rounded-2xl px-5 flex items-center justify-between text-left active:scale-[.98]"
                style={{
                  ...entra(0.14 + k * 0.07),
                  transition: "background-color .35s ease-out, color .35s ease-out, box-shadow .35s ease-out, opacity .35s ease-out, transform .15s ease-out",
                  background: mostraCerta ? "#ffffff" : errada ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.12)",
                  color: mostraCerta ? cor : "#ffffff",
                  boxShadow: mostraCerta ? "0 14px 30px -14px rgba(0,0,0,.5)" : "inset 0 0 0 2px rgba(255,255,255,.35)",
                  opacity: palpite.revelado && !certa && !escolhida ? 0.45 : 1,
                }}
                data-testid={id("retro-adivinha-opcao")}
                data-valor={v}
              >
                <span className="text-[30px] font-black tracking-[-0.04em] tabular-nums" style={errada ? { textDecoration: "line-through", textDecorationThickness: 3 } : undefined}>{v}</span>
                {mostraCerta && <Check className="w-7 h-7" strokeWidth={3.2} aria-hidden style={reduzir ? undefined : { animation: `retroTcSobe .35s ${CURVA} .05s backwards` }} />}
              </button>
            );
          })}
        </div>
        {/* o "Toque no seu palpite" some com fade enquanto a resposta entra no mesmo lugar (sem troca seca) */}
        <div className="mt-7 min-h-[96px] relative" aria-live="polite">
          <p className="absolute left-0 top-0 text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.75)", opacity: palpite.revelado ? 0 : 1, transition: "opacity .2s ease-out", ...(palpite.revelado ? {} : entra(0.4)) }} aria-hidden={palpite.revelado || undefined}>Toque no seu palpite.</p>
          {palpite.revelado && (
            <div style={entra(0.08)} data-testid={id("retro-adivinha-resposta")}>
              <p className="text-[36px] font-black tracking-[-0.035em] leading-none">{acertou ? "Acertou!" : `Foram ${a.certo}!`}</p>
              <p className="mt-2 text-[16px] font-bold" style={{ color: "rgba(255,255,255,.86)" }}>{acertou ? `${a.certo} ${a.unidade}. Você conhece o seu mês.` : `${a.certo} ${a.unidade}.`}</p>
            </div>
          )}
        </div>
      </div>
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
  /** (03/11) Descendo (some suave antes de sair): sem toque. */
  saindo?: boolean;
  reduzir: boolean;
  alturaTela: number;
  largura: number;
  baseSegura: number;
}

const FolhaDeCompartilhar = ({ titulo, base, dados, formato, setFormato, valores, setValores, textos, setTextos, enviando, progresso, onPostar, onSalvar, onFechar, saindo = false, reduzir, alturaTela, largura, baseSegura }: PropsFolha) => {
  const painel = useRef<HTMLDivElement>(null);
  // (03/11) preventScroll: focar a folha enquanto ela ainda está abaixo da tela (subindo) fazia o navegador ROLAR a
  // retrospectiva pra cima — o card dava um pulo no meio da animação
  useEffect(() => { painel.current?.focus({ preventScroll: true }); }, []);
  const { w: W, h: H } = FORMATOS[formato];
  // a prévia encolhe em tela baixa (iPhone SE) pra folha nunca passar da tela
  const alturaPrevia = Math.round(Math.max(110, Math.min(200, alturaTela * 0.24 - (temReais(base) || temTextos(base) ? 24 : 0))));
  const larguraPrevia = Math.round((alturaPrevia * W) / H);
  return (
    <div className="absolute inset-0 z-10" data-testid={saindo ? "retro-folha-saindo" : "retro-folha"} style={{ pointerEvents: saindo ? "none" : undefined }}>
      <button type="button" aria-label="Fechar o compartilhar" onClick={onFechar} className="absolute inset-0 w-full h-full cursor-default" style={{ background: "rgba(0,0,0,.55)", animation: saindo ? `retroTcSome ${reduzir ? TROCA.reduzido : FOLHA_SAI_MS}ms ease-out both` : `retroTcEntra ${reduzir ? 150 : 240}ms ease-out both` }} data-testid="retro-folha-fundo" />
      <div
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Compartilhar · ${titulo}`}
        className="absolute bottom-0 left-0 right-0 mx-auto rounded-t-[22px] text-white outline-none"
        style={{
          width: largura, background: "#18181c", boxShadow: "0 -20px 50px -20px rgba(0,0,0,.6)",
          // sobe com ease-out (~0,32 s) e desce mais rápido (~0,23 s); com "reduzir movimento", só fade
          animation: reduzir
            ? `${saindo ? "retroTcSome" : "retroTcEntra"} ${saindo ? TROCA.reduzido : 150}ms ease-out both`
            : saindo ? `retroTcFolhaSai ${FOLHA_SAI_MS}ms cubic-bezier(.4,0,1,1) both` : `retroTcFolha .32s ${CURVA} both`,
        }}
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
