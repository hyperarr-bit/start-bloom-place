import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, TrendingDown, Gift, Pause } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts";

interface RetentionStats {
  reasons_30d: { reason: string; count: number }[];
  funnel_30d: Record<string, number>;
  save_rate_30d: number;
  total_attempts_30d: number;
  saved_count_30d: number;
}

interface OfferRow {
  offer_type: string;
  status: string;
  count: number;
  pct_of_type: number;
}

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Muito caro",
  not_using: "Não estou usando",
  missing_feature: "Falta funcionalidade",
  technical_issue: "Problema técnico",
  other: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aguardando",
  applied: "Aplicado",
  failed: "Falhou",
  expired: "Expirado",
  consumed: "Consumido",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function AdminRetention() {
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsR, offersR] = await Promise.all([
          (supabase as any).rpc("admin_retention_stats"),
          (supabase as any).rpc("admin_retention_offers_breakdown"),
        ]);
        if (cancelled) return;
        if (statsR.error) throw statsR.error;
        if (offersR.error) throw offersR.error;
        setStats(statsR.data as RetentionStats);
        setOffers((offersR.data ?? []) as OfferRow[]);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
      </div>
    );
  }

  if (error || !stats) {
    return <div className="text-red-400 text-sm">Erro: {error ?? "sem dados"}</div>;
  }

  const funnel = stats.funnel_30d ?? {};
  const reasonsData = (stats.reasons_30d ?? []).map((r) => ({
    name: REASON_LABELS[r.reason] ?? r.reason,
    value: Number(r.count),
  }));

  const savedDiscount = Number(funnel.saved_discount ?? 0);
  const savedPause = Number(funnel.saved_pause ?? 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold">Retention — Save Flow</h1>
        <span className="text-xs text-zinc-500 ml-2">últimos 30 dias</span>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={<TrendingDown className="w-4 h-4" />} label="Tentativas" value={stats.total_attempts_30d} />
        <Card
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          label="Save Rate"
          value={`${stats.save_rate_30d}%`}
          highlight
        />
        <Card icon={<Gift className="w-4 h-4 text-blue-400" />} label="Salvos por desconto" value={savedDiscount} />
        <Card icon={<Pause className="w-4 h-4 text-amber-400" />} label="Salvos por pausa" value={savedPause} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reasons pie */}
        <Section title="Motivos de cancelamento">
          {reasonsData.length === 0 ? (
            <Empty>Sem motivos registrados</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={reasonsData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {reasonsData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* Funnel */}
        <Section title="Funil do save flow">
          <div className="space-y-2 text-sm">
            <FunnelRow label="Abriu o cancelamento" value={Number(funnel.opened ?? 0) + Number(funnel.reason_given ?? 0) + savedDiscount + savedPause + Number(funnel.churned ?? 0)} />
            <FunnelRow label="Informou motivo" value={Number(funnel.reason_given ?? 0) + savedDiscount + savedPause + Number(funnel.saved_feedback ?? 0)} />
            <FunnelRow label="Aceitou desconto" value={savedDiscount} accent="text-emerald-400" />
            <FunnelRow label="Aceitou pausa" value={savedPause} accent="text-emerald-400" />
            <FunnelRow label="Aceitou feedback" value={Number(funnel.saved_feedback ?? 0)} accent="text-emerald-400" />
            <FunnelRow label="Cancelou (churn)" value={Number(funnel.churned ?? 0)} accent="text-red-400" />
          </div>
        </Section>
      </div>

      {/* Offers breakdown - grouped by offer_type with success rate */}
      <Section title="Performance por tipo de oferta">
        {offers.length === 0 ? (
          <Empty>Nenhuma oferta de retenção ainda</Empty>
        ) : (
          <OffersBreakdownTable rows={offers} />
        )}
        <p className="text-xs text-zinc-500 mt-3">
          <strong className="text-zinc-400">Taxa de sucesso na aplicação</strong> = aplicados ÷ (aplicados + falhas).
          Não conta ofertas ainda aguardando próxima cobrança. "Aguardando" = aceita pelo usuário mas ainda não
          aplicada no AbacatePay (job <code className="text-zinc-400">apply-pending-discounts</code>).
        </p>
      </Section>
    </div>
  );
}

function OffersBreakdownTable({ rows }: { rows: OfferRow[] }) {
  const grouped = rows.reduce<Record<string, { rows: OfferRow[]; total: number; applied: number; failed: number }>>(
    (acc, r) => {
      if (!acc[r.offer_type]) acc[r.offer_type] = { rows: [], total: 0, applied: 0, failed: 0 };
      acc[r.offer_type].rows.push(r);
      acc[r.offer_type].total += r.count;
      if (r.status === "applied") acc[r.offer_type].applied += r.count;
      if (r.status === "failed") acc[r.offer_type].failed += r.count;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, g]) => {
        const successDenom = g.applied + g.failed;
        const successRate = successDenom > 0 ? Math.round((g.applied / successDenom) * 1000) / 10 : null;
        const typeLabel = type === "discount" ? "Desconto 50% / 2 ciclos" : type === "pause" ? "Pausa 1-3 meses" : type;
        const rateColor = successRate === null ? "text-zinc-500"
          : successRate >= 80 ? "text-emerald-400"
          : successRate >= 50 ? "text-amber-400" : "text-red-400";

        return (
          <div key={type} className="rounded-lg border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between bg-zinc-900/60 px-4 py-3 border-b border-zinc-800">
              <div>
                <div className="text-sm font-medium text-zinc-100">{typeLabel}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {g.total} aceitas · {g.applied} aplicadas · {g.failed} falharam
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-semibold ${rateColor}`}>
                  {successRate === null ? "—" : `${successRate}%`}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">taxa de sucesso</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Qtd</th>
                  <th className="text-right px-4 py-2">% do tipo</th>
                  <th className="text-left px-4 py-2 pr-4 w-1/3">Distribuição</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-900">
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        r.status === "applied" ? "bg-emerald-500/10 text-emerald-400" :
                        r.status === "failed" ? "bg-red-500/10 text-red-400" :
                        r.status === "active" ? "bg-amber-500/10 text-amber-400" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2 font-medium text-zinc-100">{r.count}</td>
                    <td className="text-right px-4 py-2 text-zinc-500">{r.pct_of_type}%</td>
                    <td className="px-4 py-2 pr-4">
                      <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            r.status === "applied" ? "bg-emerald-400" :
                            r.status === "failed" ? "bg-red-400" :
                            r.status === "active" ? "bg-amber-400" : "bg-zinc-600"
                          }`}
                          style={{ width: `${Math.min(100, r.pct_of_type)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Card({
  icon, label, value, highlight,
}: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${
      highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/50"
    }`}>
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">{icon}{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${highlight ? "text-emerald-400" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <h2 className="text-sm font-medium text-zinc-300 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function FunnelRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-900 py-1.5">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-medium ${accent ?? "text-zinc-200"}`}>{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-zinc-500 text-sm py-6 text-center">{children}</div>;
}
