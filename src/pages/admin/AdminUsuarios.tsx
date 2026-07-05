import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RangePicker, rangeToDates, type RangeKey, Panel, EmptyState } from "./components";

interface JourneyRow {
  email: string | null;
  furthest_step: string;
  furthest_ord: number;
  started_at: string;
  account_created_at: string | null;
  paid_at: string | null;
  last_event_at: string;
  utm_source: string | null;
}

const fmtDateTime = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function fmtDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1min";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins ? `${hours}h ${remMins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function AdminUsuarios() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [rows, setRows] = useState<JourneyRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setError(null);
    const { from, to } = rangeToDates(r);
    const { data, error: err } = await supabase.rpc("admin_funnel_users", { _from: from, _to: to, _limit: 300 });
    if (err) setError(err.message);
    else setRows((data as any)?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Usuários</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Jornada individual de quem passou pelo funil (mais recentes primeiro)</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Erro ao carregar: {error}
        </div>
      )}

      <Panel>
        {loading && !rows ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <EmptyState label="Nenhuma sessão no período selecionado." />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
            <table className="w-full text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4 font-semibold">E-mail</th>
                  <th className="pb-2 pr-4 font-semibold">Chegou até</th>
                  <th className="pb-2 pr-4 font-semibold">Criou conta</th>
                  <th className="pb-2 pr-4 font-semibold">Pagou</th>
                  <th className="pb-2 pr-4 font-semibold">Tempo no funil</th>
                  <th className="pb-2 font-semibold">Origem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.email ?? <span className="text-muted-foreground/60">(anônimo)</span>}</td>
                    <td className="py-2 pr-4">
                      <span className={r.furthest_ord === 11 ? "text-accent font-semibold" : ""}>{r.furthest_step}</span>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{fmtDateTime(r.account_created_at)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {r.paid_at ? <span className="text-accent font-semibold">{fmtDateTime(r.paid_at)}</span> : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                      {fmtDuration(r.started_at, r.paid_at ?? r.last_event_at)}
                    </td>
                    <td className="py-2 text-muted-foreground">{r.utm_source ?? "direto/desconhecido"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
