import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, TrendingDown, AlertTriangle } from "lucide-react";

/* ---------------------------------------------------------------- range */

export type RangeKey = "today" | "7d" | "30d" | "90d" | "all" | "reset";
const RANGE_LABELS: Record<Exclude<RangeKey, "reset">, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  all: "Desde o início",
};

// "Zerar contador": marco de tempo salvo localmente. Não apaga dado nenhum —
// só move o início da janela "Desde o reset" pra quando o dono apertou zerar
// (útil pra assistir uma campanha nova subir do zero).
const RESET_KEY = "admin-counter-reset";
export const getCounterReset = (): string | null => {
  try { return localStorage.getItem(RESET_KEY); } catch { return null; }
};
export const setCounterReset = (iso: string | null) => {
  try {
    if (iso) localStorage.setItem(RESET_KEY, iso);
    else localStorage.removeItem(RESET_KEY);
  } catch { /* noop */ }
};

export const rangeLabel = (key: RangeKey): string =>
  key === "reset" ? "Desde o reset" : RANGE_LABELS[key];

export function rangeToDates(key: RangeKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (key === "reset") {
    const marker = getCounterReset();
    // Sem marco salvo, cai pro começo do dia (nunca quebra).
    return { from: marker ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString(), to: to.toISOString() };
  }
  if (key === "today") from.setHours(0, 0, 0, 0);
  else if (key === "7d") from.setDate(from.getDate() - 7);
  else if (key === "30d") from.setDate(from.getDate() - 30);
  else if (key === "90d") from.setDate(from.getDate() - 90);
  else from.setFullYear(2026, 0, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export type Granularity = "day" | "hour";

export function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (v: Granularity) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      {(["day", "hour"] as Granularity[]).map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
            value === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {g === "day" ? "Dia" : "Hora"}
        </button>
      ))}
    </div>
  );
}

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-medium hover:bg-muted transition-colors"
      >
        {rangeLabel(value)}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 md:left-0 mt-1.5 w-48 rounded-xl border border-border bg-card shadow-lg py-1 z-20">
          {/* "Desde o reset" só aparece quando existe um marco salvo */}
          {(getCounterReset() ? ([...Object.keys(RANGE_LABELS), "reset"] as RangeKey[]) : (Object.keys(RANGE_LABELS) as RangeKey[])).map((k) => (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] hover:bg-muted transition-colors text-left"
            >
              {rangeLabel(k)}
              {value === k && <Check className="w-4 h-4 text-accent" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- surfaces */

export function Panel({ title, sub, children, className = "" }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 md:p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-[13px] font-bold">{title}</h3>
          {sub && <p className="text-[12px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[12px] text-muted-foreground font-medium">{label}</div>
      <div className="text-[28px] font-semibold tracking-tight mt-1 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-[13px] text-muted-foreground/70 text-center py-10">{label}</div>
  );
}

/* --------------------------------------------------------- ranked bars */

export interface BarItem { label: string; value: number; sub?: string }

/**
 * Lista de barras horizontais, hue única (accent) — série nominal onde a
 * própria categoria já é o rótulo (sem necessidade de paleta categórica).
 */
export function RankedBars({
  items, formatValue = (v) => String(v), emptyLabel = "Sem dados neste período",
}: { items: BarItem[]; formatValue?: (v: number) => string; emptyLabel?: string }) {
  if (!items.length) return <EmptyState label={emptyLabel} />;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12.5px] font-medium truncate">{item.label}</span>
            <span className="text-[12.5px] font-semibold tabular-nums shrink-0">{formatValue(item.value)}</span>
          </div>
          <div className="h-[9px] rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.sub && <div className="text-[11px] text-muted-foreground mt-1">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- funil bar */

export interface FunnelStep {
  key: string; label: string; sessions: number; pct_of_first: number; drop_pct: number | null;
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) return <EmptyState label="Sem visitas neste período" />;
  const max = steps[0]?.sessions || 1;
  return (
    <div>
      {steps.map((s, i) => (
        <div key={s.key}>
          <div className="flex items-center gap-3 py-2">
            <div className="w-6 h-6 rounded-full bg-muted grid place-items-center text-[11px] font-bold text-muted-foreground shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[13px] font-semibold truncate">{s.label}</span>
                <span className="text-[13px] font-semibold tabular-nums shrink-0">
                  {s.sessions.toLocaleString("pt-BR")}
                  <span className="text-muted-foreground font-normal ml-1.5">{s.pct_of_first}%</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.max(2, (s.sessions / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          {i < steps.length - 1 && s.drop_pct !== null && s.drop_pct > 0 && (
            <div className="flex items-center gap-2 pl-9 py-1">
              <div className="w-px h-4 bg-border ml-3" />
              <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                s.drop_pct >= 50 ? "text-destructive" : s.drop_pct >= 25 ? "text-warning" : "text-muted-foreground"
              }`}>
                {s.drop_pct >= 50 && <AlertTriangle className="w-3 h-3" />}
                -{s.drop_pct}% saíram aqui
              </span>
            </div>
          )}
          {i < steps.length - 1 && s.drop_pct !== null && s.drop_pct <= 0 && (
            <div className="flex items-center gap-2 pl-9 py-1">
              <div className="w-px h-4 bg-border ml-3" />
              <span className="text-[11px] text-muted-foreground/60">
                sessões extras entraram direto nesta etapa
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function WorstDropCallout({ drop }: { drop: { key: string; label: string; drop_pct: number } | null }) {
  if (!drop) return null;
  const severe = drop.drop_pct >= 50;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${
      severe ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
    }`}>
      <div className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${severe ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
        <TrendingDown className="w-[18px] h-[18px]" />
      </div>
      <div>
        <div className="text-[13px] font-bold">Maior perda do funil</div>
        <div className="text-[12.5px] text-muted-foreground mt-0.5">
          <strong className={severe ? "text-destructive" : "text-warning"}>{drop.drop_pct}%</strong> dos que chegaram na etapa anterior não avançaram para <strong className="text-foreground">"{drop.label}"</strong>.
        </div>
      </div>
    </div>
  );
}
