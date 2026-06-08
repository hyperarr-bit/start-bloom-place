import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp } from "lucide-react";

interface Row {
  source_label: string;
  utm_source: string | null;
  utm_medium: string | null;
  referrer_host: string | null;
  total: number;
  converted: number;
  first_seen: string;
  last_seen: string;
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

export default function AdminAquisicao() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data, error } = await (supabase as any).rpc("admin_lead_sources_summary");
    if (error) console.error(error);
    setRows((data as Row[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalLeads = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalConv = rows.reduce((s, r) => s + Number(r.converted || 0), 0);
  const convRate = totalLeads > 0 ? ((totalConv / totalLeads) * 100).toFixed(1) : "0";
  const max = Math.max(1, ...rows.map(r => Number(r.total || 0)));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aquisição</h1>
          <p className="text-xs text-zinc-500 mt-1">De onde os leads vieram (UTM + referrer)</p>
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

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Leads totais</p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">{totalLeads}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Convertidos</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalConv}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Taxa de conversão</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{convRate}%</p>
        </div>
      </div>

      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          <strong className="text-zinc-300">Como usar:</strong> compartilhe links com UTM para diferenciar fontes.<br />
          Ex.: <code className="text-emerald-400">?utm_source=tiktok&utm_medium=organic</code> ou <code className="text-emerald-400">?utm_source=instagram&utm_medium=paid&utm_campaign=lancamento</code>.<br />
          Quando não houver UTM, o referrer do navegador é usado como fallback (menos preciso).
        </p>
      </div>

      {loading ? <div className="text-sm text-zinc-500">Carregando…</div> : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Origem</th>
                  <th className="text-left px-3 py-2">utm_source</th>
                  <th className="text-left px-3 py-2">utm_medium</th>
                  <th className="text-left px-3 py-2">Referrer</th>
                  <th className="text-right px-3 py-2">Leads</th>
                  <th className="text-right px-3 py-2">Convertidos</th>
                  <th className="text-right px-3 py-2">Conv. %</th>
                  <th className="text-left px-3 py-2">Primeiro</th>
                  <th className="text-left px-3 py-2">Último</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-zinc-500">Nenhum dado ainda.</td></tr>
                )}
                {rows.map((r, i) => {
                  const total = Number(r.total || 0);
                  const conv = Number(r.converted || 0);
                  const rate = total > 0 ? ((conv / total) * 100).toFixed(0) : "0";
                  const pct = (total / max) * 100;
                  return (
                    <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-100 font-medium">
                        <div className="flex items-center gap-2">
                          <span>{r.source_label}</span>
                          {conv > 0 && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{r.utm_source || "—"}</td>
                      <td className="px-3 py-2 text-zinc-400">{r.utm_medium || "—"}</td>
                      <td className="px-3 py-2 text-zinc-400 truncate max-w-[160px]">{r.referrer_host || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1 bg-zinc-800 rounded overflow-hidden">
                            <div className="h-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-zinc-100 font-bold tabular-nums">{total}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{conv}</td>
                      <td className="px-3 py-2 text-right text-amber-400 tabular-nums">{rate}%</td>
                      <td className="px-3 py-2 text-zinc-500">{fmtDate(r.first_seen)}</td>
                      <td className="px-3 py-2 text-zinc-500">{fmtDate(r.last_seen)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
