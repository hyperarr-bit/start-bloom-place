import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ListOrdered, Layers } from "lucide-react";
import ResetAnalyticsButton from "@/components/admin/ResetAnalyticsButton";

type Stage = { key: string; label: string; users: number };
type ModuleRow = {
  module: string;
  clicked: number;
  opened: number;
  completed: number;
  steps: Record<string, number>;
};
type FunnelData = {
  from: string;
  to: string;
  stages: Stage[];
  by_module: ModuleRow[];
};

type PresetKey = "1h" | "today" | "24h" | "7d" | "30d" | "all";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "1h", label: "Última hora" },
  { key: "today", label: "Hoje" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "all", label: "Tudo" },
];

const computeRange = (key: PresetKey): { from: string | null; to: string | null } => {
  const now = new Date();
  if (key === "all") return { from: null, to: null };
  if (key === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { from: d.toISOString(), to: now.toISOString() };
  }
  const map: Record<Exclude<PresetKey, "all" | "today">, number> = {
    "1h": 1,
    "24h": 24,
    "7d": 24 * 7,
    "30d": 24 * 30,
  };
  const hours = map[key as Exclude<PresetKey, "all" | "today">];
  return {
    from: new Date(now.getTime() - hours * 3600_000).toISOString(),
    to: now.toISOString(),
  };
};

const MODULE_LABELS: Record<string, string> = {
  financas: "Finanças",
  rotina: "Hábitos",
  dieta: "Dieta",
  metas: "Metas",
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export default function AdminTutorialInicial() {
  const [preset, setPreset] = useState<PresetKey>("7d");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => computeRange(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: res, error } = await supabase.rpc("admin_onboarding_funnel_v2" as any, {
        _from: range.from,
        _to: range.to,
      });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setData(null);
      } else {
        setData(res as unknown as FunnelData);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const stages = data?.stages ?? [];
  const top = stages[0]?.users ?? 0;

  const allStepNums = useMemo(() => {
    const set = new Set<number>();
    (data?.by_module ?? []).forEach((m) => {
      Object.keys(m.steps || {}).forEach((k) => set.add(Number(k)));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tutorial inicial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Funil completo desde a primeira página até aceitar os 7 dias grátis. Cada etapa conta usuários únicos (logados ou anônimos).
            </p>
          </div>
          <ResetAnalyticsButton />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                preset === p.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
            Erro: {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Seção 1: Funil em ordem */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Etapas do funil
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {stages.map((s, i) => {
                  const prev = i === 0 ? null : stages[i - 1];
                  const vsPrev = prev ? pct(s.users, prev.users) : 100;
                  const vsTop = pct(s.users, top);
                  return (
                    <div
                      key={s.key}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {s.label}
                          </p>
                          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                            <span className="text-2xl font-bold text-foreground tabular-nums">
                              {s.users.toLocaleString("pt-BR")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              usuário{s.users === 1 ? "" : "s"} únicos
                            </span>
                            {prev && (
                              <span className="text-xs text-muted-foreground">
                                • {vsPrev}% vs etapa anterior
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              • {vsTop}% vs topo
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-foreground transition-all"
                              style={{ width: `${vsTop}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Seção 2: Detalhe por módulo */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Detalhe por módulo
                </h2>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Módulo</th>
                      <th className="text-right font-medium px-3 py-2">Clicaram</th>
                      <th className="text-right font-medium px-3 py-2">Entraram</th>
                      {allStepNums.map((n) => (
                        <th key={n} className="text-right font-medium px-3 py-2">
                          Passo {n + 1}
                        </th>
                      ))}
                      <th className="text-right font-medium px-3 py-2">Finalizaram</th>
                      <th className="text-right font-medium px-3 py-2">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.by_module ?? []).map((m) => {
                      const conv = pct(m.completed, m.clicked);
                      return (
                        <tr key={m.module} className="border-t border-border">
                          <td className="px-3 py-2 font-medium text-foreground">
                            {MODULE_LABELS[m.module] ?? m.module}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{m.clicked}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{m.opened}</td>
                          {allStepNums.map((n) => (
                            <td key={n} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {m.steps?.[String(n)] ?? 0}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right tabular-nums">{m.completed}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {conv}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                "Passo N" usa o evento <code>spotlight_step_view</code> (index 0 = primeiro passo, mostrado como Passo 1).
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
