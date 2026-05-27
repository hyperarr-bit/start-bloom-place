import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, MousePointerClick, BookOpen, CheckCircle2, UserPlus, TrendingDown } from "lucide-react";

interface LandingFunnel {
  landing: number;
  start_clicked: number;
  tutorial_started: number;
  tutorial_completed: number;
  signups: number;
}

interface TutorialStep {
  step: number;
  label: string;
  total: number;
  reached: number;
}

interface TutorialModule {
  module_id: string;
  started: number;
  completed: number;
  steps: TutorialStep[];
}

interface TutorialDropoff {
  modules: TutorialModule[];
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function AdminFinanceFunnel() {
  const [days, setDays] = useState(30);
  const [landing, setLanding] = useState<LandingFunnel | null>(null);
  const [tutorial, setTutorial] = useState<TutorialModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [r1, r2] = await Promise.all([
      (supabase as any).rpc("admin_landing_funnel", { _days: days }),
      (supabase as any).rpc("admin_tutorial_dropoff", { _days: days }),
    ]);
    if (r1.error) setErr(r1.error.message);
    else setLanding(r1.data as LandingFunnel);
    if (!r2.error) {
      const mods = (r2.data as TutorialDropoff)?.modules ?? [];
      setTutorial(mods.find((m) => m.module_id === "financas") ?? null);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funil — Finanças</h1>
          <p className="text-xs text-zinc-500 mt-1">Da landing até a conclusão do tutorial</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  days === d ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-400">Erro: {err}</div>}

      {/* Aquisição */}
      <section className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">Aquisição</h2>
        <p className="text-[11px] text-zinc-500 mb-5">Landing → cadastro</p>

        {!landing ? (
          <div className="text-xs text-zinc-500">Carregando…</div>
        ) : (
          <AcquisitionFunnel data={landing} />
        )}
      </section>

      {/* Tutorial Finanças */}
      <section className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">Tutorial do módulo Finanças</h2>
        <p className="text-[11px] text-zinc-500 mb-5">Em qual passo os usuários desistem</p>

        {!tutorial ? (
          <div className="text-xs text-zinc-500">
            {loading ? "Carregando…" : "Sem dados de tutorial no período."}
          </div>
        ) : (
          <TutorialFunnel data={tutorial} />
        )}
      </section>
    </div>
  );
}

const AcquisitionFunnel = ({ data }: { data: LandingFunnel }) => {
  const steps = [
    { Icon: Eye, label: 'Viram a landing "Tenha controle da sua vida financeira"', value: data.landing, base: data.landing },
    { Icon: MousePointerClick, label: 'Clicaram em "Começar grátis"', value: data.start_clicked, base: data.landing },
    { Icon: BookOpen, label: "Iniciaram o tutorial pré-cadastro", value: data.tutorial_started, base: data.start_clicked },
    { Icon: CheckCircle2, label: "Terminaram o tutorial pré-cadastro", value: data.tutorial_completed, base: data.tutorial_started },
    { Icon: UserPlus, label: "Criaram conta", value: data.signups, base: data.tutorial_completed },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const w = (s.value / max) * 100;
        const conv = i === 0 ? 100 : pct(s.value, s.base);
        const drop = i > 0 && conv < 50;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-2 text-zinc-300">
                <s.Icon className="w-3.5 h-3.5 text-zinc-500" />
                {s.label}
              </span>
              <span className="text-zinc-500 tabular-nums">
                <span className="text-zinc-200 font-semibold">{s.value.toLocaleString("pt-BR")}</span>
                {i > 0 && (
                  <span className={`ml-2 ${drop ? "text-red-400" : "text-emerald-400"}`}>
                    {fmtPct(conv)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${drop ? "bg-red-500/70" : "bg-emerald-500"}`}
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TutorialFunnel = ({ data }: { data: TutorialModule }) => {
  const sortedSteps = [...data.steps].sort((a, b) => a.step - b.step);
  const max = Math.max(data.started, ...sortedSteps.map((s) => s.reached), data.completed, 1);

  return (
    <div className="space-y-3">
      <FunnelLine
        label="Iniciaram o tutorial"
        value={data.started}
        max={max}
        conv={null}
        drop={false}
        icon={<BookOpen className="w-3.5 h-3.5 text-zinc-500" />}
      />
      {sortedSteps.map((s, i) => {
        const prev = i === 0 ? data.started : sortedSteps[i - 1].reached;
        const conv = pct(s.reached, prev);
        const drop = conv < 80;
        const stepNumber = s.step + 1;
        return (
          <FunnelLine
            key={s.step}
            label={`Passo ${stepNumber}${s.label ? ` — ${s.label}` : ""}`}
            value={s.reached}
            max={max}
            conv={conv}
            drop={drop}
            icon={
              drop
                ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                : <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px] text-zinc-500">{stepNumber}</span>
            }
          />
        );
      })}
      <FunnelLine
        label="Concluíram o tutorial"
        value={data.completed}
        max={max}
        conv={pct(data.completed, sortedSteps.length ? sortedSteps[sortedSteps.length - 1].reached : data.started)}
        drop={false}
        icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
      />
    </div>
  );
};

const FunnelLine = ({
  label, value, max, conv, drop, icon,
}: { label: string; value: number; max: number; conv: number | null; drop: boolean; icon: React.ReactNode }) => {
  const w = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-2 text-zinc-300">
          {icon}
          {label}
        </span>
        <span className="text-zinc-500 tabular-nums">
          <span className="text-zinc-200 font-semibold">{value.toLocaleString("pt-BR")}</span>
          {conv !== null && (
            <span className={`ml-2 ${drop ? "text-red-400" : "text-emerald-400"}`}>
              {fmtPct(conv)}
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${drop ? "bg-red-500/70" : "bg-emerald-500"}`}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
};
