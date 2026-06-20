import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw } from "lucide-react";

export default function ResetAnalyticsButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!confirm("Zerar todos os contadores a partir de agora? Os dados antigos somem das telas (mas continuam no banco).")) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_reset_analytics");
    setBusy(false);
    if (error) { alert("Erro: " + error.message); return; }
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
