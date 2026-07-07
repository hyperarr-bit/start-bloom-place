import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Circle, CheckCircle2, MousePointerClick, Eye, BookOpen, LogIn, Activity, AlertCircle } from "lucide-react";

interface JourneyEvent {
  created_at: string;
  event_name: string;
  event_data: Record<string, any>;
  session_id: string | null;
}

const ICONS: Record<string, any> = {
  landing_view: Eye,
  start_clicked: MousePointerClick,
  pre_signup_tutorial_started: BookOpen,
  quickstart_module_chosen: BookOpen,
  spotlight_shown: BookOpen,
  spotlight_step_view: Circle,
  quickstart_completed: CheckCircle2,
  pre_signup_tutorial_completed: CheckCircle2,
  trial_started: LogIn,
  key_action_completed: Activity,
  spotlight_target_missing: AlertCircle,
  spotlight_dismissed: AlertCircle,
};

const LABELS: Record<string, string> = {
  landing_view: "Visitou a landing",
  start_clicked: "Clicou em 'Quero começar'",
  pre_signup_tutorial_started: "Iniciou tutorial",
  quickstart_module_chosen: "Escolheu módulo",
  spotlight_shown: "Tutorial do módulo aberto",
  spotlight_step_view: "Viu passo",
  quickstart_completed: "Concluiu módulo",
  pre_signup_tutorial_completed: "Concluiu tutorial pré-cadastro",
  trial_started: "Criou conta / iniciou trial",
  key_action_completed: "Ação-chave",
  spotlight_target_missing: "Não encontrou elemento",
  spotlight_dismissed: "Abandonou tutorial",
};

export default function UserJourneyDrawer({
  userId, sessionId, label, onClose,
}: { userId?: string; sessionId?: string; label: string; onClose: () => void }) {
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("admin_user_journey", {
        _user_id: userId ?? null,
        _session_id: sessionId ?? null,
      });
      setEvents(data || []);
      setLoading(false);
    })();
  }, [userId, sessionId]);

  const lastTutorialStep = [...events].reverse().find(e => e.event_name === "spotlight_step_view");
  const dropped = lastTutorialStep && !events.some(e =>
    (e.event_name === "quickstart_completed" || e.event_name === "pre_signup_tutorial_completed") &&
    new Date(e.created_at) > new Date(lastTutorialStep.created_at)
  );

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Jornada</h3>
            <p className="text-xs text-zinc-500 truncate max-w-[60vw]">{label}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-xs text-zinc-500">Carregando…</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-zinc-500">Nenhum evento registrado.</p>
          ) : (
            <>
              {dropped && lastTutorialStep && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs font-bold text-red-400">Abandonou aqui</p>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Módulo <span className="font-bold capitalize">{lastTutorialStep.event_data?.module}</span> ·
                    passo {(lastTutorialStep.event_data?.step ?? 0) + 1}/{lastTutorialStep.event_data?.total ?? "?"}
                    {" — "}
                    <span className="text-zinc-100">{lastTutorialStep.event_data?.label}</span>
                  </p>
                </div>
              )}
              <div className="relative pl-6 space-y-3">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-zinc-800" />
                {events.map((e, i) => {
                  const Icon = ICONS[e.event_name] || Circle;
                  const lab = LABELS[e.event_name] || e.event_name;
                  const mod = e.event_data?.module;
                  const stepLabel = e.event_data?.label;
                  return (
                    <div key={i} className="relative">
                      <div className="absolute -left-[18px] top-0.5 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <Icon className="w-2.5 h-2.5 text-zinc-400" />
                      </div>
                      <p className="text-xs text-zinc-200 font-medium">{lab}
                        {mod && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-zinc-500">{mod}</span>}
                      </p>
                      {stepLabel && (
                        <p className="text-[11px] text-zinc-500">
                          {e.event_name === "spotlight_step_view"
                            ? `Passo ${(e.event_data?.step ?? 0) + 1}/${e.event_data?.total ?? "?"} — ${stepLabel}`
                            : stepLabel}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {new Date(e.created_at).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
