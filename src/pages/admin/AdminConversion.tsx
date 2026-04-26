import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, CreditCard, Target } from "lucide-react";

interface UserRow {
  user_id: string; email: string; created_at: string;
  plan: string | null; status: string; total_sessions: number;
}

export default function AdminConversion() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).rpc("admin_list_users").then(({ data }: any) => {
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const total = rows.length;
  const activated = rows.filter(r => r.total_sessions > 0).length;
  const engaged = rows.filter(r => r.total_sessions >= 3).length;
  const trial = rows.filter(r => r.status === "trialing").length;
  const paid = rows.filter(r => r.status === "active").length;

  const stages = [
    { label: "Cadastro", count: total, pct: 100, color: "bg-blue-500" },
    { label: "Ativaram (≥1 sessão)", count: activated, pct: total ? (activated/total)*100 : 0, color: "bg-cyan-500" },
    { label: "Engajados (≥3 sessões)", count: engaged, pct: total ? (engaged/total)*100 : 0, color: "bg-emerald-500" },
    { label: "Em trial", count: trial, pct: total ? (trial/total)*100 : 0, color: "bg-amber-500" },
    { label: "Pagantes", count: paid, pct: total ? (paid/total)*100 : 0, color: "bg-violet-500" },
  ];

  const conversionRate = activated ? (paid / activated) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversão</h1>
        <p className="text-xs text-zinc-500 mt-1">Funil de cadastro → pagamento</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Total" value={total} color="text-blue-400" />
        <Stat icon={Target} label="Ativados" value={activated} color="text-cyan-400" />
        <Stat icon={CreditCard} label="Pagantes" value={paid} color="text-violet-400" />
        <Stat icon={TrendingUp} label="Taxa de Conversão" value={`${conversionRate.toFixed(1)}%`} color="text-emerald-400" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Funil</h3>
        <div className="space-y-3">
          {stages.map(s => (
            <div key={s.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300">{s.label}</span>
                <span className="text-zinc-500">{s.count} · {s.pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full ${s.color} transition-all`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Insights</h3>
        <ul className="space-y-2 text-xs text-zinc-400">
          <li>• {total - activated} usuários cadastraram mas nunca usaram — focar em onboarding.</li>
          <li>• {activated - engaged} usaram 1-2x e não voltaram — melhorar primeira semana.</li>
          <li>• Taxa de conversão atual: {conversionRate.toFixed(1)}% (benchmark SaaS B2C: 2-5%).</li>
        </ul>
      </div>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
    <Icon className={`w-3.5 h-3.5 ${color} mb-2`} />
    <p className="text-xl font-bold text-zinc-100">{value}</p>
    <p className="text-[10px] text-zinc-500">{label}</p>
  </div>
);
