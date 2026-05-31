import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingDown, Eye, MousePointerClick } from "lucide-react";

const SLIDE_TITLES: Record<number, string> = {
  1: "Tenha controle da sua vida financeira",
  2: "Veja seu mês com clareza",
  3: "Controle seus gastos e limites",
  4: "Planeje seus desejos e objetivos",
  5: "Comece pela sua primeira receita",
};
const TOTAL_SLIDES = 5;

interface FunnelData {
  landing: number;
  start_clicked: number;
  slides: { step: number; reached: number }[];
}

type PresetKey = "1h" | "today" | "24h" | "7d" | "30d" | "all" | "day_hour";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "1h", label: "1h" },
  { key: "today", label: "Hoje" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "Tudo" },
  { key: "day_hour", label: "Dia + Hora" },
];

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

export default function AdminTutorialInicial() {
  const [preset, setPreset] = useState<PresetKey>("7d");
  const [day, setDay] = useState<string>(todayISO());
  const [hour, setHour] = useState<string>("all");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const computeRange = useCallback((): { from: string | null; to: string | null } => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    switch (preset) {
      case "1h": return { from: iso(new Date(now.getTime() - 3600_000)), to: null };
      case "today": {
        const s = new Date(now); s.setHours(0, 0, 0, 0);
        return { from: iso(s), to: null };
      }
      case "24h": return { from: iso(new Date(now.getTime() - 86400_000)), to: null };
      case "7d":  return { from: iso(new Date(now.getTime() - 7 * 86400_000)), to: null };
      case "30d": return { from: iso(new Date(now.getTime() - 30 * 86400_000)), to: null };
      case "all": return { from: null, to: null };
      case "day_hour": {
        if (!day) return { from: null, to: null };
        const [y, m, d] = day.split("-").map(Number);
        if (hour === "all") {
          return {
            from: iso(new Date(y, m - 1, d, 0, 0, 0)),
            to:   iso(new Date(y, m - 1, d, 23, 59, 59, 999)),
          };
        }
        const h = Number(hour);
        return {
          from: iso(new Date(y, m - 1, d, h, 0, 0)),
          to:   iso(new Date(y, m - 1, d, h, 59, 59, 999)),
        };
      }
    }
  }, [preset, day, hour]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { from, to } = computeRange();
    const { data: res, error } = await (supabase as any).rpc("admin_pre_signup_funnel", { _from: from, _to: to });
    if (error) setErr(error.message);
    else setData(res as FunnelData);
    setLoading(false);
  }, [computeRange]);

  useEffect(() => { load(); }, [load]);

  // Monta o funil completo: landing + 5 slides + start_clicked
  const rows = (() => {
    if (!data) return [];
    const slideMap = new Map<number, number>(data.slides.map(s => [s.step, s.reached]));
    const list: { label: string; value: number; isStart?: boolean }[] = [];
    list.push({ label: "Entrou na landing", value: data.landing });
    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      list.push({ label: `Slide ${i} — ${SLIDE_TITLES[i]}`, value: slideMap.get(i) ?? 0 });
    }
    list.push({ label: 'Clicou em "Começar grátis"', value: data.start_clicked, isStart: true });
    return list;
  })();
  const max = Math.max(1, ...rows.map(r => r.value));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutorial Inicial — Dropoff por Slide</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Funil dos 5 slides da landing "Tenha controle da sua vida financeira"
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                preset === p.key
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "day_hour" && (
          <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-zinc-800">
            <label className="text-xs text-zinc-400 flex flex-col gap-1">
              Dia
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200"
              />
            </label>
            <label className="text-xs text-zinc-400 flex flex-col gap-1">
              Hora
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200"
              >
                <option value="all">Todas as horas (dia inteiro)</option>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00 – {String(h).padStart(2, "0")}:59
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {err && <div className="text-sm text-red-400">Erro: {err}</div>}

      <section className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">Funil slide a slide</h2>
        <p className="text-[11px] text-zinc-500 mb-5">
          Quantos viram cada slide e a % de quem continuou em relação ao anterior
        </p>

        {!data ? (
          <div className="text-xs text-zinc-500">{loading ? "Carregando…" : "Sem dados."}</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => {
              const prev = i === 0 ? r.value : rows[i - 1].value;
              const conv = i === 0 ? 100 : pct(r.value, prev);
              const drop = i > 0 && conv < 80;
              const w = (r.value / max) * 100;
              const Icon = drop ? TrendingDown : r.isStart ? MousePointerClick : Eye;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1.5 gap-3">
                    <span className="flex items-center gap-2 text-zinc-300 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${drop ? "text-red-400" : "text-zinc-500"}`} />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="text-zinc-500 tabular-nums shrink-0">
                      <span className="text-zinc-200 font-semibold">{r.value.toLocaleString("pt-BR")}</span>
                      {i > 0 && (
                        <span className={`ml-2 ${drop ? "text-red-400" : "text-emerald-400"}`}>
                          {fmtPct(conv)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${drop ? "bg-red-500/70" : "bg-emerald-500"}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
