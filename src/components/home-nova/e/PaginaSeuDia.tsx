import { BookOpen, CalendarCheck, Check, Droplets, Dumbbell, Moon, PenLine, Pill, Plus, Utensils, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LifeHubData, RegistrosHoje } from "@/hooks/use-life-hub-data";
import type { ActionId } from "@/components/home/QuickActions";
import type { TipoPendencia } from "@/lib/home-pendencias";
import { COPO_ML_PADRAO, unidadeDaAgua } from "@/lib/saude-copo";
import { RESUMOS_PADRAO, type IdDoResumo } from "@/lib/home-resumos";
import { ORDEM_DA_LISTA } from "@/lib/pendencias-novato";
import { Anel } from "./Anel";
import { Entrada, NumeroQueConta } from "./Animacoes";
import { ICONE_DO_TIPO, TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, type Tom } from "./paleta";
import { EcoDoAnel, EstrelaFesta, corDaFase, useFesta100 } from "./Festa100";

/**
 * PÁGINA 1 DO CARROSSEL — "SEU DIA" (opção E). O conjunto do Cal AI, ajustado ao CORE.
 *
 * RODADA 3 (dono: "quanto menos informação melhor"):
 *  - o CARD GRANDE é só o número: "27 /100 pontos" (V7, 26/10: número preto, "/100 pontos" cinza na mesma linha) e, embaixo, "Score do dia" em cinza — como
 *    "2276 /2616 · Calorias consumidas" no Cal AI. Saíram "Faltam N coisas pra fechar o dia" e o "?". À direita
 *    o anel com a ESTRELA, que é o convite: tocar nele abre a folha "Como funciona a pontuação" (e a frase
 *    "faltam N coisas" mora lá, no topo). RODADA 4: anel e estrela em TINTA (grafite;
 *    no escuro a tinta clara do "+"), como o anel preto do Cal AI; trilho cinza claro.
 *    26/10 (dono: "o Cal AI não muda o símbolo quando bate 100"): no 100 a estrela FICA (nada de ✓); estrela, anel
 *    e número viram ÂMBAR (o laranja do score antigo) com a festinha de ~0,9 s, 1x por dia (Festa100.tsx).
 *  - os 3 CARDS PEQUENOS continuam Hábitos (20 pts), Água (15) e Refeições (10) — as três contas "x de y"
 *    que existem pra todo mundo, 45 dos 100 pontos num olhar —, com o anel e o ícone na cor do módulo de
 *    origem da paleta única (verde-água, céu, sálvia) e traço 1,75. RODADA 4: só o nome, uma palavra
 *    ("Hábitos", "Água", "Refeições"; na fila de reserva, "Suplementos" e "Registros").
 *  - 1.0.20 (dono 27/10): na CONTA NOVA (primeiros 7 dias) que não escolheu resumos, os 3 cards são o que CONTA no score
 *    dela, na ordem da lista (dia 1 da missão: Hábitos · Água · Gasto); faltando card, o padrão entra em CONVITE
 *    (tracejado + "+") — metricasDoNovato.
 */
export interface Metrica {
  id: TipoPendencia | "registros";
  rotulo: string;
  valor: number;
  max: number;
  Icone: typeof Droplets;
  tom: Tom;
  route?: string;
  action?: ActionId;
  /** toque abre o "+" na grade (registros) */
  abreMais?: boolean;
  /** 1.0.20 (conta nova): o card é um CONVITE — anel tracejado com "+", como o "Criar hábito" — de um tipo que ainda NÃO
   *  conta no score dela (nunca um "0/4" do lado do número); o valor é o texto do convite */
  convite?: string;
}

export const tituloDoScore = (score: number): string =>
  score >= 100 ? "Dia completo!" : score >= 70 ? "Quase lá!" : score >= 30 ? "Bom ritmo!" : score > 0 ? "Vamos lá!" : "Dia começando";

export const explicacaoDoScore = (faltam: number, score: number): string => {
  if (score >= 100) return "Tudo feito por hoje";
  if (faltam === 0) return "Nada pendente por aqui";
  return faltam === 1 ? "Falta 1 coisa pra fechar o dia" : `Faltam ${faltam} coisas pra fechar o dia`;
};

