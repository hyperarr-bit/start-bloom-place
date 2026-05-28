import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw } from "lucide-react";

interface TrialRow {
  user_id: string;
  email: string;
  started_at: string;
  subscription_status: string;
  days_since_start: number;
}

type Period = "today" | "7d" | "30d" | "all";

const fmtDateTime = (s: string) => new Date(s).toLocaleString("pt-BR");

export default function AdminTrials() {
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [counts, setCounts] = useState({ today: 0, "7d": 0, "30d": 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("today");

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const [today, w, m, all] = await Promise.all([
      (supabase as any).rpc("admin_trials_started", { _period: "today" }),
      (supabase as any).rpc("admin_trials_started", { _period: "7d" }),
      (supabase as any).rpc("admin_trials_started", { _period: "30d" }),
      (supabase as any).rpc("admin_trials_started", { _period: "all" }),
    ]);
    setCounts({
      today: today.data?.length || 0,
      "7d": w.data?.length || 0,
      "30d": m.data?.length || 0,
      all: all.data?.length || 0,
    });
    const map: Record<Period, any> = { today, "7d": w, "30d": m, all };
    setRows(map[period].data || []);
    setLoading(false);
    setRefreshing(false);
    setLastUpdate(new Date());
  }, [period]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = rows.filter(r => !q || r.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trials iniciados</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Usuários que se cadastraram (e iniciaram trial) · atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { k: "today", label: "Hoje" },
          { k: "7d", label: "Últimos 7 dias" },
          { k: "30d", label: "Últimos 30 dias" },
          { k: "all", label: "Total" },
        ] as { k: Period; label: string }[]).map(c => (
          <button
            key={c.k}
            onClick={() => setPeriod(c.k)}
            className={`text-left p-4 rounded-xl border transition-colors ${
              period === c.k
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{c.label}</div>
            <div className="text-2xl font-bold text-zinc-100 mt-1">{counts[c.k]}</div>
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
                  <th className="text-left px-3 py-2">Iniciou em</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Dias</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-500">Nenhum trial neste período.</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.user_id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-100 truncate max-w-[260px]">{r.email}</td>
                    <td className="px-3 py-2 text-zinc-400">{fmtDateTime(r.started_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.subscription_status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                        r.subscription_status === "trialing" ? "bg-amber-500/10 text-amber-400" :
                        r.subscription_status === "canceled" ? "bg-red-500/10 text-red-400" :
                        "bg-zinc-800 text-zinc-500"
                      }`}>{r.subscription_status}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-100 font-bold">{r.days_since_start}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
