import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, Rocket, UserPlus, MonitorPlay, AlertCircle, ArrowDownRight } from "lucide-react";

type StepData = Record<string, { sessions: number; views: number }>;
type ClickData = Record<string, { clicks: number; sessions: number }>;
type QuizRow = { q: string; answer: string; count: number; sessions: number };
type DailyRow = { day: string; started: number; demo: number; signups: number; trials: number };
interface Funnel {
  range: { from: string; to: string };
  steps: StepData;
  clicks: ClickData;
  quiz: QuizRow[];
  daily: DailyRow[];
}

const RANGES = [
  { key: "today", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
];

const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: "start", label: "Tela inicial" },
  { key: "quiz_1", label: "Quiz · o que te atrapalha" },
  { key: "quiz_2", label: "Quiz · como controla" },
  { key: "quiz_3", label: "Quiz · vitória em 7d" },
  { key: "progress", label: "Preparando teste" },
  { key: "result", label: "Plano pronto" },
  { key: "demo", label: "Demo (app real)" },
  { key: "signup", label: "Cadastro (form)" },
  { key: "trial", label: "Ganhou 7 dias" },
];

const CTA_LABELS: Record<string, string> = {
  start: "Começar meu teste (início)",
  result: "Ver meu painel (plano → demo)",
  demo_quase_la: "Quase lá (demo → cadastro)",
  signup_submit: "Enviou o cadastro",
  signup_success: "Conta criada",
  trial_accept: "Aceitou o trial",
};

const QUIZ_LABELS: Record<string, string> = {
  atrapalha: "O que mais te atrapalha?",
  controle: "Como controla seu dinheiro hoje?",
  vitoria: "Vitória nos próximos 7 dias?",
};

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function Kpi({ Icon, label, value, sub }: { Icon: typeof Eye; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-zinc-500 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminFunil() {
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState("7d");
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];

  const load = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 864e5);
    const { data, error } = await (supabase as any).rpc("admin_funnel_v1", {
      _from: from.toISOString(),
      _to: to.toISOString(),
    });
    if (error) {
      setErr(error.message || "Erro ao carregar");
      setData(null);
    } else {
      setData(data as Funnel);
    }
    setLoading(false);
    setRefreshing(false);
  }, [range.days]);

  useEffect(() => { load(); }, [load]);

  const sess = (k: string) => data?.steps?.[k]?.sessions ?? 0;
  const click = (k: string) => data?.clicks?.[k]?.sessions ?? 0;
  const startN = sess("start");

  const quizByQ = useMemo(() => {
    const m: Record<string, QuizRow[]> = {};
    (data?.quiz ?? []).forEach((r) => { (m[r.q] ??= []).push(r); });
    Object.values(m).forEach((rows) => rows.sort((a, b) => b.count - a.count));
    return m;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Funil de aquisição</h1>
          <p className="text-xs text-zinc-500 mt-1">/comecar → quiz → plano → demo → cadastro → trial · sessões únicas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRangeKey(r.key)}
                className={`px-3 py-1 text-xs rounded-md ${rangeKey === r.key ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300/90">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">Falta aplicar a função no banco.</p>
            <p className="text-amber-300/70 mt-1">
              Rode a migration <code className="bg-amber-500/10 px-1 rounded">admin_funnel_v1</code> (ou cole o SQL dela no
              Supabase → SQL Editor). Detalhe: {err}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Carregando…</div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi Icon={Eye} label="Iniciaram" value={startN} sub="abriram o funil" />
            <Kpi Icon={MonitorPlay} label="Viram a demo" value={sess("demo")} sub={pct(sess("demo"), startN) + " do início"} />
            <Kpi Icon={UserPlus} label="Criaram conta" value={click("signup_success")} sub={pct(click("signup_success"), startN)} />
            <Kpi Icon={Rocket} label="Aceitaram trial" value={click("trial_accept")} sub={pct(click("trial_accept"), startN)} />
            <Kpi Icon={ArrowDownRight} label="Início → Trial" value={pct(click("trial_accept"), startN)} sub="conversão total" />
          </div>

          {/* Funil passo a passo */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-bold text-zinc-200 mb-4">Passo a passo (quem viu cada parte)</h2>
            <div className="space-y-2.5">
              {FUNNEL_STEPS.map((s, i) => {
                const n = sess(s.key);
                const prev = i > 0 ? sess(FUNNEL_STEPS[i - 1].key) : n;
                const drop = prev > 0 ? ((prev - n) / prev) * 100 : 0;
                const width = startN > 0 ? Math.max(2, (n / startN) * 100) : 0;
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300">{s.label}</span>
                      <span className="text-zinc-400 tabular-nums">
                        {n} <span className="text-zinc-600">·</span> {pct(n, startN)}
                        {i > 0 && drop > 0.5 && <span className="text-red-400/80 ml-2">−{drop.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cliques em botões */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-bold text-zinc-200 mb-3">Cliques nos botões</h2>
            <div className="space-y-1.5">
              {Object.entries(data.clicks || {}).sort((a, b) => b[1].clicks - a[1].clicks).map(([cta, v]) => (
                <div key={cta} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/60 last:border-0">
                  <span className="text-zinc-300">{CTA_LABELS[cta] ?? cta}</span>
                  <span className="text-zinc-400 tabular-nums">{v.sessions} sessões <span className="text-zinc-600">·</span> {v.clicks} cliques</span>
                </div>
              ))}
              {Object.keys(data.clicks || {}).length === 0 && <p className="text-xs text-zinc-600">Sem cliques no período.</p>}
            </div>
          </div>

          {/* Respostas do quiz (ouro pra otimizar copy/oferta) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-bold text-zinc-200 mb-1">Respostas do quiz</h2>
            <p className="text-[11px] text-zinc-500 mb-4">Quem é seu público e o que ele quer — use pra afinar copy e oferta.</p>
            <div className="grid md:grid-cols-3 gap-5">
              {Object.keys(QUIZ_LABELS).map((qk) => {
                const rows = quizByQ[qk] ?? [];
                const total = rows.reduce((s, r) => s + r.count, 0);
                return (
                  <div key={qk}>
                    <div className="text-xs font-semibold text-zinc-300 mb-2">{QUIZ_LABELS[qk]}</div>
                    <div className="space-y-1.5">
                      {rows.map((r) => (
                        <div key={r.answer}>
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="text-zinc-400 truncate pr-2">{r.answer}</span>
                            <span className="text-zinc-500 tabular-nums shrink-0">{pct(r.count, total)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full bg-fuchsia-500/60 rounded-full" style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                      {rows.length === 0 && <p className="text-[11px] text-zinc-600">Sem respostas.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diário */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-bold text-zinc-200 mb-3">Por dia</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="font-medium pb-2">Dia</th>
                    <th className="font-medium pb-2 text-right">Iniciaram</th>
                    <th className="font-medium pb-2 text-right">Demo</th>
                    <th className="font-medium pb-2 text-right">Contas</th>
                    <th className="font-medium pb-2 text-right">Trials</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {(data.daily ?? []).slice().reverse().map((d) => (
                    <tr key={d.day} className="border-t border-zinc-800/60">
                      <td className="py-1.5">{fmtDate(d.day)}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.started}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.demo}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.signups}</td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-400">{d.trials}</td>
                    </tr>
                  ))}
                  {(data.daily ?? []).length === 0 && (
                    <tr><td colSpan={5} className="py-3 text-zinc-600">Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
