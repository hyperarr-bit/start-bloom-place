import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, Eye, CreditCard, TrendingUp, Clock, Users } from "lucide-react";
import { PayingUserFunnelSheet } from "@/components/admin/PayingUserFunnelSheet";

interface Row {
  user_id: string;
  email: string;
  plan: string | null;
  billing_period: string | null;
  status: string;
  payment_method: string | null;
  subscribed_at: string;
  current_period_end: string | null;
  signup_at: string;
  days_trial_to_paid: number;
  trial_days_active: number;
  total_sessions: number;
  total_seconds_in_app: number;
  top_module: string | null;
  tabs_visited_count: number;
  cards_filled_count: number;
}

const fmtDT = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";
const fmtD  = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

// MRR real (preços do app): mensal R$14,90 | anual R$46,80/ano = R$3,90/mês equiv.
// O app só tem um plano ("core-pro"); o que varia é o billing_period.
const PRICE_MONTHLY = 14.9;
const PRICE_ANNUAL_PER_MONTH = 3.9;
const mrrOf = (r: Row) => {
  if (r.status !== "active") return 0;
  if (["annual", "yearly"].includes(r.billing_period || "")) return PRICE_ANNUAL_PER_MONTH;
  if (r.billing_period === "lifetime") return 0;
  return PRICE_MONTHLY; // mensal (ou period nulo = assume mensal)
};

export default function AdminPaying() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalSignups, setTotalSignups] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"canceled">("all");
  const [selected, setSelected] = useState<{ id: string; email: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const [{ data }, { data: usersAll }] = await Promise.all([
      (supabase as any).rpc("admin_paying_users"),
      (supabase as any).rpc("admin_list_users"),
    ]);
    setRows(data || []);
    setTotalSignups((usersAll || []).length);
    setLoading(false);
    setRefreshing(false);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = rows.filter(r =>
    (!q || r.email?.toLowerCase().includes(q.toLowerCase())) &&
    (statusFilter === "all" || r.status === statusFilter)
  );

  const kpis = useMemo(() => {
    const active = rows.filter(r => r.status === "active");
    const mrr = active.reduce((s, r) => s + mrrOf(r), 0);
    const conv = totalSignups > 0 ? (rows.length / totalSignups) * 100 : 0;
    const avgDays = rows.length
      ? rows.reduce((s, r) => s + (r.days_trial_to_paid || 0), 0) / rows.length
      : 0;
    return {
      activeCount: active.length,
      mrr,
      conv,
      avgDays,
    };
  }, [rows, totalSignups]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagantes</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {rows.length} assinaturas registradas · atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
            <CreditCard className="w-3 h-3" /> Ativos
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{kpis.activeCount}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
            <TrendingUp className="w-3 h-3" /> MRR estimado
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            R$ {kpis.mrr.toFixed(2).replace(".", ",")}
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
            <Users className="w-3 h-3" /> Conv. trial→pago
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{kpis.conv.toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">{rows.length} de {totalSignups}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
            <Clock className="w-3 h-3" /> Dias médios p/ pagar
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{kpis.avgDays.toFixed(1)}</div>
        </div>
      </div>

      {/* Filtros por status */}
      <div className="flex gap-2 flex-wrap">
        {([
          { k: "all", label: "Todos", color: "" },
          { k: "active", label: "Ativos", color: "text-emerald-400" },
          { k: "canceled", label: "Cancelados", color: "text-red-400" },
        ] as const).map(f => (
          <button
            key={f.k}
            onClick={() => setStatusFilter(f.k)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              statusFilter === f.k
                ? "bg-zinc-800 border-zinc-700 text-zinc-100"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label} <span className={`ml-1 ${f.color}`}>
              ({f.k === "all" ? rows.length : rows.filter(r => r.status === f.k).length})
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por email…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {loading ? <div className="text-sm text-zinc-500">Carregando…</div> : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Plano</th>
                  <th className="text-left px-3 py-2">Período</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Pagou em</th>
                  <th className="text-right px-3 py-2">Dias p/ pagar</th>
                  <th className="text-right px-3 py-2">Dias trial</th>
                  <th className="text-right px-3 py-2">Sessões</th>
                  <th className="text-right px-3 py-2">Abas</th>
                  <th className="text-right px-3 py-2">Cards</th>
                  <th className="text-left px-3 py-2">Top módulo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-6 text-center text-zinc-500">Nenhum pagante.</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.user_id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-100 truncate max-w-[200px]">{r.email}</td>
                    <td className="px-3 py-2 text-zinc-300">{r.plan || "—"}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.billing_period || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                        r.status === "canceled" ? "bg-red-500/10 text-red-400" :
                        "bg-zinc-800 text-zinc-500"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{fmtD(r.subscribed_at)}</td>
                    <td className="px-3 py-2 text-right text-zinc-100 font-bold">D{r.days_trial_to_paid}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{r.trial_days_active}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{r.total_sessions}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{r.tabs_visited_count}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{r.cards_filled_count}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.top_module || "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => setSelected({ id: r.user_id, email: r.email })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-zinc-800 hover:bg-emerald-500/10 hover:text-emerald-400 text-zinc-300 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Funil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayingUserFunnelSheet
        userId={selected?.id || null}
        email={selected?.email || null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
