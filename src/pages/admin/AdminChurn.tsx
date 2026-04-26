import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, AlertTriangle, Clock } from "lucide-react";

interface AtRisk {
  user_id: string; email: string; plan: string | null;
  last_session: string | null; days_inactive: number;
}

export default function AdminChurn() {
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      (supabase as any).rpc("admin_at_risk_users"),
      (supabase as any).rpc("admin_metrics_overview"),
    ]).then(([a, b]: any[]) => {
      setAtRisk(a.data || []);
      setMetrics(b.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Churn</h1>
        <p className="text-xs text-zinc-500 mt-1">Cancelamentos e usuários em risco</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={TrendingDown} label="Churn 30d" value={`${metrics?.churn_rate_30d || 0}%`} color="text-red-400" />
        <Stat icon={Clock} label="Cancelamentos 30d" value={metrics?.canceled_30d || 0} color="text-amber-400" />
        <Stat icon={AlertTriangle} label="Em risco" value={atRisk.length} color="text-orange-400" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Pagantes Inativos (≥7 dias)
        </h3>
        {atRisk.length === 0 ? (
          <p className="text-xs text-zinc-500">Ninguém em risco no momento. 🎉</p>
        ) : (
          <div className="space-y-2">
            {atRisk.slice(0, 30).map(u => (
              <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-100 truncate">{u.email}</p>
                  <p className="text-[10px] text-zinc-500">{u.plan || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-orange-400 font-bold">{u.days_inactive}d</p>
                  <p className="text-[10px] text-zinc-500">inativo</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Ações Sugeridas</h3>
        <ul className="space-y-2 text-xs text-zinc-400">
          <li>• Enviar email de re-engajamento para inativos &gt;7 dias.</li>
          <li>• Oferecer desconto/pausa para usuários inativos &gt;14 dias.</li>
          <li>• Pesquisa de cancelamento para reduzir churn voluntário.</li>
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
