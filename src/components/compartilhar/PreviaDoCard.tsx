import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clapperboard, Image as ImagemIcone, Link2, Loader2, Sticker, X } from "lucide-react";
import { toast } from "sonner";
import { EMPRESA } from "@/lib/empresa";
import { Switch } from "@/components/ui/switch";
import { trackEvent } from "@/lib/analytics";
import { isIOS, isNativeShell } from "@/lib/native-shell";
import { suporteVideo } from "@/components/conquistas/video/suporte";
import { CardDeCompartilhar } from "./cards";
import { postarCardImagem, postarCardVideo } from "./postar";
import { FORMATOS, type DadosCard, type Formato } from "./tipos";

const AnimacaoDoCard = lazy(() => import("./AnimacaoDoCard"));

/**
 * A PRÉVIA DO CARD (29/09): tela cheia com o card no tamanho que cabe, os 3
 * formatos (Stories/Status · Feed · Adesivo pra pôr na própria foto), a
 * animação ao vivo (sem ela com "menos movimento") e os botões. Dinheiro:
 * o interruptor "Mostrar valores em R$" só aparece no card que TEM valor e
 * começa DESLIGADO — a pessoa escolhe.
 *
 * Mesma casca da prévia das Conquistas (SeletorDeArte › Previa): o X fora
 * da área da câmera, "Voltar" perto do polegar, Esc fecha.
 */

interface Props {
  dados: DadosCard;
  /** "conquista" · "treino-concluido" … (vai nos eventos). */
  origem: string;
  titulo: string;
  onFechar: () => void;
  formatos?: Formato[];
  /** O formato que abre (padrão: o 1º da lista). */
  formatoInicial?: Formato;
  /** A moeda de verdade (MoedaEstatica) no card da insígnia. */
  moeda?: ReactNode;
  /** Botões extras no rodapé (o "Trocar conquista"). */
  acoes?: ReactNode;
  children?: ReactNode;
}

const NOMES: Record<Formato, string> = { stories: "Stories/Status", feed: "Feed", adesivo: "Adesivo" };

/** O card de W×H escalado pra caber em `largura` (memoizado). */
const CardEscalado = memo(({ elemento, largura, w, h }: { elemento: ReactElement; largura: number; w: number; h: number }) => {
  const s = largura / w;
  return (
    <div style={{ width: largura, height: Math.round(h * s), overflow: "hidden", position: "relative" }}>
      <div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }}>{elemento}</div>
    </div>
  );
});
CardEscalado.displayName = "CardEscalado";

/**
 * O link pra figurinha de LINK do Instagram (o card não leva link nem QR):
 * com utm próprio, pra dar pra medir quem chega pelo Story de alguém — hoje
 * isso cai junto com o link da bio e não dá pra separar.
 */
export const linkDoCard = (tipo: string) =>
  `${EMPRESA.site}/inicio?utm_source=ig&utm_medium=story_card&utm_campaign=compartilhar&utm_content=${encodeURIComponent(tipo)}`;

/** O card tem R$ pra mostrar (e a pessoa ainda não escolheu)? */
const temValorEmReais = (d: DadosCard) =>
  (d.tipo === "azul" && d.meses.some((m) => (m.saldo ?? 0) > 0)) || (d.tipo === "poupanca" && (d.valor ?? 0) > 0);

