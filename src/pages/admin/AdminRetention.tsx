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

      {/* Offers breakdown */}
      <Section title="Status das ofertas (todo o histórico)">
        {offers.length === 0 ? (
          <Empty>Nenhuma oferta de retenção ainda</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                <tr>
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Qtd</th>
                  <th className="text-right py-2">% do tipo</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o, i) => (
                  <tr key={i} className="border-b border-zinc-900">
                    <td className="py-2">{o.offer_type === "discount" ? "Desconto 50%" : "Pausa"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        o.status === "applied" ? "bg-emerald-500/10 text-emerald-400" :
                        o.status === "failed" ? "bg-red-500/10 text-red-400" :
                        o.status === "active" ? "bg-amber-500/10 text-amber-400" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="text-right py-2">{o.count}</td>
                    <td className="text-right py-2 text-zinc-500">{o.pct_of_type}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500 mt-3">
          "Aguardando" = aceita pelo usuário mas ainda não aplicada na próxima cobrança do AbacatePay.
          O job <code className="text-zinc-400">apply-pending-discounts</code> tenta automaticamente
          a cada cobrança nova e em sweep diário.
        </p>
      </Section>
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
