import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock, Users, TrendingUp, Trophy, Activity, Calendar, ArrowLeftCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/admin";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  LineChart, Line, CartesianGrid
} from "recharts";

const MODULE_LABELS: Record<string, string> = {
  financas: "Finanças", treino: "Treino", dieta: "Dieta", rotina: "Rotina",
  desenvolvimento: "Dev. Pessoal", saude: "Saúde", casa: "Casa", estudos: "Estudos",
  biblioteca: "Biblioteca", beleza: "Beleza", viagens: "Viagens", carreira: "Carreira",
  hiperfoco: "Mente", relacionamentos: "Relações", pet: "Pet", detox: "Detox",
  conquistas: "Conquistas",
};

interface AnalyticsRow {
  module_id: string;
  duration_seconds: number;
  entered_at: string;
  user_id: string;
  tab_id: string | null;
}

const formatTime = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${(s / 3600).toFixed(1)}h`;
};

/* ─── Overview Cards ─── */
const StatCard = ({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) => (
  <div className="bg-card rounded-xl border border-border p-3 text-center">
    <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
    <p className="text-lg font-bold">{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

/* ─── Module Detail View ─── */
const ModuleDetail = ({ moduleId, data, onBack }: { moduleId: string; data: AnalyticsRow[]; onBack: () => void }) => {
  const moduleData = data.filter(r => r.module_id === moduleId);
  const totalTime = moduleData.reduce((s, r) => s + r.duration_seconds, 0);
  const totalSessions = moduleData.length;
  const uniqueUsers = new Set(moduleData.map(r => r.user_id)).size;

  // Tab ranking
  const byTab: Record<string, { sessions: number; totalTime: number; users: Set<string> }> = {};
  moduleData.forEach(r => {
    const tab = r.tab_id || "(sem aba)";
    if (!byTab[tab]) byTab[tab] = { sessions: 0, totalTime: 0, users: new Set() };
    byTab[tab].sessions++;
    byTab[tab].totalTime += r.duration_seconds;
    byTab[tab].users.add(r.user_id);
  });

  const tabRanking = Object.entries(byTab)
    .map(([id, d]) => ({ id, sessions: d.sessions, totalTime: d.totalTime, users: d.users.size }))
    .sort((a, b) => b.totalTime - a.totalTime);

  // User ranking
  const byUser: Record<string, { sessions: number; totalTime: number }> = {};
  moduleData.forEach(r => {
    if (!byUser[r.user_id]) byUser[r.user_id] = { sessions: 0, totalTime: 0 };
    byUser[r.user_id].sessions++;
    byUser[r.user_id].totalTime += r.duration_seconds;
  });

  const userRanking = Object.entries(byUser)
    .map(([id, d]) => ({ id: id.slice(0, 8) + "…", sessions: d.sessions, totalTime: d.totalTime }))
    .sort((a, b) => b.totalTime - a.totalTime);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary hover:underline">
        <ArrowLeftCircle className="w-4 h-4" /> Voltar ao overview
      </button>

      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{MODULE_LABELS[moduleId] || moduleId}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Clock} value={formatTime(totalTime)} label="Tempo total" color="text-amber-400" />
        <StatCard icon={TrendingUp} value={totalSessions} label="Sessões" color="text-green-400" />
        <StatCard icon={Users} value={uniqueUsers} label="Usuários" color="text-primary" />
      </div>

      {/* Tab ranking */}
      {tabRanking.length > 0 && tabRanking[0].id !== "(sem aba)" && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" /> Ranking de Abas
          </h3>
          <div className="space-y-2">
            {tabRanking.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 py-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? "bg-yellow-400/20 text-yellow-400" :
                  i === 1 ? "bg-gray-300/20 text-gray-400" :
                  i === 2 ? "bg-amber-600/20 text-amber-600" :
                  "bg-muted text-muted-foreground"
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold capitalize">{t.id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.sessions} sessões · {t.users} usuário{t.users > 1 ? "s" : ""} 
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">{formatTime(t.totalTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User ranking */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-primary" /> Usuários neste módulo
        </h3>
        <div className="space-y-2">
          {userRanking.slice(0, 20).map((u, i) => (
            <div key={u.id} className="flex items-center gap-2 py-1">
              <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{u.id}</code>
              <span className="text-[10px] text-muted-foreground ml-auto">{u.sessions} sessões</span>
              <span className="text-xs font-bold text-primary">{formatTime(u.totalTime)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Main ─── */
const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !isAdmin(user.id, user.email)) navigate("/");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (authLoading || !user || !isAdmin(user.id)) return;
    const load = async () => {
      setLoading(true);
      let query = (supabase as any)
        .from("module_analytics")
        .select("module_id, duration_seconds, entered_at, user_id, tab_id")
        .order("entered_at", { ascending: false });

      if (period === "7d") {
        const d = new Date(); d.setDate(d.getDate() - 7);
        query = query.gte("entered_at", d.toISOString());
      } else if (period === "30d") {
        const d = new Date(); d.setDate(d.getDate() - 30);
        query = query.gte("entered_at", d.toISOString());
      }

      const { data: rows } = await query.limit(5000);
      setData(rows || []);
      setLoading(false);
    };
    load();
  }, [user, period, authLoading]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const uniqueUsers = new Set(data.map(r => r.user_id)).size;
    const totalSessions = data.length;
    const totalSeconds = data.reduce((s, r) => s + r.duration_seconds, 0);
    const avgSession = Math.round(totalSeconds / totalSessions);

    // Today
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayData = data.filter(r => r.entered_at.slice(0, 10) === todayStr);
    const todaySessions = todayData.length;
    const todayUsers = new Set(todayData.map(r => r.user_id)).size;

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
        id, label: MODULE_LABELS[id] || id, sessions: d.sessions,
        totalTime: d.totalTime, avgTime: Math.round(d.totalTime / d.sessions), users: d.users.size,
      }))
      .sort((a, b) => b.totalTime - a.totalTime);

    // Daily activity
    const byDay: Record<string, number> = {};
    data.forEach(r => {
      const day = r.entered_at.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const dailyActivity = Object.entries(byDay)
      .map(([date, sessions]) => ({ date: date.slice(5), sessions }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    // Peak hours
    const byHour: Record<number, number> = {};
    data.forEach(r => {
      const h = new Date(r.entered_at).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const peakHours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, sessions: byHour[h] || 0 }));

    // Retention: users active on >1 distinct day
    const userDays: Record<string, Set<string>> = {};
    data.forEach(r => {
      if (!userDays[r.user_id]) userDays[r.user_id] = new Set();
      userDays[r.user_id].add(r.entered_at.slice(0, 10));
    });
    const retainedUsers = Object.values(userDays).filter(days => days.size > 1).length;

    return { uniqueUsers, totalSessions, totalSeconds, avgSession, todaySessions, todayUsers, moduleRanking, dailyActivity, peakHours, retainedUsers };
  }, [data]);

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
            <button key={p} onClick={() => { setPeriod(p); setSelectedModule(null); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
        ) : !stats ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Sem dados ainda</div>
        ) : selectedModule ? (
          <ModuleDetail moduleId={selectedModule} data={data} onBack={() => setSelectedModule(null)} />
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Users} value={stats.uniqueUsers} label="Usuários" color="text-primary" />
              <StatCard icon={TrendingUp} value={stats.totalSessions} label="Sessões" color="text-green-400" />
              <StatCard icon={Clock} value={formatTime(stats.totalSeconds)} label="Tempo total" color="text-amber-400" />
              <StatCard icon={Zap} value={formatTime(stats.avgSession)} label="Sessão média" color="text-violet-400" />
            </div>

            {/* Today */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-2 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-green-400" /> Hoje
              </h3>
              <div className="flex gap-6">
                <div>
                  <p className="text-xl font-bold">{stats.todaySessions}</p>
                  <p className="text-[10px] text-muted-foreground">sessões</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.todayUsers}</p>
                  <p className="text-[10px] text-muted-foreground">usuários</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.retainedUsers}</p>
                  <p className="text-[10px] text-muted-foreground">retidos (+1 dia)</p>
                </div>
              </div>
            </div>

            {/* Daily activity chart */}
            {stats.dailyActivity.length > 1 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Atividade Diária
                </h3>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.dailyActivity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Peak hours */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Horários de Pico
              </h3>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.peakHours}>
                    <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="sessions" radius={[2, 2, 0, 0]}>
                      {stats.peakHours.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Module time chart */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-primary" /> Tempo por Módulo
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.moduleRanking.slice(0, 10)} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={formatTime} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={70} />
                    <Tooltip formatter={(v: number) => formatTime(v)} contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="totalTime" radius={[0, 4, 4, 0]}>
                      {stats.moduleRanking.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking table — clickable */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3">Ranking Detalhado — clique para ver abas</h3>
              <div className="space-y-2">
                {stats.moduleRanking.map((m, i) => (
                  <button key={m.id} onClick={() => setSelectedModule(m.id)}
                    className="flex items-center gap-2 py-1.5 w-full text-left hover:bg-muted/50 rounded-lg px-1 transition-colors">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? "bg-yellow-400/20 text-yellow-400" :
                      i === 1 ? "bg-gray-300/20 text-gray-400" :
                      i === 2 ? "bg-amber-600/20 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.sessions} sessões · {m.users} usuário{m.users > 1 ? "s" : ""} · média {formatTime(m.avgTime)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatTime(m.totalTime)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Least used */}
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