export const PreviaDoCard = ({ dados, origem, titulo, onFechar, formatos = ["stories", "feed", "adesivo"], formatoInicial, moeda, acoes, children }: Props) => {
  const reduzir = useReducedMotion();
  const [formato, setFormato] = useState<Formato>(formatoInicial && formatos.includes(formatoInicial) ? formatoInicial : formatos[0]);
  const [valores, setValores] = useState(false);
  const [enviando, setEnviando] = useState<"video" | "imagem" | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [video, setVideo] = useState<boolean | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState({ w: 342, h: 560 });

  useEffect(() => {
    let vivo = true;
    suporteVideo().then((s) => { if (vivo) setVideo(!!s); }, () => { if (vivo) setVideo(false); });
    trackEvent("card_previa", { tipo: dados.tipo, origem });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => { if (el.clientWidth > 0 && el.clientHeight > 0) setCaixa((c) => (c.w === el.clientWidth - 32 && c.h === el.clientHeight - 12 ? c : { w: el.clientWidth - 32, h: el.clientHeight - 12 })); };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const d: DadosCard = "valoresLigados" in dados ? ({ ...dados, valoresLigados: valores } as DadosCard) : dados;
  const { w: W, h: H } = FORMATOS[formato];
  const largura = Math.max(150, Math.floor(Math.min(caixa.w, (caixa.h * W) / H)));
  const elemento = <CardDeCompartilhar dados={d} formato={formato} moeda={moeda} />;
  const animado = formato !== "adesivo" && !!video && !reduzir;

  const postarVideo = async () => {
    if (formato === "adesivo") return;
    setEnviando("video");
    setProgresso(0);
    try { await postarCardVideo(d, formato, origem, setProgresso, moeda); } finally { setEnviando(null); }
  };
  const postarImagem = async () => {
    setEnviando("imagem");
    try { await postarCardImagem(d, formato, origem, moeda); } finally { setEnviando(null); }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Postar · ${titulo}`}
      data-testid="previa-card"
      data-formato={formato}
      className="fixed inset-0 z-[300] flex flex-col bg-background text-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduzir ? 0.1 : 0.22 }}
    >
      <header className="shrink-0 pt-[var(--app-safe-top)] relative z-10 bg-background">
        <div className="h-[52px] flex items-center gap-2 px-3 text-[14px] font-extrabold">
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-10 h-10 shrink-0 grid place-items-center rounded-full hover:bg-muted active:bg-muted" data-testid="previa-card-fechar"><X className="w-5 h-5" /></button>
          <span className="truncate">Postar · {titulo}</span>
          <span className="ml-auto pr-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{W} × {H}{animado ? " · vídeo" : ""}</span>
        </div>
        {formatos.length > 1 && (
          <div role="radiogroup" aria-label="Formato" className="mx-4 mb-1 grid rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${formatos.length}, 1fr)` }}>
            {formatos.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={f === formato}
                onClick={() => { setFormato(f); trackEvent("card_formato", { tipo: dados.tipo, formato: f }); }}
                className={`h-10 rounded-lg text-[12.5px] font-extrabold transition-colors ${f === formato ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                data-formato-opcao={f}
              >
                {NOMES[f]}
              </button>
            ))}
          </div>
        )}
      </header>

      <div ref={palco} className="flex-1 min-h-0 grid place-items-center px-4 py-1.5" data-testid="previa-card-palco">
        <motion.div
          key={formato}
          className="relative rounded-[20px] overflow-hidden border border-border shadow-[0_20px_50px_-20px_rgba(0,0,0,.55)]"
          style={formato === "adesivo" ? { background: "linear-gradient(160deg,#c9b8a6,#8d7b6b 45%,#4b4038)" } : undefined}
          initial={reduzir ? false : { scale: 0.92, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <CardEscalado elemento={elemento} largura={largura} w={W} h={H} />
          {animado && (
            <div className="absolute inset-0" data-testid="previa-card-ao-vivo">
              <Suspense fallback={null}>
                <AnimacaoDoCard dados={d} formato={formato as "stories" | "feed"} largura={largura} pausado={enviando === "video"} moeda={moeda} />
              </Suspense>
            </div>
          )}
          {formato === "adesivo" && (
            <div className="absolute left-0 right-0 bottom-2 text-center text-[11px] font-bold text-white/90 drop-shadow">(aqui entra a sua foto)</div>
          )}
        </motion.div>
      </div>

      <footer className="shrink-0 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
        {temValorEmReais(dados) && (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 h-12 cursor-pointer">
            <span className="text-[13px] font-bold">Mostrar valores em R$</span>
            <Switch checked={valores} onCheckedChange={(v) => { setValores(v); trackEvent("card_valores", { tipo: dados.tipo, ligado: v }); }} aria-label="Mostrar valores em R$ no card" data-testid="card-valores" />
          </label>
        )}
        {acoes}
        {formato === "adesivo" ? (
          <>
            <button type="button" onClick={postarImagem} disabled={!!enviando} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 disabled:opacity-70" data-testid="postar-adesivo">
              {enviando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Sticker className="w-[18px] h-[18px]" aria-hidden />} Salvar o adesivo
            </button>
            <p className="text-[11.5px] text-muted-foreground text-center leading-snug px-2">No Instagram: abra o Stories com a sua foto e cole o adesivo por cima (fundo transparente).</p>
          </>
        ) : (
          <>
            {video && (
              <button type="button" onClick={postarVideo} disabled={!!enviando} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 disabled:opacity-70" data-testid="postar-card-video">
                {enviando === "video" ? <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Preparando o vídeo… {Math.round(progresso * 100)}%</> : <><Clapperboard className="w-[18px] h-[18px]" aria-hidden /> Postar vídeo{formato === "stories" ? " nos Stories" : ""}</>}
              </button>
            )}
            <button type="button" onClick={postarImagem} disabled={!!enviando} className={`h-11 rounded-xl text-[13.5px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${video ? "border border-border bg-card" : "bg-foreground text-background"}`} data-testid="postar-card-imagem">
              {enviando === "imagem" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagemIcone className="w-4 h-4" aria-hidden />} Postar imagem
            </button>
            {/* 23/10: no app do iPhone, nada de link do site (regra da loja: sem link de site/Pix no iOS) */}
            {formato === "stories" && !(isNativeShell() && isIOS()) && (
              <button
                type="button"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(linkDoCard(dados.tipo)); toast.success("Link copiado! No Story, use a figurinha de Link e cole."); }
                  catch { toast.error("Não consegui copiar agora."); }
                  trackEvent("card_link_copiado", { tipo: dados.tipo, origem });
                }}
                className="h-9 rounded-xl text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
                data-testid="copiar-link-card"
              >
                <Link2 className="w-4 h-4" aria-hidden /> Copiar o link pra figurinha de Link
              </button>
            )}
          </>
        )}
        <button type="button" onClick={onFechar} className="h-10 rounded-xl text-[13px] font-bold text-muted-foreground hover:text-foreground" data-testid="previa-card-voltar">Voltar</button>
      </footer>
      {children}
    </motion.div>
  );
};
