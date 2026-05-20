import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, CheckCircle2, Activity, Clock, RefreshCw, Users as UsersIcon, TrendingDown } from "lucide-react";
import ResetAnalyticsButton from "@/components/admin/ResetAnalyticsButton";

interface DropoffStep { step: number; label: string; total: number; reached: number }
interface DropoffModule { module_id: string; started: number; completed: number; steps: DropoffStep[] }
interface DropoffResult { days: number; modules: DropoffModule[]; generated_at: string }


interface ModuleStat { module_id: string; users: number; total_seconds: number }
interface CohortStat {
  total_signups: number;
  confirmed: number;
  users_with_use: number;
  total_seconds: number;
  sessions: number;
  modules: ModuleStat[];
}
interface CompareResult {
  cutoff: string;
  before: CohortStat;
  after: CohortStat;
  generated_at: string;
}

interface TutorialUser {
  user_id: string;
  email: string;
  completed_at: string;
  action_key: string;
}

const fmtMin = (s: number) => `${Math.round(s / 60)} min`;
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—");
const fmtDateTime = (s: string) => new Date(s).toLocaleString("pt-BR");

const CohortCard = ({ title, subtitle, data, accent }: { title: string; subtitle: string; data: CohortStat; accent: string }) => (
  <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
    <div>
      <h3 className={`text-sm font-bold ${accent}`}>{title}</h3>
      <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <Stat icon={<Sparkles className="w-3 h-3" />} label="Cadastros" value={data.total_signups.toString()} />
      <Stat icon={<CheckCircle2 className="w-3 h-3" />} label="Confirmaram" value={`${data.confirmed} (${pct(data.confirmed, data.total_signups)})`} />
      <Stat icon={<Activity className="w-3 h-3" />} label="Usaram módulos" value={`${data.users_with_use} (${pct(data.users_with_use, data.total_signups)})`} />
      <Stat icon={<Clock className="w-3 h-3" />} label="Tempo total" value={fmtMin(data.total_seconds)} />
    </div>

    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Minutos por módulo</h4>
      {data.modules.length === 0 ? (
        <p className="text-xs text-zinc-600">Sem dados.</p>
      ) : (
        <div className="space-y-1.5">
          {data.modules.slice(0, 12).map(m => (
            <div key={m.module_id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{m.module_id}</span>
              <span className="text-zinc-500">{fmtMin(m.total_seconds)} · {m.users} u</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 p-2.5">
    <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider mb-1">{icon}{label}</div>
    <div className="text-sm font-bold text-zinc-100">{value}</div>
  </div>
);

export default function AdminTutorialCompare() {
  const [data, setData] = useState<CompareResult | null>(null);
  const [users, setUsers] = useState<TutorialUser[]>([]);
  const [dropoff, setDropoff] = useState<DropoffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [err, setErr] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState<string>("all");
  const [dropoffDays, setDropoffDays] = useState<number>(1);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const [cmp, usr, drp] = await Promise.all([
      (supabase as any).rpc("admin_tutorial_compare"),
      (supabase as any).rpc("admin_tutorial_users"),
      (supabase as any).rpc("admin_tutorial_dropoff", { _days: dropoffDays }),
    ]);
    if (cmp.error) setErr(cmp.error.message);
    else setData(cmp.data as CompareResult);
    setUsers((usr.data as TutorialUser[]) || []);
    setDropoff((drp.data as DropoffResult) || null);
    setLoading(false);
    setRefreshing(false);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;
  if (err) return <div className="text-sm text-red-400">Erro: {err}</div>;
  if (!data) return null;

  const cutoffDate = new Date(data.cutoff);

  // Group users by action_key
  const byAction = users.reduce<Record<string, TutorialUser[]>>((acc, u) => {
    (acc[u.action_key] ||= []).push(u);
    return acc;
  }, {});
  const actionKeys = Object.keys(byAction).sort();
  const filteredUsers = filterKey === "all" ? users : (byAction[filterKey] || []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutorial</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Comparação A/B + usuários por etapa · atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <ResetAnalyticsButton onDone={() => load()} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <CohortCard
          title="Tutorial Antigo"
          subtitle={`Cadastros antes de ${cutoffDate.toLocaleString("pt-BR")}`}
          data={data.before}
          accent="text-zinc-300"
        />
        <CohortCard
          title="Tutorial Novo"
          subtitle={`Cadastros a partir de ${cutoffDate.toLocaleString("pt-BR")}`}
          data={data.after}
          accent="text-emerald-400"
        />
      </div>

      {/* Drop-off por etapa de cada módulo */}
      {dropoff && dropoff.modules.length > 0 && (
        <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-zinc-100">Onde os usuários abandonam o tutorial</h3>
          </div>
          <p className="text-[11px] text-zinc-500 mb-4">Últimos 30 dias · etapa por etapa em cada módulo</p>

          <div className="grid md:grid-cols-2 gap-4">
            {dropoff.modules.map(mod => {
              const startedFromSteps = mod.steps[0]?.reached ?? mod.started;
              const base = Math.max(mod.started, startedFromSteps, 1);
              return (
                <div key={mod.module_id} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-zinc-100 capitalize">{mod.module_id}</span>
                    <span className="text-[10px] text-zinc-500">
                      {mod.completed}/{base} concluíram ({pct(mod.completed, base)})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {mod.steps.map((s, i) => {
                      const prev = i === 0 ? base : (mod.steps[i - 1]?.reached ?? base);
                      const dropFromPrev = Math.max(0, prev - s.reached);
                      const pctReached = base > 0 ? (s.reached / base) * 100 : 0;
                      return (
                        <div key={s.step}>
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="text-zinc-300 truncate pr-2 max-w-[60%]" title={s.label}>
                              {s.step + 1}. {s.label || "—"}
                            </span>
                            <span className="text-zinc-500 shrink-0">
                              {s.reached} {dropFromPrev > 0 && <span className="text-orange-400">−{dropFromPrev}</span>}
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-orange-500 rounded-full"
                              style={{ width: `${pctReached}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {mod.steps.length === 0 && (
                      <p className="text-[11px] text-zinc-600">Sem dados ainda — usuários precisam passar pelo tutorial.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista real de usuários por etapa */}
      <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-100">Usuários que completaram cada etapa</h3>
          </div>
          <span className="text-[11px] text-zinc-500">{filteredUsers.length} de {users.length} ativações</span>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          <FilterBtn active={filterKey === "all"} onClick={() => setFilterKey("all")}>
            Todas ({users.length})
          </FilterBtn>
          {actionKeys.map(k => (
            <FilterBtn key={k} active={filterKey === k} onClick={() => setFilterKey(k)}>
              {k} ({byAction[k].length})
            </FilterBtn>
          ))}
        </div>

        {filteredUsers.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">
            Nenhum usuário completou {filterKey === "all" ? "ainda" : `"${filterKey}"`}.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead className="text-zinc-500 uppercase text-[10px] tracking-wider">
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">Etapa</th>
                  <th className="text-left py-2 px-2">Completou em</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.slice(0, 100).map(u => (
                  <tr key={`${u.user_id}-${u.action_key}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 px-2 text-zinc-100 truncate max-w-[240px]">{u.email}</td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">{u.action_key}</span>
                    </td>
                    <td className="py-2 px-2 text-zinc-400">{fmtDateTime(u.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length > 100 && (
              <p className="text-[11px] text-zinc-500 mt-3 text-center">
                Mostrando primeiros 100 de {filteredUsers.length}.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
        <p>
          <strong className="text-zinc-200">Como ler:</strong> a tabela acima lista quem completou cada ação chave do tutorial pós-cadastro (vem de <code>user_activations</code>). Antes esse dado não aparecia direito porque a página não estava ligada. Agora atualiza sozinho a cada 30 segundos.
        </p>
      </div>
    </div>
  );
}

const FilterBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      active
        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
        : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200"
    }`}
  >
    {children}
  </button>
);
