import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock, Users, TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/admin";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

const MODULE_LABELS: Record<string, string> = {
  financas: "Finanças",
  treino: "Treino",
  dieta: "Dieta",
  rotina: "Rotina",
  desenvolvimento: "Dev. Pessoal",
  saude: "Saúde",
  casa: "Casa",
  estudos: "Estudos",
  biblioteca: "Biblioteca",
  beleza: "Beleza",
  viagens: "Viagens",
  carreira: "Carreira",
  hiperfoco: "Mente",
  relacionamentos: "Relações",
  pet: "Pet",
  detox: "Detox",
  conquistas: "Conquistas",
};

interface AnalyticsRow {
  module_id: string;
  duration_seconds: number;
  entered_at: string;
  user_id: string;
}

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  // Block non-admin after auth loaded
  useEffect(() => {
    if (!authLoading && user && !isAdmin(user.id, user.email)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (authLoading || !user || !isAdmin(user.id)) return;
    const load = async () => {
      setLoading(true);
      let query = (supabase as any)
        .from("module_analytics")
        .select("module_id, duration_seconds, entered_at, user_id")
        .order("entered_at", { ascending: false });

      if (period === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte("entered_at", d.toISOString());
      } else if (period === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte("entered_at", d.toISOString());
      }

      const { data: rows } = await query.limit(5000);
      setData(rows || []);
      setLoading(false);
    };
    load();
  }, [user, period]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    // Unique users
    const uniqueUsers = new Set(data.map(r => r.user_id)).size;

    // Total sessions
    const totalSessions = data.length;

    // Total time
    const totalSeconds = data.reduce((s, r) => s + r.duration_seconds, 0);

    // By module
    const byModule: Record<string, { sessions: number; totalTime: number; users: Set<string> }> = {};
    data.forEach(r => {
      if (!byModule[r.module_id]) byModule[r.module_id] = { sessions: 0, totalTime: 0, users: new Set() };
      byModule[r.module_id].sessions++;
      byModule[r.module_id].totalTime += r.duration_seconds;
      byModule[r.module_id].users.add(r.user_id);
    });

    const moduleRanking = Object.entries(byModule)
      .map(([id, d]) => ({
        id,
        label: MODULE_LABELS[id] || id,
        sessions: d.sessions,
        totalTime: d.totalTime,
        avgTime: Math.round(d.totalTime / d.sessions),
        users: d.users.size,
      }))
      .sort((a, b) => b.totalTime - a.totalTime);

    return { uniqueUsers, totalSessions, totalSeconds, moduleRanking };
  }, [data]);

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}min`;
    return `${(s / 3600).toFixed(1)}h`;
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground text-sm">Carregando...</div></div>;
  if (!user || !isAdmin(user.id)) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">ANALYTICS</h1>
          </div>
        </div>

        {/* Period filter */}
        <div className="flex gap-1.5">
          {(["7d", "30d", "all"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
        ) : !stats ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Sem dados ainda</div>
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card rounded-xl border border-border p-3 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{stats.uniqueUsers}</p>
                <p className="text-[10px] text-muted-foreground">Usuários</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 text-center">
                <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-400" />
                <p className="text-lg font-bold">{stats.totalSessions}</p>
                <p className="text-[10px] text-muted-foreground">Sessões</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                <p className="text-lg font-bold">{formatTime(stats.totalSeconds)}</p>
                <p className="text-[10px] text-muted-foreground">Tempo total</p>
              </div>
            </div>

            {/* Chart - time per module */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-primary" />
                Tempo por Módulo
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.moduleRanking.slice(0, 10)} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={formatTime} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={70} />
                    <Tooltip
                      formatter={(v: number) => formatTime(v)}
                      labelFormatter={(l: string) => l}
                      contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Bar dataKey="totalTime" radius={[0, 4, 4, 0]}>
                      {stats.moduleRanking.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking table */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3">Ranking Detalhado</h3>
              <div className="space-y-2">
                {stats.moduleRanking.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 py-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? "bg-yellow-400/20 text-yellow-400" :
                      i === 1 ? "bg-gray-300/20 text-gray-400" :
                      i === 2 ? "bg-amber-600/20 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.sessions} sessões · {m.users} usuário{m.users > 1 ? "s" : ""} · média {formatTime(m.avgTime)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatTime(m.totalTime)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Least used - churn risk */}
            {stats.moduleRanking.length > 3 && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                <h3 className="text-xs font-bold text-destructive mb-2">⚠️ Módulos menos usados</h3>
                <div className="space-y-1">
                  {stats.moduleRanking.slice(-3).reverse().map(m => (
                    <p key={m.id} className="text-[11px] text-muted-foreground">
                      {m.label}: {m.sessions} sessões, {formatTime(m.totalTime)} total
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
