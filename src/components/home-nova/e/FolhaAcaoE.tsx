import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Droplets, Dumbbell, Plus } from "lucide-react";
import type { ActionId } from "@/components/home/QuickActions";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import {
  CATEGORIAS_DE_GASTO, EMOJI_DA_REFEICAO, HUMORES, TIPOS_DE_GANHO, gravarAgua, gravarDetox, gravarGanho, gravarGasto, gravarGratidao, gravarHumor,
  gravarIdeia, gravarPeso, gravarRefeicao, gravarSono, gravarTreino, hojeStr, marcarAcaoRapidaFeita, refeicoesDeHoje, type ContextoAcao,
} from "@/lib/acoes-rapidas";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl, rotuloMl } from "@/lib/saude-copo";
import { chaveDoHabito, datasDeCheckin } from "@/lib/detox";
import { formatarMacros, temMacros } from "@/lib/dieta-macros";
import { Anel } from "./Anel";
import { TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, tinta } from "./paleta";

/**
 * OS FORMULÁRIOS DO "+" DA HOME NOVA (26/10, pedido do dono: "reformular completamente — bonitos, na identidade nova,
 * uma folha consistente por ação; mantenha os mesmos efeitos/gravações/eventos").
 *
 * Uma interface só pra todas as ações: título (já na faixa da folha), UM campo grande com o teclado certo
 * (inputMode decimal/numeric/texto), as escolhas em pílulas quando houver (categoria do gasto, tipo do ganho, as
 * horas de sono), e UM botão principal, grafite. Quem GRAVA é lib/acoes-rapidas — as mesmas funções do
 * QuickActions da Home de hoje (mesmas chaves, validações, toasts com Desfazer/Ver…, conquista da ação rápida).
 *   · Água: o contador do dia com o anel e o botão "+ 1 copo" (tocar no card da Home abre ISTO — não registra);
 *   · Humor: os 5 humores grandes; · Treino: "Marcar como feito" (nunca no toque do azulejo);
 *   · Refeição: a lista do cardápio de hoje → as kcal; · Detox: a lista de hábitos → check-in;
 *   · Gasto · Ganho · Peso · Sono · Ideia · Gratidão: o campo grande + o botão.
 * O foco do campo espera a folha ASSENTAR (`assentada`), sem rolar a página (ver use-area-visivel).
 */
export const ROTULO_DA_ACAO: Record<ActionId, string> = {
  water: "Água", mood: "Humor", expense: "Gasto", income: "Ganho", task: "Tarefa", workout: "Treino",
  sleep: "Sono", meal: "Refeição", weight: "Peso", idea: "Ideia", gratitude: "Gratidão", detox: "Detox",
};

interface Props {
  acao: ActionId;
  data: LifeHubData;
  /** a folha terminou de subir: só então o campo foca (sem rolar a página) */
  assentada: boolean;
  /** gravou (a folha fecha, menos na água) */
  onFeito: (id: ActionId) => void;
  onFechar: () => void;
}

const Principal = ({ children, onClick, testid = "hn-acao-principal", tom }: { children: ReactNode; onClick: () => void; testid?: string; tom?: string }) => (
  <button
    type="button" onClick={onClick} data-testid={testid}
    className="mt-5 w-full h-14 rounded-2xl text-[16px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
    style={{ background: tom ?? "var(--hn-mais)", color: "var(--hn-mais-texto)" }}
  >
    {children}
  </button>
);

const Secundario = ({ children, onClick, testid }: { children: ReactNode; onClick: () => void; testid?: string }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="mt-2 w-full h-12 rounded-2xl text-[15px] font-semibold text-muted-foreground active:bg-muted/60">
    {children}
  </button>
);

