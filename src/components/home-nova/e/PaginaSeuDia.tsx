import type { CSSProperties } from "react";
import { Apple, CalendarCheck, Check, ChevronRight, Droplets, PenLine, Pill, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import type { ActionId } from "@/components/home/QuickActions";
import type { TipoPendencia } from "@/lib/home-pendencias";
import { COPO_ML_PADRAO, unidadeDaAgua } from "@/lib/saude-copo";
import { Anel } from "./Anel";
import type { CorDoTipo } from "./score-itens";

/**
 * PÁGINA 1 DO CARROSSEL — "SEU DIA" (opção E, 25/10). O conjunto do Cal AI, ajustado ao CORE:
 *
 *  - o CARD GRANDE é o Score do Dia: o número grande à esquerda ("27 pontos"), a frase que explica o
 *    número em coisas ("Faltam 5 coisas pra fechar o dia" — a conta real das pendências) e a linha da
 *    sequência de hoje; à direita o anel, maior que o de hoje, com a estrela dos pontos no meio
 *    (no 100 vira ✓ verde). Tocar no card abre a folha "Como funciona a pontuação".
 *  - os 3 CARDS PEQUENOS são as três contas "x de y" que o app tem pra TODO MUNDO, e que mais pesam no
 *    score depois do treino: Hábitos (20 pts), Água (15) e Refeições (10) — 45 dos 100 pontos num olhar.
 *    Treino não entra aqui porque não é "x de y" (é feito / pendente / descanso) — vai pra página dos
 *    widgets. Se a pessoa ocultou um desses tipos em Personalizar, o lugar é preenchido pelo próximo
 *    da fila: Suplementos (x de y, quando cadastrados) e Registros do dia (x de 6: humor, gasto, peso,
 *    sono, ideia, gratidão).
 */
export interface Metrica {
  id: TipoPendencia | "registros";
  rotulo: string;
  valor: number;
  max: number;
  Icone: typeof Droplets;
  cor: CorDoTipo;
  route?: string;
  action?: ActionId;
  /** toque abre o "+" na grade (registros) */
  abreMais?: boolean;
}

export const tituloDoScore = (score: number): string =>
  score >= 100 ? "Dia completo!" : score >= 70 ? "Quase lá!" : score >= 30 ? "Bom ritmo!" : score > 0 ? "Vamos lá!" : "Dia começando";

export const explicacaoDoScore = (faltam: number, score: number): string => {
  if (score >= 100) return "Tudo feito por hoje";
  if (faltam === 0) return "Nada pendente por aqui";
  return faltam === 1 ? "Falta 1 coisa pra fechar o dia" : `Faltam ${faltam} coisas pra fechar o dia`;
};

/** As três métricas da página 1, pelos dados do dia e pelo que a pessoa cobra. `copoMl` dá a unidade da água (copos/garrafas). */
export function metricasDoDia(d: LifeHubData, copoMl: number = COPO_ML_PADRAO): Metrica[] {
  const cobra = (t: TipoPendencia) => !d.pendenciasCobradas || d.pendenciasCobradas.includes(t);
  const reg = d.registrosHoje ?? { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false };
  const registrosCobrados = (["humor", "gasto", "peso", "sono", "ideia", "gratidao"] as const).filter((t) => cobra(t));
  const unidade = unidadeDaAgua(copoMl);
  const fila: (Metrica | null)[] = [
    cobra("habitos") ? { id: "habitos", rotulo: d.habits.length ? "Hábitos feitos" : "Hábitos · crie o 1º", valor: d.habits.filter((h) => h.done).length, max: d.habits.length, Icone: CalendarCheck, cor: "emerald", route: "/rotina" } : null,
    cobra("agua") ? { id: "agua", rotulo: `${unidade.charAt(0).toUpperCase()}${unidade.slice(1)} de água`, valor: Math.min(d.waterGlasses, d.waterGoal), max: d.waterGoal, Icone: Droplets, cor: "cyan", action: "water" } : null,
    cobra("refeicoes") ? { id: "refeicoes", rotulo: "Refeições registradas", valor: Math.min(d.mealsLogged, d.mealsTotal), max: d.mealsTotal, Icone: Apple, cor: "green", route: "/dieta" } : null,
    cobra("suplementos") && d.supplementsTotal > 0 ? { id: "suplementos", rotulo: "Suplementos tomados", valor: Math.min(d.supplementsTaken, d.supplementsTotal), max: d.supplementsTotal, Icone: Pill, cor: "red", route: "/saude" } : null,
    registrosCobrados.length > 0 ? { id: "registros", rotulo: "Registros do dia", valor: registrosCobrados.filter((t) => reg[t]).length, max: registrosCobrados.length, Icone: PenLine, cor: "purple", abreMais: true } : null,
  ];
  return fila.filter((m): m is Metrica => !!m).slice(0, 3);
}

const corVar = (c: CorDoTipo) => `var(--he-c-${c})`;

interface PropsScore {
  score: number;
  faltam: number;
  seq: Sequencia;
  onAbrir: () => void;
  /** variação: o número DENTRO do anel (como o anel de hoje) e o título da faixa no lugar dele */
  numeroDentro?: boolean;
}

export const CardScoreE = ({ score, faltam, seq, onAbrir, numeroDentro }: PropsScore) => {
  const navigate = useNavigate();
  const completo = score >= 100;
  const corAnel = score >= 80 ? "hsl(var(--success))" : "hsl(var(--score-ring, var(--warning)))";
  const acao = seq.acao.texto.replace(/\s+(de\s+)?hoje\b\.?$/i, "");
  return (
    <section className="hn-card he-score px-5 pt-5 pb-3.5" data-testid="he-score" aria-label="Score do dia" data-numero={numeroDentro ? "dentro" : "fora"}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={onAbrir} data-testid="he-score-abrir" className="flex-1 min-w-0 text-left rounded-xl -m-1 p-1 active:bg-muted/50">
          {numeroDentro ? (
            <span className="block text-[24px] leading-tight font-bold tracking-tight" data-testid="he-score-titulo">{tituloDoScore(score)}</span>
          ) : (
            <span className="flex items-baseline gap-1.5">
              <span className={`text-[46px] leading-[0.95] font-bold tabular-nums tracking-[-0.035em]${completo ? " text-success" : ""}`} data-testid="he-score-numero">{score}</span>
              <span className="text-[17px] font-medium text-muted-foreground">pontos</span>
            </span>
          )}
          <span className={`block ${numeroDentro ? "mt-1.5 text-[14.5px] text-muted-foreground" : "mt-2 text-[14.5px] text-foreground/85"} leading-[1.3] font-medium [text-wrap:balance]`} data-testid="hn-score-explica">
            {explicacaoDoScore(faltam, score)}
            <ChevronRight className="inline-block w-4 h-4 ml-0.5 -mt-0.5 align-middle text-muted-foreground/60" aria-hidden />
          </span>
        </button>
        <button type="button" onClick={onAbrir} aria-label="Como funciona a pontuação" className="shrink-0 rounded-full active:scale-95 transition-transform">
          <Anel tamanho={108} espessura={11} valor={score} max={100} cor={corAnel} testid="hn-anel">
            {numeroDentro ? (
              <span className="flex flex-col items-center justify-center">
                <span className={`text-[30px] leading-none font-bold tabular-nums tracking-tight${completo ? " text-success" : ""}`} data-testid="he-score-numero">{score}</span>
                <span className="text-[9.5px] mt-1 text-muted-foreground font-semibold uppercase tracking-[0.12em]">pontos</span>
              </span>
            ) : completo
              ? <Check className="w-9 h-9 text-success" strokeWidth={3} aria-hidden />
              : <Star className="w-8 h-8" style={{ color: corAnel, fill: corAnel }} strokeWidth={1.5} aria-hidden />}
          </Anel>
        </button>
      </div>
      {/* a sequência de hoje, na largura toda (sem divisória): garantida ✓ ou a ação do dia da pessoa */}
      <button
        type="button"
        onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
        data-testid="hn-linha-sequencia"
        className="mt-2.5 -ml-1 pl-1 pr-1 w-[calc(100%+4px)] min-h-[34px] flex items-center gap-2 text-left text-[13px] rounded-lg active:bg-muted/50"
      >
        {seq.hojeFeito ? (
          <>
            <span className="w-5 h-5 rounded-full grid place-items-center shrink-0" style={{ background: `${seq.faixa.meio}22` }}>
              <Check className="w-3 h-3" strokeWidth={3.2} style={{ color: seq.faixa.hojeTexto }} aria-hidden />
            </span>
            <span className="font-semibold truncate text-[var(--seq-c)] dark:text-[var(--seq-cd)]" style={{ "--seq-c": seq.faixa.hojeTexto, "--seq-cd": seq.faixa.hojeTextoEscuro } as CSSProperties}>Dia garantido na sequência</span>
          </>
        ) : (
          <>
            <span className="w-5 h-5 rounded-full grid place-items-center shrink-0 bg-muted">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: seq.faixa.meio }} />
            </span>
            <span className="text-muted-foreground truncate">
              {seq.dias > 0 ? "Pra garantir hoje: " : "Comece sua sequência: "}<span className="font-semibold text-foreground">{acao}</span>
            </span>
          </>
        )}
        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50 shrink-0" aria-hidden />
      </button>
    </section>
  );
};

