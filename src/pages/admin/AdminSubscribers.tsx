import { useEffect, useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatTile, RankedBars, EmptyState } from "./components";
import { PayingUserFunnelSheet } from "@/components/admin/PayingUserFunnelSheet";

interface SubscribersData {
  kpis: { active: number; mrr_estimate: number; new_30d: number; ended_30d: number; churn_30d_pct: number };
  plan_split: { plan: string; count: number; mrr_estimate: number }[];
  tab_usage: { tab: string; views: number; interacts: number }[];
  card_usage: { card: string; views: number; interacts: number }[];
}

interface PayerRow {
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  plan: string | null;
  status: string;
  subscribed_since: string;
  current_period_end: string | null;
  first_seen: string | null;
  last_seen: string | null;
  modules: { tab: string; views: number }[];
}

const PLAN_LABELS: Record<string, string> = { monthly: "Mensal", annual: "Anual", lifetime: "Vitalício" };
const STATUS_STYLE: Record<string, string> = {
  active: "bg-success/10 text-success",
  past_due: "bg-warning/10 text-warning",
  canceled: "bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<string, string> = { active: "Ativo", past_due: "Atrasado", canceled: "Cancelado" };

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

const nameOf = (r: PayerRow) =>
  r.display_name?.trim() || r.email?.split("@")[0] || "(sem nome)";

export default function AdminSubscribers() {
  const [data, setData] = useState<SubscribersData | null>(null);
  const [payers, setPayers] = useState<PayerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ userId: string; email: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const [overview, detail] = await Promise.all([
        supabase.rpc("admin_subscribers_overview"),
        supabase.rpc("admin_paying_users_detail"),
      ]);
      if (overview.error) setError(overview.error.message);
      else setData(overview.data as unknown as SubscribersData);
      if (!detail.error) setPayers(((detail.data as any)?.users ?? []) as PayerRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Assinantes</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Quem já paga — MRR, churn e cada assinante em detalhe</p>
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

          {/* Lista de assinantes — clicável pra abrir a jornada completa */}
          <Panel
            title="Cada assinante"
            sub="Toque num assinante pra ver a jornada no funil, o que usa e a hora que assinou"
          >
            {!payers || payers.length === 0 ? (
              <EmptyState label="Nenhum assinante ainda." />
            ) : (
              <div className="space-y-2">
                {payers.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => r.user_id && setSelected({ userId: r.user_id, email: r.email })}
                    disabled={!r.user_id}
                    className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-accent/40 hover:bg-muted/30 transition-colors disabled:cursor-default"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-[14px] truncate">{nameOf(r)}</div>
                        <div className="text-[12px] text-muted-foreground truncate">{r.email ?? "(sem e-mail)"}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {PLAN_LABELS[r.plan ?? ""] ?? r.plan ?? "—"}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"}`}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-start gap-1.5">
                        <div className="text-[11px] text-muted-foreground">
                          <div>Assinou <strong className="text-foreground">{fmtDateTime(r.subscribed_since)}</strong></div>
                          <div className="mt-0.5">
                            visto {fmtDate(r.first_seen)} → {fmtDate(r.last_seen)}
                          </div>
                        </div>
                        {r.user_id && <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5" />}
                      </div>
                    </div>

                    {r.modules.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {r.modules.slice(0, 6).map((m) => (
                          <span key={m.tab} className="text-[11px] font-medium bg-muted rounded-full px-2.5 py-1">
                            {m.tab} <span className="text-muted-foreground">· {m.views}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Panel>

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

      <PayingUserFunnelSheet
        userId={selected?.userId ?? null}
        email={selected?.email ?? null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