/** O campo grande: número ou texto, com prefixo/sufixo discretos; Enter grava. */
const Campo = ({ valor, aoMudar, aoEnviar, placeholder, rotulo, modo, prefixo, sufixo, campoRef, multilinha }: {
  valor: string; aoMudar: (v: string) => void; aoEnviar: () => void; placeholder: string; rotulo: string;
  modo: "decimal" | "numeric" | "text"; prefixo?: string; sufixo?: string; campoRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>; multilinha?: boolean;
}) => (
  <label className="block rounded-[22px] px-5 py-4" style={{ background: "hsl(var(--muted) / 0.55)" }}>
    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{rotulo}</span>
    <span className="mt-1 flex items-baseline gap-2">
      {prefixo && <span className="text-[22px] font-semibold text-muted-foreground">{prefixo}</span>}
      {multilinha ? (
        <textarea
          ref={campoRef as React.RefObject<HTMLTextAreaElement>} value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} aria-label={rotulo} rows={3}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aoEnviar(); } }}
          className="he-campo-texto w-full bg-transparent text-[20px] leading-snug font-semibold outline-none resize-none placeholder:text-muted-foreground/40"
        />
      ) : (
        <input
          ref={campoRef as React.RefObject<HTMLInputElement>} type="text" inputMode={modo} value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} aria-label={rotulo}
          onKeyDown={(e) => e.key === "Enter" && aoEnviar()} enterKeyHint="done"
          className="he-campo-heroi w-full min-w-0 bg-transparent text-[36px] leading-none font-bold tabular-nums tracking-[-0.02em] outline-none placeholder:text-muted-foreground/35"
        />
      )}
      {sufixo && <span className="text-[18px] font-semibold text-muted-foreground shrink-0">{sufixo}</span>}
    </span>
  </label>
);

const Pilulas = ({ opcoes, ativa, aoEscolher, rotulo }: { opcoes: readonly string[]; ativa: string; aoEscolher: (v: string) => void; rotulo: string }) => (
  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={rotulo}>
    {opcoes.map((o) => {
      const on = o === ativa;
      return (
        <button key={o} type="button" onClick={() => aoEscolher(o)} aria-pressed={on} data-pilula={o} className="h-9 px-3.5 rounded-full text-[13.5px] font-semibold transition-colors" style={on ? { background: "var(--hn-mais)", color: "var(--hn-mais-texto)" } : { background: "hsl(var(--muted) / 0.7)", color: "hsl(var(--foreground))" }}>
          {o}
        </button>
      );
    })}
  </div>
);

