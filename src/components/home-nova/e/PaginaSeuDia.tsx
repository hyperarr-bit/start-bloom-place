import { CalendarCheck, Check, Droplets, PenLine, Pill, Star, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { ActionId } from "@/components/home/QuickActions";
import type { TipoPendencia } from "@/lib/home-pendencias";
import { COPO_ML_PADRAO, unidadeDaAgua } from "@/lib/saude-copo";
import { Anel } from "./Anel";
import { MATIZ_DO_MODULO, MATIZ_DO_TIPO, TRACO, cor, corDoScore } from "./paleta";

/**
 * PÁGINA 1 DO CARROSSEL — "SEU DIA" (opção E). O conjunto do Cal AI, ajustado ao CORE.
 *
 * RODADA 3 (dono: "quanto menos informação melhor"):
 *  - o CARD GRANDE é só o número: "27 pontos" (os dois em preto) e, embaixo, "Score do dia" em cinza — como
 *    "2276 /2616 · Calorias consumidas" no Cal AI. Saíram "Faltam N coisas pra fechar o dia" e o "?". À direita
 *    o anel com a ESTRELA, que é o convite: tocar nele abre a folha "Como funciona a pontuação" (e a frase
 *    "faltam N coisas" mora lá, no topo). No 100 a estrela vira ✓.
 *  - os 3 CARDS PEQUENOS continuam Hábitos (20 pts), Água (15) e Refeições (10) — as três contas "x de y"
 *    que existem pra todo mundo, 45 dos 100 pontos num olhar —, agora com o anel e o ícone na cor do módulo
 *    de origem da paleta única (verde-água, céu, sálvia) e traço 1,75. Fila de reserva, se a pessoa ocultar
 *    um tipo em Personalizar: Suplementos (x de y, quando cadastrados) e Registros do dia (x de 6).
 */
export interface Metrica {
  id: TipoPendencia | "registros";
  rotulo: string;
  valor: number;
  max: number;
  Icone: typeof Droplets;
  matiz: number;
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
    cobra("habitos") ? { id: "habitos", rotulo: d.habits.length ? "Hábitos feitos" : "Hábitos · crie o 1º", valor: d.habits.filter((h) => h.done).length, max: d.habits.length, Icone: CalendarCheck, matiz: MATIZ_DO_TIPO.habitos, route: "/rotina" } : null,
    cobra("agua") ? { id: "agua", rotulo: `${unidade.charAt(0).toUpperCase()}${unidade.slice(1)} de água`, valor: Math.min(d.waterGlasses, d.waterGoal), max: d.waterGoal, Icone: Droplets, matiz: MATIZ_DO_TIPO.agua, action: "water" } : null,
    cobra("refeicoes") ? { id: "refeicoes", rotulo: "Refeições registradas", valor: Math.min(d.mealsLogged, d.mealsTotal), max: d.mealsTotal, Icone: Utensils, matiz: MATIZ_DO_TIPO.refeicoes, route: "/dieta" } : null,
    cobra("suplementos") && d.supplementsTotal > 0 ? { id: "suplementos", rotulo: "Suplementos tomados", valor: Math.min(d.supplementsTaken, d.supplementsTotal), max: d.supplementsTotal, Icone: Pill, matiz: MATIZ_DO_TIPO.suplementos, route: "/saude" } : null,
    registrosCobrados.length > 0 ? { id: "registros", rotulo: "Registros do dia", valor: registrosCobrados.filter((t) => reg[t]).length, max: registrosCobrados.length, Icone: PenLine, matiz: MATIZ_DO_MODULO.desenvolvimento, abreMais: true } : null,
  ];
  return fila.filter((m): m is Metrica => !!m).slice(0, 3);
}

interface PropsScore {
  score: number;
  onAbrir: () => void;
  /** variação: o número DENTRO do anel (como o anel de hoje) e o título da faixa no lugar dele */
  numeroDentro?: boolean;
}

