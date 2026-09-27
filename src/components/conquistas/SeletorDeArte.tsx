import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Clapperboard, Image as ImagemIcone, Instagram, Loader2, Repeat, Sparkles, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { trackEvent } from "@/lib/analytics";
import { MARCOS_SEQUENCIA } from "@/lib/sequencia";
import type { ArteComVideo, DadosArtes } from "./artes-dados";
import { Insignia } from "./Insignia";
import { NOME_FAIXA, fraseDe, linhaDe, type Insignia as DadosInsignia } from "./insignias";
import { STORIES, StoriesAlbum, StoriesConquista, StoriesRoseta, StoriesTres } from "./Stories";
import { compartilharAlbum, compartilharConquista, compartilharRoseta, compartilharTres, compartilharVideoDaArte } from "./compartilhar-conquistas";
import { suporteVideo } from "./video/suporte";

export type { DadosArtes } from "./artes-dados";

/**
 * "Postar nos Stories" (27/09; as INSÍGNIAS v3 na noite de 27/09): a folha
 * com as artes em miniatura — "Minha conquista do mês" (NOVA), "Minhas 3
 * conquistas" (só com 3 candidatas de áreas diferentes) e "Meu álbum de
 * figurinhas" — todas em VÍDEO com a imagem como alternativa; a Roseta só
 * aparece no dia de um marco da sequência (7 · 30 · 100). Capa e Carteirinha
 * saíram. Toque → prévia em tela cheia com "Postar vídeo nos Stories" e
 * "Postar imagem"; na conquista dá pra TROCAR qual insígnia vai (entre as
 * candidatas), e a Roseta oferece "Fundo transparente".
 *
 * "Minhas 3 conquistas" é UM arquivo: as 3 melhores de áreas diferentes em
 * sequência e o resumo no fim (dono, 27/09).
 *
 * As miniaturas são a arte de verdade (1080×1920) escalada — montadas UMA A
 * UMA (uma por quadro) e memoizadas: DOMs de Stories de uma vez pesam no
 * Android barato. A prévia monta só a arte escolhida.
 */

const AnimacaoAoVivo = lazy(() => import("./video/AnimacaoAoVivo"));

export type ArteId = ArteComVideo | "roseta";

export interface Arte {
  id: ArteId;
  nome: string;
  frase: string;
  nova?: boolean;
  transparente?: boolean;
  video?: boolean;
  /** Sem o dado que a arte precisa: a miniatura vira o aviso. */
  bloqueio?: string;
}

/** As artes de hoje (o que aparece na folha depende do dado). */
export const artesDisponiveis = (d: DadosArtes): Arte[] => {
  const out: Arte[] = [
    { id: "conquista", nome: "Minha conquista do mês", frase: d.heroi ? fraseDe(d.heroi, d.mesIdx) : "Sua 1ª insígnia de bronze libera o vídeo.", nova: true, video: true, bloqueio: d.heroi ? undefined : "Sua 1ª insígnia de bronze libera o vídeo" },
  ];
  if (d.tres.length >= 3) out.push({ id: "tres", nome: "Minhas 3 conquistas", frase: "3 conquistas num vídeo só.", video: true });
  out.push({ id: "album", nome: "Meu álbum de figurinhas", frase: `${d.adesivos} de ${d.total} coladas.`, video: true });
  if ((MARCOS_SEQUENCIA as readonly number[]).includes(d.dias)) out.push({ id: "roseta", nome: "Roseta", frase: `${d.dias} dias seguidos — hoje é marco!`, transparente: true });
  return out;
};

/** A arte pronta pra tela (prévia/miniatura) — a mesma que vira foto. */
export const arteDe = (id: ArteId, d: DadosArtes): ReactElement | null => {
  switch (id) {
    case "conquista": return d.heroi ? <StoriesConquista ins={d.heroi} nome={d.nome} membroDesde={d.membroDesde} nivel={d.nivel} mesIdx={d.mesIdx} ano={d.ano} /> : null;
    case "tres": return <StoriesTres tres={d.tres} nome={d.nome} membroDesde={d.membroDesde} nivel={d.nivel} mesIdx={d.mesIdx} />;
    case "album": return <StoriesAlbum {...d} />;
    case "roseta": return <StoriesRoseta dias={d.dias} nome={d.nome} membroDesde={d.membroDesde} nivel={d.nivel} />;
  }
};

