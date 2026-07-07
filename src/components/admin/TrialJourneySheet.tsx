import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar, CheckCircle2, Clock, MousePointerClick } from "lucide-react";

interface Props {
  userId: string | null;
  email: string | null;
  onClose: () => void;
}

interface DayRow {
  day: number;
  seconds: number;
  tabs: { tab: string; seconds: number }[];
  cards: { card: string; count: number }[];
  activations: string[];
  active: boolean;
}
interface Journey {
  user_id: string;
  signup_at: string;
  last_active_at: string | null;
  last_active_day: number;
  first_inactive_day: number | null;
  total_days_active: number;
  subscription_status: string;
  days: DayRow[];
}

const fmtSec = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

export const TrialJourneySheet = ({ userId, email, onClose }: Props) => {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setJourney(null);
    (supabase as any)
      .rpc("admin_user_trial_journey", { _user_id: userId })
      .then(({ data }: any) => {
        setJourney(data);
        setLoading(false);
      });
  }, [userId]);

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-zinc-100 text-base">Jornada do trial</SheetTitle>
          <p className="text-xs text-zinc-500">{email}</p>
        </SheetHeader>

        {loading && <div className="text-sm text-zinc-500 mt-6">Carregando…</div>}

        {journey && (
          <div className="mt-5 space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Status</div>
                <div className="text-sm font-bold mt-1 text-zinc-100">{journey.subscription_status}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Dias ativos</div>
                <div className="text-sm font-bold mt-1 text-emerald-400">{journey.total_days_active}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Último ativo</div>
                <div className="text-sm font-bold mt-1 text-zinc-100">
                  {journey.last_active_day >= 0 ? `D${journey.last_active_day}` : "—"}
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Saiu no dia</div>
                <div className="text-sm font-bold mt-1 text-amber-400">
                  {journey.first_inactive_day !== null ? `D${journey.first_inactive_day}` : "—"}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500">
              Signup: {new Date(journey.signup_at).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              {journey.last_active_at && ` · Último uso: ${new Date(journey.last_active_at).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`}
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              {journey.days.map((d) => (
                <div
                  key={d.day}
                  className={`border rounded-lg p-3 ${
                    d.active
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-zinc-900/30 border-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs font-bold text-zinc-100">D{d.day}</span>
                    {d.active ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                        ATIVO
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold">
                        INATIVO
                      </span>
                    )}
                    {d.seconds > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
                        <Clock className="w-3 h-3" />
                        {fmtSec(d.seconds)}
                      </span>
                    )}
                  </div>

                  {d.tabs.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Abas</div>
                      <div className="flex flex-wrap gap-1">
                        {d.tabs.map((t) => (
                          <span
                            key={t.tab}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                          >
                            {t.tab} · {fmtSec(t.seconds)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {d.cards.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> Cards
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {d.cards.map((c) => (
                          <span
                            key={c.card}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                          >
                            {c.card} ×{c.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {d.activations.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Preencheu
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {d.activations.map((a, i) => (
                          <span
                            key={`${a}-${i}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!d.active && d.tabs.length === 0 && d.cards.length === 0 && d.activations.length === 0 && (
                    <div className="text-[10px] text-zinc-600">Sem atividade.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
