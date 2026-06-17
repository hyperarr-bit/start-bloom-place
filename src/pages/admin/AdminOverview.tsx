import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, DollarSign, Users, Rocket, TrendingUp, TrendingDown, UserPlus, Activity,
} from "lucide-react";

interface Overview {
  total_users: number;
  active_24h: number;
  active_7d: number;
  active_30d: number;
  signups_30d: number;
  paid_active: number;
  paid_monthly: number;
  paid_annual: number;
  trial_active: number;
  canceled_30d: number;
  churn_rate_30d: number;
  conversion_rate_30d: number;
  mrr_estimated: number;
  generated_at: string;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (n: number) => (n ?? 0).toLocaleString("pt-BR");

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const { data: res, error } = await (supabase as any).rpc("admin_metrics_overview");
    if (error) setError(error.message);
    setData((res as Overview) || null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Os números que importam pro SaaS — receita, retenção e crescimento num só lugar.
            {data && ` · atualizado ${new Date(data.generated_at).toLocaleTimeString("pt-BR")}`}
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

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 p-3 text-sm">
          Erro: {error}
        </div>
      )}

      {loading || !data ? (
        <div className="text-sm text-zinc-500">Carregando…</div>
      ) : (
        <>
          {/* Linha 1 — north-star */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BigCard
              Icon={DollarSign}
              accent="emerald"
              label="MRR estimado"
              value={fmtMoney(data.mrr_estimated)}
              sub={`${data.paid_monthly} mensais · ${data.paid_annual} anuais`}
            />
            <BigCard
              Icon={Users}
              accent="sky"
              label="Assinantes pagantes"
              value={fmtNum(data.paid_active)}
              sub={`${fmtNum(data.trial_active)} em trial agora`}
            />
            <BigCard
              Icon={TrendingUp}
              accent="violet"
              label="Conversão trial → pago (30d)"
              value={`${data.conversion_rate_30d}%`}
              sub="coorte de 30–60 dias atrás"
            />
          </div>

          {/* Linha 2 — saúde */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi Icon={TrendingDown} label="Churn 30d" value={`${data.churn_rate_30d}%`}
              tone={data.churn_rate_30d > 10 ? "bad" : "good"}
              sub={`${fmtNum(data.canceled_30d)} cancelaram`} />
            <Kpi Icon={UserPlus} label="Cadastros 30d" value={fmtNum(data.signups_30d)} />
            <Kpi Icon={Activity} label="Ativos 7d" value={fmtNum(data.active_7d)}
              sub={`${fmtNum(data.active_24h)} nas últimas 24h`} />
            <Kpi Icon={Users} label="Total de contas" value={fmtNum(data.total_users)}
              sub={`${fmtNum(data.active_30d)} ativos em 30d`} />
          </div>

          {/* Funil de receita resumido */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-4">
              Onde estão os usuários
            </div>
            <div className="space-y-3">
              <FunnelBar label="Total de contas" n={data.total_users} base={data.total_users} color="bg-zinc-600" />
              <FunnelBar label="Ativos em 30 dias" n={data.active_30d} base={data.total_users} color="bg-sky-500/70" />
              <FunnelBar label="Em trial agora" n={data.trial_active} base={data.total_users} color="bg-amber-500/70" />
              <FunnelBar label="Pagantes ativos" n={data.paid_active} base={data.total_users} color="bg-emerald-500/70" />
            </div>
          </div>

          <p className="text-[11px] text-zinc-600">
            MRR considera R$14,90/mês para planos mensais e R$3,90/mês (R$46,80/ano) para anuais.
            Conversão = pagantes ativos da coorte que se cadastrou entre 30 e 60 dias atrás.
          </p>
        </>
      )}
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  violet: "text-violet-400",
};

const BigCard = ({ Icon, accent, label, value, sub }: {
  Icon: any; accent: string; label: string; value: string; sub?: string;
}) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${ACCENTS[accent]}`} />
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{label}</p>
    </div>
    <p className="text-3xl font-bold text-zinc-100 mt-2 tabular-nums">{value}</p>
    {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
  </div>
);

const Kpi = ({ Icon, label, value, sub, tone }: {
  Icon: any; label: string; value: string; sub?: string; tone?: "good" | "bad";
}) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-zinc-500" />
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
    <p className={`text-2xl font-bold mt-1 tabular-nums ${
      tone === "bad" ? "text-red-400" : tone === "good" ? "text-emerald-400" : "text-zinc-100"
    }`}>{value}</p>
    {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
  </div>
);

const FunnelBar = ({ label, n, base, color }: { label: string; n: number; base: number; color: string }) => {
  const pct = base > 0 ? (n / base) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs text-zinc-300">{label}</span>
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-bold tabular-nums text-zinc-100">{fmtNum(n)}</span>
          <span className="text-[10px] text-zinc-500 tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
};
