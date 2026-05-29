import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, BarChart3, MousePointerClick, LogOut } from "lucide-react";


type Period = "today" | "7d" | "30d" | "all";

interface TabRow {
  tab_id: string;
  sessions: number;
  unique_users: number;
  total_seconds: number;
  avg_seconds: number;
  last_used: string | null;
}
interface CardRow {
  card_key: string;
  tab_id: string;
  views: number;
  interactions: number;
  unique_users: number;
  last_used: string | null;
}

const fromForPeriod = (p: Period): string | null => {
  const now = Date.now();
  if (p === "today") return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  if (p === "7d") return new Date(now - 7 * 86400000).toISOString();
  if (p === "30d") return new Date(now - 30 * 86400000).toISOString();
  return null;
};

const fmtSec = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

export default function AdminUso() {
  const [period, setPeriod] = useState<Period>("7d");
  const [tabs, setTabs] = useState<TabRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const _from = fromForPeriod(period);
    const [t, c] = await Promise.all([
      (supabase as any).rpc("admin_finance_tab_usage", { _from, _to: null }),
      (supabase as any).rpc("admin_finance_card_usage", { _from, _to: null }),
    ]);
    setTabs(t.data || []);
    setCards(c.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uso de Finanças</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Quais abas e cards os usuários mais usam dentro do módulo Finanças.
          </p>
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

      <div className="flex gap-2 flex-wrap">
        {(["today", "7d", "30d", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              period === p
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {p === "today" ? "Hoje" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500">Carregando…</div>
      ) : (
        <>
          {/* Abas */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <header className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold">Ranking de abas</h2>
              <span className="text-[10px] text-zinc-500 ml-auto">{tabs.length} abas</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Aba</th>
                    <th className="text-right px-3 py-2">Sessões</th>
                    <th className="text-right px-3 py-2">Usuários</th>
                    <th className="text-right px-3 py-2">Tempo total</th>
                    <th className="text-right px-3 py-2">Tempo médio</th>
                    <th className="text-right px-3 py-2">Último uso</th>
                  </tr>
                </thead>
                <tbody>
                  {tabs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                        Sem dados neste período.
                      </td>
                    </tr>
                  )}
                  {tabs.map((r) => (
                    <tr key={r.tab_id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-100 font-medium">{r.tab_id}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{r.sessions}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{r.unique_users}</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-bold">{fmtSec(r.total_seconds)}</td>
                      <td className="px-3 py-2 text-right text-zinc-400">{fmtSec(Math.round(r.avg_seconds))}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">{fmtDate(r.last_used)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Cards */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <header className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
              <MousePointerClick className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold">Ranking de cards</h2>
              <span className="text-[10px] text-zinc-500 ml-auto">{cards.length} cards</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Card</th>
                    <th className="text-left px-3 py-2">Aba</th>
                    <th className="text-right px-3 py-2">Views</th>
                    <th className="text-right px-3 py-2">Interações</th>
                    <th className="text-right px-3 py-2">Usuários</th>
                    <th className="text-right px-3 py-2">Último uso</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                        Sem dados ainda — cards começam a aparecer depois do deploy.
                      </td>
                    </tr>
                  )}
                  {cards.map((r) => (
                    <tr key={`${r.card_key}-${r.tab_id}`} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-100 font-medium">{r.card_key}</td>
                      <td className="px-3 py-2 text-zinc-400">{r.tab_id || "—"}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{r.views}</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-bold">{r.interactions}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{r.unique_users}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">{fmtDate(r.last_used)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
