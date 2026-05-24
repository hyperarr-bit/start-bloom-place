import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

interface Row {
  action_key: string;
  completed_count: number;
  total_users: number;
  pct: number;
}

const LABELS: Record<string, string> = {
  first_transaction: "Primeira transação (Finanças)",
  first_habit: "Primeiro hábito",
  first_workout: "Primeiro treino",
  first_meal: "Primeira refeição",
  first_task: "Primeira tarefa (Rotina)",
  first_water_log: "Primeiro registro de hidratação",
  first_note: "Primeira nota",
};

export default function AdminActivation() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any).rpc("admin_activation_funnel").then(({ data }: any) => {
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const total = rows[0]?.total_users || 0;

  const handleSetupProducts = async () => {
    setSetupLoading(true);
    setSetupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-setup-products", {
        body: {},
      });

      if (error) throw error;

      const configured = Object.keys((data as any)?.products ?? {}).length;
      const message = `Produtos configurados: ${configured}`;
      setSetupResult(message);
      toast.success("Produtos do AbacatePay atualizados");
    } catch (e: any) {
      const message = e?.message ?? "Erro ao configurar produtos";
      setSetupResult(message);
      toast.error(message);
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ativação</h1>
        <p className="text-xs text-zinc-500 mt-1">% de usuários que completou cada ação-chave</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Produtos AbacatePay
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Cria/salva os produtos novos de mensal, anual e roleta.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSetupProducts}
            disabled={setupLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
          >
            {setupLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Configurar produtos
          </button>
        </div>
        {setupResult && <p className="text-xs text-muted-foreground mt-3">{setupResult}</p>}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Funil de Ativação · {total} usuários totais
          </h3>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhuma ativação registrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.action_key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300">{LABELS[r.action_key] ?? r.action_key}</span>
                  <span className="text-zinc-500">
                    {r.completed_count} · {Number(r.pct).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, Number(r.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Como ler</h3>
        <ul className="space-y-2 text-xs text-zinc-400">
          <li>• A ativação principal do app é <strong>primeira transação</strong> — meta: ≥40% nos D1-D2.</li>
          <li>• <strong>Primeiro hábito</strong> indica formação de rotina — quem cria 1 tem retenção 2x maior.</li>
          <li>• Ações com baixa adesão recebem variantes específicas no e-mail D1-D5.</li>
        </ul>
      </div>
    </div>
  );
}
