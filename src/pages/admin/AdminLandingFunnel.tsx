import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, MousePointerClick, BookOpen, CheckCircle2, UserPlus, Activity, CreditCard, RefreshCw, ChevronRight } from "lucide-react";
import ResetAnalyticsButton from "@/components/admin/ResetAnalyticsButton";
import UserJourneyDrawer from "@/components/admin/UserJourneyDrawer";

interface Funnel {
  days: number;
  landing: number;
  start_clicked: number;
  tutorial_started: number;
  tutorial_completed: number;
  signups: number;
  activated: number;
  trial: number;
  paid: number;
  by_source: { source: string; visits: number }[];
  generated_at: string;
}

const STEPS = [
  { key: "landing", label: "Visitou /inicio", icon: Eye, color: "bg-cyan-500", text: "text-cyan-400" },
  { key: "start_clicked", label: "Clicou em 'Quero começar'", icon: MousePointerClick, color: "bg-blue-500", text: "text-blue-400" },
  { key: "tutorial_started", label: "Iniciou tutorial", icon: BookOpen, color: "bg-indigo-500", text: "text-indigo-400" },
  { key: "tutorial_completed", label: "Concluiu o tutorial", icon: CheckCircle2, color: "bg-violet-500", text: "text-violet-400" },
  { key: "signups", label: "Criou conta", icon: UserPlus, color: "bg-fuchsia-500", text: "text-fuchsia-400" },
  { key: "activated", label: "Usou o app", icon: Activity, color: "bg-amber-500", text: "text-amber-400" },
  { key: "paid", label: "Virou pagante", icon: CreditCard, color: "bg-emerald-500", text: "text-emerald-400" },
] as const;

export default function AdminLandingFunnel() {
  const [data, setData] = useState<Funnel | null>(null);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data: res, error } = await (supabase as any).rpc("admin_landing_funnel", { _days: days });
    if (error) setErr(error.message);
    else {
      setData(res as Funnel);
      setLastUpdate(new Date());
      setErr(null);
    }
    setRefreshing(false);
  }, [days]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  if (err) return <div className="text-sm text-red-400">Erro: {err}</div>;
  if (!data) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const topValue = data.landing || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funil de Aquisição</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Da visita ao pagamento · atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
          >
            <option value={1}>Hoje</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Big funnel */}
      <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-3">
        {STEPS.map((step, i) => {
          const value = (data as any)[step.key] as number;
          const pctOfTop = (value / topValue) * 100;
          const prevValue = i > 0 ? (data as any)[STEPS[i - 1].key] as number : value;
          const dropRate = i > 0 && prevValue > 0 ? ((1 - value / prevValue) * 100) : 0;
          const Icon = step.icon;

          return (
            <div key={step.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${step.text}`} />
                  <span className="text-sm text-zinc-200 font-medium">{step.label}</span>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-100 font-bold">{value}</span>
                  <span className="text-zinc-500"> · {pctOfTop.toFixed(1)}%</span>
                  {i > 0 && dropRate > 0 && (
                    <span className="ml-2 text-red-400 text-[10px]">-{dropRate.toFixed(0)}%</span>
                  )}
                </div>
              </div>
              <div className="h-3 bg-zinc-800/50 rounded-full overflow-hidden">
                <div
                  className={`h-full ${step.color} transition-all duration-700 rounded-full`}
                  style={{ width: `${Math.max(pctOfTop, value > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* By source */}
      <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-zinc-100 mb-1">Origem das visitas</h3>
        <p className="text-[11px] text-zinc-500 mb-4">
          Use UTM para rastrear seus anúncios. Ex: <code className="bg-zinc-800 px-1.5 py-0.5 rounded">?utm_source=instagram&utm_campaign=lancamento</code>
        </p>
        {data.by_source.length === 0 ? (
          <p className="text-xs text-zinc-600">Nenhuma visita registrada ainda no período.</p>
        ) : (
          <div className="space-y-2">
            {data.by_source.map((s) => {
              const max = data.by_source[0]?.visits || 1;
              const pct = (s.visits / max) * 100;
              return (
                <div key={s.source}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 capitalize">{s.source}</span>
                    <span className="text-zinc-500">{s.visits} visitas</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Key conversions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="Visita → Cadastro" value={data.landing > 0 ? `${((data.signups / data.landing) * 100).toFixed(1)}%` : "—"} />
        <KPI label="Cadastro → Ativação" value={data.signups > 0 ? `${((data.activated / data.signups) * 100).toFixed(1)}%` : "—"} />
        <KPI label="Tutorial concluído" value={data.tutorial_started > 0 ? `${((data.tutorial_completed / data.tutorial_started) * 100).toFixed(1)}%` : "—"} />
        <KPI label="Visita → Pagante" value={data.landing > 0 ? `${((data.paid / data.landing) * 100).toFixed(2)}%` : "—"} highlight />
        <KPI label="Cadastros do período" value={data.signups.toString()} />
        <KPI label="Pagantes do período" value={data.paid.toString()} />
      </div>
    </div>
  );
}

const KPI = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-xl border p-3 ${highlight ? "bg-emerald-500/5 border-emerald-500/30" : "bg-zinc-900/50 border-zinc-800"}`}>
    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    <p className={`text-xl font-bold mt-1 ${highlight ? "text-emerald-400" : "text-zinc-100"}`}>{value}</p>
  </div>
);