/** 1.0.20: o nome de uma palavra de cada tipo (os cards do que conta, na conta nova — RODADA 4: "só o nome"). */
const ROTULO_DO_TIPO: Record<TipoPendencia, string> = {
  habitos: "Hábitos", treino: "Treino", agua: "Água", refeicoes: "Refeições", suplementos: "Suplementos", leitura: "Leitura",
  humor: "Humor", gasto: "Gasto", peso: "Peso", sono: "Sono", ideia: "Ideia", gratidao: "Gratidão",
};
/** O formulário do "+" que cada registro de sim/não abre (o mesmo da linha da lista). */
const ACAO_DO_REGISTRO: Record<keyof RegistrosHoje, ActionId> = { humor: "mood", gasto: "expense", peso: "weight", sono: "sleep", ideia: "idea", gratidao: "gratitude" };
/** 1.0.20: o texto do CONVITE dos cards do padrão (Hábitos · Água · Refeições) que ainda não contam pra conta nova. Cabe
 *  numa linha no card de 375 pt (iPhone SE/mini: ~78 pt de texto; "Anotar refeição" cortava). Refeições = "Criar plano",
 *  como o "+" sem plano ("Planejar na Dieta") e o CRIAR_DO_RESUMO. */
export const CONVITE_DO_PADRAO: Record<"habitos" | "agua" | "refeicoes", string> = { habitos: "Criar hábito", agua: "Anotar copo", refeicoes: "Criar plano" };

/**
 * As três métricas da página 1, pelos dados do dia e pelo que a pessoa cobra. `copoMl` dá a unidade da água.
 * RODADA 2: `resumos` são os cards que a pessoa escolheu em Você › Personalizar início (lib/home-resumos: até 3,
 * entre Hábitos · Água · Refeições · Sono · Gasto · Treino · Leitura); sem escolha (null), os 3 de sempre. Os que a
 * pessoa ocultou em Personalizar pendências saem; se sobrar vaga, entram Suplementos e Registros como antes.
 * 1.0.20 (dono 27/10): na CONTA NOVA nos primeiros 7 dias (o hub manda `pendenciasNovato`) e SEM escolha, os cards são
 * os do que CONTA no score dela (metricasDoNovato). Quem escolheu mantém a escolha; conta antiga/admin: nada muda.
 * Tocar num card ABRE o registro/detalhe — nunca registra sozinho (água abre o formulário da água, com o "+ 1 copo").
 */
export function metricasDoDia(d: LifeHubData, copoMl: number = COPO_ML_PADRAO, resumos: IdDoResumo[] | null = null): Metrica[] {
  // 1.0.19 (novato polido): o que a conta nova ESCOLHEU aparece mesmo sem contar no score dela (é a escolha dela) — por
  // isso os cards escolhidos leem a conta de sempre; o que só COMPLETA a fila (a reserva) segue o score (`contaNoScore`)
  const base = d.pendenciasCobradasSemNovato ?? d.pendenciasCobradas;
  const cobra = (t: TipoPendencia) => !base || base.includes(t);
  // o que conta no score (na conta nova = a lista; nas outras contas é o mesmo `base`)
  const contaNoScore = (t: TipoPendencia) => !d.pendenciasCobradas || d.pendenciasCobradas.includes(t);
  const reg = d.registrosHoje ?? { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false };
  const registrosCobrados = (["humor", "gasto", "peso", "sono", "ideia", "gratidao"] as const).filter((t) => contaNoScore(t));
  // (a unidade da água — copos/garrafas — não aparece mais no rótulo; segue valendo no "x/y" e nas pendências)
  void unidadeDaAgua(copoMl);
  const porId: Record<IdDoResumo, Metrica | null> = {
    habitos: cobra("habitos") ? { id: "habitos", rotulo: "Hábitos", valor: d.habits.filter((h) => h.done).length, max: d.habits.length, Icone: CalendarCheck, tom: TOM_DO_TIPO.habitos, route: "/rotina" } : null,
    // varredura 26/10: a água mostra o número REAL (15/8, como o formulário); o anel enche e para na meta (Anel limita)
    agua: cobra("agua") ? { id: "agua", rotulo: "Água", valor: d.waterGlasses, max: d.waterGoal, Icone: Droplets, tom: TOM_DO_TIPO.agua, action: "water" } : null,
    refeicoes: cobra("refeicoes") ? { id: "refeicoes", rotulo: "Refeições", valor: Math.min(d.mealsLogged, d.mealsTotal), max: d.mealsTotal, Icone: Utensils, tom: TOM_DO_TIPO.refeicoes, route: "/dieta" } : null,
    sono: { id: "sono", rotulo: "Sono", valor: Math.min(8, Math.max(0, Math.round(d.sleepHours ?? 0))), max: 8, Icone: Moon, tom: TOM_DO_TIPO.sono, action: "sleep" },
    financas: { id: "gasto", rotulo: "Gasto", valor: reg.gasto ? 1 : 0, max: 1, Icone: Wallet, tom: TOM_DO_TIPO.gasto, action: "expense" },
    treino: { id: "treino", rotulo: "Treino", valor: d.workoutDone ? 1 : 0, max: 1, Icone: Dumbbell, tom: TOM_DO_TIPO.treino, action: "workout" },
    leitura: { id: "leitura", rotulo: "Leitura", valor: d.leuHoje ? 1 : 0, max: 1, Icone: BookOpen, tom: TOM_DO_MODULO.biblioteca, route: "/biblioteca" },
  };
  const suplementos: Metrica | null = d.supplementsTotal > 0 ? { id: "suplementos", rotulo: "Suplementos", valor: Math.min(d.supplementsTaken, d.supplementsTotal), max: d.supplementsTotal, Icone: Pill, tom: TOM_DO_TIPO.suplementos, route: "/saude" } : null;
  if (d.pendenciasNovato && !(resumos && resumos.length > 0)) return metricasDoNovato(d, porId, suplementos, cobra);
  const escolhidos = (resumos && resumos.length > 0 ? resumos : RESUMOS_PADRAO).map((id) => porId[id]).filter((m): m is Metrica => !!m);
  const reserva: (Metrica | null)[] = [
    contaNoScore("suplementos") ? suplementos : null,
    registrosCobrados.length > 0 ? { id: "registros", rotulo: "Registros", valor: registrosCobrados.filter((t) => reg[t]).length, max: registrosCobrados.length, Icone: PenLine, tom: TOM_DO_MODULO.desenvolvimento, abreMais: true } : null,
  ];
  const fila = [...escolhidos, ...reserva.filter((m): m is Metrica => !!m && !escolhidos.some((e) => e.id === m.id))];
  return fila.slice(0, 3);
}

