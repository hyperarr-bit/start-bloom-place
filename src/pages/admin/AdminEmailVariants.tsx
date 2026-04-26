import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";

interface Row {
  email_key: string;
  variant_key: string;
  sent_count: number;
  banner_clicks_after: number;
  conversions_48h: number;
  ctr_pct: number;
  conversion_pct: number;
}

const DAY_LABELS: Record<string, string> = {
  "trial-welcome": "D0 · Boas-vindas",
  "trial-d1-first-action": "D1 · Primeira ação",
  "trial-d2-finance": "D2 · Finanças",
  "trial-d3-habit": "D3 · Hábito",
  "trial-d4-progress": "D4 · Progresso",
  "trial-d5-value": "D5 · Valor",
  "trial-d6-convert": "D6 · Converter",
  "trial-d7-last-call": "D7 · Última chance",
};

export default function AdminEmailVariants() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).rpc("admin_email_variant_stats").then(({ data }: any) => {
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Carregando…</div>;

  const groups = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.email_key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">E-mails do Trial</h1>
        <p className="text-xs text-zinc-500 mt-1">Variantes e performance por dia</p>
      </div>

      {Object.keys(groups).length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
          <Mail className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">Nenhum e-mail enviado ainda.</p>
          <p className="text-[10px] text-zinc-600 mt-1">Configure o domínio em Cloud → Emails para começar.</p>
        </div>
      ) : (
        Object.entries(groups).map(([emailKey, variants]) => {
          const totalSent = variants.reduce((s, v) => s + Number(v.sent_count), 0);
          const totalConv = variants.reduce((s, v) => s + Number(v.conversions_48h), 0);
          return (
            <div key={emailKey} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-200">{DAY_LABELS[emailKey] ?? emailKey}</h3>
                <span className="text-[10px] text-zinc-500">
                  {totalSent} envios · {totalConv} conversões em 48h
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 font-medium">Variante</th>
                    <th className="text-right py-2 font-medium">Enviados</th>
                    <th className="text-right py-2 font-medium">Cliques 48h</th>
                    <th className="text-right py-2 font-medium">CTR</th>
                    <th className="text-right py-2 font-medium">Conv. 48h</th>
                    <th className="text-right py-2 font-medium">Taxa Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map(v => (
                    <tr key={v.variant_key} className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-300 font-mono">{v.variant_key}</td>
                      <td className="py-2 text-right text-zinc-400">{v.sent_count}</td>
                      <td className="py-2 text-right text-zinc-400">{v.banner_clicks_after}</td>
                      <td className="py-2 text-right text-cyan-400">{Number(v.ctr_pct).toFixed(1)}%</td>
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
