import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingDown, AlertTriangle, Clock, Gift, Pause, DollarSign,
  Calendar, Users, Award,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useChurnDeepMetrics } from "@/hooks/use-churn-metrics";

interface AtRisk {
  user_id: string; email: string; plan: string | null;
  last_session: string | null; days_inactive: number;
}

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Muito caro",
  not_using: "Não estou usando",
  missing_feature: "Falta funcionalidade",
  technical_issue: "Problema técnico",
  other: "Outro",
};

const OFFER_LABELS: Record<string, string> = {
  discount: "Desconto 50%",
  pause: "Pausa",
};

export default function AdminChurn() {
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const { data: deep, loading: deepLoading, error: deepError } = useChurnDeepMetrics();

  useEffect(() => {
    Promise.all([
      (supabase as any).rpc("admin_at_risk_users"),
      (supabase as any).rpc("admin_metrics_overview"),
    ]).then(([a, b]: any[]) => {
      setAtRisk(a.data || []);
      setOverview(b.data);
      setOverviewLoading(false);
    });
  }, []);

  if (overviewLoading || deepLoading) return <div className="text-sm text-zinc-500">Carregando análise profunda…</div>;
  if (deepError) return <div className="text-sm text-red-400">Erro: {deepError}</div>;
  if (!deep) return null;

  // Find offer winner
  const offerWinner = [...deep.offer_effectiveness].sort((a, b) => b.retention_pct - a.retention_pct)[0];
  const offerLoser = [...deep.offer_effectiveness].sort((a, b) => a.retention_pct - b.retention_pct)[0];

  // Find biggest cliff
  const biggestDrop = deep.trial_curve.reduce<{ day: number; drop: number }>(
    (acc, p, i) => {
      if (i === 0) return acc;
      const prev = deep.trial_curve[i - 1];
      const drop = prev.retention_pct - p.retention_pct;
      return drop > acc.drop ? { day: p.day, drop } : acc;
    },
    { day: 0, drop: 0 },
  );

  // Find best/worst reason
  const worstReason = [...deep.reasons].sort((a, b) => a.save_rate_pct - b.save_rate_pct)[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Análise profunda de Churn</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Por que cancelam, o que retém, em qual dia abandonam — visão executiva.
        </p>
      </div>

      {/* === SECTION 2a: KPIs === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={TrendingDown}
          label="Churn 30d"
          value={`${overview?.churn_rate_30d ?? 0}%`}
          sub={`${overview?.canceled_30d ?? 0} cancelamentos`}
          color="text-red-400"
        />
        <Stat
          icon={Users}
          label="Voluntário vs Involuntário"
          value={`${deep.voluntary_30d} / ${deep.involuntary_30d}`}
          sub="cancelou no app / falha pgto"
          color="text-amber-400"
        />
        <Stat
          icon={Clock}
          label="Tempo médio até cancelar"
          value={deep.avg_days_to_cancel !== null ? `${deep.avg_days_to_cancel}d` : "—"}
          sub={deep.most_common_churn_day ? `Pico no dia ${deep.most_common_churn_day}` : "sem dados"}
          color="text-orange-400"
        />
        <Stat
          icon={DollarSign}
          label="MRR perdido 30d"
          value={`R$ ${deep.mrr_lost_30d.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub="estimativa @ R$14,90"
          color="text-rose-400"
        />
      </div>

      {/* === SECTION 2b: Trial retention curve === */}
      <Card title="Curva de retenção do trial (D1 → D7)" subtitle="Coorte: signups dos últimos 60 dias">
        {biggestDrop.drop > 0 && (
          <div className="mb-3 text-xs px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <strong>Maior queda:</strong> dia {biggestDrop.day} ({biggestDrop.drop.toFixed(1)} pp de drop). Foco aqui.
          </div>
        )}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deep.trial_curve}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#71717a" tick={{ fontSize: 11 }} tickFormatter={(d) => `D${d}`} />
              <YAxis stroke="#71717a" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12, borderRadius: 6 }}
                labelFormatter={(l) => `Dia ${l}`}
                formatter={(v: number, _n, p: any) => [
                  `${v}% (${p.payload.active_on_day}/${p.payload.cohort_size})`,
                  "ativos",
                ]}
              />
              <Line type="monotone" dataKey="retention_pct" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          % de usuários do coorte que voltaram ao app em cada dia desde o signup.
        </p>
      </Card>

      {/* === SECTION 2c: Offer effectiveness === */}
      <Card title="Cupons & Pausa: o que está retendo de verdade">
        {deep.offer_effectiveness.length === 0 ? (
          <Empty>Nenhuma oferta aceita ainda.</Empty>
        ) : (
          <>
            {offerWinner && offerLoser && offerWinner.offer_type !== offerLoser.offer_type && (
              <div className="mb-4 text-xs px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <strong>{OFFER_LABELS[offerWinner.offer_type] ?? offerWinner.offer_type}</strong> retém {offerWinner.retention_pct}%
                vs <strong>{OFFER_LABELS[offerLoser.offer_type] ?? offerLoser.offer_type}</strong> {offerLoser.retention_pct}% —
                priorize a primeira no funil de cancelamento.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {deep.offer_effectiveness.map((o) => {
                const isWinner = offerWinner && o.offer_type === offerWinner.offer_type && deep.offer_effectiveness.length > 1;
                const Icon = o.offer_type === "discount" ? Gift : Pause;
                return (
                  <div
                    key={o.offer_type}
                    className={`relative rounded-lg border p-4 ${
                      isWinner ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/40"
                    }`}
                  >
                    {isWinner && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
                        <Award className="w-3 h-3" /> vencedor
                      </span>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-4 h-4 ${o.offer_type === "discount" ? "text-emerald-400" : "text-blue-400"}`} />
                      <span className="text-sm font-medium text-zinc-100">{OFFER_LABELS[o.offer_type] ?? o.offer_type}</span>
                    </div>
                    <div className="text-3xl font-semibold text-zinc-100">{o.retention_pct}%</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {o.still_active} de {o.accepted} ainda ativos hoje
                    </div>
                    <div className="mt-3 w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={o.offer_type === "discount" ? "bg-emerald-400 h-full" : "bg-blue-400 h-full"}
                        style={{ width: `${Math.min(100, o.retention_pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* === SECTION 2d: Reasons × save rate === */}
      <Card title="Motivos × eficácia do save (90d)">
        {deep.reasons.length === 0 ? (
          <Empty>Nenhum motivo de cancelamento registrado.</Empty>
        ) : (
          <>
            {worstReason && worstReason.total >= 3 && worstReason.save_rate_pct < 30 && (
              <div className="mb-3 text-xs px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-300">
                <strong>"{REASON_LABELS[worstReason.reason] ?? worstReason.reason}"</strong> tem save rate de
                apenas <strong>{worstReason.save_rate_pct}%</strong> — a oferta atual não convence esse público.
                Considere oferta diferente ou roteiro diferente para esse motivo.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 px-3">Motivo</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-right py-2 px-3">Salvos c/ desconto</th>
                    <th className="text-right py-2 px-3">Salvos c/ pausa</th>
                    <th className="text-right py-2 px-3">Churnaram</th>
                    <th className="text-right py-2 px-3">Save rate</th>
                  </tr>
                </thead>
                <tbody>
                  {deep.reasons.map((r) => (
                    <tr key={r.reason} className="border-b border-zinc-900">
                      <td className="py-2 px-3 text-zinc-100">{REASON_LABELS[r.reason] ?? r.reason}</td>
                      <td className="text-right py-2 px-3 text-zinc-400">{r.total}</td>
                      <td className="text-right py-2 px-3 text-emerald-400">{r.saved_discount}</td>
                      <td className="text-right py-2 px-3 text-blue-400">{r.saved_pause}</td>
                      <td className="text-right py-2 px-3 text-red-400">{r.churned}</td>
                      <td className="text-right py-2 px-3 font-medium">
                        <span
                          className={
                            r.save_rate_pct >= 50 ? "text-emerald-400"
                            : r.save_rate_pct >= 25 ? "text-amber-400" : "text-red-400"
                          }
                        >
                          {r.save_rate_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* === SECTION 2e: Cohorts 6 months === */}
      <Card title="Cohorts mensais (últimos 6 meses)" subtitle="Acompanhe a tendência: a retenção está melhorando?">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
              <tr>
                <th className="text-left py-2 px-3">Mês</th>
                <th className="text-right py-2 px-3">Signups</th>
                <th className="text-right py-2 px-3">Conversão</th>
                <th className="text-right py-2 px-3">Cancelados</th>
                <th className="text-right py-2 px-3">Retenção 30d</th>
              </tr>
            </thead>
            <tbody>
              {deep.cohorts.map((c) => (
                <tr key={c.month} className="border-b border-zinc-900">
                  <td className="py-2 px-3 text-zinc-100 font-mono text-xs">{c.month}</td>
                  <td className="text-right py-2 px-3 text-zinc-300">{c.signups}</td>
                  <td className="text-right py-2 px-3">
                    <span className="text-emerald-400">{c.converted}</span>
                    <span className="text-zinc-600 text-xs ml-1">({c.conversion_pct}%)</span>
                  </td>
                  <td className="text-right py-2 px-3 text-red-400">{c.canceled}</td>
                  <td className="text-right py-2 px-3">
                    <span className={c.retention_30d_pct >= 30 ? "text-emerald-400" : c.retention_30d_pct >= 15 ? "text-amber-400" : "text-red-400"}>
                      {c.retention_30d_pct}%
                    </span>
                    <span className="text-zinc-600 text-xs ml-1">({c.retained_30d})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* === SECTION 2f: At-risk users === */}
      <Card title={`Pagantes inativos ≥ 7 dias (${atRisk.length})`} subtitle="Candidatos a re-engajamento proativo">
        {atRisk.length === 0 ? (
          <Empty>Ninguém em risco no momento. 🎉</Empty>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {atRisk.slice(0, 50).map((u) => (
              <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-100 truncate">{u.email}</p>
                  <p className="text-[10px] text-zinc-500">{u.plan || "—"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-orange-400 font-bold">{u.days_inactive}d</p>
                  <p className="text-[10px] text-zinc-500">inativo</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
    <Icon className={`w-3.5 h-3.5 ${color} mb-2`} />
    <p className="text-xl font-bold text-zinc-100">{value}</p>
    <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
  </div>
);

const Card = ({ title, subtitle, children }: any) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
    <div className="mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{title}</h3>
      {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-zinc-500 py-4 text-center">{children}</p>
);