export const CardScoreE = ({ score, onAbrir, numeroDentro }: PropsScore) => {
  const completo = score >= 100;
  const corAnel = corDoScore(score);
  return (
    <section className="hn-card he-score p-5 flex items-center gap-4" data-testid="he-score" aria-label="Score do dia" data-numero={numeroDentro ? "dentro" : "fora"}>
      <div className="flex-1 min-w-0">
        {numeroDentro ? (
          <span className="block text-[24px] leading-tight font-bold tracking-tight" data-testid="he-score-titulo">{tituloDoScore(score)}</span>
        ) : (
          <span className="flex items-baseline gap-1.5">
            <span className="text-[46px] leading-[0.95] font-bold tabular-nums tracking-[-0.035em]" data-testid="he-score-numero">{score}</span>
            <span className="text-[18px] font-semibold text-foreground">pontos</span>
          </span>
        )}
        <span className="block mt-1.5 text-[15px] leading-snug font-medium text-muted-foreground" data-testid="hn-score-explica">Score do dia</span>
      </div>
      {/* a estrela dentro do anel é o convite: tocar abre "Como funciona a pontuação" */}
      <button type="button" onClick={onAbrir} aria-label="Como funciona a pontuação" data-testid="he-score-abrir" className="shrink-0 rounded-full active:scale-95 transition-transform">
        <Anel tamanho={108} espessura={11} valor={score} max={100} cor={corAnel} testid="hn-anel">
          {numeroDentro ? (
            <span className="flex flex-col items-center justify-center">
              <span className="text-[30px] leading-none font-bold tabular-nums tracking-tight" data-testid="he-score-numero">{score}</span>
              <span className="text-[9.5px] mt-1 text-muted-foreground font-semibold uppercase tracking-[0.12em]">pontos</span>
            </span>
          ) : completo
            ? <Check className="w-9 h-9" strokeWidth={2.5} style={{ color: corAnel }} aria-hidden />
            : <Star className="w-8 h-8" style={{ color: corAnel, fill: corAnel }} strokeWidth={1.5} aria-hidden />}
        </Anel>
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
  const c = cor(m.matiz);
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
      className="hn-card !rounded-[22px] p-3.5 flex flex-col items-start text-left min-h-[148px] active:scale-[0.98] transition-transform"
    >
      <span className="flex items-baseline gap-1">
        <span className="text-[23px] leading-none font-bold tabular-nums tracking-[-0.02em]">{m.valor}</span>
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums">/{m.max}</span>
      </span>
      <span className="mt-1.5 text-[12px] leading-[1.25] text-muted-foreground line-clamp-2 min-h-[30px]">{m.rotulo}</span>
      <span className="mt-auto self-center pt-1.5">
        <Anel tamanho={62} espessura={7} valor={m.valor} max={m.max} cor={c} atraso={atraso}>
          {completo
            ? <Check className="w-5 h-5" strokeWidth={2.5} style={{ color: c }} aria-hidden />
            : <m.Icone className="w-[21px] h-[21px]" strokeWidth={TRACO} style={{ color: c }} aria-hidden />}
        </Anel>
      </span>
    </button>
  );
};

interface Props {
  data: LifeHubData;
  onAbrirScore: () => void;
  onAcao: (id: ActionId) => void;
  onMais: () => void;
  numeroDentro?: boolean;
  copoMl?: number;
}

export const PaginaSeuDia = ({ data, onAbrirScore, onAcao, onMais, numeroDentro, copoMl }: Props) => {
  const metricas = metricasDoDia(data, copoMl);
  return (
    <div className="he-pagina" data-testid="he-pagina-1">
      <CardScoreE score={data.dayScore} onAbrir={onAbrirScore} numeroDentro={numeroDentro} />
      <div className="grid grid-cols-3 gap-3 mt-3 flex-1">
        {metricas.map((m, i) => <CardMetrica key={m.id} m={m} atraso={0.3 + i * 0.1} onAcao={onAcao} onMais={onMais} />)}
      </div>
    </div>
  );
};
