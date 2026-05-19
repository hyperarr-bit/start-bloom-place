import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Activity, DollarSign, UserCheck, Eye, Calendar,
  Sparkles, Zap, RefreshCw, ArrowUpRight
} from "lucide-react";

interface Metrics {
  total_users: number;
  signups_today: number;
  signups_7d: number;
  signups_30d: number;
  active_now: number;
  active_24h: number;
  active_7d: number;
  trial_active: number;
  paid_active: number;
  mrr_brl: number;
  visits_today: number;
  visits_7d: number;
  generated_at: string;
}

const Stat = ({
  icon: Icon, label, value, sub, accent = "text-zinc-200", live = false,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  accent?: string; live?: boolean;
}) => (
  <div className="group relative bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors">
    {live && (
      <span className="absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        ao vivo
      </span>
    )}
    <div className="flex items-center gap-2 mb-3 text-zinc-500">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
    {sub && <p className="text-[11px] text-zinc-500 mt-1.5">{sub}</p>}
  </div>
);

export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data, error } = await (supabase as any).rpc("admin_dashboard_v2");
    if (error) setErr(error.message);
    else {
      setM(data as Metrics);
      setLastUpdate(new Date());
      setErr(null);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30000); // auto-refresh 30s
    return () => clearInterval(id);
  }, [load]);

  if (err) return <div className="text-sm text-red-400">Erro: {err}</div>;
  if (!m) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const conversionTrial = m.trial_active > 0 ? ((m.paid_active / (m.paid_active + m.trial_active)) * 100).toFixed(1) : "0";
  const visitToSignup = m.visits_7d > 0 ? ((m.signups_7d / m.visits_7d) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Atualizado {lastUpdate.toLocaleTimeString("pt-BR")} · auto-refresh a cada 30s
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar agora
        </button>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={Eye}
          label="Visitas hoje"
          value={m.visits_today}
          sub={`${m.visits_7d} nos últimos 7d`}
          accent="text-cyan-400"
          live
        />
        <Stat
          icon={Activity}
          label="Online agora"
          value={m.active_now}
          sub={`${m.active_24h} em 24h`}
          accent="text-emerald-400"
          live
        />
        <Stat
          icon={Sparkles}
          label="Cadastros hoje"
          value={m.signups_today}
          sub={`${m.signups_7d} em 7d · ${m.signups_30d} em 30d`}
          accent="text-violet-400"
        />
        <Stat
          icon={DollarSign}
          label="MRR estimado"
          value={`R$ ${Number(m.mrr_brl).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          sub={`${m.paid_active} assinantes pagantes`}
          accent="text-emerald-400"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Total usuários" value={m.total_users} sub="histórico completo" />
        <Stat icon={Calendar} label="Ativos 7d" value={m.active_7d} sub={`${m.total_users > 0 ? ((m.active_7d / m.total_users) * 100).toFixed(0) : 0}% do total`} />
        <Stat icon={UserCheck} label="Em trial" value={m.trial_active} sub="potenciais conversões" accent="text-amber-400" />
        <Stat icon={Zap} label="Pagantes" value={m.paid_active} sub={`${conversionTrial}% conversão de trial`} accent="text-emerald-400" />
      </div>

      {/* Funnel insights */}
      <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Funil de Aquisição (7 dias)</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Da visita até o cadastro</p>
          </div>
          <a href="/admin/aquisicao" className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Ver detalhes <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>

        <div className="space-y-3">
          <FunnelStep label="Visitas únicas" value={m.visits_7d} max={m.visits_7d} color="bg-cyan-500" />
          <FunnelStep label="Cadastros" value={m.signups_7d} max={m.visits_7d} color="bg-violet-500" />
          <FunnelStep label="Ativos (usaram o app)" value={m.active_7d} max={m.visits_7d} color="bg-emerald-500" />
        </div>

        <p className="text-[11px] text-zinc-500 mt-4 pt-4 border-t border-zinc-800">
          Taxa visita → cadastro: <span className="text-zinc-200 font-bold">{visitToSignup}%</span>
        </p>
      </div>
    </div>
  );
}

const FunnelStep = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-500">{value} · {pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
