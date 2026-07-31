import { useEffect, useMemo, useState } from "react";
import { Loader2, Clock, Layers, LogIn, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatTile, EmptyState } from "./components";

/**
 * Pagantes — uso REAL de cada assinante, lido da tabela module_analytics
 * (módulo + aba + tempo por visita). Antes lia finance_card_view e mostrava
 * "sem uso" errado. Mostra nome real do módulo/aba, 1º/último acesso com hora,
 * tempo total e nº de sessões — pro dono ver o que a galera usa e melhorar.
 */

interface ModUse { id: string; seconds: number; opens: number }
interface TabUse { module: string; tab: string; seconds: number }
interface PayerRow {
  user_id: string; email: string | null; name: string | null;
  plan: string | null; status: string;
  subscribed_since: string; current_period_end: string | null;
  first_seen: string | null; last_seen: string | null;
  sessions: number; days_active: number; total_seconds: number; total_opens: number;
  actions: string[]; modules: ModUse[]; tabs: TabUse[];
  /* 30/07 — sinais de acompanhamento (fuso de SP, calculados no SQL) */
  active_today: boolean; last_7d_days: number;
  days_since_last: number | null; days_since_buy: number;
}

/**
 * RECORTES (30/07, pedido do dono: "sinto vontade de acompanhar mais").
 *
 * A lista tinha 605 linhas numa ordem só (data da compra) — dá pra ler no
 * primeiro dia e nunca mais. Cada recorte responde uma pergunta que se
 * pergunta de manhã, e o de MAIOR valor é "sumiram": comprou, não voltou.
 * Só 30% dos compradores com 14+ dias abriram o app na última semana — esse
 * é o balde onde mora churn silencioso de produto vitalício.
 */
type SegId = "todos" | "hoje" | "novos" | "fieis" | "sumidos" | "nunca";
const SEGMENTOS: Array<{ id: SegId; label: string; sub: string; teste: (r: PayerRow) => boolean }> = [
  { id: "todos", label: "Todos", sub: "todo mundo que pagou", teste: () => true },
  { id: "hoje", label: "Usaram hoje", sub: "deram sinal hoje", teste: (r) => r.active_today },
  { id: "novos", label: "Novos", sub: "compraram nos últimos 7 dias", teste: (r) => r.days_since_buy <= 7 },
  { id: "fieis", label: "Fiéis", sub: "voltaram em 5+ dias diferentes", teste: (r) => r.days_active >= 5 },
  { id: "sumidos", label: "Sumiram", sub: "compraram há 7d+ e não abrem há 7d+", teste: (r) => r.days_since_buy >= 7 && (r.days_since_last === null || r.days_since_last >= 7) },
  { id: "nunca", label: "Nunca abriram", sub: "pagaram e nunca deram sinal", teste: (r) => r.sessions === 0 || r.days_since_last === null },
];

type SortId = "recentes" | "tempo" | "dias" | "sessoes" | "sumido";
const ORDENS: Array<{ id: SortId; label: string; cmp: (a: PayerRow, b: PayerRow) => number }> = [
  { id: "recentes", label: "Compra mais recente", cmp: (a, b) => +new Date(b.subscribed_since) - +new Date(a.subscribed_since) },
  { id: "tempo", label: "Mais tempo no app", cmp: (a, b) => b.total_seconds - a.total_seconds },
  { id: "dias", label: "Mais dias diferentes", cmp: (a, b) => b.days_active - a.days_active || b.total_seconds - a.total_seconds },
  { id: "sessoes", label: "Mais sessões", cmp: (a, b) => b.sessions - a.sessions },
  { id: "sumido", label: "Sumido há mais tempo", cmp: (a, b) => (b.days_since_last ?? 9999) - (a.days_since_last ?? 9999) },
];

/** "há Xd" com cor: verde hoje/ontem, âmbar até uma semana, vermelho sumido. */
const tomDoSumico = (d: number | null) =>
  d === null ? "text-destructive"
    : d <= 1 ? "text-emerald-600 dark:text-emerald-400"
      : d <= 6 ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
