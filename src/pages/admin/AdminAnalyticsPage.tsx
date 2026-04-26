import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Clock, Users, TrendingUp, Trophy, Activity, Calendar, ArrowLeftCircle, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

const MODULE_LABELS: Record<string, string> = {
  financas: "Finanças", treino: "Treino", dieta: "Dieta", rotina: "Rotina",
  desenvolvimento: "Dev. Pessoal", saude: "Saúde", casa: "Casa", estudos: "Estudos",
  biblioteca: "Biblioteca", beleza: "Beleza", viagens: "Viagens", carreira: "Carreira",
  hiperfoco: "Mente", relacionamentos: "Relações", pet: "Pet", detox: "Detox",
  conquistas: "Conquistas",
};

interface Row { module_id: string; duration_seconds: number; entered_at: string; user_id: string; tab_id: string | null; }

const fmt = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s/60)}min` : `${(s/3600).toFixed(1)}h`;

const Stat = ({ icon: Icon, value, label, color }: any) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
    <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
    <p className="text-lg font-bold text-zinc-100">{value}</p>
    <p className="text-[10px] text-zinc-500">{label}</p>
  </div>
);

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    let q = (supabase as any).from("module_analytics")
      .select("module_id, duration_seconds, entered_at, user_id, tab_id")
      .order("entered_at", { ascending: false });
    if (period !== "all") {
      const d = new Date(); d.setDate(d.getDate() - (period === "7d" ? 7 : 30));
      q = q.gte("entered_at", d.toISOString());
    }
    q.limit(5000).then(({ data }: any) => { setData(data || []); setLoading(false); });
  }, [period]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const uniqueUsers = new Set(data.map(r => r.user_id)).size;
    const totalSeconds = data.reduce((s, r) => s + r.duration_seconds, 0);
    const avg = Math.round(totalSeconds / data.length);

    const byMod: Record<string, { sessions: number; totalTime: number; users: Set<string> }> = {};
    data.forEach(r => {
      if (!byMod[r.module_id]) byMod[r.module_id] = { sessions: 0, totalTime: 0, users: new Set() };
      byMod[r.module_id].sessions++;
      byMod[r.module_id].totalTime += r.duration_seconds;
      byMod[r.module_id].users.add(r.user_id);
    });
    const ranking = Object.entries(byMod).map(([id, d]) => ({
      id, label: MODULE_LABELS[id] || id, sessions: d.sessions, totalTime: d.totalTime, users: d.users.size,
    })).sort((a, b) => b.totalTime - a.totalTime);

    const byDay: Record<string, number> = {};
    data.forEach(r => { const k = r.entered_at.slice(0,10); byDay[k] = (byDay[k]||0)+1; });
    const daily = Object.entries(byDay).map(([d, s]) => ({ date: d.slice(5), sessions: s })).sort((a,b)=>a.date.localeCompare(b.date));

    const byHour: Record<number, number> = {};
    data.forEach(r => { const h = new Date(r.entered_at).getHours(); byHour[h] = (byHour[h]||0)+1; });
    const peak = Array.from({length:24},(_,h)=>({ hour:`${h}h`, sessions: byHour[h]||0 }));

    return { uniqueUsers, totalSeconds, avg, ranking, daily, peak, sessions: data.length };
  }, [data]);

  const moduleDetail = useMemo(() => {
    if (!selected) return null;
    const filtered = data.filter(r => r.module_id === selected);
    const byTab: Record<string, { sessions: number; total: number }> = {};
    filtered.forEach(r => {
      const t = r.tab_id || "(sem aba)";
      if (!byTab[t]) byTab[t] = { sessions: 0, total: 0 };
      byTab[t].sessions++;
      byTab[t].total += r.duration_seconds;
    });
    return {
      total: filtered.reduce((s,r)=>s+r.duration_seconds, 0),
      sessions: filtered.length,
      tabs: Object.entries(byTab).map(([id,d])=>({id,...d})).sort((a,b)=>b.total-a.total),
    };
  }, [selected, data]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-xs text-zinc-500 mt-1">Uso por módulo, abas e horários</p>
      </div>

      <div className="flex gap-1.5">
        {(["7d","30d","all"] as const).map(p => (
          <button key={p} onClick={() => { setPeriod(p); setSelected(null); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              period===p ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"
            }`}>
            {p==="7d"?"7 dias":p==="30d"?"30 dias":"Tudo"}
          </button>
        ))}
      </div>

      {loading ? <div className="text-sm text-zinc-500 py-8 text-center">Carregando…</div>
      : !stats ? <div className="text-sm text-zinc-500 py-8 text-center">Sem dados</div>
      : selected && moduleDetail ? (
        <div className="space-y-4">
          <button onClick={()=>setSelected(null)} className="flex items-center gap-2 text-xs text-emerald-400 hover:underline">
            <ArrowLeftCircle className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-lg font-bold">{MODULE_LABELS[selected] || selected}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={Clock} value={fmt(moduleDetail.total)} label="Tempo total" color="text-amber-400" />
            <Stat icon={TrendingUp} value={moduleDetail.sessions} label="Sessões" color="text-emerald-400" />
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Ranking de Abas</h3>
            <div className="space-y-2">
              {moduleDetail.tabs.map((t,i) => (
                <div key={t.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-zinc-300">{i+1}. {t.id}</span>
                  <span className="text-zinc-500">{t.sessions} sessões · {fmt(t.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat icon={Users} value={stats.uniqueUsers} label="Usuários" color="text-blue-400" />
            <Stat icon={TrendingUp} value={stats.sessions} label="Sessões" color="text-emerald-400" />
            <Stat icon={Clock} value={fmt(stats.totalSeconds)} label="Tempo total" color="text-amber-400" />
            <Stat icon={Zap} value={fmt(stats.avg)} label="Média" color="text-violet-400" />
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Atividade Diária
            </h3>
            <div className="h-40">
              <ResponsiveContainer><LineChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 11 }} />
                <Line type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart></ResponsiveContainer>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Horários de Pico
            </h3>
            <div className="h-32">
              <ResponsiveContainer><BarChart data={stats.peak}>
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "#71717a" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 11 }} />
                <Bar dataKey="sessions" fill="#10b981" radius={[2,2,0,0]} />
              </BarChart></ResponsiveContainer>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5" /> Ranking — clique para detalhar
            </h3>
            <div className="space-y-1">
              {stats.ranking.map((m, i) => (
                <button key={m.id} onClick={() => setSelected(m.id)}
                  className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-zinc-800/50 text-left transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-4">{i+1}</span>
                    <span className="text-xs font-bold text-zinc-100">{m.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-400 font-bold">{fmt(m.totalTime)}</p>
                    <p className="text-[10px] text-zinc-500">{m.sessions} sess · {m.users} user{m.users>1?"s":""}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
