import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw } from "lucide-react";

export default function ResetAnalyticsButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!confirm("Zerar TODOS os contadores? Isso apaga permanentemente eventos, uso de módulos, ativações, winback e tentativas de cancelamento. Assinaturas e dados dos usuários NÃO são afetados.")) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_reset_analytics");
    setBusy(false);
    if (error) { alert("Erro: " + error.message); return; }
    const d = data?.deleted || {};
    const total = Object.values(d).reduce((s: number, n: any) => s + Number(n || 0), 0);
    alert(`Contadores zerados. ${total} registros apagados.`);
    onDone?.();
  };
  return (
    <button
      onClick={handle}
      disabled={busy}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
    >
      <RotateCcw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
      Zerar contadores
    </button>
  );
}