const rotuloSumico = (d: number | null) =>
  d === null ? "nunca abriu" : d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;

// ações de ativação (o que a pessoa configurou de fato)
const ACTION: Record<string, string> = {
  first_income: "💰 Renda", first_fixed_expense: "📌 Gasto fixo",
  first_bill: "🗓️ Conta a vencer", first_transaction: "💳 Transação",
  first_investment: "📈 Investimento", first_meal: "🍽️ Refeição",
  first_workout: "🏋️ Treino", first_habit: "✅ Hábito",
  first_note: "📝 Anotação", first_goal: "🎯 Meta",
};
const actionLabel = (a: string) => ACTION[a] ?? prettify(a.replace(/^first_/, ""));

// código do módulo → nome real + emoji
const MODULE: Record<string, { e: string; n: string }> = {
  financas: { e: "💸", n: "Finanças" }, rotina: { e: "📅", n: "Rotina" },
  dieta: { e: "🥗", n: "Dieta" }, treino: { e: "💪", n: "Treino" },
  saude: { e: "❤️", n: "Saúde" }, desenvolvimento: { e: "🎯", n: "Metas" },
  metas: { e: "🎯", n: "Metas" }, hiperfoco: { e: "🧠", n: "Foco" },
  estudos: { e: "📚", n: "Estudos" }, carreira: { e: "💼", n: "Carreira" },
  biblioteca: { e: "📖", n: "Leitura" }, casa: { e: "🏠", n: "Casa" },
  beleza: { e: "✨", n: "Beleza" }, viagens: { e: "✈️", n: "Viagens" },
  relacionamentos: { e: "👥", n: "Relações" }, pet: { e: "🐾", n: "Pet" },
  detox: { e: "📵", n: "Detox" }, conquistas: { e: "🏆", n: "Conquistas" },
  home: { e: "🏠", n: "Início" },
};
// código da aba → nome real (as conhecidas; resto é embelezado)
const TAB: Record<string, string> = {
  financeiro: "Lançamentos", dashboard: "Painel", investimentos: "Investimentos",
  itens: "Desejos", semana: "Semana", diario: "Diário", lendo: "Lendo",
  cardapio: "Cardápio", config: "Config", saude: "Saúde", metas: "Metas",
  habitos: "Hábitos", treino: "Treino", dieta: "Dieta",
};
const modName = (id: string) => MODULE[id] ?? { e: "•", n: prettify(id) };
const tabName = (t: string) => TAB[t] ?? prettify(t);
function prettify(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PLAN = { monthly: "Mensal", annual: "Anual", lifetime: "Vitalício" } as Record<string, string>;
const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  cancel_scheduled: "bg-amber-100 text-amber-700",
  past_due: "bg-amber-100 text-amber-700",
  canceled: "bg-muted text-muted-foreground",
};
const STATUS = { active: "Ativo", cancel_scheduled: "Cancela no fim", past_due: "Atrasado", canceled: "Cancelado" } as Record<string, string>;

