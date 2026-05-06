import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, CheckCircle2, Activity, Clock } from "lucide-react";

interface ModuleStat { module_id: string; users: number; total_seconds: number }
interface CohortStat {
  total_signups: number;
  confirmed: number;
  users_with_use: number;
  total_seconds: number;
  sessions: number;
  modules: ModuleStat[];
}
interface CompareResult {
  cutoff: string;
  before: CohortStat;
  after: CohortStat;
  generated_at: string;
}

const fmtMin = (s: number) => `${Math.round(s / 60)} min`;
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—");

const CohortCard = ({ title, subtitle, data, accent }: { title: string; subtitle: string; data: CohortStat; accent: string }) => (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
    <div>
      <h3 className={`text-sm font-bold ${accent}`}>{title}</h3>
      <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <Stat icon={<Sparkles className="w-3 h-3" />} label="Cadastros" value={data.total_signups.toString()} />
      <Stat icon={<CheckCircle2 className="w-3 h-3" />} label="Confirmaram" value={`${data.confirmed} (${pct(data.confirmed, data.total_signups)})`} />
      <Stat icon={<Activity className="w-3 h-3" />} label="Usaram módulos" value={`${data.users_with_use} (${pct(data.users_with_use, data.total_signups)})`} />
      <Stat icon={<Clock className="w-3 h-3" />} label="Tempo total" value={fmtMin(data.total_seconds)} />
    </div>

    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Minutos por módulo</h4>
      {data.modules.length === 0 ? (
        <p className="text-xs text-zinc-600">Sem dados.</p>
      ) : (
        <div className="space-y-1.5">
          {data.modules.slice(0, 12).map(m => (
            <div key={m.module_id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{m.module_id}</span>
              <span className="text-zinc-500">{fmtMin(m.total_seconds)} · {m.users} u</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 p-2.5">
    <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider mb-1">{icon}{label}</div>
    <div className="text-sm font-bold text-zinc-100">{value}</div>
  </div>
);

export default function AdminTutorialCompare() {
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any).rpc("admin_tutorial_compare").then(({ data, error }: any) => {
      if (error) setErr(error.message);
      else setData(data as CompareResult);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;
  if (err) return <div className="text-sm text-red-400">Erro: {err}</div>;
  if (!data) return null;

  const cutoffDate = new Date(data.cutoff);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparação de Tutorial</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Antes vs depois do novo tutorial · cutoff: <span className="text-zinc-300">{cutoffDate.toLocaleString("pt-BR")}</span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <CohortCard
          title="Tutorial Antigo"
          subtitle={`Cadastros antes de ${cutoffDate.toLocaleString("pt-BR")}`}
          data={data.before}
          accent="text-zinc-300"
        />
        <CohortCard
          title="Tutorial Novo"
          subtitle={`Cadastros a partir de ${cutoffDate.toLocaleString("pt-BR")}`}
          data={data.after}
          accent="text-emerald-400"
        />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
        <p>
          <strong className="text-zinc-200">Como ler:</strong> compara a coorte de usuários que se cadastrou antes do cutoff (tutorial antigo) com a que se cadastrou depois (tutorial novo). Confirmação = e-mail confirmado. Tempo total e por módulo vêm de <code>module_analytics</code>.
        </p>
      </div>
    </div>
  );
}
