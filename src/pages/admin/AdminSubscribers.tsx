import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatTile, RankedBars } from "./components";

interface SubscribersData {
  kpis: { active: number; mrr_estimate: number; new_30d: number; ended_30d: number; churn_30d_pct: number };
  plan_split: { plan: string; count: number; mrr_estimate: number }[];
  tab_usage: { tab: string; views: number; interacts: number }[];
  card_usage: { card: string; views: number; interacts: number }[];
}

const PLAN_LABELS: Record<string, string> = { monthly: "Mensal", annual: "Anual", lifetime: "Vitalício" };

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function AdminSubscribers() {
  const [data, setData] = useState<SubscribersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await supabase.rpc("admin_subscribers_overview");
      if (err) setError(err.message);
      else setData(res as unknown as SubscribersData);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Assinantes</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Quem já paga — MRR, churn e o que mais usa</p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Erro ao carregar: {error}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Assinantes ativos" value={data.kpis.active.toLocaleString("pt-BR")} />
            <StatTile label="MRR estimado" value={fmtBRL(data.kpis.mrr_estimate)} sub="por preço padrão do plano" />
            <StatTile label="Novos (30d)" value={data.kpis.new_30d.toLocaleString("pt-BR")} />
            <StatTile
              label="Churn (30d)"
              value={`${data.kpis.churn_30d_pct}%`}
              sub={`${data.kpis.ended_30d} período(s) venceram`}
            />
          </div>

          <Panel title="Plano" sub="Assinantes ativos por periodicidade">
            <RankedBars
              items={data.plan_split.map((p) => ({
                label: PLAN_LABELS[p.plan] ?? p.plan,
                value: p.count,
                sub: `${fmtBRL(p.mrr_estimate)}/mês`,
              }))}
            />
          </Panel>

          <div className="grid md:grid-cols-2 gap-5">
            <Panel title="Abas mais usadas" sub="Finanças — últimos 30 dias">
              <RankedBars items={data.tab_usage.map((t) => ({ label: t.tab, value: t.views, sub: `${t.interacts} interações` }))} />
            </Panel>
            <Panel title="Cards mais usados" sub="Finanças — últimos 30 dias">
              <RankedBars items={data.card_usage.map((c) => ({ label: c.card, value: c.views, sub: `${c.interacts} interações` }))} />
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
