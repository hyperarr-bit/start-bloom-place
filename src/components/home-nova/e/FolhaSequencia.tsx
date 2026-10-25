import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Snowflake, X } from "lucide-react";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { semanaDaSequencia, type DiaDaSemana } from "@/lib/sequencia-semana";
import { fraseDaProximaFaixa, proximaFaixa } from "@/lib/fogo-sequencia";
import { trackEvent } from "@/lib/analytics";
import { FogoChapado, TOM_DA_FAIXA } from "./FogoChapado";
import { TOM_DO_MODULO, cor, tinta } from "./paleta";

/**
 * A FOLHA DA SEQUÊNCIA (1.0.19) — abre no toque da pílula do fogo da Home nova (Conquistas já é aba na barra).
 * No estilo das outras folhas da E, a partir do mockup do Codex: "Um dia de cada vez" · a frase do que conta ·
 * o fogo chapado grande (a cor da faixa; apagado/aceso de verdade) · "27 dias" · "Constância é voltar para você."
 * · a SEMANA ATUAL (S T Q Q S S D) com o estado real de cada dia (lib/sequencia-semana: anotado = ✓ na cor da
 * faixa; perdido = vazio; hoje sem nada = anel tracejado; futuro = só a letra; protegido = gelo) · embaixo, se
 * hoje ainda não conta, a ação do dia da pessoa ("Pra continuar hoje: …", lib/acao-do-dia) com o toque que leva
 * a fazer; se já conta, "✓ Hoje já conta." e a próxima faixa ("Faltam 3 dias pro fogo azul"). No fim, "Ver
 * conquistas", discreto. Eventos: sequencia_folha_aberta, sequencia_folha_acao.
 */
interface Props {
  aberta: boolean;
  onFechar: () => void;
  seq: Sequencia;
}

const LETRA: Record<string, string> = { SEG: "S", TER: "T", QUA: "Q", QUI: "Q", SEX: "S", SÁB: "S", DOM: "D" };
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const Dia = ({ d, seq }: { d: DiaDaSemana; seq: Sequencia }) => {
  const t = TOM_DA_FAIXA[seq.faixa.id] ?? TOM_DO_MODULO.dieta;
  const base = "w-9 h-9 rounded-full grid place-items-center";
  let disco: React.ReactNode;
  if (d.estado === "feito") disco = <span className={base} style={{ background: tinta(t) }}><Check className="w-[18px] h-[18px]" strokeWidth={2.6} style={{ color: cor(t) }} aria-hidden /></span>;
  else if (d.estado === "gelo") disco = <span className={`${base} bg-sky-400/15 dark:bg-sky-400/20`}><Snowflake className="w-4 h-4 text-sky-600 dark:text-sky-300" strokeWidth={2.2} aria-hidden /></span>;
  else if (d.estado === "hoje") disco = <span className={`${base} border-[1.5px] border-dashed`} style={{ borderColor: cor(t) }} />;
  else if (d.estado === "vazio") disco = <span className={`${base} border-[1.5px] border-foreground/12`} />;
  else disco = <span className={base} />;
  return (
    <div className="flex flex-col items-center gap-2" data-testid="he-seq-dia" data-estado={d.estado} data-hoje={d.ehHoje ? "1" : "0"}>
      <span className={`text-[12px] leading-none font-semibold ${d.ehHoje ? "text-foreground" : "text-muted-foreground"}`}>{LETRA[d.rotulo] ?? d.rotulo.charAt(0)}</span>
      {disco}
    </div>
  );
};

export const FolhaSequencia = ({ aberta, onFechar, seq }: Props) => {
  const navigate = useNavigate();
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  const estado = seq.dias <= 0 ? "neutro" : seq.hojeFeito ? "aceso" : "apagado";
  const proxima = proximaFaixa(seq.dias);
  const frase = fraseDaProximaFaixa(seq.dias);
  const acao = seq.acao.texto.replace(/\s+(de\s+)?hoje\b\.?$/i, "").trim();

  useEffect(() => {
    if (aberta) trackEvent("sequencia_folha_aberta", { dias: seq.dias, garantido: seq.hojeFeito, faixa: seq.faixa.id });
  }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const fazer = () => {
    trackEvent("sequencia_folha_acao", { acao: seq.acao.id, destino: seq.acao.rota, dias: seq.dias });
    onFechar();
    window.setTimeout(() => navigate(seq.acao.rota), 180);
  };
  const conquistas = () => {
    trackEvent("sequencia_folha_acao", { acao: "conquistas", destino: "/conquistas", dias: seq.dias });
    onFechar();
    window.setTimeout(() => navigate("/conquistas", { state: { origem: "home" } }), 180);
  };

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div
            role="dialog" aria-label="Sua sequência" data-testid="he-folha-sequencia" data-garantido={seq.hojeFeito ? "1" : "0"}
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-6 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <span className="block w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[22px] font-bold tracking-tight leading-tight">Um dia de cada vez</h3>
                <p className="text-[14px] text-muted-foreground mt-1 leading-snug">Cada dia em que você registra algo conta para a sua sequência.</p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mr-1.5 mt-0.5 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>

            <div className="flex flex-col items-center mt-7">
              <FogoChapado faixa={seq.faixa} estado={estado} tamanho={72} />
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[44px] leading-none font-bold tabular-nums tracking-[-0.03em]" data-testid="he-seq-dias">{seq.dias}</span>
                <span className="text-[18px] font-medium text-muted-foreground">{seq.dias === 1 ? "dia" : "dias"}</span>
              </p>
              <p className="mt-2 text-[14px] text-muted-foreground">Constância é voltar para você.</p>
              {seq.recorde > seq.dias && <p className="mt-1 text-[12px] text-muted-foreground/80" data-testid="he-seq-recorde">Seu recorde: {seq.recorde} dias</p>}
            </div>

            <div className="mt-7 grid grid-cols-7 gap-1" data-testid="he-seq-semana">
              {semana.map((d) => <Dia key={d.dia} d={d} seq={seq} />)}
            </div>

            <div className="mt-7">
              {seq.hojeFeito ? (
                <div className="rounded-2xl bg-muted/60 px-4 py-3.5" data-testid="he-seq-garantido">
                  <p className="flex items-center gap-2 text-[15px] font-semibold"><Check className="w-[18px] h-[18px]" strokeWidth={2.6} style={{ color: cor(TOM_DA_FAIXA[seq.faixa.id] ?? TOM_DO_MODULO.dieta) }} aria-hidden />Hoje já conta.</p>
                  <p className="text-[13px] text-muted-foreground mt-1">{frase && proxima ? capitalizar(frase) + "." : "Você está no fogo dourado — o topo."}</p>
                </div>
              ) : acao ? (
                <button type="button" onClick={fazer} data-testid="he-seq-acao" className="w-full rounded-2xl bg-muted/60 px-4 py-3.5 flex items-center gap-3 text-left active:bg-muted">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pra continuar hoje</span>
                    <span className="block text-[15px] font-semibold mt-0.5">{capitalizar(acao)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" strokeWidth={2} aria-hidden />
                </button>
              ) : (
                <p className="text-[14px] text-muted-foreground leading-snug" data-testid="he-seq-acao-generica">Registre um cuidado no seu dia para continuar. Pode ser um copo d'água, um hábito ou uma tarefa.</p>
              )}
            </div>

            <button type="button" onClick={conquistas} data-testid="he-seq-conquistas" className="mt-4 w-full min-h-[44px] text-[13px] font-semibold text-muted-foreground flex items-center justify-center gap-1">
              Ver conquistas <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