const fmtDur = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}min` : `${(s / 3600).toFixed(1)}h`);
const fmtDT = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminPagantes() {
  const [rows, setRows] = useState<PayerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [seg, setSeg] = useState<SegId>("todos");
  const [ordem, setOrdem] = useState<SortId>("recentes");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc("admin_paying_users_detail");
      if (err) setError(err.message);
      else setRows((data as any)?.users ?? []);
      setLoading(false);
    })();
  }, []);

  // Resumo agregado (pro dono decidir o que melhorar)
  const summary = useMemo(() => {
    if (!rows) return null;
    const withUse = rows.filter((r) => r.total_seconds > 0);
    const modSeconds: Record<string, number> = {};
    for (const r of rows) for (const m of r.modules) modSeconds[m.id] = (modSeconds[m.id] ?? 0) + m.seconds;
    const topModules = Object.entries(modSeconds).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const avgMin = withUse.length ? Math.round(withUse.reduce((a, r) => a + r.total_seconds, 0) / withUse.length / 60) : 0;
    // ativação: quantos fizeram cada primeira ação
    const actCount: Record<string, number> = {};
    for (const r of rows) for (const a of r.actions ?? []) actCount[a] = (actCount[a] ?? 0) + 1;
    const topActions = Object.entries(actCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const activated = rows.filter((r) => (r.actions?.length ?? 0) > 0).length;
    const returned = rows.filter((r) => r.days_active > 1).length;
    const hoje = rows.filter((r) => r.active_today).length;
    const semana = rows.filter((r) => r.last_7d_days > 0).length;
    return { total: rows.length, withUse: withUse.length, topModules, avgMin, topActions, activated, returned, hoje, semana };
  }, [rows]);

  /** Contagem de cada recorte — vai no próprio botão, pra decidir sem clicar. */
  const contagens = useMemo(() => {
    const m = {} as Record<SegId, number>;
    for (const s of SEGMENTOS) m[s.id] = rows ? rows.filter(s.teste).length : 0;
    return m;
  }, [rows]);

  const lista = useMemo(() => {
    if (!rows) return [];
    const seg_ = SEGMENTOS.find((s) => s.id === seg)!;
    const q = busca.trim().toLowerCase();
    return rows
      .filter(seg_.teste)
      .filter((r) => !q || (r.name ?? "").toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q))
      .sort(ORDENS.find((o) => o.id === ordem)!.cmp);
  }, [rows, seg, ordem, busca]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pagantes</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">O que cada assinante usa de verdade — módulo, aba e tempo</p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Erro ao carregar: {error}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : !rows || rows.length === 0 ? (
        <Panel><EmptyState label="Nenhum pagante ainda." /></Panel>
      ) : (
        <>
          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile label="Usaram HOJE" value={String(summary.hoje)} sub={`${Math.round(summary.hoje / summary.total * 100)}% dos pagantes`} />
                <StatTile label="Ativos na semana" value={String(summary.semana)} sub={`${Math.round(summary.semana / summary.total * 100)}% deram sinal em 7 dias`} />
                <StatTile label="Pagantes" value={String(summary.total)} sub={`${summary.activated} configuraram algo · ${summary.total - summary.withUse} nem abriram`} />
                <StatTile label="Tempo médio no app" value={`${summary.avgMin}min`} sub="visita conta até 30min" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Panel title="Módulos mais usados" sub="Soma do tempo de todos os pagantes — onde investir no produto">
                  <div className="space-y-2">
                    {summary.topModules.map(([id, sec]) => {
                      const max = summary.topModules[0][1];
                      const m = modName(id);
                      return (
                        <div key={id} className="flex items-center gap-3">
                          <span className="text-[13px] w-28 shrink-0">{m.e} {m.n}</span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${Math.max(4, sec / max * 100)}%` }} />
                          </div>
                          <span className="text-[12px] text-muted-foreground tabular-nums w-16 text-right">{fmtDur(sec)}</span>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
                <Panel title="O que a galera configura" sub="Quantos pagantes fizeram cada 1ª ação — o que ativa e o que ninguém toca">
                  <div className="space-y-2">
                    {summary.topActions.map(([a, n]) => {
                      const max = summary.topActions[0][1];
                      return (
                        <div key={a} className="flex items-center gap-3">
                          <span className="text-[13px] w-32 shrink-0">{actionLabel(a)}</span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(4, n / max * 100)}%` }} />
                          </div>
                          <span className="text-[12px] text-muted-foreground tabular-nums w-10 text-right">{n}</span>
                        </div>
                      );
                    })}
                    {summary.topActions.length === 0 && <EmptyState label="Sem ativação registrada" />}
                  </div>
                </Panel>
              </div>
            </>
          )}

          {/* RECORTES — a pergunta primeiro, a lista depois */}
          <Panel>
            <div className="flex flex-wrap gap-2">
              {SEGMENTOS.map((sgm) => {
                const on = seg === sgm.id;
                return (
                  <button
                    key={sgm.id}
                    onClick={() => { setSeg(sgm.id); setOpen(null); }}
                    title={sgm.sub}
                    className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                      on ? "bg-foreground text-background" : "bg-secondary hover:bg-muted text-foreground"}`}
                  >
                    {sgm.label}
                    <span className={`ml-1.5 tabular-nums ${on ? "opacity-70" : "text-muted-foreground"}`}>{contagens[sgm.id]}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[12px] text-muted-foreground mt-2.5">{SEGMENTOS.find((s) => s.id === seg)!.sub}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail…"
                className="flex-1 min-w-[180px] h-9 rounded-lg border border-border bg-background px-3 text-[13px]"
              />
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as SortId)}
                className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] font-medium"
              >
                {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </Panel>

          <div className="text-[12px] text-muted-foreground">
            Mostrando <b className="text-foreground">{lista.length}</b> de {rows.length}
          </div>

          <div className="space-y-2.5">
            {lista.length === 0 && <Panel><EmptyState label="Ninguém neste recorte." /></Panel>}
            {lista.map((r) => {
              // chave = user_id: o e-mail se repetia (mesma pessoa com 2
              // assinaturas) e chave duplicada embaralha a lista no React.
              const key = r.user_id;
              const isOpen = open === key;
              const used = r.total_seconds > 0;
              return (
                <div key={key} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : key)}
                    className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="font-bold text-[14px] truncate">{r.name || r.email || "(sem e-mail)"}</span>
                        {r.active_today && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            hoje
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"}`}>
                          {STATUS[r.status] ?? r.status}
                        </span>
                      </div>
                      {r.name && <div className="text-[12px] text-muted-foreground ml-6 truncate">{r.email}</div>}
                      <div className="text-[11px] text-muted-foreground ml-6 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{PLAN[r.plan ?? ""] ?? r.plan}</span>
                        <span className="inline-flex items-center gap-1"><LogIn className="w-3 h-3" /> 1º {fmtDT(r.first_seen)}</span>
                        <span>· último {fmtDT(r.last_seen)}</span>
                        <span>· {r.sessions} sessões</span>
                        <span className={r.days_active > 1 ? "text-emerald-600 font-semibold" : ""}>· {r.days_active} {r.days_active === 1 ? "dia" : "dias"} ativo{r.days_active === 1 ? "" : "s"}{r.days_active > 1 ? " ↩" : ""}</span>
                        <span>· {r.last_7d_days}/7 dias na semana</span>
                        <span className={`font-semibold ${tomDoSumico(r.days_since_last)}`}>· abriu {rotuloSumico(r.days_since_last)}</span>
                        <span>· comprou há {r.days_since_buy}d</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {used ? (
                        <>
                          <div className="text-[15px] font-bold tabular-nums inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-accent" /> {fmtDur(r.total_seconds)}</div>
                          <div className="text-[11px] text-muted-foreground">{r.modules.length} módulos</div>
                        </>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-600">não abriu o app</span>
                      )}
                    </div>
                  </button>

                  {isOpen && used && (
                    <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                      {r.actions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Configurou no app (ativação)</div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.actions.map((a) => (
                              <span key={a} className="text-[12px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-full px-2.5 py-1">
                                {actionLabel(a)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Módulos (tempo · aberturas)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {r.modules.map((m) => {
                            const mn = modName(m.id);
                            return (
                              <span key={m.id} className="text-[12px] font-medium bg-card border border-border rounded-full px-2.5 py-1">
                                {mn.e} {mn.n} <span className="text-muted-foreground">· {fmtDur(m.seconds)} · {m.opens}×</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      {r.tabs.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Abas que mais usou</div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.tabs.map((t, i) => (
                              <span key={i} className="text-[11px] bg-card border border-border rounded-full px-2.5 py-1">
                                <span className="text-muted-foreground">{modName(t.module).n} ›</span> {tabName(t.tab)} <span className="text-muted-foreground">· {fmtDur(t.seconds)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isOpen && !used && (
                    <div className="border-t border-border p-4 text-[12px] text-muted-foreground bg-muted/20">
                      Pagou mas ainda não abriu nenhum módulo. 1º acesso {fmtDT(r.first_seen)}. Bom alvo pra um lembrete de ativação.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
