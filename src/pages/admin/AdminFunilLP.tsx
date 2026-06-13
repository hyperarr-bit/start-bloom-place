import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ArrowDownRight, Eye, MousePointerClick, UserPlus, BookOpen, LayoutGrid, CheckCircle2, Rocket, ArrowRight } from "lucide-react";

type CtaRow = { cta: string; clicks: number; sessions: number };
type ModRow = { module: string; chosen: number; unique_users: number };
type SourceRow = { source: string; visits: number };
type DailyRow = { day: string; visits: number; cta_clicks: number; signups: number; tutorial_completed: number; trials: number };

interface FunnelData {
  range: { from: string; to: string };
  totals: {
    visits: number; cta_clicks: number; signups: number;
    tutorial_started: number; module_chosen: number; tutorial_completed: number;
    trials: number;
  };
  cta_breakdown: CtaRow[];
  module_breakdown: ModRow[];
  source_breakdown: SourceRow[];
  daily: DailyRow[];
}

const RANGES = [
  { key: "2d",  label: "Desde o novo funil", days: 2 },
  { key: "7d",  label: "7 dias",   days: 7 },
  { key: "30d", label: "30 dias",  days: 30 },
];

const fmtPct = (num: number, den: number) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";

const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const CTA_LABELS: Record<string, string> = {
  header_entrar: "Header — Entrar",
  hero_signup: "Hero — Começar teste grátis",
  pricing_anual: "Preços — Plano anual",
  pricing_mensal: "Preços — Plano mensal",
  final_signup: "CTA final — Começar teste",
};

type StageKey = "visits" | "cta" | "signup" | "tut_start" | "module" | "tut_done" | "trial";

