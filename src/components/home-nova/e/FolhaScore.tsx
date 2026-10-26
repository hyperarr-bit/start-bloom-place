import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Star, X } from "lucide-react";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { ActionId } from "@/components/home/QuickActions";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { resumoDoScore, type ItemDoScore } from "./score-itens";
import { explicacaoDoScore } from "./PaginaSeuDia";
import { NumeroQueConta } from "./Animacoes";
import { Alca, useFolhaArrastavel, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha } from "./folha-arrasto";
import { ICONE_DO_TIPO, TRACO, corDoTipo, tintaDoTipo } from "./paleta";
import { COR_OURO } from "./Festa100";

/**
 * A FOLHA DO SCORE (opção E) — RODADA 2 (dono, 26/10: "muito carregada → bem simples"): abre já mostrando a
 * composição de forma mínima. Em cima, o número e UMA frase ("Faltam 3 coisas pra fechar o dia"). Depois, uma
 * linha por item: o ícone no disco da cor, o nome, a contagem real ("2/5" nos que contam; nos de sim/não, o ✓
 * discreto no fim quando feito) e uma barrinha do quanto está feito. Sem os pontos (0/20, 15/15), sem "Falta"/
 * "Feito", sem a caixa de regra. Tocar numa linha leva a resolver (o formulário do "+" ou o módulo). No fim, só
 * a porta pra "Personalizar". Abre tocando em QUALQUER parte do card do score.
 * 26/10 (dono): no 100, a mesma lógica do card — o número em ÂMBAR e a estrela âmbar ao lado de "pontos" (nunca um ✓
 * no lugar dela; os ✓ das linhas são dos itens). Parado: a festinha é do card (Festa100.tsx).
 */
interface Props {
  aberta: boolean;
  onFechar: () => void;
  data: LifeHubData;
  seq?: Sequencia;
  onAcao: (id: ActionId) => void;
  onPersonalizar: () => void;
}

/** A contagem real do item ("2/5"); null nos de sim/não. */
export function contagemDoItem(i: ItemDoScore, d: LifeHubData): string | null {
  switch (i.tipo) {
    case "habitos": return d.habits.length > 0 ? `${d.habits.filter((h) => h.done).length}/${d.habits.length}` : null;
    case "agua": return `${d.waterGlasses}/${d.waterGoal}`; // varredura 26/10: o número REAL (15/8), como o formulário
    case "refeicoes": return d.mealsTotal > 0 ? `${Math.min(d.mealsLogged, d.mealsTotal)}/${d.mealsTotal}` : null;
    case "suplementos": return d.supplementsTotal > 0 ? `${Math.min(d.supplementsTaken, d.supplementsTotal)}/${d.supplementsTotal}` : null;
    default: return null;
  }
}

/**
 * Uma linha da folha do score. Varredura 26/10: era declarada DENTRO da FolhaScore — a cada render as linhas eram um
 * componente novo (desmontavam e remontavam), o mesmo risco de clique perdido já corrigido na barra.
 */
const ItemDoScoreLinha = ({ i, data, resolver }: { i: ItemDoScore; data: LifeHubData; resolver: (i: ItemDoScore) => void }) => {
  const Icone = ICONE_DO_TIPO[i.tipo];
  const c = corDoTipo(i.tipo);
  const contagem = contagemDoItem(i, data);
  const fracao = i.max > 0 ? Math.max(0, Math.min(1, i.pontos / i.max)) : 0;
  return (
    <li>
      <button type="button" onClick={() => resolver(i)} data-testid="he-score-item" data-tipo={i.tipo} data-feito={i.feito ? "1" : undefined} className="w-full flex items-center gap-3 h-[52px] -mx-1 px-1 rounded-xl text-left active:bg-muted/50">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: i.feito ? "hsl(var(--muted))" : tintaDoTipo(i.tipo) }} aria-hidden>
          <Icone className="w-[18px] h-[18px]" strokeWidth={TRACO} style={{ color: i.feito ? "hsl(var(--muted-foreground))" : c }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`text-[15px] font-semibold truncate ${i.feito ? "text-muted-foreground" : ""}`}>{i.nome}</span>
            {contagem ? (
              <span className="text-[14px] font-semibold tabular-nums text-muted-foreground shrink-0" data-testid="he-score-contagem">{contagem}</span>
            ) : i.feito ? (
              <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} style={{ color: c }} aria-label="feito" />
            ) : null}
          </span>
          <span className="block h-1 rounded-full bg-muted mt-2 overflow-hidden" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.round(fracao * 100)}%`, background: i.feito ? "hsl(var(--muted-foreground) / 0.35)" : c }} />
          </span>
        </span>
        {!i.feito && <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" strokeWidth={2} aria-hidden />}
      </button>
    </li>
  );
};

export const FolhaScore = ({ aberta, onFechar, data, onAcao, onPersonalizar }: Props) => {
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const arrasto = useFolhaArrastavel(onFechar, !!semMovimento); // rodada 3: arrastar pra baixo fecha
  const r = resumoDoScore(data);
  const score = data.dayScore;
  const mostrados = r.itens.filter((i) => !((i.tipo === "leitura" && !data.currentBook) || (i.tipo === "suplementos" && data.supplementsTotal === 0)));
  const pendentes = mostrados.filter((i) => !i.feito).length;

  const resolver = (i: ItemDoScore) => {
    onFechar();
    if (i.action) window.setTimeout(() => onAcao(i.action!), 220);
    else if (i.route) navigate(i.route);
  };

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button
            type="button" aria-label="Fechar" onClick={onFechar}
            className={CLASSE_FUNDO_FOLHA}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }}
          />
          <motion.div
            role="dialog" aria-label="Score do dia" data-testid="he-folha-score"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(!!semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-1.5" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Score do dia</p>
                <span className="flex items-baseline gap-1.5 mt-0.5">
                  <NumeroQueConta valor={score} className={`text-[40px] leading-none font-bold tabular-nums tracking-[-0.03em] ${score >= 100 ? "text-[color:var(--he-ouro-texto)]" : ""}`} testid="he-folha-numero" />
                  <span className="text-[16px] font-semibold">pontos</span>
                  {score >= 100 && <Star className="w-[18px] h-[18px] self-center ml-0.5" style={{ color: COR_OURO, fill: COR_OURO }} strokeWidth={1.5} aria-hidden data-testid="he-folha-estrela" />}
                </span>
                <p className="text-[14px] text-muted-foreground mt-2" data-testid="he-folha-explica">{explicacaoDoScore(pendentes, score)}.</p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mr-1.5 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>

            <ul className="mt-4" data-testid="he-score-itens">{mostrados.map((i) => <ItemDoScoreLinha key={i.tipo} i={i} data={data} resolver={resolver} />)}</ul>

            <button type="button" onClick={() => { onFechar(); window.setTimeout(onPersonalizar, 220); }} data-testid="he-score-personalizar" className="mt-3 w-full h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-muted-foreground active:bg-muted/50">
              Personalizar o que conta <ChevronRight className="w-4 h-4 text-muted-foreground/60" strokeWidth={2} aria-hidden />
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
