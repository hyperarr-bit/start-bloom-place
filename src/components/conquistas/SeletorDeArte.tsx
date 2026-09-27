import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clapperboard, Image as ImagemIcone, Instagram, Loader2, Sparkles, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { trackEvent } from "@/lib/analytics";
import type { ArteComVideo, DadosArtes } from "./artes-dados";
import { STORIES, StoriesAlbum, StoriesCapa, StoriesCarteirinha, StoriesRoseta } from "./Stories";
import { compartilharAlbum, compartilharCapa, compartilharCarteirinha, compartilharRoseta, compartilharVideoDaArte } from "./compartilhar-conquistas";
import { suporteVideo } from "./video/suporte";

export type { DadosArtes } from "./artes-dados";

/**
 * "Postar nos Stories" (27/09) abre uma folha com as 4 artes em miniatura —
 * Capa, Carteirinha, Roseta e Álbum (nova, no lugar das Insígnias) — todas
 * com os dados de hoje, a qualquer hora (a roseta não é mais só dos marcos).
 * Toque → prévia em tela cheia com "Postar nos Stories" e, na Roseta, "Fundo
 * transparente · pra colar na sua foto".
 *
 * VÍDEO (dono: "podia ser um GIF que abre e mostra os adesivos"): a Capa e o
 * Álbum também saem em vídeo (o planner abrindo e os adesivos pipocando).
 * Onde o aparelho consegue gerar (WebCodecs ou MediaRecorder com MP4), a
 * prévia toca a animação ao vivo e o botão principal vira "Postar vídeo nos
 * Stories", com "Postar imagem" embaixo; onde não, fica só a imagem. O
 * código do vídeo só é baixado quando a prévia de uma dessas artes abre.
 *
 * As miniaturas são a arte de verdade (1080×1920) escalada — montadas UMA A
 * UMA (uma por quadro) e memoizadas: quatro DOMs de Stories de uma vez pesam
 * no Android barato. A prévia monta só a arte escolhida.
 */

const AnimacaoAoVivo = lazy(() => import("./video/AnimacaoAoVivo"));

export type ArteId = "capa" | "carteirinha" | "roseta" | "album";

export const ARTES: { id: ArteId; nome: string; frase: string; nova?: boolean; transparente?: boolean; video?: boolean }[] = [
  { id: "capa", nome: "Capa", frase: "Meu planner de vida.", video: true },
  { id: "carteirinha", nome: "Carteirinha", frase: "Organizada, com carteirinha." },
  { id: "roseta", nome: "Roseta", frase: "Constância tem prêmio.", transparente: true },
  { id: "album", nome: "Álbum", frase: "Meus adesivos mais raros.", nova: true, video: true },
];

/** A arte pronta pra tela (prévia/miniatura) — a mesma que vira foto. */
export const arteDe = (id: ArteId, d: DadosArtes): ReactElement => {
  switch (id) {
    case "capa": return <StoriesCapa capa={d.capa} nome={d.nome} membroDesde={d.membroDesde} dias={d.dias} nivel={d.nivel} />;
    case "carteirinha": return <StoriesCarteirinha nome={d.nome} membroDesde={d.membroDesde} dias={d.dias} nivel={d.nivel} xp={d.xp} adesivos={d.adesivos} total={d.total} ano={d.ano} />;
    case "roseta": return <StoriesRoseta dias={d.dias} nome={d.nome} membroDesde={d.membroDesde} nivel={d.nivel} />;
    case "album": return <StoriesAlbum {...d} />;
  }
};

export async function postarArte(id: ArteId, d: DadosArtes, transparente = false) {
  switch (id) {
    case "capa": return compartilharCapa({ capa: d.capa, nome: d.nome, membroDesde: d.membroDesde, dias: d.dias, nivel: d.nivel, adesivos: d.adesivos });
    case "carteirinha": return compartilharCarteirinha({ nome: d.nome, membroDesde: d.membroDesde, dias: d.dias, nivel: d.nivel, xp: d.xp, adesivos: d.adesivos, total: d.total, ano: d.ano });
    case "roseta": return compartilharRoseta({ dias: d.dias, nome: d.nome, membroDesde: d.membroDesde, nivel: d.nivel, transparente });
    case "album": return compartilharAlbum(d);
  }
}

