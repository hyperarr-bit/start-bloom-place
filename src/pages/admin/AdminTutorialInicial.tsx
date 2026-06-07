import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingDown, ArrowRight } from "lucide-react";

interface MacroRow { key: string; label: string; users: number }
interface ModuleRow {
  module: string;
  clicked: number;
  tutorial_opened: number;
  completed: number;
  steps: { step: number; users: number }[];
}
interface FunnelData {
  macro: MacroRow[];
  by_module: ModuleRow[];
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

const MODULE_LABEL: Record<string, string> = {
  financas: "Finanças",
  rotina: "Hábitos",
  dieta: "Dieta",
  metas: "Metas (Desenv. Pessoal)",
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

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
    const { data: res, error } = await (supabase as any).rpc("admin_onboarding_funnel", { _from: from, _to: to });
    if (error) setErr(error.message);
    else setData(res as FunnelData);
    setLoading(false);
  }, [computeRange]);

  useEffect(() => { load(); }, [load]);

  const macro = data?.macro ?? [];
  const top = macro[0]?.users ?? 0;
  const max = Math.max(1, ...macro.map(r => r.users));

  const formShown = macro.find(r => r.key === "form_shown")?.users ?? 0;
  const formDone = macro.find(r => r.key === "form_done")?.users ?? 0;
  const moduleCompleted = macro.find(r => r.key === "module_completed")?.users ?? 0;

  const maxStep = useMemo(() => {
    if (!data) return 0;
    return data.by_module.reduce((acc, m) => {
      const local = m.steps.reduce((a, s) => Math.max(a, s.step), 0);
      return Math.max(acc, local);
    }, 0);
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funil de Onboarding</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Da primeira visita até aceitar os 7 dias grátis. Pessoas únicas por etapa.
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

      {/* SEÇÃO 1 — Funil macro */}
      <section className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">Funil completo</h2>
        <p className="text-[11px] text-zinc-500 mb-5">
          Cada linha mostra pessoas únicas, % vs etapa anterior e % vs topo do funil.
        </p>

        {!data ? (
          <div className="text-xs text-zinc-500">{loading ? "Carregando…" : "Sem dados."}</div>
        ) : (
          <div className="space-y-3">
            {macro.map((r, i) => {
              const prev = i === 0 ? r.users : macro[i - 1].users;
              const conv = i === 0 ? 100 : pct(r.users, prev);
              const fromTop = pct(r.users, top);
              const drop = i > 0 && conv < 80;
              const w = (r.users / max) * 100;
              return (
                <div key={r.key}>
                  <div className="flex items-center justify-between text-xs mb-1.5 gap-3">
                    <span className="flex items-center gap-2 text-zinc-300 min-w-0">
                      {drop
                        ? <TrendingDown className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        : <span className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-semibold">{i + 1}</span>}
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="text-zinc-500 tabular-nums shrink-0 flex items-center gap-3">
                      <span className="text-zinc-200 font-semibold">{fmtNum(r.users)}</span>
                      {i > 0 && (
                        <span className={drop ? "text-red-400" : "text-emerald-400"}>
                          {fmtPct(conv)} <span className="text-zinc-600">vs ant.</span>
                        </span>
                      )}
                      <span className="text-zinc-500">{fmtPct(fromTop)} <span className="text-zinc-600">topo</span></span>
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

      {/* SEÇÃO 2 — Detalhe por módulo */}
      <section className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">Detalhe por módulo</h2>
        <p className="text-[11px] text-zinc-500 mb-5">
          Quantas pessoas clicaram em cada módulo, entraram no tutorial, passaram por cada passo e finalizaram.
        </p>

        {!data ? (
          <div className="text-xs text-zinc-500">{loading ? "Carregando…" : "Sem dados."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left font-medium px-2 py-2">Módulo</th>
                  <th className="text-right font-medium px-2 py-2">Clicou</th>
                  <th className="text-right font-medium px-2 py-2">Tutorial abriu</th>
                  {Array.from({ length: maxStep }).map((_, i) => (
                    <th key={i} className="text-right font-medium px-2 py-2">Passo {i + 1}</th>
                  ))}
                  <th className="text-right font-medium px-2 py-2">Finalizou</th>
                  <th className="text-right font-medium px-2 py-2">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {data.by_module.map((m) => {
                  const stepMap = new Map(m.steps.map(s => [s.step, s.users]));
                  const conv = pct(m.completed, m.clicked);
                  return (
                    <tr key={m.module} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                      <td className="px-2 py-2 text-zinc-200 font-medium">{MODULE_LABEL[m.module] ?? m.module}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-zinc-200">{fmtNum(m.clicked)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{fmtNum(m.tutorial_opened)}</td>
                      {Array.from({ length: maxStep }).map((_, i) => (
                        <td key={i} className="px-2 py-2 text-right tabular-nums text-zinc-400">
                          {fmtNum(stepMap.get(i + 1) ?? 0)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-400 font-semibold">{fmtNum(m.completed)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums font-semibold ${conv < 50 ? "text-red-400" : "text-emerald-400"}`}>
                        {fmtPct(conv)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SEÇÃO 3 — Conversão final */}
      <section className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">Conversão final — Cadastro & 7 dias grátis</h2>
        <p className="text-[11px] text-zinc-500 mb-5">
          O que acontece depois que o usuário finaliza o módulo.
        </p>

        {!data ? (
          <div className="text-xs text-zinc-500">{loading ? "Carregando…" : "Sem dados."}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <FinalCard label="Finalizou o módulo" value={moduleCompleted} />
            <ArrowConv pct={pct(formShown, moduleCompleted)} />
            <FinalCard label="Form apareceu" value={formShown} />
            <ArrowConv pct={pct(formDone, formShown)} />
            <FinalCard label="Aceitou 7 dias grátis" value={formDone} highlight />
          </div>
        )}
      </section>
    </div>
  );
}

const FinalCard = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
  <div className={`rounded-xl border p-4 ${highlight ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/40"}`}>
    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{label}</div>
    <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-emerald-400" : "text-zinc-100"}`}>
      {value.toLocaleString("pt-BR")}
    </div>
  </div>
);

const ArrowConv = ({ pct }: { pct: number }) => (
  <div className="flex flex-col items-center justify-center text-center">
    <ArrowRight className="w-4 h-4 text-zinc-600" />
    <span className={`text-xs mt-1 font-semibold ${pct < 50 ? "text-red-400" : "text-emerald-400"}`}>
      {pct.toFixed(1)}%
    </span>
  </div>
);
