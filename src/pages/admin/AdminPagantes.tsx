import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, EmptyState } from "./components";

interface ModuleUsage { tab: string; views: number }
interface PayerRow {
  email: string | null;
  plan: string | null;
  status: string;
  subscribed_since: string;
  current_period_end: string | null;
  first_seen: string | null;
  last_seen: string | null;
  modules: ModuleUsage[];
}

const PLAN_LABELS: Record<string, string> = { monthly: "Mensal", annual: "Anual", lifetime: "Vitalício" };
const STATUS_STYLE: Record<string, string> = {
  active: "bg-success/10 text-success",
  past_due: "bg-warning/10 text-warning",
  canceled: "bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<string, string> = { active: "Ativo", past_due: "Atrasado", canceled: "Cancelado" };

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function AdminPagantes() {
  const [rows, setRows] = useState<PayerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc("admin_paying_users_detail");
      if (err) setError(err.message);
      else setRows((data as any)?.users ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pagantes</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Cada assinante, o que usa e desde quando está no app</p>
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
      ) : !rows || rows.length === 0 ? (
        <Panel><EmptyState label="Nenhum assinante ainda." /></Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <Panel key={i}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-bold text-[14px]">{r.email ?? "(sem e-mail)"}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {PLAN_LABELS[r.plan ?? ""] ?? r.plan ?? "—"}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                </div>
                <div className="text-right text-[12px] text-muted-foreground">
                  <div>Assina desde <strong className="text-foreground">{fmtDate(r.subscribed_since)}</strong></div>
                  <div className="mt-0.5">
                    1º dia <strong className="text-foreground">{fmtDate(r.first_seen)}</strong> · último dia <strong className="text-foreground">{fmtDate(r.last_seen)}</strong>
                  </div>
                </div>
              </div>

              {r.modules.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/70">Sem uso registrado ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {r.modules.slice(0, 8).map((m) => (
                    <span key={m.tab} className="text-[11px] font-medium bg-muted rounded-full px-2.5 py-1">
                      {m.tab} <span className="text-muted-foreground">· {m.views}</span>
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
