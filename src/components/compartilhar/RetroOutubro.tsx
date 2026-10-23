import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { Clapperboard, Download, Loader2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { suporteVideo } from "@/components/conquistas/video/suporte";
import type { Leitor } from "@/lib/retrospectiva";
import { CardDeCompartilhar } from "./cards";
import { postarCardImagem, postarCardVideo, prepararCapas } from "./postar";
import { comEscolhas, montarRetroOutubro, type CardDaRetro } from "./retro-outubro-dados";
import { nomeDoMes, capitalizar } from "./textos";
import { FORMATOS, type DadosCard } from "./tipos";

const AnimacaoDoCard = lazy(() => import("./AnimacaoDoCard"));

/**
 * A RETROSPECTIVA DE OUTUBRO NA TELA (23/10): os cards animados de
 * compartilhar em sequência — abertura → um card por módulo com dado →
 * resumo. Toque à direita avança, à esquerda volta (e as setas do
 * teclado). Embaixo de cada card: "Postar nos Stories" (o VÍDEO, gerado no
 * aparelho; sem como gerar, vai a imagem) e "Salvar" (a imagem).
 *
 * R$ escondido por padrão: o interruptor "Mostrar valores em R$" só aparece
 * no card de Finanças que tem valor, começa DESLIGADO e vale só nesta
 * abertura. O texto das metas idem ("Mostrar o texto das metas").
 *
 * Eventos (todos com `mes: "outubro"`): wrapped_cards (quais cards a pessoa
 * tem), wrapped_tela (cada card visto), wrapped_share (postou/salvou, por
 * card, com o resultado do compartilhar), wrapped_fechou (até onde foi).
 */

interface Props {
  ler: Leitor;
  onClose: () => void;
  /** Sem nada pra mostrar (nenhum módulo, nenhum dia): quem chama decide (a retrospectiva antiga). */
  semDados: ReactNode;
  /** Só testes/dev: o relógio. */
  agora?: Date;
}

const MES = "outubro";
const ROTULOS: Record<CardDaRetro["id"], string> = { abertura: "Abertura", financas: "Finanças", treino: "Treino", rotina: "Rotina", agua: "Água", leitura: "Leitura", metas: "Metas", resumo: "Meu outubro" };

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

export const RetroOutubro = ({ ler, onClose, semDados, agora }: Props) => {
  const reduzir = useReducedMotion();
  const retro = useMemo(() => montarRetroOutubro(ler, { agora }), [ler, agora]);
  const [i, setI] = useState(0);
  const [formato, setFormato] = useState<"stories" | "feed">("stories");
  const [valores, setValores] = useState(false);
  const [textosDasMetas, setTextosDasMetas] = useState(false);
  const [capas, setCapas] = useState<DadosCard | null>(null);
  const [video, setVideo] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState<"video" | "imagem" | null>(null);
  const [progresso, setProgresso] = useState(0);
  const vistos = useRef(new Set<number>());
  const palco = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState({ w: 340, h: 600 });

  const cards = retro?.cards ?? [];
  const total = cards.length;
  const atual = cards[Math.min(i, Math.max(0, total - 1))];

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

  // quais cards a pessoa tem (1 vez por abertura, mesmo que o store mude depois)
  const contouCards = useRef(false);
  useEffect(() => {
    if (!retro || contouCards.current) return;
    contouCards.current = true;
    trackEvent("wrapped_cards", { mes: MES, month: capitalizar(MES), cards: retro.cards.map((c) => c.id).join(","), n: retro.cards.length, pouco_dado: retro.poucoDado, financas: retro.financas ?? "sem" });
  }, [retro]);

  // cada card visto
  useEffect(() => {
    if (!atual) return;
    if (!vistos.current.has(i)) {
      vistos.current.add(i);
      trackEvent("wrapped_tela", { mes: MES, month: capitalizar(MES), i, id: atual.id, total, versao: "cards" });
    }
  }, [i, atual, total]);

  // até onde foi (no fechar e no sair do app)
  const totalRef = useRef(total);
  totalRef.current = total;
  useEffect(() => () => {
    if (!totalRef.current) return;
    trackEventBeacon("wrapped_fechou", { mes: MES, month: capitalizar(MES), vistos: vistos.current.size, total: totalRef.current, chegou_ao_fim: vistos.current.has(totalRef.current - 1), versao: "cards" });
  }, []);

  const ir = useCallback((passo: number) => setI((x) => Math.max(0, Math.min(total - 1, x + passo))), [total]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, onClose]);

  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => { if (el.clientWidth > 0 && el.clientHeight > 0) setCaixa((c) => (c.w === el.clientWidth - 32 && c.h === el.clientHeight - 8 ? c : { w: el.clientWidth - 32, h: el.clientHeight - 8 })); };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [retro]);

  if (!retro || !atual) return <>{semDados}</>;

  const base = atual.id === "leitura" && capas ? capas : atual.dados;
  const dados = comEscolhas(base, { valores, textosDasMetas });
  const { w: W, h: H } = FORMATOS[formato];
  const largura = Math.max(150, Math.floor(Math.min(caixa.w, (caixa.h * W) / H)));
  const animado = !!video && !reduzir;

  const compartilhar = async (acao: "postar" | "salvar") => {
    const midia = acao === "postar" ? "video" : "imagem";
    setEnviando(midia);
    setProgresso(0);
    try {
      const resultado = acao === "postar"
        ? await postarCardVideo(dados, formato, `retro-${MES}`, setProgresso)
        : await postarCardImagem(dados, formato, `retro-${MES}`);
      trackEvent("wrapped_share", { mes: MES, month: capitalizar(MES), card: atual.id, acao, midia, formato, resultado, valores: temReais(dados) ? valores : undefined, versao: "cards" });
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Retrospectiva de ${nomeDoMes(retro.mesIdx)}`}
      data-testid="retro-outubro"
      data-card-atual={atual.id}
      className="fixed inset-0 z-[400] flex flex-col text-white"
      style={{ background: "#0e0e11" }}
    >
      <header className="shrink-0 pt-[max(0.5rem,env(safe-area-inset-top))] px-3">
        <div className="flex gap-1 px-1 pt-1" aria-hidden>
          {cards.map((c, k) => (
            <div key={c.id} className="h-[3px] flex-1 rounded-full" style={{ background: k <= i ? "#ffffff" : "rgba(255,255,255,.25)" }} />
          ))}
        </div>
        <div className="h-[48px] flex items-center gap-2">
          <span className="text-[13px] font-extrabold tracking-wide pl-1" data-testid="retro-rotulo">{ROTULOS[atual.id]} <span className="text-white/50 font-semibold">· {i + 1} de {total}</span></span>
          <div role="radiogroup" aria-label="Formato" className="ml-auto flex rounded-full p-0.5" style={{ background: "rgba(255,255,255,.1)" }}>
            {(["stories", "feed"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={f === formato} onClick={() => setFormato(f)} className={`h-8 px-3 rounded-full text-[12px] font-extrabold ${f === formato ? "bg-white text-black" : "text-white/70"}`} data-formato-opcao={f}>
                {f === "stories" ? "Stories" : "Feed"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10" data-testid="retro-fechar"><X className="w-5 h-5" /></button>
        </div>
      </header>

      <div ref={palco} className="flex-1 min-h-0 grid place-items-center px-4" data-testid="retro-palco">
        <div className="relative rounded-[18px] overflow-hidden" style={{ boxShadow: "0 24px 60px -24px rgba(0,0,0,.8)" }}>
          <CardEscalado elemento={<CardDeCompartilhar dados={dados} formato={formato} />} largura={largura} w={W} h={H} />
          {animado && (
            <div className="absolute inset-0" data-testid="retro-ao-vivo">
              <Suspense fallback={null}>
                <AnimacaoDoCard key={`${atual.id}-${formato}`} dados={dados} formato={formato} largura={largura} pausado={enviando === "video"} />
              </Suspense>
            </div>
          )}
          <button type="button" aria-label="Card anterior" onClick={() => ir(-1)} disabled={i === 0} className="absolute inset-y-0 left-0 w-[32%] disabled:cursor-default" data-testid="retro-anterior" />
          <button type="button" aria-label="Próximo card" onClick={() => ir(1)} disabled={i === total - 1} className="absolute inset-y-0 right-0 w-[68%] disabled:cursor-default" data-testid="retro-proximo" />
        </div>
      </div>

      <footer className="shrink-0 px-4 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
        {temReais(base) && (
          <label className="flex items-center justify-between gap-3 rounded-xl px-3.5 h-11 cursor-pointer" style={{ background: "rgba(255,255,255,.08)" }}>
            <span className="text-[13px] font-bold">Mostrar valores em R$</span>
            <Switch checked={valores} onCheckedChange={(v) => { setValores(v); trackEvent("wrapped_valores", { mes: MES, month: capitalizar(MES), ligado: v, versao: "cards" }); }} aria-label="Mostrar valores em R$ no card" data-testid="retro-valores" />
          </label>
        )}
        {temTextos(base) && (
          <label className="flex items-center justify-between gap-3 rounded-xl px-3.5 h-11 cursor-pointer" style={{ background: "rgba(255,255,255,.08)" }}>
            <span className="text-[13px] font-bold">Mostrar o texto das metas</span>
            <Switch checked={textosDasMetas} onCheckedChange={setTextosDasMetas} aria-label="Mostrar o texto das metas no card" data-testid="retro-textos-metas" />
          </label>
        )}
        <button type="button" onClick={() => compartilhar("postar")} disabled={!!enviando} className="h-12 rounded-xl bg-white text-black font-extrabold text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-70" data-testid="retro-postar">
          {enviando === "video" ? <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Preparando o vídeo… {Math.round(progresso * 100)}%</> : <><Clapperboard className="w-[18px] h-[18px]" aria-hidden /> {formato === "stories" ? "Postar nos Stories" : "Postar no feed"}</>}
        </button>
        <button type="button" onClick={() => compartilhar("salvar")} disabled={!!enviando} className="h-11 rounded-xl text-[13.5px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "rgba(255,255,255,.1)" }} data-testid="retro-salvar">
          {enviando === "imagem" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" aria-hidden />} Salvar
        </button>
      </footer>
    </div>
  );
};

export default RetroOutubro;