export default function AdminFunilLP() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeKey, setRangeKey] = useState("2d");
  const [fromStage, setFromStage] = useState<StageKey>("visits");
  const [toStage, setToStage] = useState<StageKey>("trial");

  const range = RANGES.find(r => r.key === rangeKey) ?? RANGES[0];

  const load = useCallback(async () => {
    setRefreshing(true);
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 24 * 60 * 60 * 1000);
    const { data, error } = await (supabase as any).rpc("admin_lp_funnel", {
      _from: from.toISOString(),
      _to: to.toISOString(),
    });
    if (error) console.error(error);
    setData((data as FunnelData) || null);
    setLoading(false);
    setRefreshing(false);
  }, [range.days]);

  useEffect(() => { load(); }, [load]);

  const stages = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    return [
      { key: "visits" as StageKey,    label: "Visitas únicas (LP)",     n: t.visits,             Icon: Eye },
      { key: "cta" as StageKey,       label: "Cliques em CTA",          n: t.cta_clicks,         Icon: MousePointerClick },
      { key: "signup" as StageKey,    label: "Criaram conta",           n: t.signups,            Icon: UserPlus },
      { key: "tut_start" as StageKey, label: "Iniciaram tutorial",      n: t.tutorial_started,   Icon: BookOpen },
      { key: "module" as StageKey,    label: "Escolheram um módulo",    n: t.module_chosen,      Icon: LayoutGrid },
      { key: "tut_done" as StageKey,  label: "Concluíram tutorial",     n: t.tutorial_completed, Icon: CheckCircle2 },
      { key: "trial" as StageKey,     label: "Iniciaram trial",         n: t.trials,             Icon: Rocket },
    ];
  }, [data]);

  const stageByKey = useMemo(() => Object.fromEntries(stages.map(s => [s.key, s])), [stages]);

  const SHORTCUTS: Array<{ label: string; from: StageKey; to: StageKey }> = [
    { label: "Visita → Trial",   from: "visits", to: "trial" },
    { label: "Visita → Conta",   from: "visits", to: "signup" },
    { label: "CTA → Conta",      from: "cta",    to: "signup" },
    { label: "Conta → Trial",    from: "signup", to: "trial" },
  ];

  const maxDaily = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.daily.flatMap(d => [d.visits, d.cta_clicks, d.signups, d.trials]));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funil LP → Trial</h1>
          <p className="text-xs text-zinc-500 mt-1">LP → CTA → Cadastro → Tutorial → Trial · sessões únicas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`px-3 py-1 text-xs rounded-md ${rangeKey === r.key ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="text-sm text-zinc-500">Carregando…</div>
      ) : (
        <>
          {/* Funil principal */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-4">Funil completo</div>
            <div className="space-y-2">
              {stages.map((s, i) => {
                const prev = i > 0 ? stages[i - 1].n : null;
                const base = stages[0].n;
                const pctTotal = base > 0 ? (s.n / base) * 100 : 0;
                const drop = prev !== null && prev > 0 ? (1 - s.n / prev) * 100 : 0;
                return (
                  <div key={s.key} className="group">
                    <div className="flex items-center gap-3">
                      <s.Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                          <span className="text-xs font-bold text-zinc-100 truncate">{s.label}</span>
                          <div className="flex items-baseline gap-3 shrink-0">
                            <span className="text-sm font-bold tabular-nums text-zinc-100">{s.n.toLocaleString("pt-BR")}</span>
                            <span className="text-[10px] text-zinc-500 tabular-nums w-12 text-right">{pctTotal.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/60" style={{ width: `${pctTotal}%` }} />
                        </div>
                      </div>
                    </div>
                    {prev !== null && drop > 0 && (
                      <div className="ml-7 mt-1 flex items-center gap-1 text-[10px] text-amber-500/80">
                        <ArrowDownRight className="w-3 h-3" />
                        <span>Drop-off: <span className="font-bold">{drop.toFixed(1)}%</span> ({(prev - s.n).toLocaleString("pt-BR")} pessoas)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Visita → CTA"   value={fmtPct(data.totals.cta_clicks, data.totals.visits)} />
            <KpiCard label="CTA → Cadastro" value={fmtPct(data.totals.signups, data.totals.cta_clicks)} />
            <KpiCard label="Cadastro → Trial" value={fmtPct(data.totals.trials, data.totals.signups)} />
            <KpiCard label="Visita → Trial" value={fmtPct(data.totals.trials, data.totals.visits)} />
          </div>

          {/* CTA breakdown */}
          <Section title="Cliques por CTA" hint="Quem clicou em qual botão da LP">
            {data.cta_breakdown.length === 0 ? <Empty /> : (
              <table className="w-full text-xs">
                <thead className="text-zinc-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">CTA</th>
                    <th className="text-right px-3 py-2">Cliques</th>
                    <th className="text-right px-3 py-2">Sessões únicas</th>
                    <th className="text-right px-3 py-2">% das visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cta_breakdown.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-800/50">
                      <td className="px-3 py-2 text-zinc-100 font-medium">{CTA_LABELS[r.cta] ?? r.cta}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{r.clicks}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.sessions}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{fmtPct(r.sessions, data.totals.visits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Módulos */}
          <Section title="Módulos escolhidos no tutorial" hint="Onde o usuário começa a explorar o app">
            {data.module_breakdown.length === 0 ? <Empty /> : (
              <table className="w-full text-xs">
                <thead className="text-zinc-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Módulo</th>
                    <th className="text-right px-3 py-2">Aberturas</th>
                    <th className="text-right px-3 py-2">Usuários únicos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.module_breakdown.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-800/50">
                      <td className="px-3 py-2 text-zinc-100 font-medium capitalize">{r.module}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{r.chosen}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.unique_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Fontes */}
          <Section title="Origem das visitas" hint="utm_source — fallback: direto">
            {data.source_breakdown.length === 0 ? <Empty /> : (
              <table className="w-full text-xs">
                <thead className="text-zinc-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Fonte</th>
                    <th className="text-right px-3 py-2">Visitas</th>
                    <th className="text-right px-3 py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.source_breakdown.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-800/50">
                      <td className="px-3 py-2 text-zinc-100 font-medium">{r.source}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{r.visits}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{fmtPct(r.visits, data.totals.visits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Daily */}
          <Section title="Evolução diária" hint="Sessões únicas por dia">
            {data.daily.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Dia</th>
                      <th className="text-right px-3 py-2">Visitas</th>
                      <th className="text-right px-3 py-2">CTA</th>
                      <th className="text-right px-3 py-2">Cadastros</th>
                      <th className="text-right px-3 py-2">Tutorial</th>
                      <th className="text-right px-3 py-2">Trials</th>
                      <th className="text-left px-3 py-2 w-40">Visita → Trial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((r, i) => {
                      const conv = r.visits > 0 ? (r.trials / r.visits) * 100 : 0;
                      return (
                        <tr key={i} className="border-t border-zinc-800/50">
                          <td className="px-3 py-2 text-zinc-300">{fmtDate(r.day)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{r.visits}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.cta_clicks}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{r.signups}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-sky-400">{r.tutorial_completed}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-400">{r.trials}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400/70" style={{ width: `${Math.min(100, conv)}%` }} />
                              </div>
                              <span className="text-[10px] tabular-nums text-zinc-400 w-10 text-right">{conv.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Visual de funil + comparador */}
          <Section title="Comparador de conversão" hint="Visualize o funil em camadas e compare 2 estágios">
            <div className="p-5 space-y-6">
              {/* Funil visual */}
              <div className="space-y-1.5">
                {stages.map((s, i) => {
                  const base = stages[0].n;
                  const pct = base > 0 ? (s.n / base) * 100 : 0;
                  const width = Math.max(6, pct);
                  const palette = ["bg-emerald-500/80","bg-emerald-500/70","bg-sky-500/70","bg-sky-500/60","bg-violet-500/60","bg-violet-500/50","bg-amber-500/70"];
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className="w-32 shrink-0 text-[11px] text-zinc-400 text-right">{s.label}</div>
                      <div className="flex-1 flex items-center">
                        <div
                          className={`${palette[i]} h-9 rounded-md flex items-center justify-between px-3 text-[11px] font-bold text-zinc-950 transition-all`}
                          style={{ width: `${width}%` }}
                        >
                          <span className="tabular-nums">{s.n.toLocaleString("pt-BR")}</span>
                          <span className="tabular-nums opacity-80">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparador */}
              <div className="border-t border-zinc-800 pt-5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Comparar conversão entre estágios</div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={fromStage}
                    onChange={(e) => setFromStage(e.target.value as StageKey)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                  >
                    {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <ArrowRight className="w-4 h-4 text-zinc-500" />
                  <select
                    value={toStage}
                    onChange={(e) => setToStage(e.target.value as StageKey)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                  >
                    {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>

                <div className="mt-4 p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg flex items-baseline justify-between flex-wrap gap-3">
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-zinc-200 font-medium">{stageByKey[fromStage]?.label}</span>
                    {" "}({(stageByKey[fromStage]?.n ?? 0).toLocaleString("pt-BR")})
                    {" → "}
                    <span className="text-zinc-200 font-medium">{stageByKey[toStage]?.label}</span>
                    {" "}({(stageByKey[toStage]?.n ?? 0).toLocaleString("pt-BR")})
                  </div>
                  <div className="text-3xl font-bold text-emerald-400 tabular-nums">
                    {fmtPct(stageByKey[toStage]?.n ?? 0, stageByKey[fromStage]?.n ?? 0)}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {SHORTCUTS.map(sc => (
                    <button
                      key={sc.label}
                      onClick={() => { setFromStage(sc.from); setToStage(sc.to); }}
                      className="text-left px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
                    >
                      <div className="text-[10px] text-zinc-500">{sc.label}</div>
                      <div className="text-sm font-bold text-zinc-100 tabular-nums">
                        {fmtPct(stageByKey[sc.to]?.n ?? 0, stageByKey[sc.from]?.n ?? 0)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

const KpiCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    <p className="text-2xl font-bold text-zinc-100 mt-1 tabular-nums">{value}</p>
  </div>
);

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-zinc-800">
      <div className="text-sm font-bold text-zinc-100">{title}</div>
      {hint && <div className="text-[10px] text-zinc-500 mt-0.5">{hint}</div>}
    </div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const Empty = () => <div className="px-3 py-6 text-center text-zinc-500 text-xs">Sem dados no período.</div>;
