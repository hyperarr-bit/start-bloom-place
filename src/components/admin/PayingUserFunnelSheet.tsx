import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar, CheckCircle2, Circle, Clock, CreditCard, MousePointerClick } from "lucide-react";

interface Props {
  userId: string | null;
  email: string | null;
  onClose: () => void;
}

interface Step { key: string; label: string; at: string | null; reached: boolean; }
interface TabRow { module_id: string; tab_id: string; seconds: number; visits: number; }
interface CardRow { action_key: string; completed_at: string; }
interface TimelineDay { day: number; seconds: number; tabs: { tab: string; module: string }[]; activations: string[]; active: boolean; }
interface Funnel {
  email: string;
  signup_at: string;
  subscription: { plan: string; billing_period: string; status: string; payment_method: string; subscribed_at: string; current_period_end: string; };
  totals: { total_sessions: number; total_seconds: number; top_module: string | null; days_trial_to_paid: number | null; };
  steps: Step[];
  tabs: TabRow[];
  cards: CardRow[];
  timeline: TimelineDay[];
}

const fmtSec = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const fmtDT = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";

export const PayingUserFunnelSheet = ({ userId, email, onClose }: Props) => {
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setData(null);
    (supabase as any)
      .rpc("admin_paying_user_funnel", { _user_id: userId })
      .then(({ data }: any) => { setData(data); setLoading(false); });
  }, [userId]);

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-zinc-100 text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Jornada do pagante
          </SheetTitle>
          <p className="text-xs text-zinc-500">{email}</p>
        </SheetHeader>

        {loading && <div className="text-sm text-zinc-500 mt-6">Carregando…</div>}

        {data && (
          <div className="mt-5 space-y-5">
            {/* Resumo da assinatura */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-2">Assinatura</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-zinc-500">Plano:</span> <span className="text-zinc-100 font-bold">{data.subscription.plan}</span></div>
                <div><span className="text-zinc-500">Período:</span> <span className="text-zinc-100 font-bold">{data.subscription.billing_period}</span></div>
                <div><span className="text-zinc-500">Status:</span> <span className="text-zinc-100 font-bold">{data.subscription.status}</span></div>
                <div><span className="text-zinc-500">Método:</span> <span className="text-zinc-100 font-bold">{data.subscription.payment_method}</span></div>
                <div className="col-span-2"><span className="text-zinc-500">Pagou em:</span> <span className="text-zinc-100">{fmtDT(data.subscription.subscribed_at)}</span></div>
                <div className="col-span-2"><span className="text-zinc-500">Renovação:</span> <span className="text-zinc-100">{fmtDT(data.subscription.current_period_end)}</span></div>
              </div>
            </div>

            {/* Totais */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Dias até pagar</div>
                <div className="text-sm font-bold mt-1 text-zinc-100">
                  {data.totals.days_trial_to_paid !== null ? `D${data.totals.days_trial_to_paid}` : "—"}
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sessões</div>
                <div className="text-sm font-bold mt-1 text-zinc-100">{data.totals.total_sessions}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Tempo total</div>
                <div className="text-sm font-bold mt-1 text-zinc-100">{fmtSec(data.totals.total_seconds)}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Top módulo</div>
                <div className="text-sm font-bold mt-1 text-zinc-100">{data.totals.top_module || "—"}</div>
              </div>
            </div>

            {/* Funil */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Etapas do funil</div>
              <div className="space-y-1.5">
                {data.steps.map(s => (
                  <div
                    key={s.key}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                      s.reached ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-900/30 border-zinc-800/50"
                    }`}
                  >
                    {s.reached
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      : <Circle className="w-4 h-4 text-zinc-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold ${s.reached ? "text-zinc-100" : "text-zinc-500"}`}>{s.label}</div>
                      {s.at && <div className="text-[10px] text-zinc-500">{fmtDT(s.at)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Abas usadas */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Abas usadas no trial ({data.tabs.length})</div>
              {data.tabs.length === 0 ? (
                <div className="text-xs text-zinc-600">Nenhuma aba registrada.</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {data.tabs.map((t, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      <span className="text-zinc-500">{t.module_id}/</span>{t.tab_id} · {fmtSec(t.seconds)} · {t.visits}x
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cards preenchidos */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Cards preenchidos ({data.cards.length})
              </div>
              {data.cards.length === 0 ? (
                <div className="text-xs text-zinc-600">Nenhum card preenchido.</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {data.cards.map((c, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                      {c.action_key}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline D0-D7 */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Timeline D0–D7</div>
              <div className="space-y-2">
                {data.timeline.map(d => (
                  <div
                    key={d.day}
                    className={`border rounded-lg p-3 ${
                      d.active ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-900/30 border-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-xs font-bold text-zinc-100">D{d.day}</span>
                      {d.active ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">ATIVO</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold">INATIVO</span>
                      )}
                      {d.seconds > 0 && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
                          <Clock className="w-3 h-3" />{fmtSec(d.seconds)}
                        </span>
                      )}
                    </div>
                    {d.tabs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {d.tabs.map((t, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            <span className="text-zinc-500">{t.module}/</span>{t.tab}
                          </span>
                        ))}
                      </div>
                    )}
                    {d.activations.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {d.activations.map((a, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
