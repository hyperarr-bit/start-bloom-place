import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { ActionId } from "@/components/home/QuickActions";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { Anel } from "./Anel";
import { resumoDoScore } from "./score-itens";
import { explicacaoDoScore, tituloDoScore } from "./PaginaSeuDia";
import { ICONE_DO_TIPO, TRACO, corDoScore, corDoTipo } from "./paleta";

/**
 * A FOLHA "COMO FUNCIONA A PONTUAÇÃO" (opção E) — como a "Pontuação diária · Ótimo equilíbrio 90" do Cal AI.
 * RODADA 3: abre pelo ANEL do card do score (a estrela é o convite); a frase "Faltam N coisas pra fechar o dia"
 * saiu do card e mora aqui, no topo. Depois a dica da sequência ("Pra garantir hoje: <ação>" / "✓ Dia
 * garantido"), e os itens REAIS que compõem o score hoje (score-itens.ts: a mesma conta do hub), cada um
 * com o ícone da família única no disco da cor do tipo, a barra dos pontos e o que falta — o toque leva pra
 * resolver. Leitura sem livro e Suplementos sem cadastro não aparecem. No fim, a regra em duas frases e a
 * porta pra "Personalizar".
 */
interface Props {
  aberta: boolean;
  onFechar: () => void;
  data: LifeHubData;
  seq: Sequencia;
  onAcao: (id: ActionId) => void;
  onPersonalizar: () => void;
}

const dataCurta = (): string => {
  const d = new Date();
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d.getDate()} de ${meses[d.getMonth()]}`;
};

export const FolhaScore = ({ aberta, onFechar, data, seq, onAcao, onPersonalizar }: Props) => {
  const navigate = useNavigate();
  const r = resumoDoScore(data);
  const score = data.dayScore;
  const corAnel = corDoScore(score);
  const mostrados = r.itens.filter((i) => !((i.tipo === "leitura" && !data.currentBook) || (i.tipo === "suplementos" && data.supplementsTotal === 0)));
  const pendentes = mostrados.filter((i) => !i.feito);
  const feitos = mostrados.filter((i) => i.feito);
  const acaoDoDia = seq.acao.texto.replace(/\s+(de\s+)?hoje\b\.?$/i, "");

  const resolver = (i: (typeof r.itens)[number]) => {
    onFechar();
    if (i.action) window.setTimeout(() => onAcao(i.action!), 220);
    else if (i.route) navigate(i.route);
  };

  const Item = ({ i }: { i: (typeof r.itens)[number] }) => {
    const Icone = ICONE_DO_TIPO[i.tipo];
    const c = corDoTipo(i.tipo);
    return (
      <li>
        <button type="button" onClick={() => resolver(i)} data-testid="he-score-item" data-tipo={i.tipo} className="w-full flex items-center gap-3 py-2 -mx-1 px-1 rounded-xl text-left active:bg-muted/50">
          <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: i.feito ? "hsl(var(--muted))" : corDoTipo(i.tipo, 0.13) }} aria-hidden>
            {i.feito ? <Check className="w-4 h-4 text-muted-foreground" strokeWidth={2.5} /> : <Icone className="w-[18px] h-[18px]" strokeWidth={TRACO} style={{ color: c }} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline justify-between gap-2">
              <span className={`text-[14px] font-semibold truncate ${i.feito ? "text-muted-foreground" : ""}`}>{i.nome}</span>
              <span className="text-[12.5px] font-semibold tabular-nums text-muted-foreground shrink-0">{i.pontos}<span className="font-medium text-muted-foreground/70">/{i.max}</span></span>
            </span>
            <span className="block h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${i.max > 0 ? Math.round((i.pontos / i.max) * 100) : 0}%`, background: i.feito ? "hsl(var(--muted-foreground) / 0.45)" : c }} />
            </span>
            <span className="block text-[12px] text-muted-foreground mt-1 truncate">{i.detalhe}</span>
          </span>
          {!i.feito && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />}
        </button>
      </li>
    );
  };

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button
            type="button" aria-label="Fechar" onClick={onFechar}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog" aria-label="Como funciona a pontuação" data-testid="he-folha-score"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <span className="block w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" aria-hidden />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{dataCurta()} · Score do dia</p>
                <h3 className="text-[24px] font-bold tracking-tight leading-tight mt-0.5">{tituloDoScore(score)}</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5" data-testid="he-folha-explica">{explicacaoDoScore(pendentes.length, score)}.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Anel tamanho={64} espessura={7} valor={score} max={100} cor={corAnel} atraso={0.1}>
                  <span className="text-[21px] font-bold tabular-nums tracking-tight">{score}</span>
                </Anel>
                <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mr-1.5 rounded-full grid place-items-center bg-muted"><X className="w-4 h-4" strokeWidth={2.2} /></button>
              </div>
            </div>

            {/* a dica da sequência: o que garante o dia, enquanto não garantido; depois, discreta */}
            {seq.dias > 0 || !seq.hojeFeito ? (
              <button
                type="button"
                onClick={() => { onFechar(); window.setTimeout(() => navigate("/conquistas", { state: { origem: "home" } }), 220); }}
                data-testid="he-folha-sequencia"
                data-garantido={seq.hojeFeito ? "true" : "false"}
                className={`mt-3 w-full min-h-[40px] px-3 rounded-2xl flex items-center gap-2.5 text-left text-[13px] ${seq.hojeFeito ? "bg-muted/50 text-muted-foreground" : "bg-muted"}`}
              >
                {seq.hojeFeito ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} style={{ color: seq.faixa.hojeTexto }} aria-hidden />
                    <span className="font-medium truncate">Dia garantido na sequência</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seq.faixa.meio }} aria-hidden />
                    <span className="truncate text-muted-foreground">{seq.dias > 0 ? "Pra garantir hoje: " : "Comece sua sequência: "}<span className="font-semibold text-foreground">{acaoDoDia}</span></span>
                  </>
                )}
                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            ) : null}

            {pendentes.length > 0 && (
              <>
                <p className="mt-5 mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Ainda falta</p>
                <ul>{pendentes.map((i) => <Item key={i.tipo} i={i} />)}</ul>
              </>
            )}
            {feitos.length > 0 && (
              <>
                <p className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Já contou</p>
                <ul>{feitos.map((i) => <Item key={i.tipo} i={i} />)}</ul>
              </>
            )}

            <div className="mt-5 rounded-2xl bg-muted/60 p-4" data-testid="he-score-como">
              <p className="text-[13.5px] font-bold">Como funciona a pontuação</p>
              <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
                Cada item vale uma parte dos 100 pontos. O que você esconde em Personalizar não conta.
                {!r.somaConfere && " (A conta desta folha ainda não bateu com o número do dia — avise o suporte.)"}
              </p>
            </div>
            <button type="button" onClick={() => { onFechar(); window.setTimeout(onPersonalizar, 220); }} data-testid="he-score-personalizar" className="mt-2 w-full min-h-[48px] px-3 rounded-2xl flex items-center gap-3 text-left active:bg-muted/50">
              <SlidersHorizontal className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={TRACO} aria-hidden />
              <span className="flex-1 text-[14px] font-semibold">Personalizar o que o score cobra</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60" strokeWidth={2} aria-hidden />
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