/**
 * 1.0.20 (dono 27/10: "Refeições 0/4 do lado do 100 sem ela ter usado a Dieta") — A PÁGINA 1 DA CONTA NOVA SEM ESCOLHA:
 * os 3 cards são os tipos que CONTAM no score dela (os mesmos da lista e da folha do score — lib/pendencias-novato), na
 * ordem da lista (ORDEM_DA_LISTA; fixa, o card não pula quando fica feito). No dia 1 da missão: Hábitos · Água · Gasto.
 * Cada card diz o mesmo que o score: completo ⇔ o item está feito na folha (o Sono conta "registrou hoje", não as horas;
 * o Treino num dia de descanso de quem tem plano já vem feito). Humor, Peso, Ideia e Gratidão ganham o card de sim/não
 * (como o Gasto: 0/1 → 1/1).
 * Contou MENOS de 3: completa com o padrão (Hábitos · Água · Refeições) em CONVITE — o anel tracejado com "+" do
 * "Criar hábito" ("Anotar copo", "Criar plano"), nunca o "0/4" de uma obrigação. Escolhi o convite em vez de 2 cards
 * largos: a página 1 aprovada é a grade de 3; com 2 ou 1 card a grade fica com buraco ou com cards esticados, e a conta
 * que explorou sozinha (0 tipos) ficaria só com o número. O que ela escondeu em Personalizar não volta nem como convite.
 * Usar o convite (anotar o copo, a refeição) faz o tipo contar — ele vira card de verdade e entra na lista e no score.
 */
function metricasDoNovato(d: LifeHubData, porId: Record<IdDoResumo, Metrica | null>, suplementos: Metrica | null, cobra: (t: TipoPendencia) => boolean): Metrica[] {
  const reg = d.registrosHoje ?? { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false };
  const simNao = (t: keyof RegistrosHoje): Metrica => ({ id: t, rotulo: ROTULO_DO_TIPO[t], valor: reg[t] ? 1 : 0, max: 1, Icone: ICONE_DO_TIPO[t], tom: TOM_DO_TIPO[t], action: ACAO_DO_REGISTRO[t] });
  const doTipo = (t: TipoPendencia): Metrica | null => {
    switch (t) {
      case "habitos": case "agua": case "refeicoes": case "leitura": return porId[t];
      case "gasto": return porId.financas;
      case "treino": return porId.treino && { ...porId.treino, valor: d.workoutDone || !d.todayWorkoutGroup ? 1 : 0 };
      case "suplementos": return suplementos;
      default: return simNao(t);
    }
  };
  const contam = new Set(d.pendenciasCobradas ?? []);
  const cards = ORDEM_DA_LISTA.filter((t) => contam.has(t)).map(doTipo).filter((m): m is Metrica => !!m);
  const convites = (["habitos", "agua", "refeicoes"] as const)
    .filter((t) => !contam.has(t) && cobra(t) && !cards.some((m) => m.id === t) && porId[t])
    .map((t): Metrica => ({ ...porId[t]!, convite: CONVITE_DO_PADRAO[t] }));
  return [...cards, ...convites].slice(0, 3);
}

