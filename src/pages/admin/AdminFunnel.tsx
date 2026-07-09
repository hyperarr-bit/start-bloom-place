import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, Gift, RotateCw, Users2, XCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  RangePicker, rangeToDates, type RangeKey,
  GranularityToggle, type Granularity,
  CustomRangePicker, type CustomWindow,
  Panel, StatTile, EmptyState, RankedBars, FunnelChart, WorstDropCallout,
  getCounterReset, setCounterReset,
  type FunnelStep,
} from "./components";

interface FunnelData {
  totals: { sessions: number; accounts: number; paid: number; conversion_pct: number };
  steps: FunnelStep[];
  worst_drop: { key: string; label: string; drop_pct: number } | null;
  recovery: { offer_views: number; wheel_views: number; downsell_views: number; downsell_dismissed: number; downsell_paid: number };
  cta_clicks: { cta: string; clicks: number; sessions: number }[];
  quiz_answers: Record<string, { answer: string; count: number }[]>;
  utm_breakdown: { source: string; sessions: number; paid: number }[];
  granularity: "day" | "hour";
  daily: { day: string; sessions: number; accounts: number; paid: number }[];
}

const QUIZ_LABELS: Record<string, string> = {
  atrapalha: "O que mais atrapalha",
  controle: "Como controla hoje",
  gasto: "Quanto some por mês",
  compromisso: "Compromisso 5 min/dia",
  vitoria: "Vitória em 7 dias",
};