/** Largura útil do container (pra escalar a arte). */
const useLargura = (padrao: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(padrao);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => { if (el.clientWidth) setW(el.clientWidth); };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

/** A arte 1080×1920 escalada pra caber em `largura` (memoizada: só re-renderiza se os dados mudarem). */
const ArteEscalada = memo(({ elemento, largura }: { elemento: ReactElement; largura: number }) => {
  const s = largura / STORIES.w;
  return (
    <div style={{ width: largura, height: Math.round(STORIES.h * s), overflow: "hidden", position: "relative" }}>
      <div style={{ width: STORIES.w, height: STORIES.h, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }}>{elemento}</div>
    </div>
  );
});
ArteEscalada.displayName = "ArteEscalada";

const Miniatura = ({ id, nome, frase, nova, video, videoSuportado, indice, dados, largura, onEscolher }: { id: ArteId; nome: string; frase: string; nova?: boolean; video?: boolean; videoSuportado: boolean; indice: number; dados: DadosArtes; largura: number; onEscolher: (id: ArteId) => void }) => {
  // monta uma por quadro: a folha abre leve e as artes vão aparecendo
  const [pronta, setPronta] = useState(indice === 0);
  useEffect(() => {
    if (pronta) return;
    const t = setTimeout(() => setPronta(true), 40 * indice);
    return () => clearTimeout(t);
  }, [pronta, indice]);
  return (
    <button type="button" onClick={() => onEscolher(id)} className="text-left active:scale-[0.98] transition-transform" data-arte={id}>
      <div className="relative rounded-[14px] overflow-hidden border border-border bg-muted shadow-[0_6px_16px_-10px_rgba(0,0,0,.4)]" style={{ width: largura, height: Math.round((largura * STORIES.h) / STORIES.w) }}>
        {pronta && <ArteEscalada elemento={arteDe(id, dados)} largura={largura} />}
        {nova && <span className="absolute left-2 top-2 rounded-full bg-accent text-accent-foreground text-[8.5px] font-extrabold tracking-[.12em] px-2 py-[3px]">NOVA</span>}
        {video && videoSuportado && (
          <span className="absolute left-2 bottom-2 rounded-full bg-black/70 text-white text-[8.5px] font-extrabold tracking-[.12em] px-2 py-[3px] inline-flex items-center gap-1" data-testid="selo-video">
            <Clapperboard className="w-2.5 h-2.5" aria-hidden /> VÍDEO
          </span>
        )}
      </div>
      <div className="text-[13px] font-extrabold mt-1.5">{nome}</div>
      <div className="text-[11px] text-muted-foreground">{frase}</div>
    </button>
  );
};

export interface PreviaVideo {
  /** null = ainda detectando. */
  suportado: boolean | null;
  /** A animação ao vivo por cima da arte parada (largura do palco; pausada enquanto o vídeo é gerado). */
  aoVivo?: (largura: number, pausado: boolean) => ReactNode;
  onPostar: (onProgresso: (fracao: number) => void) => Promise<unknown> | void;
}

interface PreviaProps {
  titulo: string;
  elemento: ReactElement;
  /** Oferece o "Fundo transparente · pra colar na sua foto". */
  transparente?: boolean;
  /** A arte também sai em vídeo. */
  video?: PreviaVideo;
  onPostar: (transparente: boolean) => Promise<unknown> | void;
  onFechar: () => void;
}

/** Prévia em tela cheia da arte, com "Postar nos Stories" (o vídeo e o fundo transparente quando existem). */
export const Previa = ({ titulo, elemento, transparente, video, onPostar, onFechar }: PreviaProps) => {
  const reduzir = useReducedMotion();
  const [palco, largura] = useLargura(342);
  const [enviando, setEnviando] = useState<"cor" | "transparente" | "video" | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [alturaPalco, setAlturaPalco] = useState(608);
  useLayoutEffect(() => {
    const el = palco.current;
    if (el && el.clientHeight) setAlturaPalco(el.clientHeight);
  }, [palco]);
  // cabe na largura e na altura do palco
  const w = Math.max(160, Math.min(largura, Math.floor((alturaPalco * STORIES.w) / STORIES.h)));
  const postar = async (t: boolean) => {
    setEnviando(t ? "transparente" : "cor");
    try { await onPostar(t); } finally { setEnviando(null); }
  };
  const postarVideo = async () => {
    if (!video) return;
    setEnviando("video");
    setProgresso(0);
    try { await video.onPostar((f) => setProgresso(f)); } finally { setEnviando(null); }
  };
  useEffect(() => {
    const fecharComEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [onFechar]);
  const comVideo = !!video?.suportado;
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Prévia · ${titulo}`}
      data-testid="previa-arte"
      data-video={comVideo ? "" : undefined}
      className="fixed inset-0 z-[300] flex flex-col bg-background text-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduzir ? 0.1 : 0.22 }}
    >
      {/* 27/09 (dono: "quando clica não tem como sair"): o header tinha altura FIXA de 52 px
          com o recuo da câmera dentro — no iPhone o recuo (~59 px) empurrava o X pra fora da
          caixa e a arte cobria. Agora o recuo fica por fora e a faixa do X tem 52 px de verdade. */}
      <header className="shrink-0 pt-[env(safe-area-inset-top)] relative z-10 bg-background">
        <div className="h-[52px] flex items-center gap-2 px-3 text-[14px] font-extrabold">
          <button type="button" onClick={onFechar} aria-label="Fechar a prévia" className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted active:bg-muted" data-testid="previa-fechar"><X className="w-5 h-5" /></button>
          <span>Prévia · {titulo}</span>
          <span className="ml-auto pr-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{comVideo ? "1080 × 1920 · vídeo 5 s" : "1080 × 1920"}</span>
        </div>
      </header>
      <div ref={palco} className="flex-1 min-h-0 grid place-items-center px-4 py-1.5">
        <motion.div
          className="relative rounded-[22px] overflow-hidden border border-border shadow-[0_20px_50px_-20px_rgba(0,0,0,.55)]"
          initial={reduzir ? false : { scale: 0.86, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.36, ease: "easeOut" }}
        >
          <ArteEscalada elemento={elemento} largura={w} />
          {comVideo && video?.aoVivo && (
            <div className="absolute inset-0" data-testid="previa-ao-vivo">
              <Suspense fallback={null}>{video.aoVivo(w, enviando === "video")}</Suspense>
            </div>
          )}
        </motion.div>
      </div>
      <footer className="shrink-0 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
        {comVideo ? (
          <>
            <button type="button" onClick={postarVideo} disabled={!!enviando} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 disabled:opacity-70" data-testid="postar-video">
              {enviando === "video" ? (
                <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Preparando o vídeo… {Math.round(progresso * 100)}%</>
              ) : (
                <><Clapperboard className="w-[18px] h-[18px]" aria-hidden /> Postar vídeo nos Stories</>
              )}
            </button>
            <button type="button" onClick={() => postar(false)} disabled={!!enviando} className="h-11 rounded-xl border border-border bg-card text-[13.5px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="postar-imagem">
              {enviando === "cor" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagemIcone className="w-4 h-4" aria-hidden />}
              Postar imagem
            </button>
          </>
        ) : (
          <button type="button" onClick={() => postar(false)} disabled={!!enviando} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 disabled:opacity-70" data-testid="postar-imagem">
            {enviando === "cor" ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Instagram className="w-[18px] h-[18px]" aria-hidden />}
            Postar nos Stories
          </button>
        )}
        {transparente && (
          <button type="button" onClick={() => postar(true)} disabled={!!enviando} className="h-11 rounded-xl border border-border bg-card text-[13.5px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {enviando === "transparente" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Fundo transparente <span className="font-medium text-muted-foreground">· pra colar na sua foto</span>
          </button>
        )}
        {/* saída perto do polegar, além do X lá em cima */}
        <button type="button" onClick={onFechar} className="h-10 rounded-xl text-[13px] font-bold text-muted-foreground hover:text-foreground" data-testid="previa-voltar">
          Voltar
        </button>
      </footer>
    </motion.div>
  );
};

interface SeletorProps {
  aberto: boolean;
  onFechar: () => void;
  dados: DadosArtes;
  /** Vai direto pra prévia desta arte (o "Compartilhar meu álbum" do planner aberto). */
  direto?: ArteId | null;
  onDiretoConsumido?: () => void;
}

export const SeletorDeArte = ({ aberto, onFechar, dados, direto, onDiretoConsumido }: SeletorProps) => {
  const reduzir = useReducedMotion();
  const [escolhida, setEscolhida] = useState<ArteId | null>(null);
  // veio direto pra prévia (sem passar pela folha): fechar a prévia fecha tudo, não cai na folha
  const [veioDireto, setVeioDireto] = useState(false);
  const [grade, largura] = useLargura(358);
  const wMini = Math.min(174, Math.floor((largura - 10) / 2));
  // o aparelho gera vídeo? (uma detecção rápida quando a folha abre; fica em cache)
  const [suporte, setSuporte] = useState<boolean | null>(null);
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    suporteVideo().then((s) => { if (vivo) setSuporte(!!s); }, () => { if (vivo) setSuporte(false); });
    return () => { vivo = false; };
  }, [aberto]);

  useEffect(() => {
    if (!direto) return;
    setEscolhida(direto);
    setVeioDireto(true);
    trackEvent("arte_escolhida", { arte: direto, origem: "direto" });
    onDiretoConsumido?.();
  }, [direto, onDiretoConsumido]);

  const escolher = (id: ArteId) => {
    trackEvent("arte_escolhida", { arte: id, origem: "seletor" });
    setEscolhida(id);
  };
  const arte = escolhida ? ARTES.find((a) => a.id === escolhida)! : null;

  return (
    <>
      <Sheet open={aberto && !escolhida} onOpenChange={(o) => !o && onFechar()}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="seletor-de-arte">
          <div ref={grade} className="max-w-md mx-auto pt-1">
            <SheetTitle className="text-[18px] font-extrabold tracking-tight">Postar nos Stories</SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground mt-0.5">Escolha a arte — todas saem com os seus dados de hoje.</SheetDescription>
            <div className="grid grid-cols-2 mt-3.5" style={{ gap: "12px 10px" }}>
              {ARTES.map((a, i) => (
                <Miniatura key={a.id} {...a} videoSuportado={!!suporte} indice={i} dados={dados} largura={wMini} onEscolher={escolher} />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {arte && aberto && (
        <Previa
          titulo={arte.nome}
          elemento={arteDe(arte.id, dados)}
          transparente={arte.transparente}
          video={arte.video ? {
            suportado: suporte,
            aoVivo: reduzir ? undefined : (w, pausado) => <AnimacaoAoVivo arte={arte.id as ArteComVideo} dados={dados} largura={w} pausado={pausado} />,
            onPostar: (p) => compartilharVideoDaArte(arte.id as ArteComVideo, dados, p),
          } : undefined}
          onPostar={(t) => postarArte(arte.id, dados, t)}
          onFechar={() => { setEscolhida(null); if (veioDireto) { setVeioDireto(false); onFechar(); } }}
        />
      )}
    </>
  );
};