interface PropsMetrica {
  m: Metrica;
  atraso: number;
  onAcao: (id: ActionId) => void;
  onMais: () => void;
}

export const CardMetrica = ({ m, atraso, onAcao, onMais }: PropsMetrica) => {
  const navigate = useNavigate();
  const completo = m.max > 0 && m.valor >= m.max;
  const tocar = () => {
    if (m.abreMais) return onMais();
    if (m.action) return onAcao(m.action);
    if (m.route) navigate(m.route);
  };
  return (
    <button
      type="button"
      onClick={tocar}
      data-testid="he-metrica"
      data-metrica={m.id}
      className="hn-card !rounded-[22px] p-3.5 pb-4 flex flex-col items-start text-left min-h-[150px] active:scale-[0.98] transition-transform"
    >
      <span className="flex items-baseline gap-1">
        <span className="text-[23px] leading-none font-bold tabular-nums tracking-[-0.02em]">{m.valor}</span>
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums">/{m.max}</span>
      </span>
      <span className="mt-1.5 text-[12px] leading-[1.25] text-muted-foreground line-clamp-2 min-h-[30px]">{m.rotulo}</span>
      <span className="mt-auto self-center pt-2">
        <Anel tamanho={62} espessura={7} valor={m.valor} max={m.max} cor={corVar(m.cor)} atraso={atraso}>
          {completo
            ? <Check className="w-5 h-5" strokeWidth={3} style={{ color: corVar(m.cor) }} aria-hidden />
            : <m.Icone className="w-[21px] h-[21px]" strokeWidth={2.2} style={{ color: corVar(m.cor) }} aria-hidden />}
        </Anel>
      </span>
    </button>
  );
};

interface Props {
  data: LifeHubData;
  faltam: number;
  seq: Sequencia;
  onAbrirScore: () => void;
  onAcao: (id: ActionId) => void;
  onMais: () => void;
  numeroDentro?: boolean;
  copoMl?: number;
}

export const PaginaSeuDia = ({ data, faltam, seq, onAbrirScore, onAcao, onMais, numeroDentro, copoMl }: Props) => {
  const metricas = metricasDoDia(data, copoMl);
  return (
    <div className="he-pagina" data-testid="he-pagina-1">
      <CardScoreE score={data.dayScore} faltam={faltam} seq={seq} onAbrir={onAbrirScore} numeroDentro={numeroDentro} />
      <div className="grid grid-cols-3 gap-3 mt-3 flex-1">
        {metricas.map((m, i) => <CardMetrica key={m.id} m={m} atraso={0.3 + i * 0.1} onAcao={onAcao} onMais={onMais} />)}
      </div>
    </div>
  );
};