const fmtBucket = (d: string, granularity: "day" | "hour") => {
  const dt = new Date(d);
  return granularity === "hour"
    ? dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

function ChartTooltip({ active, payload, label, granularity }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-[12px]">
      <div className="font-semibold mb-1">{fmtBucket(label, granularity)}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-semibold tabular-nums ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminFunnel() {
  // Se existe um marco de reset salvo, abre já em "Desde o reset" — senão o
  // reload voltava pra "30 dias" e os números "voltavam".
  const [resetAt, setResetAt] = useState<string | null>(() => getCounterReset());
  const [range, setRange] = useState<RangeKey>(() => (getCounterReset() ? "reset" : "30d"));
  const [granularity, setGranularity] = useState<Granularity>(() => (getCounterReset() ? "hour" : "day"));
  // Janela custom (dia/hora específico). Quando setada, manda no período —
  // sobrepõe o preset até o admin limpar.
  const [customWindow, setCustomWindow] = useState<CustomWindow | null>(null);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zerar: salva o marco AGORA e passa a contar desde ali (não apaga dado).
  const handleReset = () => {
    if (!confirm("Zerar o contador? Os números passam a contar a partir de agora.\n\nNada é apagado — dá pra voltar pra qualquer período depois.")) return;
    const now = new Date().toISOString();
    setCounterReset(now);
    setResetAt(now);
    setRange("reset");
    setGranularity("hour");
  };

  const handleUndoReset = () => {
    setCounterReset(null);
    setResetAt(null);
    setRange("30d");
    setGranularity("day");
  };

  const load = useCallback(async (from: string, to: string, g: Granularity) => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.rpc("admin_acquisition_funnel", {
      _from: from, _to: to, _granularity: g,
    });
    if (err) setError(err.message);
    else setData(res as unknown as FunnelData);
    setLoading(false);
  }, []);

  useEffect(() => {
    const { from, to } = customWindow ?? rangeToDates(range);
    load(from, to, granularity);
  }, [range, granularity, customWindow, load]);

  // "Hoje" com granularidade diária vira 1 ponto só (inútil) — troca pra hora.
  const handleRangeChange = (r: RangeKey) => {
    setCustomWindow(null); // preset limpa a janela custom
    setRange(r);
    if (r === "today") setGranularity("hour");
    else if (r !== "today" && granularity === "hour") setGranularity("day");
  };

  // Janela custom: aplica e força granularidade por hora (é o caso de uso —
  // ver um dia/faixa em detalhe hora a hora).
  const handleCustomApply = (w: CustomWindow) => {
    setCustomWindow(w);
    setGranularity("hour");
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Funil de aquisição</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">/comecar — do primeiro clique até assinar</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-medium hover:bg-muted transition-colors"
            title="Zerar o contador a partir de agora"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            Zerar
          </button>
          <GranularityToggle value={granularity} onChange={setGranularity} />
          <CustomRangePicker active={customWindow} onApply={handleCustomApply} onClear={() => setCustomWindow(null)} />
          <RangePicker value={range} onChange={handleRangeChange} />
        </div>
      </div>

      {resetAt && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-[13px]">
          <span className="text-muted-foreground">
            {range === "reset" ? "Contando" : "Contador zerado"} desde{" "}
            <span className="font-semibold text-foreground">
              {new Date(resetAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            {range !== "reset" && " — selecione \"Desde o reset\" no período pra ver."}
          </span>
          <button onClick={handleUndoReset} className="font-semibold text-accent hover:underline shrink-0">
            Desfazer
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Erro ao carregar: {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Sessões" value={data.totals.sessions.toLocaleString("pt-BR")} />
            <StatTile label="Contas criadas" value={data.totals.accounts.toLocaleString("pt-BR")} />
            <StatTile label="Pagantes" value={data.totals.paid.toLocaleString("pt-BR")} />
            <StatTile
              label="Conversão"
              value={`${data.totals.conversion_pct}%`}
              sub="sessão → pagante"
            />
          </div>

          {data.totals.sessions === 0 ? (
            <Panel><EmptyState label="Nenhuma sessão no período selecionado." /></Panel>
          ) : (
            <>
              {/* Funil principal */}
              <Panel title="Etapas do funil" sub="Sessões únicas que alcançaram cada etapa">
                <FunnelChart steps={data.steps} />
              </Panel>

              <WorstDropCallout drop={data.worst_drop} />

              {/* Recuperação: roleta / downsell */}
              <Panel title="Recuperação (saída do paywall)" sub="Quem tentou sair viu a roleta → oferta de downsell">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MiniStat icon={Users2} label="Viu a oferta" value={data.recovery.offer_views} />
                  <MiniStat icon={RotateCw} label="Girou a roleta" value={data.recovery.wheel_views} />
                  <MiniStat icon={Gift} label="Viu o downsell" value={data.recovery.downsell_views} />
                  <MiniStat icon={XCircle} label="Assinou pelo downsell" value={data.recovery.downsell_paid} accent />
                </div>
                {data.recovery.wheel_views > 0 && (
                  <p className="text-[12px] text-muted-foreground mt-3">
                    {data.recovery.downsell_dismissed} recusaram o desconto e continuaram sem assinar.
                  </p>
                )}
              </Panel>

              <div className="grid md:grid-cols-2 gap-5">
                <Panel title="Cliques por botão" sub="Todos os CTAs do funil, do mais ao menos clicado">
                  <RankedBars
                    items={data.cta_clicks.map((c) => ({ label: c.cta, value: c.clicks }))}
                  />
                </Panel>

                <Panel title="Respostas do quiz" sub="Ajuda a mirar criativo/campanha por dor">
                  <div className="space-y-5">
                    {Object.entries(data.quiz_answers).length === 0 && (
                      <EmptyState label="Sem respostas neste período" />
                    )}
                    {Object.entries(data.quiz_answers).map(([q, answers]) => (
                      <div key={q}>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                          {QUIZ_LABELS[q] ?? q}
                        </div>
                        <RankedBars items={answers.map((a) => ({ label: a.answer, value: a.count }))} />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel title="Origem do tráfego" sub="UTM source — capturado desde 04/07. Sessões antigas aparecem como direto/desconhecido">
                {data.utm_breakdown.length === 0 ? (
                  <EmptyState label="Sem dados de origem neste período" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="pb-2 font-semibold">Origem</th>
                          <th className="pb-2 font-semibold text-right">Sessões</th>
                          <th className="pb-2 font-semibold text-right">Pagantes</th>
                          <th className="pb-2 font-semibold text-right">Conversão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.utm_breakdown.map((u) => (
                          <tr key={u.source} className="border-b border-border/50 last:border-0">
                            <td className="py-2 font-medium">{u.source}</td>
                            <td className="py-2 text-right tabular-nums">{u.sessions}</td>
                            <td className="py-2 text-right tabular-nums">{u.paid}</td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground">
                              {u.sessions > 0 ? ((u.paid / u.sessions) * 100).toFixed(1) : "0"}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel>
                <div className="mb-4">
                  <h3 className="text-[13px] font-bold">Tendência</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Sessões, contas criadas e assinaturas por {granularity === "hour" ? "hora" : "dia"}
                  </p>
                </div>
                {data.daily.length === 0 ? (
                  <EmptyState label="Sem dados nesse período" />
                ) : (
                  <div className="h-64 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="day" tickFormatter={(d) => fmtBucket(d, data.granularity)}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false} tickLine={false} width={28}
                        />
                        <Tooltip content={<ChartTooltip granularity={data.granularity} />} />
                        <Legend
                          iconType="plainline" iconSize={14}
                          wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                        />
                        <Line type="monotone" dataKey="sessions" name="Sessões" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="accounts" name="Contas" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} strokeOpacity={0.5} />
                        <Line type="monotone" dataKey="paid" name="Pagantes" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--accent))" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <Icon className={`w-4 h-4 mb-2 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      <div className={`text-xl font-semibold tabular-nums leading-none ${accent ? "text-accent" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
