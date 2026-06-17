import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, BarChart3, Layers, MousePointerClick, ChevronRight, X } from "lucide-react";
import { moduleLabel, tabLabel, cardLabel } from "./labels";

type Period = "today" | "7d" | "30d" | "all";

interface ModuleRow {
  module_id: string;
  sessions: number;
  unique_users: number;
  total_seconds: number;
  avg_seconds: number;
  last_used: string | null;
  adoption_pct: number;
}
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
  s = Math.round(s || 0);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

export default function AdminEngajamento() {
  const [period, setPeriod] = useState<Period>("7d");
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // drill-down
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [tabs, setTabs] = useState<TabRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const _from = fromForPeriod(period);
    const { data } = await (supabase as any).rpc("admin_module_usage", { _from, _to: null });
    setModules((data as ModuleRow[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const openDrill = useCallback(async (moduleId: string) => {
    setOpenModule(moduleId);
    setDrillLoading(true);
    setTabs([]);
    setCards([]);
    const _from = fromForPeriod(period);
    const calls: Promise<any>[] = [
      (supabase as any).rpc("admin_module_tab_usage", { _module: moduleId, _from, _to: null }),
    ];
    if (moduleId === "financas") {
      calls.push((supabase as any).rpc("admin_module_card_usage", { _module: moduleId, _from, _to: null }));
    }
    const [t, c] = await Promise.all(calls);
    setTabs((t?.data as TabRow[]) || []);
    setCards((c?.data as CardRow[]) || []);
    setDrillLoading(false);
  }, [period]);

  const totalSessions = modules.reduce((s, m) => s + Number(m.sessions || 0), 0);
  const maxSeconds = Math.max(1, ...modules.map((m) => Number(m.total_seconds || 0)));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Engajamento</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Quais dos 16 módulos os usuários realmente usam — e, dentro de cada um, quais abas.
            Clique num módulo para ver o detalhe por aba.
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
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold">Ranking de módulos</h2>
            <span className="text-[10px] text-zinc-500 ml-auto">
              {modules.length} módulos · {totalSessions.toLocaleString("pt-BR")} sessões
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Módulo</th>
                  <th className="text-right px-3 py-2">Adoção</th>
                  <th className="text-right px-3 py-2">Usuários</th>
                  <th className="text-right px-3 py-2">Sessões</th>
                  <th className="text-right px-3 py-2">Tempo total</th>
                  <th className="text-right px-3 py-2">Tempo médio</th>
                  <th className="text-right px-3 py-2">Último uso</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-zinc-500">Sem dados neste período.</td></tr>
                )}
                {modules.map((m) => {
                  const pct = (Number(m.total_seconds || 0) / maxSeconds) * 100;
                  return (
                    <tr
                      key={m.module_id}
                      onClick={() => openDrill(m.module_id)}
                      className="border-t border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                    >
                      <td className="px-3 py-2 text-zinc-100 font-medium">{moduleLabel(m.module_id)}</td>
                      <td className="px-3 py-2 text-right text-amber-400 tabular-nums">{m.adoption_pct}%</td>
                      <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{m.unique_users}</td>
                      <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{m.sessions}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1 bg-zinc-800 rounded overflow-hidden">
                            <div className="h-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-emerald-400 font-bold tabular-nums">{fmtSec(m.total_seconds)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{fmtSec(m.avg_seconds)}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">{fmtDate(m.last_used)}</td>
                      <td className="px-3 py-2 text-right"><ChevronRight className="w-3.5 h-3.5 text-zinc-600 inline" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Drill-down: abas + cards do módulo selecionado */}
      {openModule && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpenModule(null)} />
          <div className="relative w-full max-w-2xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto">
            <header className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{moduleLabel(openModule)}</h2>
                <p className="text-[11px] text-zinc-500">Detalhe de uso por aba {openModule === "financas" && "e card"}</p>
              </div>
              <button onClick={() => setOpenModule(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-5 space-y-5">
              {drillLoading ? (
                <div className="text-sm text-zinc-500">Carregando…</div>
              ) : (
                <>
                  <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    <header className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold">Abas mais usadas</h3>
                      <span className="text-[10px] text-zinc-500 ml-auto">{tabs.length} abas</span>
                    </header>
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="text-left px-3 py-2">Aba</th>
                          <th className="text-right px-3 py-2">Sessões</th>
                          <th className="text-right px-3 py-2">Usuários</th>
                          <th className="text-right px-3 py-2">Tempo total</th>
                          <th className="text-right px-3 py-2">Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabs.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-500">Sem dados de aba.</td></tr>
                        )}
                        {tabs.map((t) => (
                          <tr key={t.tab_id} className="border-t border-zinc-800/50">
                            <td className="px-3 py-2 text-zinc-100 font-medium">{tabLabel(openModule, t.tab_id)}</td>
                            <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{t.sessions}</td>
                            <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{t.unique_users}</td>
                            <td className="px-3 py-2 text-right text-emerald-400 font-bold tabular-nums">{fmtSec(t.total_seconds)}</td>
                            <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{fmtSec(t.avg_seconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  {openModule === "financas" && (
                    <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                      <header className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                        <MousePointerClick className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold">Cards (views e interações)</h3>
                        <span className="text-[10px] text-zinc-500 ml-auto">{cards.length} cards</span>
                      </header>
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="text-left px-3 py-2">Card</th>
                            <th className="text-left px-3 py-2">Aba</th>
                            <th className="text-right px-3 py-2">Views</th>
                            <th className="text-right px-3 py-2">Interações</th>
                            <th className="text-right px-3 py-2">Usuários</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cards.length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-500">Sem dados de card.</td></tr>
                          )}
                          {cards.map((c) => (
                            <tr key={`${c.card_key}-${c.tab_id}`} className="border-t border-zinc-800/50">
                              <td className="px-3 py-2 text-zinc-100 font-medium">{cardLabel(c.card_key)}</td>
                              <td className="px-3 py-2 text-zinc-400">{tabLabel(openModule, c.tab_id)}</td>
                              <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{c.views}</td>
                              <td className="px-3 py-2 text-right text-emerald-400 font-bold tabular-nums">{c.interactions}</td>
                              <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{c.unique_users}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