export async function postarArte(id: ArteId, d: DadosArtes, transparente = false) {
  switch (id) {
    case "conquista": return compartilharConquista(d);
    case "tres": return compartilharTres(d);
    case "album": return compartilharAlbum(d);
    case "roseta": return compartilharRoseta({ dias: d.dias, nome: d.nome, membroDesde: d.membroDesde, nivel: d.nivel, transparente });
  }
}

/** Largura útil do container (pra escalar a arte). `quando` re-mede quando o container monta (a folha abre depois do componente). */
const useLargura = (padrao: number, quando: unknown = true) => {
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
  }, [quando]);
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

const Miniatura = ({ arte, videoSuportado, indice, dados, largura, onEscolher }: { arte: Arte; videoSuportado: boolean; indice: number; dados: DadosArtes; largura: number; onEscolher: (id: ArteId) => void }) => {
  // monta uma por quadro: a folha abre leve e as artes vão aparecendo
  const [pronta, setPronta] = useState(indice === 0);
  useEffect(() => {
    if (pronta) return;
    const t = setTimeout(() => setPronta(true), 40 * indice);
    return () => clearTimeout(t);
  }, [pronta, indice]);
  const elemento = pronta && !arte.bloqueio ? arteDe(arte.id, dados) : null;
  return (
    <button type="button" onClick={() => !arte.bloqueio && onEscolher(arte.id)} className="block text-left self-start active:scale-[0.98] transition-transform disabled:active:scale-100" style={{ width: largura }} data-arte={arte.id} data-bloqueada={arte.bloqueio ? "" : undefined} disabled={!!arte.bloqueio} aria-disabled={!!arte.bloqueio}>
      <div className="relative rounded-[14px] overflow-hidden border border-border bg-muted shadow-[0_6px_16px_-10px_rgba(0,0,0,.4)]" style={{ width: largura, height: Math.round((largura * STORIES.h) / STORIES.w) }}>
        {elemento && <ArteEscalada elemento={elemento} largura={largura} />}
        {arte.bloqueio && <div className="absolute inset-0 grid place-items-center p-3 text-center text-[11px] font-semibold text-muted-foreground">{arte.bloqueio}</div>}
        {arte.nova && !arte.bloqueio && <span className="absolute left-2 top-2 rounded-full bg-accent text-accent-foreground text-[8.5px] font-extrabold tracking-[.12em] px-2 py-[3px]">NOVA</span>}
        {arte.video && videoSuportado && !arte.bloqueio && (
          <span className="absolute left-2 bottom-2 rounded-full bg-black/70 text-white text-[8.5px] font-extrabold tracking-[.12em] px-2 py-[3px] inline-flex items-center gap-1" data-testid="selo-video">
            <Clapperboard className="w-2.5 h-2.5" aria-hidden /> VÍDEO
          </span>
        )}
      </div>
      <div className="text-[13px] font-extrabold mt-1.5">{arte.nome}</div>
      <div className="text-[11px] text-muted-foreground">{arte.frase}</div>
    </button>
  );
};

export interface PreviaVideo {
  /** null = ainda detectando. */
  suportado: boolean | null;
  /** A animação ao vivo por cima da arte parada (largura do palco; pausada enquanto o vídeo é gerado). */
  aoVivo?: (largura: number, pausado: boolean) => ReactNode;
  onPostar: (onProgresso: (fracao: number) => void) => Promise<unknown> | void;
  /** "vídeo 5 s" · "vídeo 11 s" */
  rotulo?: string;
}