export const FolhaAcaoE = ({ acao, data, assentada, onFeito, onFechar }: Props) => {
  const { get, set } = useUserData();
  const navigate = useNavigate();
  const ctx: ContextoAcao = { get, set, navigate, waterGoal: data.waterGoal };
  const conquista = () => marcarAcaoRapidaFeita(get, set);
  const campoRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState("");
  const [escolha, setEscolha] = useState<string>(acao === "expense" ? "Outros" : acao === "income" ? TIPOS_DE_GANHO[0] : "");
  const [refeicao, setRefeicao] = useState<{ tipo: string; comida: string } | null>(null);
  const [kcal, setKcal] = useState("");

  // o campo foca só com a folha assentada (e sem rolar a página — a folha se encaixa acima do teclado sozinha)
  const temCampo = acao === "expense" || acao === "income" || acao === "weight" || acao === "sleep" || acao === "idea" || acao === "gratitude";
  useEffect(() => {
    if (!assentada || !temCampo) return;
    try { campoRef.current?.focus({ preventScroll: true }); } catch { campoRef.current?.focus(); }
  }, [assentada, temCampo, acao]);
  useEffect(() => {
    if (acao === "meal" && refeicao && assentada) { try { campoRef.current?.focus({ preventScroll: true }); } catch { /* noop */ } }
  }, [acao, refeicao, assentada]);

  const corDe = (tom: Parameters<typeof cor>[0]) => cor(tom);

  switch (acao) {
    case "water": {
      const copoMl = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
      const copos = data.waterGlasses;
      const meta = Math.max(1, data.waterGoal);
      const c = corDe(TOM_DO_TIPO.agua);
      const bateu = copos >= meta;
      return (
        <div data-testid="hn-folha-acao" data-acao="water">
          <div className="flex items-center gap-5 rounded-[22px] px-5 py-4" style={{ background: tinta(TOM_DO_TIPO.agua) }}>
            <Anel tamanho={84} espessura={9} valor={copos} max={meta} cor={c} atraso={0.1}>
              {bateu ? <Check className="w-7 h-7" strokeWidth={2.5} style={{ color: c }} aria-hidden /> : <Droplets className="w-7 h-7" strokeWidth={TRACO} style={{ color: c }} aria-hidden />}
            </Anel>
            <div className="min-w-0">
              <span className="flex items-baseline gap-1">
                <span className="text-[40px] leading-none font-bold tabular-nums tracking-[-0.02em]" data-testid="hn-agua-numero">{copos}</span>
                <span className="text-[16px] font-semibold text-muted-foreground">/{meta} copos</span>
              </span>
              <span className="block mt-1.5 text-[13px] text-muted-foreground">{bateu ? "Meta do dia batida" : `${meta - copos} ${meta - copos === 1 ? "copo" : "copos"} pra meta · ${rotuloMl(copoMl)} cada`}</span>
            </div>
          </div>
          <Principal testid="hn-agua-mais" tom={c} onClick={() => gravarAgua(ctx, conquista)}>
            <Plus className="w-5 h-5" strokeWidth={2.5} aria-hidden /> 1 copo ({rotuloMl(copoMl)})
          </Principal>
          <Secundario testid="hn-acao-pronto" onClick={onFechar}>Pronto</Secundario>
        </div>
      );
    }
    case "mood":
      return (
        <div data-testid="hn-folha-acao" data-acao="mood">
          <p className="text-[15px] text-muted-foreground">Como você está agora?</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {HUMORES.map((m) => (
              <button key={m.value} type="button" data-humor={m.value} onClick={() => { gravarHumor(ctx, { value: m.value, emoji: m.emoji }, conquista); onFeito("mood"); }} className="rounded-[20px] py-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform" style={{ background: "hsl(var(--muted) / 0.55)" }}>
                <span className="text-[30px] leading-none" aria-hidden>{m.emoji}</span>
                <span className="text-[11.5px] font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    case "expense": {
      const enviar = () => { if (gravarGasto(ctx, { valorTexto: texto, categoria: escolha }, conquista)) onFeito("expense"); };
      return (
        <div data-testid="hn-folha-acao" data-acao="expense">
          <Campo valor={texto} aoMudar={setTexto} aoEnviar={enviar} placeholder="0,00" rotulo="Valor do gasto" modo="decimal" prefixo="R$" campoRef={campoRef} />
          <Pilulas opcoes={CATEGORIAS_DE_GASTO} ativa={escolha} aoEscolher={setEscolha} rotulo="Categoria" />
          <Principal onClick={enviar}>Registrar gasto</Principal>
        </div>
      );
    }
    case "income": {
      const enviar = () => { if (gravarGanho(ctx, { valorTexto: texto, tipo: escolha }, conquista)) onFeito("income"); };
      return (
        <div data-testid="hn-folha-acao" data-acao="income">
          <Campo valor={texto} aoMudar={setTexto} aoEnviar={enviar} placeholder="0,00" rotulo="Valor do ganho" modo="decimal" prefixo="R$" campoRef={campoRef} />
          <Pilulas opcoes={TIPOS_DE_GANHO} ativa={escolha} aoEscolher={setEscolha} rotulo="Tipo" />
          <Principal onClick={enviar}>Registrar ganho</Principal>
        </div>
      );
    }
    case "weight": {
      const enviar = () => { if (gravarPeso(ctx, { pesoTexto: texto }, conquista)) onFeito("weight"); };
      return (
        <div data-testid="hn-folha-acao" data-acao="weight">
          <Campo valor={texto} aoMudar={setTexto} aoEnviar={enviar} placeholder="0,0" rotulo="Peso de hoje" modo="decimal" sufixo="kg" campoRef={campoRef} />
          <Principal onClick={enviar}>Registrar peso</Principal>
        </div>
      );
    }
    case "sleep": {
      const enviar = () => { if (gravarSono(ctx, { horasTexto: texto }, conquista)) onFeito("sleep"); };
      return (
        <div data-testid="hn-folha-acao" data-acao="sleep">
          <Campo valor={texto} aoMudar={setTexto} aoEnviar={enviar} placeholder="0" rotulo="Horas de sono" modo="decimal" sufixo="h" campoRef={campoRef} />
          <Pilulas opcoes={["6", "7", "8", "9"]} ativa={texto} aoEscolher={setTexto} rotulo="Horas" />
          <Principal onClick={enviar}>Registrar sono</Principal>
        </div>
      );
    }
    case "idea": {
      const enviar = () => { if (gravarIdeia(ctx, { texto }, conquista)) onFeito("idea"); };
      return (
        <div data-testid="hn-folha-acao" data-acao="idea">
          <Campo valor={texto} aoMudar={setTexto} aoEnviar={enviar} placeholder="Sua ideia brilhante…" rotulo="Sua ideia" modo="text" campoRef={campoRef} multilinha />
          <Principal onClick={enviar}>Guardar ideia</Principal>
        </div>
      );
    }
    case "gratitude": {
      const enviar = () => { if (gravarGratidao(ctx, { texto }, conquista)) onFeito("gratitude"); };
      return (
        <div data-testid="hn-folha-acao" data-acao="gratitude">
          <Campo valor={texto} aoMudar={setTexto} aoEnviar={enviar} placeholder="Pelo que você é grato agora?" rotulo="Gratidão" modo="text" campoRef={campoRef} multilinha />
          <Principal onClick={enviar}>Registrar gratidão</Principal>
        </div>
      );
    }
    case "workout": {
      const c = corDe(TOM_DO_TIPO.treino);
      const temTreino = !!data.todayWorkoutGroup;
      return (
        <div data-testid="hn-folha-acao" data-acao="workout">
          <div className="flex items-center gap-4 rounded-[22px] px-5 py-4" style={{ background: tinta(TOM_DO_TIPO.treino) }}>
            <span className="w-14 h-14 rounded-2xl grid place-items-center shrink-0 bg-card" aria-hidden><Dumbbell className="w-7 h-7" strokeWidth={TRACO} style={{ color: c }} /></span>
            <div className="min-w-0">
              <span className="block text-[20px] font-bold tracking-tight leading-tight">{temTreino ? data.todayWorkoutGroup : data.workoutStatus === "descanso" ? "Hoje é descanso" : "Sem treino programado"}</span>
              <span className="block mt-1 text-[13px] text-muted-foreground">{data.workoutDone ? "Já marcado como feito hoje" : temTreino ? "Treino de hoje" : "Pode marcar mesmo assim"}</span>
            </div>
          </div>
          <Principal tom={c} onClick={() => { gravarTreino(ctx, conquista); onFeito("workout"); }}>
            <Check className="w-5 h-5" strokeWidth={2.5} aria-hidden /> {data.workoutDone ? "Marcar de novo" : "Marcar como feito"}
          </Principal>
          <Secundario onClick={() => { onFechar(); navigate("/treino"); }}>Abrir o Treino</Secundario>
        </div>
      );
    }
    case "meal": {
      const lista = refeicoesDeHoje(get);
      const c = corDe(TOM_DO_TIPO.refeicoes);
      if (lista.length === 0) {
        return (
          <div data-testid="hn-folha-acao" data-acao="meal" className="text-center py-2">
            <p className="text-[15px] text-muted-foreground">Nenhuma refeição planejada pra hoje.</p>
            <Principal onClick={() => { onFechar(); navigate("/dieta"); }}>Planejar na Dieta</Principal>
          </div>
        );
      }
      if (refeicao) {
        const r = lista.find((x) => x.tipo === refeicao.tipo);
        const enviar = () => { gravarRefeicao(ctx, { mealType: refeicao.tipo, food: refeicao.comida, kcalTexto: kcal }, conquista); onFeito("meal"); };
        return (
          <div data-testid="hn-folha-acao" data-acao="meal" data-refeicao-escolhida={refeicao.tipo}>
            <button type="button" onClick={() => setRefeicao(null)} className="w-full flex items-center gap-3 rounded-[22px] px-4 py-3 text-left" style={{ background: tinta(TOM_DO_TIPO.refeicoes) }}>
              <span className="text-[26px] leading-none" aria-hidden>{EMOJI_DA_REFEICAO[refeicao.tipo] || "🍴"}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{refeicao.tipo}</span>
                <span className="block text-[13px] text-muted-foreground truncate">{refeicao.comida}{r && temMacros(r.macros) ? ` · ${formatarMacros(r.macros)}` : ""}</span>
              </span>
              <span className="text-[12.5px] font-semibold" style={{ color: c }}>Trocar</span>
            </button>
            <div className="mt-3">
              <Campo valor={kcal} aoMudar={setKcal} aoEnviar={enviar} placeholder="0" rotulo="Calorias da refeição" modo="numeric" sufixo="kcal" campoRef={campoRef} />
            </div>
            <Principal tom={c} onClick={enviar}>Registrar refeição</Principal>
          </div>
        );
      }
      return (
        <div data-testid="hn-folha-acao" data-acao="meal">
          <p className="text-[15px] text-muted-foreground">O que você comeu?</p>
          <ul className="mt-3 space-y-2">
            {lista.map((r) => (
              <li key={r.tipo}>
                <button type="button" data-refeicao={r.tipo} onClick={() => { setRefeicao({ tipo: r.tipo, comida: r.comida }); setKcal(r.kcal > 0 ? String(Math.round(r.kcal)) : ""); }} className="w-full flex items-center gap-3 rounded-[20px] px-4 py-3 text-left active:scale-[0.99] transition-transform" style={{ background: "hsl(var(--muted) / 0.55)" }}>
                  <span className="text-[24px] leading-none" aria-hidden>{EMOJI_DA_REFEICAO[r.tipo] || "🍴"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{r.tipo}</span>
                    <span className="block text-[12.5px] text-muted-foreground truncate">{r.comida}{r.kcal > 0 ? ` · ${r.kcal} kcal` : ""}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "detox": {
      const habitos = ((h) => (Array.isArray(h) ? h : []))(get<Array<{ name?: string; checkins?: unknown }>>("detox-habits", []));
      const c = corDe(TOM_DO_MODULO.detox);
      if (habitos.length === 0) {
        return (
          <div data-testid="hn-folha-acao" data-acao="detox" className="text-center py-2">
            <p className="text-[15px] text-muted-foreground">Nenhum hábito detox cadastrado.</p>
            <Principal onClick={() => { onFechar(); navigate("/detox"); }}>Criar no Detox</Principal>
          </div>
        );
      }
      const hoje = hojeStr();
      return (
        <div data-testid="hn-folha-acao" data-acao="detox">
          <p className="text-[15px] text-muted-foreground">Check-in de hoje</p>
          <ul className="mt-3 space-y-2">
            {habitos.map((h, i) => {
              const chave = chaveDoHabito(h as Parameters<typeof chaveDoHabito>[0], i);
              const feito = datasDeCheckin((h as { checkins?: unknown }).checkins as Parameters<typeof datasDeCheckin>[0]).includes(hoje);
              return (
                <li key={chave}>
                  <button type="button" data-detox={chave} onClick={() => { gravarDetox(ctx, { chave, nome: String(h.name ?? "") }, conquista); onFeito("detox"); }} className="w-full flex items-center gap-3 rounded-[20px] px-4 py-3 text-left active:scale-[0.99] transition-transform" style={{ background: "hsl(var(--muted) / 0.55)" }}>
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: feito ? tinta(TOM_DO_MODULO.detox) : "hsl(var(--card))" }} aria-hidden>
                      {feito ? <Check className="w-4 h-4" strokeWidth={2.5} style={{ color: c }} /> : <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold truncate">{String(h.name ?? "")}</span>
                    <span className="text-[12px] font-semibold text-muted-foreground shrink-0">{feito ? "✓ hoje" : "check-in"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    default:
      return null;
  }
};
