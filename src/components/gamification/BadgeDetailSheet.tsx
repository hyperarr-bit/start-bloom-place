import { useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Share2, Loader2, Lock, Sparkles, ChevronRight, Target } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { parseLocalDay } from "@/lib/utils";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { AdesivoRaro, ChipRaridade } from "@/components/conquistas/adesivos-raridade";
import { Destacar } from "@/components/conquistas/GradeAdesivos";
import { Roseta } from "@/components/conquistas/Roseta";
import { compartilharAdesivo, compartilharRoseta } from "@/components/conquistas/compartilhar-conquistas";
import { Badge, RARIDADE_LABEL, RARIDADE_PLURAL, RARIDADE_VISUAL, categoriaDe, fracaoDe, raridadeDe, type Raridade } from "./types";

interface Props {
  badge: Badge | null;
  onClose: () => void;
  /** Dia em que foi colado ("AAAA-MM-DD"). */
  desbloqueadoEm?: string;
  /** Sequência viva (pro "falta" dos adesivos de sequência). */
  diasDeSequencia?: number;
  perfil: { nome: string; membroDesde: string; nivel: string };
  /** "1 de 14 épicos do CORE". */
  porRaridade?: Record<Raridade, { abertos: number; total: number }>;
  /** Os desafios semanais estão desligados (o "Desafiante" oferece ligar). */
  desafiosOcultos?: boolean;
  onLigarDesafios?: () => void;
  /** Abre a prévia da arte do adesivo (Stories) em vez de mandar direto. */
  onCompartilharAdesivo?: (badge: Badge) => void;
}

/**
 * Detalhe do adesivo (26/09; raridade em 27/09): o adesivo grande colando de
 * novo, o chip da raridade ("ADESIVO ÉPICO · +200 XP"), quando foi conquistado
 * e "1 de 14 épicos do CORE", e o compartilhar nos Stories. Épico e lendário
 * inclinam com o dedo (parallax). O que falta mostra a barra, o "falta" em
 * palavras, o que a raridade dá de visual e o botão "Ir pra <módulo>". Os de
 * sequência compartilham a ROSETA (com fundo transparente pra colar na foto).
 */