interface PreviaProps {
  titulo: string;
  elemento: ReactElement;
  /** Oferece o "Fundo transparente · pra colar na sua foto". */
  transparente?: boolean;
  /** A arte também sai em vídeo. */
  video?: PreviaVideo;
  /** Botões extras no rodapé (o "Trocar conquista"). */
  acoes?: ReactNode;
  onPostar: (transparente: boolean) => Promise<unknown> | void;
  onFechar: () => void;
  children?: ReactNode;
}

/** Prévia em tela cheia da arte, com "Postar nos Stories" (o vídeo e o fundo transparente quando existem). */
export const Previa = ({ titulo, elemento, transparente, video, acoes, onPostar, onFechar, children }: PreviaProps) => {
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
      {/* o recuo da câmera fica por fora e a faixa do X tem 52 px de verdade (dono 27/09: "quando clica não tem como sair") */}
      <header className="shrink-0 pt-[env(safe-area-inset-top)] relative z-10 bg-background">
        <div className="h-[52px] flex items-center gap-2 px-3 text-[14px] font-extrabold">
          <button type="button" onClick={onFechar} aria-label="Fechar a prévia" className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted active:bg-muted" data-testid="previa-fechar"><X className="w-5 h-5" /></button>
          <span className="truncate">Prévia · {titulo}</span>
          <span className="ml-auto pr-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{comVideo ? `1080 × 1920 · ${video?.rotulo ?? "vídeo"}` : "1080 × 1920"}</span>
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
        {acoes}
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
      {children}
    </motion.div>
  );
};

