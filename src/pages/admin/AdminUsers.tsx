import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

interface UserRow {
  user_id: string; email: string; created_at: string;
  last_sign_in_at: string | null; plan: string | null; status: string;
  total_sessions: number; last_session: string | null; top_module: string | null;
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (supabase as any).rpc("admin_list_users").then(({ data }: any) => {
      setRows(data || []); setLoading(false);
    });
  }, []);

  const filtered = rows.filter(r => !q || r.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-xs text-zinc-500 mt-1">{rows.length} cadastrados</p>
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
                  <th className="text-left px-3 py-2">Cadastro</th>
                  <th className="text-left px-3 py-2">Plano</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Sessões</th>
                  <th className="text-left px-3 py-2">Última</th>
                  <th className="text-left px-3 py-2">Top módulo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.user_id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-100 truncate max-w-[200px]">{r.email}</td>
                    <td className="px-3 py-2 text-zinc-400">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.plan || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                        r.status === "trialing" ? "bg-amber-500/10 text-amber-400" :
                        r.status === "canceled" ? "bg-red-500/10 text-red-400" :
                        "bg-zinc-800 text-zinc-500"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-100 font-bold">{r.total_sessions}</td>
                    <td className="px-3 py-2 text-zinc-400">{fmtDate(r.last_session)}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.top_module || "—"}</td>
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
