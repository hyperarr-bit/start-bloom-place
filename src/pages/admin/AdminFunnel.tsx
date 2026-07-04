import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, Gift, RotateCw, Users2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  RangePicker, rangeToDates, type RangeKey,
  Panel, StatTile, EmptyState, RankedBars, FunnelChart, WorstDropCallout,
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
  daily: { day: string; sessions: number; accounts: number; paid: number }[];
}

const QUIZ_LABELS: Record<string, string> = {
  atrapalha: "O que mais atrapalha",
  controle: "Como controla hoje",
  vitoria: "Vitória em 7 dias",
};

const fmtDay = (d: string) => {
  const dt = new Date(`${d}T12:00:00`);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-[12px]">
      <div className="font-semibold mb-1">{fmtDay(label)}</div>
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
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setError(null);
    const { from, to } = rangeToDates(r);
    const { data: res, error: err } = await supabase.rpc("admin_acquisition_funnel", { _from: from, _to: to });
    if (err) setError(err.message);
    else setData(res as unknown as FunnelData);
    setLoading(false);
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Funil de aquisição</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">/comecar — do primeiro clique até assinar</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

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

              <Panel title="Tendência diária" sub="Sessões, contas criadas e assinaturas por dia">
                {data.daily.length === 0 ? (
                  <EmptyState label="Sem dados nesse período" />
                ) : (
                  <div className="h-64 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="day" tickFormatter={fmtDay}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false} tickLine={false} width={28}
                        />
                        <Tooltip content={<ChartTooltip />} />
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
