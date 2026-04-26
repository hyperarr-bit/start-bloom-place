import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Target } from "lucide-react";

interface Row {
  trial_day: number;
  nudge_key: string;
  shown: number;
  clicked: number;
  dismissed: number;
  completed: number;
  conversions_48h: number;
  ctr_pct: number;
  completion_pct: number;
  conversion_pct: number;
}

export default function AdminOnboarding() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).rpc("admin_nudge_stats").then(({ data }: any) => {
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const groups = rows.reduce<Record<number, Row[]>>((acc, r) => {
    (acc[r.trial_day] ||= []).push(r);
    return acc;
  }, {});
  const days = Object.keys(groups).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Onboarding in-app</h1>
        <p className="text-xs text-zinc-500 mt-1">Performance dos nudges por dia do trial</p>
      </div>

      {days.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
          <Target className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">Nenhum nudge exibido ainda.</p>
        </div>
      ) : (
        days.map(day => {
          const variants = groups[day];
          const totalShown = variants.reduce((s, v) => s + Number(v.shown), 0);
          const totalConv = variants.reduce((s, v) => s + Number(v.conversions_48h), 0);
          return (
            <div key={day} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-200">Dia {day}</h3>
                <span className="text-[10px] text-zinc-500">
                  {totalShown} exibições · {totalConv} conversões em 48h
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 font-medium">Nudge</th>
                    <th className="text-right py-2 font-medium">Mostrado</th>
                    <th className="text-right py-2 font-medium">Cliques</th>
                    <th className="text-right py-2 font-medium">CTR</th>
                    <th className="text-right py-2 font-medium">Concluído</th>
                    <th className="text-right py-2 font-medium">Concl. %</th>
                    <th className="text-right py-2 font-medium">Conv. 48h</th>
                    <th className="text-right py-2 font-medium">Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map(v => (
                    <tr key={v.nudge_key} className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-300 font-mono">{v.nudge_key}</td>
                      <td className="py-2 text-right text-zinc-400">{v.shown}</td>
                      <td className="py-2 text-right text-zinc-400">{v.clicked}</td>
                      <td className="py-2 text-right text-cyan-400">{Number(v.ctr_pct).toFixed(1)}%</td>
                      <td className="py-2 text-right text-zinc-400">{v.completed}</td>
                      <td className="py-2 text-right text-amber-400">{Number(v.completion_pct).toFixed(1)}%</td>
                      <td className="py-2 text-right text-zinc-400">{v.conversions_48h}</td>
                      <td className="py-2 text-right text-emerald-400 font-semibold">
                        {Number(v.conversion_pct).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
