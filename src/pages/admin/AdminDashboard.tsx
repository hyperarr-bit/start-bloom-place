import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Activity, TrendingUp, TrendingDown, DollarSign, UserCheck } from "lucide-react";

interface Metrics {
  total_users: number;
  active_24h: number;
  active_7d: number;
  active_30d: number;
  signups_30d: number;
  paid_active: number;
  trial_active: number;
  canceled_30d: number;
  churn_rate_30d: number;
  conversion_rate_30d: number;
  mrr_estimated: number;
}

const Card = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
    <p className="text-2xl font-bold text-zinc-100">{value}</p>
    {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
  </div>
);

export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any).rpc("admin_metrics_overview").then(({ data, error }: any) => {
      if (error) setErr(error.message);
      else setM(data);
    });
  }, []);

  if (err) return <div className="text-sm text-red-400">Erro: {err}</div>;
  if (!m) return <div className="text-sm text-zinc-500">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-xs text-zinc-500 mt-1">Métricas executivas do produto</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card icon={DollarSign} label="MRR estimado" value={`R$ ${Number(m.mrr_estimated).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub={`${m.paid_active} assinaturas ativas`} color="text-emerald-400" />
        <Card icon={Users} label="Total de usuários" value={m.total_users} sub={`+${m.signups_30d} nos últimos 30d`} color="text-blue-400" />
        <Card icon={Activity} label="Ativos 24h" value={m.active_24h} sub={`${m.active_7d} em 7d · ${m.active_30d} em 30d`} color="text-amber-400" />
        <Card icon={TrendingUp} label="Conversão 30d" value={`${m.conversion_rate_30d}%`} sub="trial → pago (cohort 30-60d)" color="text-emerald-400" />
        <Card icon={TrendingDown} label="Churn 30d" value={`${m.churn_rate_30d}%`} sub={`${m.canceled_30d} cancelamentos`} color="text-red-400" />
        <Card icon={UserCheck} label="Em trial" value={m.trial_active} sub="potenciais conversões" color="text-violet-400" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Saúde do Produto</h3>
        <div className="space-y-2 text-xs">
          <Row label="Engajamento (DAU/MAU)" value={m.active_30d > 0 ? `${((m.active_24h / m.active_30d) * 100).toFixed(1)}%` : "—"} />
          <Row label="Retenção 7d" value={m.signups_30d > 0 ? `${((m.active_7d / Math.max(m.total_users, 1)) * 100).toFixed(1)}%` : "—"} />
          <Row label="LTV estimado (12 meses)" value={`R$ ${(Number(m.mrr_estimated) / Math.max(m.paid_active,1) * 12).toFixed(2)}`} />
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/50 last:border-0">
    <span className="text-zinc-500">{label}</span>
    <span className="text-zinc-100 font-bold">{value}</span>
  </div>
);
