import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin";
import {
  Shield, LogOut, RefreshCw, Users, Activity, CreditCard, TrendingDown,
  Filter, BarChart3, Globe, MousePointerClick, AlertTriangle, Layers,
  RotateCcw, X, Eye,
} from "lucide-react";

const ADMIN_EMAIL = "jv20101958@gmail.com";

type Range = "today" | "7d" | "30d" | "all";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "Tudo" },
];

const rangeBounds = (r: Range): { from: string | null; to: string | null } => {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  if (r === "all") return { from: null, to: null };
  if (r === "today") { const s = new Date(now); s.setHours(0, 0, 0, 0); return { from: iso(s), to: null }; }
  const days = r === "7d" ? 7 : 30;
  return { from: iso(new Date(now.getTime() - days * 86400_000)), to: null };
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "—");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dur = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
};
const dt = (s: string | null | undefined) => s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const MODULE_LABEL: Record<string, string> = {
  financas: "Finanças", rotina: "Rotina", dieta: "Dieta", treino: "Treino",
};

type UserListSpec = {
  title: string;
  fetch: () => Promise<any>;
  columns: { key: string; label: string; fmt?: (v: any, row: any) => any }[];
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userList, setUserList] = useState<UserListSpec | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.email !== ADMIN_EMAIL) { navigate("/admin", { replace: true }); return; }
    checkIsAdmin(user.id).then(ok => {
      setAllowed(ok);
      if (!ok) navigate("/admin", { replace: true });
    });
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const { from, to } = rangeBounds(range);
      const results = await Promise.all([
        (supabase as any).rpc("admin_dashboard_v2"),
        (supabase as any).rpc("admin_landing_funnel", { _from: from, _to: to }),
        (supabase as any).rpc("admin_tutorial_dropoff", { _from: from, _to: to }),
        (supabase as any).rpc("admin_module_funnel"),
        (supabase as any).rpc("admin_top_tabs", { _from: from, _to: to }),
        (supabase as any).rpc("admin_retention_stats"),
        (supabase as any).rpc("admin_metrics_overview"),
      ]);
      const [overview, funnel, dropoff, modules, tabs, retention, metrics] = results;
      results.forEach((r: any, i: number) => { if (r?.error) console.error(`[admin] rpc ${i} error:`, r.error); });
      const obj = (v: any) => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
      const arr = (v: any) => Array.isArray(v) ? v : [];
      setData({
        overview: obj(overview?.data),
        funnel: obj(funnel?.data),
        dropoff: obj(dropoff?.data),
        modules: arr(modules?.data),
        tabs: arr(tabs?.data),
        retention: obj(retention?.data),
        metrics: obj(metrics?.data),
      });
    } catch (e: any) {
      console.error("[admin] load failed:", e);
      setLoadError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [range]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const resetCard = useCallback(async (key: string, label: string) => {
    if (!confirm(`Zerar o contador do card "${label}"? Os dados anteriores deixarão de aparecer aqui.`)) return;
    const { error } = await (supabase as any).rpc("admin_set_card_reset", { _key: key });
    if (error) { alert("Erro ao zerar: " + error.message); return; }
    load();
  }, [load]);

  const logout = async () => { await supabase.auth.signOut(); navigate("/admin", { replace: true }); };

  const openUserList = useCallback((spec: UserListSpec) => setUserList(spec), []);

  const o = data.overview ?? {};
  const m = data.metrics ?? {};
  const f = data.funnel ?? {};
  const r = data.retention ?? {};

  const funnelSteps = useMemo(() => ([
    { label: "Entrou na landing", value: f.landing ?? 0, icon: Globe },
    { label: 'Clicou em "Começar"', value: f.start_clicked ?? 0, icon: MousePointerClick },
    { label: "Iniciou tutorial", value: f.tutorial_started ?? 0, icon: BarChart3 },
    { label: "Completou tutorial", value: f.tutorial_completed ?? 0, icon: BarChart3 },
    { label: "Cadastrou (quick signup)", value: f.quicksignup_submitted ?? 0, icon: Users },
    { label: "Conta criada", value: f.signups ?? 0, icon: Users },
    { label: "Iniciou trial", value: f.trial_started ?? 0, icon: Activity },
    { label: "Pagou", value: f.paid ?? 0, icon: CreditCard },
  ]), [f]);

  if (loading || allowed === null) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">Verificando…</div>;
  }
  if (!allowed) return null;
  const maxF = Math.max(1, ...funnelSteps.map(s => s.value));

  const dropoffModules: any[] = data.dropoff?.modules ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-zinc-950/85 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Painel Administrativo</div>
              <div className="text-[10px] text-zinc-500 truncate">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map(p => (
              <button key={p.key} onClick={() => setRange(p.key)}
                className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                  range === p.key ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "text-zinc-400 hover:text-zinc-100 border border-transparent"}`}>
                {p.label}
              </button>
            ))}
            <button onClick={load} disabled={busy}
              className="ml-1 p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
            </button>
            <button onClick={logout} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8">
        {loadError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg px-3 py-2">
            Erro ao carregar dados: {loadError}
          </div>
        )}
        {/* KPIs */}
        <section>
          <SectionHeader icon={BarChart3} title="Visão geral" tiny onReset={() => resetCard("overview", "Visão geral")} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Usuários totais" value={fmt(o.total_users)} icon={Users} onClick={() => openUserList({
              title: "Todos os usuários",
              fetch: () => (supabase as any).rpc("admin_list_users"),
              columns: [
                { key: "email", label: "Email" },
                { key: "plan", label: "Plano", fmt: (v, row) => v ?? row.status ?? "—" },
                { key: "created_at", label: "Cadastro", fmt: dt },
                { key: "last_session", label: "Última sessão", fmt: dt },
                { key: "total_sessions", label: "Sessões", fmt: fmt },
              ],
            })} />
            <KPI label="Cadastros hoje" value={fmt(o.signups_today)} sub={`${fmt(o.signups_7d)} em 7d`} icon={Users} onClick={() => openUserList({
              title: "Cadastros recentes (hoje)",
              fetch: () => (supabase as any).rpc("admin_trials_started", { _period: "today" }),
              columns: [
                { key: "email", label: "Email" },
                { key: "started_at", label: "Cadastro", fmt: dt },
                { key: "subscription_status", label: "Status" },
                { key: "days_since_start", label: "Dias", fmt: fmt },
              ],
            })} />
            <KPI label="Ativos agora" value={fmt(o.active_now)} sub={`${fmt(o.active_24h)} em 24h`} icon={Activity} accent="emerald" />
            <KPI label="Ativos 7d / 30d" value={`${fmt(o.active_7d)} / ${fmt(o.active_30d)}`} icon={Activity} />
            <KPI label="Trials ativos" value={fmt(o.trial_active)} icon={Activity} onClick={() => openUserList({
              title: "Trials ativos",
              fetch: async () => {
                const res = await (supabase as any).rpc("admin_trials_started", { _period: "all" });
                if (res?.data) res.data = res.data.filter((r: any) => r.subscription_status === "trialing");
                return res;
              },
              columns: [
                { key: "email", label: "Email" },
                { key: "started_at", label: "Iniciou trial", fmt: dt },
                { key: "days_since_start", label: "Dias", fmt: fmt },
                { key: "subscription_status", label: "Status" },
              ],
            })} />
            <KPI label="Pagantes" value={fmt(o.paid_active)} icon={CreditCard} accent="emerald" onClick={() => openUserList({
              title: "Usuários pagantes",
              fetch: () => (supabase as any).rpc("admin_paying_users"),
              columns: [
                { key: "email", label: "Email" },
                { key: "plan", label: "Plano" },
                { key: "billing_period", label: "Período" },
                { key: "subscribed_at", label: "Pagou em", fmt: dt },
                { key: "current_period_end", label: "Renova em", fmt: dt },
                { key: "payment_method", label: "Pgto" },
              ],
            })} />
            <KPI label="MRR estimado" value={brl(o.mrr_brl ?? 0)} icon={CreditCard} accent="emerald" />
            <KPI label="Churn 30d / Conv 30d" value={`${m.churn_rate_30d ?? 0}% / ${m.conversion_rate_30d ?? 0}%`} icon={TrendingDown} accent="rose" onClick={() => openUserList({
              title: "Cancelados (30d)",
              fetch: () => (supabase as any).rpc("admin_canceled_users", { _days: 30 }),
              columns: [
                { key: "email", label: "Email" },
                { key: "plan", label: "Plano" },
                { key: "canceled_at", label: "Cancelou em", fmt: dt },
                { key: "reason", label: "Motivo", fmt: (v) => v ?? "—" },
              ],
            })} />
          </div>
        </section>

        {/* Funil tutorial */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <SectionHeader icon={Filter} title="Funil de aquisição & tutorial" subtitle="Da visita à conversão paga"
            onReset={() => resetCard("funnel", "Funil")} />
          <div className="space-y-2.5">
            {funnelSteps.map((s, i) => {
              const prev = i === 0 ? s.value : funnelSteps[i - 1].value;
              const conv = i === 0 ? 100 : (prev > 0 ? (s.value / prev) * 100 : 0);
              const drop = i > 0 && conv < 60;
              const w = (s.value / maxF) * 100;
              const Icon = s.icon;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1 gap-3">
                    <span className="flex items-center gap-2 text-zinc-300 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${drop ? "text-rose-400" : "text-zinc-500"}`} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="text-zinc-500 tabular-nums shrink-0">
                      <span className="text-zinc-100 font-semibold">{fmt(s.value)}</span>
                      {i > 0 && <span className={`ml-2 ${drop ? "text-rose-400" : "text-emerald-400"}`}>{conv.toFixed(1)}%</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${drop ? "bg-rose-500/70" : "bg-emerald-500"}`} style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Dropoff por módulo do tutorial */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <SectionHeader icon={Layers} title="Dropoff por módulo do tutorial" subtitle="Em qual passo o usuário abandona cada módulo"
            onReset={() => resetCard("dropoff", "Dropoff do tutorial")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dropoffModules.map((mod: any) => {
              const steps = mod.steps ?? [];
              const started = mod.started ?? 0;
              const completed = mod.completed ?? 0;
              const maxR = Math.max(1, started, ...steps.map((s: any) => s.reached));
              return (
                <div key={mod.module_id} className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-100">{MODULE_LABEL[mod.module_id] ?? mod.module_id}</h3>
                    <span className="text-[10px] text-zinc-500">
                      {fmt(started)} iniciou · {fmt(completed)} completou · {pct(completed, started)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {steps.length === 0 ? (
                      <div className="text-[11px] text-zinc-600">Sem dados de passos</div>
                    ) : steps.map((st: any, i: number) => {
                      const prev = i === 0 ? started : steps[i - 1].reached;
                      const conv = prev > 0 ? (st.reached / prev) * 100 : 0;
                      const drop = conv < 60;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-[11px] mb-0.5 gap-2">
                            <span className="text-zinc-400 truncate">Passo {st.step}{st.label ? ` · ${st.label}` : ""}</span>
                            <span className="tabular-nums shrink-0">
                              <span className="text-zinc-200">{fmt(st.reached)}</span>
                              <span className={`ml-1.5 ${drop ? "text-rose-400" : "text-emerald-400"}`}>{conv.toFixed(0)}%</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full ${drop ? "bg-rose-500/70" : "bg-emerald-500"}`} style={{ width: `${(st.reached / maxR) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {dropoffModules.length === 0 && <div className="text-xs text-zinc-500">Sem dados.</div>}
          </div>
        </section>

        {/* Módulos e abas mais usadas */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
            <SectionHeader icon={BarChart3} title="Módulos mais usados" subtitle="Por tempo total (todo período)"
              onReset={() => resetCard("modules", "Módulos mais usados")} />
            <Table
              headers={["Módulo", "Usuários", "Sessões", "Tempo"]}
              rows={(data.modules ?? []).slice(0, 12).map((row: any) => [
                MODULE_LABEL[row.module_id] ?? row.module_id,
                fmt(row.unique_users),
                fmt(row.total_sessions),
                dur(row.total_seconds ?? 0),
              ])}
              emptyMsg="Sem dados."
            />
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
            <SectionHeader icon={Layers} title="Abas mais usadas" subtitle="Top abas no período selecionado"
              onReset={() => resetCard("tabs", "Abas mais usadas")} />
            <Table
              headers={["Módulo · Aba", "Usuários", "Sessões", "Tempo"]}
              rows={(data.tabs ?? []).slice(0, 15).map((row: any) => [
                `${MODULE_LABEL[row.module_id] ?? row.module_id} · ${row.tab_id}`,
                fmt(row.unique_users),
                fmt(row.sessions),
                dur(row.total_seconds ?? 0),
              ])}
              emptyMsg="Sem dados."
            />
          </div>
        </section>

        {/* Tráfego por fonte */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <SectionHeader icon={Globe} title="Tráfego por fonte" subtitle="Visitas à landing por UTM source"
            onReset={() => resetCard("funnel", "Tráfego por fonte")} />
          <Table
            headers={["Fonte", "Visitas"]}
            rows={(f.by_source ?? []).map((s: any) => [s.source, fmt(s.visits)])}
            emptyMsg="Sem visitas no período."
          />
        </section>

        {/* Churn & retenção */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <SectionHeader icon={AlertTriangle} title="Churn & retenção (30d)" subtitle="Motivos de cancelamento e save rate"
            iconClass="text-rose-400"
            onReset={() => resetCard("retention", "Churn & retenção")}
            action={
              <button onClick={() => openUserList({
                title: "Cancelados (30d)",
                fetch: () => (supabase as any).rpc("admin_canceled_users", { _days: 30 }),
                columns: [
                  { key: "email", label: "Email" },
                  { key: "plan", label: "Plano" },
                  { key: "canceled_at", label: "Cancelou em", fmt: dt },
                  { key: "reason", label: "Motivo", fmt: (v) => v ?? "—" },
                ],
              })}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400">
                <Eye className="w-3 h-3" /> ver usuários
              </button>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Mini label="Tentativas" value={fmt(r.total_attempts_30d)} />
            <Mini label="Salvos" value={fmt(r.saved_count_30d)} />
            <Mini label="Save rate" value={`${r.save_rate_30d ?? 0}%`} />
            <Mini label="Cancelados" value={fmt(o.canceled_30d ?? r.funnel_30d?.churned)} />
          </div>
          <Table
            headers={["Motivo", "Qtd"]}
            rows={(r.reasons_30d ?? []).map((x: any) => [x.reason, fmt(x.count)])}
            emptyMsg="Sem cancelamentos no período."
          />
        </section>
      </main>

      {userList && <UserListModal spec={userList} onClose={() => setUserList(null)} />}
    </div>
  );
}

function SectionHeader({
  icon: Icon, title, subtitle, tiny, onReset, iconClass, action,
}: {
  icon: any; title: string; subtitle?: string; tiny?: boolean;
  onReset?: () => void; iconClass?: string; action?: React.ReactNode;
}) {
  if (tiny) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <Icon className="w-3.5 h-3.5" /> {title}
        </h2>
        {onReset && <ResetBtn onClick={onReset} />}
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Icon className={`w-4 h-4 ${iconClass ?? "text-emerald-400"}`} /> {title}
        </h2>
        {subtitle && <p className="text-[11px] text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        {onReset && <ResetBtn onClick={onReset} />}
      </div>
    </div>
  );
}

function ResetBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Zerar contador deste card"
      className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-md transition-colors">
      <RotateCcw className="w-3 h-3" /> zerar
    </button>
  );
}

function KPI({ label, value, sub, icon: Icon, accent, onClick }: { label: string; value: string; sub?: string; icon: any; accent?: "emerald" | "rose"; onClick?: () => void }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "text-zinc-300";
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`text-left bg-zinc-900/40 border border-zinc-800 rounded-xl p-3.5 transition-all ${clickable ? "hover:border-emerald-500/40 hover:bg-zinc-900/70 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
        {clickable ? <Eye className="w-3 h-3 text-zinc-600" /> : <Icon className={`w-3.5 h-3.5 ${color}`} />}
      </div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950/40 border border-zinc-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <div className="text-sm font-bold text-zinc-100 tabular-nums">{value}</div>
    </div>
  );
}

function Table({ headers, rows, emptyMsg }: { headers: string[]; rows: (string | number)[][]; emptyMsg: string }) {
  if (rows.length === 0) return <div className="text-xs text-zinc-600">{emptyMsg}</div>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
            {headers.map((h, i) => (
              <th key={i} className={`px-2 py-1.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-800/60">
              {row.map((c, j) => (
                <td key={j} className={`px-2 py-2 ${j === 0 ? "text-zinc-200 text-left" : "text-zinc-400 text-right tabular-nums"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserListModal({ spec, onClose }: { spec: UserListSpec; onClose: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await spec.fetch();
        if (cancelled) return;
        if (res?.error) { setErr(res.error.message); return; }
        setRows(Array.isArray(res?.data) ? res.data : []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [spec]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, filter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-t-2xl md:rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">{spec.title}</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">{rows ? `${filtered.length} de ${rows.length}` : "carregando…"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 border-b border-zinc-800 shrink-0">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Buscar email, plano, status…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40"
          />
        </div>
        <div className="overflow-auto flex-1">
          {err && <div className="p-4 text-xs text-rose-300">Erro: {err}</div>}
          {!err && rows === null && <div className="p-6 text-center text-xs text-zinc-500">Carregando…</div>}
          {!err && rows && filtered.length === 0 && <div className="p-6 text-center text-xs text-zinc-500">Nenhum usuário encontrado.</div>}
          {!err && filtered.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {spec.columns.map(c => (
                    <th key={c.key} className="px-3 py-2 font-medium text-left">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className="border-t border-zinc-800/60 hover:bg-zinc-900/40">
                    {spec.columns.map(c => (
                      <td key={c.key} className="px-3 py-2 text-zinc-300">
                        {c.fmt ? c.fmt(row[c.key], row) : (row[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
