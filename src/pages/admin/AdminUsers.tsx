import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, ChevronRight } from "lucide-react";
import UserJourneyDrawer from "@/components/admin/UserJourneyDrawer";

interface UserRow {
  user_id: string; email: string; created_at: string;
  last_sign_in_at: string | null; plan: string | null; status: string;
  total_sessions: number; last_session: string | null; top_module: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer: string | null;
}

function labelSource(r: { utm_source: string | null; utm_medium: string | null; referrer: string | null }): string {
  const us = (r.utm_source || "").toLowerCase();
  const um = (r.utm_medium || "").toLowerCase();
  const paid = ["paid", "cpc", "ppc", "ads", "social-paid", "paidsocial"].includes(um);
  if (us) {
    const net = us.includes("instagram") ? "Instagram"
      : us.includes("facebook") ? "Facebook"
      : us.includes("meta") ? "Meta"
      : us.includes("tiktok") ? "TikTok"
      : us.includes("youtube") ? "YouTube"
      : us.includes("google") ? "Google"
      : us.includes("whatsapp") ? "WhatsApp"
      : us.includes("linkedin") ? "LinkedIn"
      : us.includes("twitter") || us.includes("x.com") ? "Twitter/X"
      : us;
    return `${net} ${paid ? "pago" : "orgânico"}`;
  }
  const ref = (r.referrer || "").toLowerCase();
  if (!ref) return "Direto";
  const host = ref.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  if (host.includes("tiktok.com")) return "TikTok orgânico (ref)";
  if (host.includes("instagram.com")) return "Instagram orgânico (ref)";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "Facebook orgânico (ref)";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube orgânico (ref)";
  if (host.includes("google.")) return "Google orgânico (ref)";
  if (host.includes("whatsapp") || host.includes("wa.me")) return "WhatsApp (ref)";
  if (host.includes("linkedin.com")) return "LinkedIn (ref)";
  if (host.includes("twitter.com") || host.includes("x.com") || host.includes("t.co")) return "Twitter/X (ref)";
  return host;
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<{ id: string; email: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data } = await (supabase as any).rpc("admin_list_users");
    setRows(data || []);
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

  const counts = {
    all: rows.length,
    active: rows.filter(r => r.status === "active").length,
    trialing: rows.filter(r => r.status === "trialing").length,
    canceled: rows.filter(r => r.status === "canceled").length,
    none: rows.filter(r => r.status === "none").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {rows.length} cadastrados · atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
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

      {/* Filtros por status */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: "all", label: "Todos", color: "" },
          { k: "active", label: "Pagantes", color: "text-emerald-400" },
          { k: "trialing", label: "Em trial", color: "text-amber-400" },
          { k: "canceled", label: "Cancelados", color: "text-red-400" },
          { k: "none", label: "Sem assinatura", color: "text-zinc-400" },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setStatusFilter(f.k)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              statusFilter === f.k
                ? "bg-zinc-800 border-zinc-700 text-zinc-100"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label} <span className={`ml-1 ${f.color}`}>({counts[f.k as keyof typeof counts]})</span>
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
                  <th className="text-left px-3 py-2">Cadastro</th>
                  <th className="text-left px-3 py-2">Origem</th>
                  <th className="text-left px-3 py-2">Plano</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Sessões</th>
                  <th className="text-left px-3 py-2">Última atividade</th>
                  <th className="text-left px-3 py-2">Top módulo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-zinc-500">Nenhum usuário encontrado.</td></tr>
                )}
                {filtered.map(r => (
                  <tr
                    key={r.user_id}
                    onClick={() => setDrawer({ id: r.user_id, email: r.email })}
                    className="border-t border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                  >
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
                    <td className="px-3 py-2 text-zinc-400">{fmtDateTime(r.last_session)}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.top_module || "—"}</td>
                    <td className="px-2 py-2 text-zinc-500"><ChevronRight className="w-4 h-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {drawer && (
        <UserJourneyDrawer
          userId={drawer.id}
          label={drawer.email}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
