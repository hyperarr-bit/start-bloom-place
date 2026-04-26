import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Filter } from "lucide-react";

const LABELS: Record<string, string> = {
  financas: "Finanças", treino: "Treino", dieta: "Dieta", rotina: "Rotina",
  desenvolvimento: "Dev. Pessoal", saude: "Saúde", casa: "Casa", estudos: "Estudos",
  biblioteca: "Biblioteca", beleza: "Beleza", viagens: "Viagens", carreira: "Carreira",
  hiperfoco: "Mente", relacionamentos: "Relações", pet: "Pet", detox: "Detox",
  conquistas: "Conquistas",
};

interface Row {
  module_id: string; unique_users: number; returning_users: number;
  total_sessions: number; total_seconds: number;
}

export default function AdminFunnel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).rpc("admin_module_funnel").then(({ data }: any) => {
      setRows(data || []); setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const maxUsers = Math.max(...rows.map(r => Number(r.unique_users)), 1);
  const lowAdoption = [...rows].sort((a,b) => Number(a.unique_users) - Number(b.unique_users)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Funil de Ativação</h1>
        <p className="text-xs text-zinc-500 mt-1">Adoção e retenção por módulo</p>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" /> Engajamento por Módulo
        </h3>
        <div className="space-y-3">
          {rows.map(r => {
            const retention = Number(r.unique_users) > 0 ? (Number(r.returning_users) / Number(r.unique_users)) * 100 : 0;
            return (
              <div key={r.module_id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-100 font-bold">{LABELS[r.module_id] || r.module_id}</span>
                  <span className="text-zinc-500">{r.unique_users} users · {retention.toFixed(0)}% retornam</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${(Number(r.unique_users)/maxUsers)*100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Oportunidades (baixa adesão)</h3>
        <ul className="space-y-2 text-xs">
          {lowAdoption.map(r => (
            <li key={r.module_id} className="flex justify-between text-zinc-400">
              <span>• {LABELS[r.module_id] || r.module_id}</span>
              <span className="text-orange-400">{r.unique_users} usuários</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-zinc-600 mt-3">Considere promover esses módulos no onboarding ou simplificar a entrada.</p>
      </div>
    </div>
  );
}