/** A lista pra TROCAR a conquista antes de postar (por cima da prévia). */
const TrocarConquista = ({ candidatas, atual, mesIdx, onEscolher, onFechar }: { candidatas: DadosInsignia[]; atual: string; mesIdx: number; onEscolher: (i: DadosInsignia) => void; onFechar: () => void }) => (
  <>
    <motion.div className="absolute inset-0 z-[5]" style={{ background: "rgba(0,0,0,.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} aria-hidden />
    <motion.div role="dialog" aria-modal="true" aria-label="Qual conquista postar?" data-testid="trocar-conquista" className="absolute left-0 right-0 bottom-0 z-[6] rounded-t-3xl bg-background text-foreground px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[78vh] overflow-y-auto shadow-[0_-20px_50px_rgba(0,0,0,.35)]" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
      <div className="w-10 h-1 rounded-full bg-border mx-auto mb-3" />
      <div className="text-[17px] font-extrabold tracking-tight">Qual conquista postar?</div>
      <div className="text-[12px] text-muted-foreground mt-0.5">As que já têm faixa e dão orgulho — a 1ª é a escolha automática do mês.</div>
      <ul className="mt-3 flex flex-col gap-1">
        {candidatas.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onEscolher(i)} className={`w-full flex items-center gap-3 rounded-xl px-2 py-1.5 text-left ${i.id === atual ? "bg-muted" : "hover:bg-muted/60"}`} data-candidata={i.id} aria-pressed={i.id === atual}>
              <Insignia ins={i} tamanho={48} estatico semSombra />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-extrabold truncate">{i.nome}</span>
                <span className="block text-[11px] text-muted-foreground truncate">{linhaDe(i, mesIdx)} · {i.faixa ? NOME_FAIXA[i.faixa].toLowerCase() : ""}</span>
              </span>
              {i.id === atual && <Check className="w-4 h-4 shrink-0" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  </>
);

export interface ArteDireta { arte: ArteId; insignia?: DadosInsignia }

interface SeletorProps {
  aberto: boolean;
  onFechar: () => void;
  dados: DadosArtes;
  /** Vai direto pra prévia desta arte (o "Postar minha conquista" do planner, o "Compartilhar" do álbum, o detalhe de uma insígnia). */
  direto?: ArteDireta | null;
  onDiretoConsumido?: () => void;
}

const rotuloDuracao = (arte: ArteId) => (arte === "tres" ? "vídeo 11 s" : arte === "conquista" ? "vídeo 5,5 s" : "vídeo 5 s");

export const SeletorDeArte = ({ aberto, onFechar, dados, direto, onDiretoConsumido }: SeletorProps) => {
  const reduzir = useReducedMotion();
  const [escolhida, setEscolhida] = useState<ArteId | null>(null);
  // veio direto pra prévia (sem passar pela folha): fechar a prévia fecha tudo, não cai na folha
  const [veioDireto, setVeioDireto] = useState(false);
  const [heroiEscolhido, setHeroiEscolhido] = useState<DadosInsignia | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [grade, largura] = useLargura(312, aberto);
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
    setEscolhida(direto.arte);
    setHeroiEscolhido(direto.insignia ?? null);
    setVeioDireto(true);
    trackEvent("arte_escolhida", { arte: direto.arte, origem: "direto", insignia: direto.insignia?.id });
    onDiretoConsumido?.();
  }, [direto, onDiretoConsumido]);

  const dadosEfetivos: DadosArtes = heroiEscolhido ? { ...dados, heroi: heroiEscolhido } : dados;
  const artes = artesDisponiveis(dadosEfetivos);
  const escolher = (id: ArteId) => {
    trackEvent("arte_escolhida", { arte: id, origem: "seletor" });
    setEscolhida(id);
  };
  const arte = escolhida ? artes.find((a) => a.id === escolhida) ?? null : null;
  const elemento = arte ? arteDe(arte.id, dadosEfetivos) : null;
  const fecharPrevia = () => {
    setEscolhida(null);
    setTrocando(false);
    setHeroiEscolhido(null);
    if (veioDireto) { setVeioDireto(false); onFechar(); }
  };

  return (
    <>
      <Sheet open={aberto && !escolhida} onOpenChange={(o) => !o && onFechar()}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="seletor-de-arte">
          <div ref={grade} className="max-w-md mx-auto pt-1">
            <SheetTitle className="text-[18px] font-extrabold tracking-tight">Postar nos Stories</SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground mt-0.5">Vídeo com a sua conquista do mês — os números de verdade. Dinheiro sai em %; R$ só com "mostrar valores" ligado.</SheetDescription>
            <div className="grid grid-cols-2 mt-3.5" style={{ gap: "12px 10px" }}>
              {artes.map((a, i) => (
                <Miniatura key={a.id} arte={a} videoSuportado={!!suporte} indice={i} dados={dadosEfetivos} largura={wMini} onEscolher={escolher} />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {arte && elemento && aberto && (
        <Previa
          titulo={arte.nome}
          elemento={elemento}
          transparente={arte.transparente}
          video={arte.video ? {
            suportado: suporte,
            rotulo: rotuloDuracao(arte.id),
            aoVivo: reduzir ? undefined : (w, pausado) => <AnimacaoAoVivo arte={arte.id as ArteComVideo} dados={dadosEfetivos} largura={w} pausado={pausado} />,
            onPostar: (p) => compartilharVideoDaArte(arte.id as ArteComVideo, dadosEfetivos, p),
          } : undefined}
          acoes={arte.id === "conquista" && dadosEfetivos.candidatas.length > 1 ? (
            <button type="button" onClick={() => setTrocando(true)} className="h-10 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-2 text-foreground border border-dashed border-border" data-testid="trocar-conquista-abrir">
              <Repeat className="w-4 h-4" aria-hidden /> Trocar conquista
            </button>
          ) : undefined}
          onPostar={(t) => postarArte(arte.id, dadosEfetivos, t)}
          onFechar={fecharPrevia}
        >
          <AnimatePresence>
            {trocando && (
              <TrocarConquista
                candidatas={dadosEfetivos.candidatas}
                atual={dadosEfetivos.heroi?.id ?? ""}
                mesIdx={dadosEfetivos.mesIdx}
                onEscolher={(i) => { setHeroiEscolhido(i); setTrocando(false); trackEvent("conquista_trocada", { de: dadosEfetivos.heroi?.id, para: i.id }); }}
                onFechar={() => setTrocando(false)}
              />
            )}
          </AnimatePresence>
        </Previa>
      )}
    </>
  );
};
