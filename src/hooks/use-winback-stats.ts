import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WinbackPeriodStats {
  triggered: number;
  wheel_spun: number;
  offer_shown: number;
  accepted: number;
  converted: number;
  dismissed: number;
  spin_rate_pct?: number;
  offer_view_rate_pct?: number;
  accept_rate_pct?: number;
  conversion_rate_pct: number;
  global_conversion_pct?: number;
  revenue_recovered_brl: number;
}

export interface WinbackStats {
  all_time: WinbackPeriodStats;
  last_30d: WinbackPeriodStats;
  last_7d: WinbackPeriodStats;
  by_day: { date: string; triggered: number; converted: number }[];
  annual_price_brl: number;
  monthly_equiv_brl: number;
  generated_at: string;
}

export function useWinbackStats() {
  const [data, setData] = useState<WinbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: r, error: e } = await (supabase as any).rpc("admin_winback_stats");
      if (cancelled) return;
      if (e) setError(e.message);
      else setData(r as WinbackStats);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