interface PropsScore {
  score: number;
  onAbrir: () => void;
  /** variação: o número DENTRO do anel (como o anel de hoje) e o título da faixa no lugar dele */
  numeroDentro?: boolean;
  /** a comemoração de tela cheia vai abrir / está aberta: a festinha do 100 espera ela fechar (HomeE) */
  festaPausada?: boolean;
  /** só a rota de dev: toca a festinha do 100 a cada montagem, sem gravar */
  forcarFesta?: boolean;
}

export const CardScoreE = ({ score, onAbrir, numeroDentro, festaPausada, forcarFesta }: PropsScore) => {
  const fase = useFesta100(score, festaPausada, forcarFesta);
  const corAnel = corDaFase(fase);
  const ouro = fase !== "preto";
  return (
    <section className="hn-card he-score" data-testid="he-score" aria-label="Score do dia" data-numero={numeroDentro ? "dentro" : "fora"} data-fase-100={fase}>
      {/* rodada 2 (dono): tocar em QUALQUER parte do card abre a folha da pontuação — não só a estrela */}
      <button type="button" onClick={onAbrir} aria-label="Score do dia — como funciona a pontuação" data-testid="he-score-abrir" className="w-full p-5 flex items-center gap-3 text-left rounded-[24px] active:scale-[0.99] transition-transform">
        <span className="flex-1 min-w-0 block">
          {numeroDentro ? (
            <span className="block text-[24px] leading-tight font-bold tracking-tight" data-testid="he-score-titulo">{tituloDoScore(score)}</span>
          ) : (
            /* V7 (dono 26/10): "44 /100 pontos" — o número grande em preto e "/100 pontos" cinza na MESMA linha, como o
               "2276 /2616" do Cal AI (enche o meio do card, que sobrava vazio). Com 3 dígitos (100) o número desce de 50
               pra 46 px pra linha caber em 390 pt sem encostar no anel (nowrap: nunca quebra). 26/10: abaixo de 390 pt (375,
               iPhone mini/SE) o "100" ficava a 2 pt do anel — lá o 100 vai a 42 px e "/100 pontos" a 17 px. */
            <span className="flex items-baseline gap-1 whitespace-nowrap" data-testid="he-score-linha">
              <NumeroQueConta valor={score} className={`${score >= 100 ? "text-[46px] max-[389px]:text-[42px]" : "text-[50px]"} he-numero-100 ${ouro ? "text-[color:var(--he-ouro-texto)]" : ""} leading-[0.95] font-bold tabular-nums tracking-[-0.04em]`} testid="he-score-numero" />
              <span className={`text-[19px] ${score >= 100 ? "max-[389px]:text-[17px]" : ""} font-medium text-muted-foreground tabular-nums tracking-[-0.01em]`} data-testid="he-score-meta">/100 pontos</span>
            </span>
          )}
          <span className="block mt-1.5 text-[15px] leading-snug font-medium text-muted-foreground" data-testid="hn-score-explica">Score do dia</span>
        </span>
        <span className="shrink-0 rounded-full block relative">
          <EcoDoAnel fase={fase} espessura={11} />
          <Anel tamanho={104} espessura={11} valor={score} max={100} cor={corAnel} testid="hn-anel">
            {numeroDentro ? (
              <span className="flex flex-col items-center justify-center">
                <span className="text-[30px] leading-none font-bold tabular-nums tracking-tight" data-testid="he-score-numero">{score}</span>
                <span className="text-[9.5px] mt-1 text-muted-foreground font-semibold uppercase tracking-[0.12em]">pontos</span>
              </span>
            ) : <EstrelaFesta fase={fase} tamanho={32} />}
          </Anel>
        </span>
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

/** 1.0.19 (dono 26/10): o texto do "Criar" de um resumo SEM META (0/0) — Hábitos sem hábito é o caso de toda conta nova. */
export const CRIAR_DO_RESUMO: Partial<Record<Metrica["id"], string>> = {
  habitos: "Criar hábito", refeicoes: "Criar plano", suplementos: "Adicionar", treino: "Criar treino", leitura: "Escolher livro",
};
export const textoDoCriar = (id: Metrica["id"]): string => CRIAR_DO_RESUMO[id] ?? "Criar";

/** O anel TRACEJADO do "Criar": suave (traço fino, pontilhado, na cor do módulo bem clara) com o "+" no meio. */
export const AnelCriar = ({ tamanho, cor: c }: { tamanho: number; cor: string }) => {
  const esp = 2.25;
  const r = (tamanho - esp) / 2 - 1;
  return (
    <span className="relative block shrink-0" style={{ width: tamanho, height: tamanho }} data-testid="he-anel-criar">
      <svg className="w-full h-full block" viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill={c} fillOpacity={0.06} stroke={c} strokeOpacity={0.5} strokeWidth={esp} strokeDasharray="2.5 5.5" strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 grid place-items-center"><Plus className="w-[22px] h-[22px]" strokeWidth={2} style={{ color: c }} aria-hidden /></span>
    </span>
  );
};

export const CardMetrica = ({ m, atraso, onAcao, onMais }: PropsMetrica) => {
  const navigate = useNavigate();
  const completo = m.max > 0 && m.valor >= m.max;
  const c = cor(m.tom);
  const tocar = () => {
    if (m.abreMais) return onMais();
    if (m.action) return onAcao(m.action);
    if (m.route) navigate(m.route);
  };
  // 1.0.19 (dono 26/10): resumo sem meta (0/0) não mostra "0/0" — vira o convite "Criar" (anel tracejado + "+")
  // 1.0.20: o mesmo convite pro card do padrão que ainda não conta no score da conta nova (`m.convite`)
  if (m.max <= 0 || m.convite) {
    const texto = m.convite ?? textoDoCriar(m.id);
    return (
      <button
        type="button"
        onClick={tocar}
        data-testid="he-metrica"
        data-metrica={m.id}
        data-criar=""
        data-convite={m.convite ? "" : undefined}
        aria-label={`${m.rotulo}: ${texto}`}
        className="hn-card !rounded-[22px] p-3.5 flex flex-col items-start text-left min-h-[148px] w-full active:scale-[0.98] transition-transform"
      >
        <span className="text-[15px] leading-tight font-semibold tracking-[-0.01em] truncate max-w-full">{m.rotulo}</span>
        <span className="mt-1.5 text-[12.5px] leading-[1.25] font-medium truncate max-w-full" style={{ color: c }} data-testid="he-metrica-criar">{texto}</span>
        <span className="mt-auto self-center pt-1.5"><AnelCriar tamanho={62} cor={c} /></span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={tocar}
      data-testid="he-metrica"
      data-metrica={m.id}
      className="hn-card !rounded-[22px] p-3.5 flex flex-col items-start text-left min-h-[148px] w-full active:scale-[0.98] transition-transform"
    >
      <span className="flex items-baseline gap-1">
        <span className="text-[23px] leading-none font-bold tabular-nums tracking-[-0.02em]">{m.valor}</span>
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums">/{m.max}</span>
      </span>
      <span className="mt-1.5 text-[12.5px] leading-[1.25] text-muted-foreground truncate max-w-full">{m.rotulo}</span>
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
  /** os cards escolhidos em Você › Personalizar início (lib/home-resumos `resumosEscolhidos`); null = nunca escolheu */
  resumos?: IdDoResumo[] | null;
  festaPausada?: boolean;
  forcarFesta?: boolean;
}

export const PaginaSeuDia = ({ data, onAbrirScore, onAcao, onMais, numeroDentro, copoMl, resumos, festaPausada, forcarFesta }: Props) => {
  const metricas = metricasDoDia(data, copoMl, resumos);
  return (
    <div className="he-pagina" data-testid="he-pagina-1">
      {/* rodada 2: os cards entram de leve, escalonados (o score primeiro, depois os três) */}
      <Entrada atraso={0}><CardScoreE score={data.dayScore} onAbrir={onAbrirScore} numeroDentro={numeroDentro} festaPausada={festaPausada} forcarFesta={forcarFesta} /></Entrada>
      <div className="grid grid-cols-3 gap-3 mt-3 flex-1">
        {metricas.map((m, i) => (
          <Entrada key={m.id} atraso={0.08 + i * 0.07} className="flex">
            <CardMetrica m={m} atraso={0.3 + i * 0.1} onAcao={onAcao} onMais={onMais} />
          </Entrada>
        ))}
      </div>
    </div>
  );
};