export const BadgeDetailSheet = ({ badge, onClose, desbloqueadoEm, diasDeSequencia = 0, perfil, porRaridade, desafiosOcultos, onLigarDesafios, onCompartilharAdesivo }: Props) => {
  const [enviando, setEnviando] = useState<"cor" | "transparente" | null>(null);
  const reduzir = useReducedMotion();
  const navigate = useNavigate();
  const inclinado = useRef<HTMLDivElement>(null);
  if (!badge) return null;

  const ehSequencia = badge.category === "sequencia" && /^sequencia-/.test(badge.id);
  const alvoSequencia = badge.progresso?.alvo ?? 7;
  const f = fracaoDe(badge);
  const rotulo = rotuloProgresso(badge);
  const raridade = raridadeDe(badge);
  const brilha = raridade === "epico" || raridade === "lendario";
  const conta = porRaridade?.[raridade];
  // "1 de 14 épicos do CORE" = quantos dessa raridade a pessoa JÁ tem (a coleção inteira é o total)
  const contaTexto = conta ? `${conta.abertos} de ${conta.total} ${RARIDADE_PLURAL[raridade]} do CORE` : null;
  const destino = badge.rota ?? { caminho: categoriaDe(badge.category).rota, nome: badge.category === "sequencia" || badge.category === "geral" ? "Home" : categoriaDe(badge.category).label };
  const ehDesafio = /^challenger/.test(badge.id);

  const compartilhar = async (transparente = false) => {
    if (!ehSequencia && onCompartilharAdesivo) {
      onCompartilharAdesivo(badge);
      return;
    }
    setEnviando(transparente ? "transparente" : "cor");
    try {
      if (ehSequencia) await compartilharRoseta({ dias: alvoSequencia, nome: perfil.nome, membroDesde: perfil.membroDesde, nivel: perfil.nivel, transparente });
      else await compartilharAdesivo({ id: badge.id, titulo: badge.name, descricao: badge.description, raridade, nome: perfil.nome, membroDesde: perfil.membroDesde });
    } finally {
      setEnviando(null);
    }
  };

  // inclina com o dedo (só épico/lendário conquistado): transform direto no nó, sem re-render
  const inclinar = (ev: PointerEvent<HTMLDivElement>) => {
    const el = inclinado.current;
    if (!el || !brilha || !badge.unlocked || reduzir) return;
    const r = el.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width - 0.5;
    const y = (ev.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${(x * 26).toFixed(1)}deg) rotateX(${(-y * 26).toFixed(1)}deg)`;
  };
  const desinclinar = () => { if (inclinado.current) inclinado.current.style.transform = ""; };

  const colado = desbloqueadoEm
    ? parseLocalDay(desbloqueadoEm).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <Sheet open={!!badge} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="detalhe-adesivo" data-raridade={raridade}>
        <div className="max-w-sm mx-auto text-center pt-3">
          {badge.unlocked ? (
            <motion.div
              className="flex justify-center"
              initial={reduzir ? { opacity: 0 } : { y: -60, rotate: -16, scale: 0.8, opacity: 0 }}
              animate={reduzir ? { opacity: 1 } : { y: 0, rotate: 0, scale: 1, opacity: 1 }}
              transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 240, damping: 14 }}
            >
              {ehSequencia ? (
                <Roseta dias={alvoSequencia} nivel={perfil.nivel} membroDesde={perfil.membroDesde} largura={128} />
              ) : (
                <div ref={inclinado} className="ad-parallax w-[160px] h-[160px] grid place-items-center touch-none" onPointerMove={inclinar} onPointerLeave={desinclinar} onPointerUp={desinclinar} onPointerCancel={desinclinar}>
                  <AdesivoRaro id={badge.id} raridade={raridade} tamanho={144} bordaGrossa giro={-4} titulo={badge.name} />
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex justify-center">
              {/* só a silhueta (como na peça aprovada): o quanto falta mora na caixa de baixo */}
              <div className="relative w-[160px] h-[160px] my-1 grid place-items-center" data-testid="adesivo-trancado" data-rotulo={rotulo ?? undefined}>
                <AdesivoRaro id={badge.id} raridade={raridade} tamanho={144} bordaGrossa trancado titulo={badge.name} />
                {!rotulo && <span className="ad-pill" style={{ right: 6, bottom: 10, height: 24, padding: "0 8px" }}><Lock className="w-3.5 h-3.5" aria-label="Trancado" /></span>}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-center">
            <ChipRaridade raridade={raridade} tam="m" texto={badge.unlocked ? `Adesivo ${RARIDADE_LABEL[raridade]}` : `A caminho · ${RARIDADE_LABEL[raridade]}`} />
          </div>
          <SheetTitle className="text-2xl font-bold tracking-tight mt-1.5">{badge.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground mt-1">{badge.description}</SheetDescription>

          {badge.unlocked ? (
            <>
              {(colado || contaTexto) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {colado ? `Colado no seu planner em ${colado}` : ""}{colado && contaTexto ? " · " : ""}{contaTexto}
                </p>
              )}
              <Button onClick={() => compartilhar(false)} disabled={!!enviando} size="lg" className="w-full h-12 mt-5 gap-2 font-bold">
                {enviando === "cor" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                Compartilhar nos Stories
              </Button>
              {ehSequencia && (
                <button
                  type="button"
                  onClick={() => compartilhar(true)}
                  disabled={!!enviando}
                  className="mt-2 w-full h-11 rounded-xl border border-border text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {enviando === "transparente" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Fundo transparente <span className="font-normal text-muted-foreground">· pra colar na sua foto</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl bg-muted/50 border border-border px-4 py-3 text-left">
                {badge.progresso && (
                  <div className="barra-prox mb-2.5"><i style={{ width: `${Math.round(f * 100)}%` }} /></div>
                )}
                <p className="text-xs text-muted-foreground">
                  Falta: <Destacar texto={textoFalta(badge, diasDeSequencia)} />
                </p>
                <p className="text-[11.5px] text-muted-foreground mt-2">
                  {RARIDADE_LABEL[raridade]}{contaTexto ? ` · ${contaTexto}` : ""} · {RARIDADE_VISUAL[raridade]}
                </p>
              </div>
              {ehDesafio && desafiosOcultos && onLigarDesafios ? (
                <>
                  <Button onClick={onLigarDesafios} size="lg" className="w-full h-12 mt-4 gap-2 font-bold">
                    <Target className="w-4 h-4" /> Ligar os desafios
                  </Button>
                  <p className="text-[11.5px] text-muted-foreground mt-2">Os desafios semanais estão desligados — este adesivo depende deles.</p>
                </>
              ) : (
                <Button onClick={() => { onClose(); navigate(destino.caminho); }} size="lg" className="w-full h-12 mt-4 gap-2 font-bold">
                  Ir pra {destino.nome} <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
