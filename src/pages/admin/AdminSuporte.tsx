import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Paperclip, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatTile, EmptyState } from "./components";

/**
 * CAIXA DE ENTRADA DO SUPORTE (07/09, refeita 17/09).
 *
 * A tabela `support_tickets` existia desde abril e estava MORTA: só o fluxo
 * de cancelamento escrevia nela, e ninguém lia. Um formulário de suporte que
 * grava onde ninguém olha é pior que não ter formulário.
 *
 * 17/09, pedido do dono: "uma aba pra eu ver o que as pessoas mandaram —
 * suporte, erros, sugestões — pra não precisar ficar perguntando". Tudo que
 * chega de gente, num lugar só, por tipo:
 *   · Chamados   — support_tickets (Erro / Dúvida / Sugestão), com prints
 *   · Cancelou   — cancel_attempts: o motivo escolhido E o texto livre
 *   · Erros      — analytics (funnel_error, js_error, compra falhou) dos
 *                  últimos 7 dias, agrupados — o que antes só a sessão via
 * E um "Responder" que abre o e-mail já com o assunto e a mensagem citada.
 *
 * Consulta DIRETA, sem função edge: as policies das tabelas já dão SELECT/
 * UPDATE pra quem tem papel admin (has_role). Chamado novo também chega por
 * e-mail (suporte-ticket → Resend) — esta tela é o histórico.
 */

interface Ticket {
  id: string;
  user_id: string;
  source: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  /** resposta enviada pelo painel (22/09) — fica no chamado */
  resposta?: string | null;
  respondido_em?: string | null;
}
interface Cancelamento {
  id: string;
  user_id: string;
  reason: string | null;
  reason_detail: string | null;
  outcome: string;
  created_at: string;
}
interface ErroAgrupado {
  chave: string;
  evento: string;
  onde: string;
  mensagem: string;
  vezes: number;
  ultimo: string;
  plataformas: Record<string, number>;
}

type Aba = "chamados" | "cancelamentos" | "erros";
type FiltroTipo = "todos" | "app_erro" | "app_duvida" | "app_sugestao";

const ROTULO: Record<string, { txt: string; cor: string }> = {
  app_erro: { txt: "Erro", cor: "bg-destructive/10 text-destructive" },
  app_duvida: { txt: "Dúvida", cor: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  app_sugestao: { txt: "Sugestão", cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  cancel_flow: { txt: "Cancelamento", cor: "bg-muted text-muted-foreground" },
};
const rotulo = (s: string) => ROTULO[s] ?? { txt: s, cor: "bg-muted text-muted-foreground" };

const MOTIVO: Record<string, string> = {
  too_expensive: "Caro demais",
  not_using: "Não estava usando",
  missing_feature: "Falta uma função",
  technical_issue: "Problema técnico",
  other: "Outro",
};
const DESFECHO: Record<string, { txt: string; cor: string }> = {
  churned: { txt: "cancelou", cor: "bg-destructive/10 text-destructive" },
  saved_discount: { txt: "ficou (desconto)", cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  saved_extension: { txt: "ficou (extensão)", cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  saved_pause: { txt: "ficou (pausa)", cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  saved_feedback: { txt: "ficou (feedback)", cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  reason_given: { txt: "disse o motivo e parou", cor: "bg-muted text-muted-foreground" },
  opened: { txt: "só abriu", cor: "bg-muted text-muted-foreground" },
};
const desfecho = (o: string) => DESFECHO[o] ?? { txt: o, cor: "bg-muted text-muted-foreground" };

/* O chamado do app carrega o diagnóstico num rodapé de texto (a tabela não
 * tem coluna pra isso — ver supabase/functions/suporte-ticket). Estes dois
 * leitores desmontam esse rodapé, que é escrito por nós e tem formato fixo. */
const emailDoRodape = (msg: string): string | null =>
  msg.match(/^Conta:\s*(\S+@\S+?)\s/m)?.[1] ?? null;
const linksDosAnexos = (msg: string): string[] =>
  msg.match(/https:\/\/\S+\/storage\/v1\/\S+/g) ?? [];

/** O texto sem o rodapé: é o que a PESSOA escreveu, e é o que se lê primeiro. */
const RODAPE = "———— diagnóstico automático";
const separar = (msg: string) => {
  const i = msg.indexOf(RODAPE);
  return i < 0 ? { texto: msg, ficha: "" } : { texto: msg.slice(0, i).trim(), ficha: msg.slice(i).trim() };
};

const fmtDT = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Link de resposta: assunto pronto e a mensagem da pessoa citada. */
const mailtoResposta = (email: string, tipo: string, texto: string) => {
  const assunto = `CORE — sobre ${tipo.toLowerCase()} que você mandou`;
  const corpo = `Oi!\n\n\n\n—\nVocê escreveu:\n> ${texto.replace(/^\[[^\]]+\]\s*/, "").split("\n").join("\n> ")}`;
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
};

/* Erros automáticos: evento + onde + mensagem (ids/uuids apagados pra agrupar). */
const normalizar = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "…").replace(/\d{4,}/g, "…").slice(0, 90);

export default function AdminSuporte() {
  const [aba, setAba] = useState<Aba>("chamados");
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [cancels, setCancels] = useState<Cancelamento[] | null>(null);
  const [erros, setErros] = useState<ErroAgrupado[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soAbertos, setSoAbertos] = useState(true);
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tk, ca, ev] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id, user_id, source, message, status, created_at, resolved_at, resposta, respondido_em")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("cancel_attempts")
        .select("id, user_id, reason, reason_detail, outcome, created_at")
        .neq("outcome", "opened")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("analytics_events")
        .select("event_name, event_data, created_at")
        .in("event_name", ["funnel_error", "js_error", "app_compra_falhou"])
        .gte("created_at", new Date(Date.now() - 7 * 86400e3).toISOString())
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    if (tk.error) { setError(tk.error.message); setLoading(false); return; }
    // `resposta`/`respondido_em` (22/09) ainda não estão nos tipos gerados do Supabase
    const lista = (tk.data ?? []) as unknown as Ticket[];
    setRows(lista);
    const cl = (ca.data ?? []) as Cancelamento[];
    setCancels(cl);

    // Erros: só o que é defeito de verdade. "compra falhou · cancelou" é a
    // pessoa desistindo na folha, não erro — fica de fora.
    const grupos = new Map<string, ErroAgrupado>();
    for (const e of (ev.data ?? []) as Array<{ event_name: string; event_data: Record<string, unknown> | null; created_at: string }>) {
      const d = e.event_data ?? {};
      if (e.event_name === "app_compra_falhou" && d.motivo !== "billing_erro") continue;
      const onde = String(d.where ?? d.step ?? d.produto ?? d.path ?? "?");
      const mensagem = normalizar(String(d.message ?? d.erro ?? d.error ?? d.motivo ?? ""));
      const chave = `${e.event_name}|${onde}|${mensagem}`;
      const plat = String(d.loja || d.plataforma || d.platform || (d.funil ? `web/${d.funil}` : "web")); // `||`: campo vazio conta como ausente
      const g = grupos.get(chave) ?? { chave, evento: e.event_name, onde, mensagem, vezes: 0, ultimo: e.created_at, plataformas: {} };
      g.vezes += 1;
      g.plataformas[plat] = (g.plataformas[plat] ?? 0) + 1;
      if (e.created_at > g.ultimo) g.ultimo = e.created_at;
      grupos.set(chave, g);
    }
    setErros([...grupos.values()].sort((a, b) => b.vezes - a.vezes));

    // e-mail: o rodapé do chamado já traz, mas o cancelamento (e chamado
    // antigo) não — aí busca em subscriptions, que o admin também lê.
    const faltando = [...new Set([
      ...lista.filter((t) => !emailDoRodape(t.message)).map((t) => t.user_id),
      ...cl.map((c) => c.user_id),
    ])];
    if (faltando.length) {
      const mapa: Record<string, string> = {};
      for (let i = 0; i < faltando.length; i += 100) {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("user_id, customer_email")
          .in("user_id", faltando.slice(i, i + 100));
        for (const s of subs ?? []) if (s.customer_email) mapa[s.user_id] = s.customer_email;
      }
      setEmails(mapa);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* RESPONDER PELO PAINEL (22/09): a caixa abre no próprio chamado, o texto
     vai pela função admin-suporte (que resolve o e-mail pelo user_id e manda
     pelo Resend com "Oi, Nome!" e assinatura) e a resposta fica gravada. */
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviarResposta = async (t: Ticket) => {
    const texto = textoResposta.trim();
    if (texto.length < 5) return;
    setEnviando(true);
    const { data, error: err } = await supabase.functions.invoke("admin-suporte", { body: { action: "responder", id: t.id, texto } });
    setEnviando(false);
    const falha = err?.message ?? (data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : null);
    if (falha) { setError(`Não enviou: ${falha}`); return; }
    const agora = new Date().toISOString();
    setRows((r) => (r ?? []).map((x) => (x.id === t.id ? { ...x, status: "resolved", resolved_at: agora, resposta: texto, respondido_em: agora } : x)));
    setRespondendo(null);
    setTextoResposta("");
  };

  const resolver = async (t: Ticket) => {
    setResolvendo(t.id);
    const agora = new Date().toISOString();
    const { error: err } = await supabase
      .from("support_tickets")
      .update({ status: "resolved", resolved_at: agora })
      .eq("id", t.id);
    setResolvendo(null);
    if (err) { setError(err.message); return; }
    setRows((r) => (r ?? []).map((x) => (x.id === t.id ? { ...x, status: "resolved", resolved_at: agora } : x)));
  };

  const chamados = useMemo(() => (rows ?? []).filter((t) => t.source !== "cancel_flow"), [rows]);
  const abertos = useMemo(() => chamados.filter((t) => t.status !== "resolved"), [chamados]);
  const contagem = useMemo(() => {
    const c: Record<string, number> = { app_erro: 0, app_duvida: 0, app_sugestao: 0 };
    for (const t of abertos) c[t.source] = (c[t.source] ?? 0) + 1;
    return c;
  }, [abertos]);
  const visiveis = (soAbertos ? abertos : chamados).filter((t) => tipo === "todos" || t.source === tipo);

  const cancelsComTexto = useMemo(() => (cancels ?? []).filter((c) => (c.reason_detail ?? "").trim().length > 0), [cancels]);
  const perdidos30d = useMemo(() => {
    const de = Date.now() - 30 * 86400e3;
    return (cancels ?? []).filter((c) => c.outcome === "churned" && Date.parse(c.created_at) >= de).length;
  }, [cancels]);
  const errosTotal = useMemo(() => (erros ?? []).reduce((s, e) => s + e.vezes, 0), [erros]);

  // Seletor genérico: as opções levam o valor como string e cada chamada
  // converte de volta (string | boolean) — evita um componente genérico
  // dentro do render, que o TS não infere direito em JSX.
  const Seletor = ({ valor, opcoes, onChange }: { valor: string; opcoes: Array<{ id: string; l: string }>; onChange: (v: string) => void }) => (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 flex-wrap">
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
            valor === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Suporte</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Tudo que as pessoas mandaram: chamados do app, motivos de cancelamento e erros automáticos. Chamado novo também chega no seu e-mail.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-medium hover:bg-muted transition-colors disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Erro: {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Chamados em aberto" value={String(abertos.length)} sub={`${contagem.app_erro} erro · ${contagem.app_duvida} dúvida · ${contagem.app_sugestao} sugestão`} />
        <StatTile label="Sugestões" value={String(chamados.filter((t) => t.source === "app_sugestao").length)} sub="no total, abertas e resolvidas" />
        <StatTile label="Cancelaram (30 dias)" value={String(perdidos30d)} sub={`${cancelsComTexto.length} deixaram texto`} />
        <StatTile label="Erros automáticos (7 dias)" value={String(errosTotal)} sub={`${erros?.length ?? 0} tipos diferentes`} />
      </div>

      <Seletor
        valor={aba}
        onChange={(v) => setAba(v as Aba)}
        opcoes={[
          { id: "chamados", l: `Chamados (${abertos.length})` },
          { id: "cancelamentos", l: `Cancelamentos (${cancelsComTexto.length})` },
          { id: "erros", l: `Erros automáticos (${erros?.length ?? 0})` },
        ]}
      />

      {loading && !rows ? (
        <Panel><div className="grid place-items-center py-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div></Panel>
      ) : aba === "chamados" ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Seletor valor={soAbertos ? "abertos" : "todos"} onChange={(v) => setSoAbertos(v === "abertos")} opcoes={[{ id: "abertos", l: "Abertos" }, { id: "todos", l: "Todos" }]} />
            <Seletor
              valor={tipo}
              onChange={(v) => setTipo(v as FiltroTipo)}
              opcoes={[{ id: "todos", l: "Tudo" }, { id: "app_erro", l: "Erros" }, { id: "app_duvida", l: "Dúvidas" }, { id: "app_sugestao", l: "Sugestões" }]}
            />
          </div>
          {visiveis.length === 0 ? (
            <Panel><EmptyState label={soAbertos ? "Nenhum chamado em aberto." : "Nenhum chamado ainda."} /></Panel>
          ) : (
            <div className="space-y-3">
              {visiveis.map((t) => {
                const { texto, ficha } = separar(t.message);
                const anexos = linksDosAnexos(t.message);
                const email = emailDoRodape(t.message) ?? emails[t.user_id] ?? null;
                const r = rotulo(t.source);
                return (
                  <div key={t.id} className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${r.cor}`}>{r.txt}</span>
                          <span className="text-[12px] text-muted-foreground">{fmtDT(t.created_at)}</span>
                          {t.status === "resolved" && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
                              resolvido{t.resolved_at ? ` em ${fmtDT(t.resolved_at)}` : ""}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 text-[13px] font-semibold break-all">{email ?? "sem e-mail conhecido"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono break-all">{t.user_id}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setRespondendo(respondendo === t.id ? null : t.id); setTextoResposta(""); }}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-medium hover:bg-muted transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" /> {t.resposta ? "Responder de novo" : "Responder"}
                        </button>
                        {email && (
                          <a
                            href={mailtoResposta(email, r.txt, texto)}
                            title="Abrir no seu e-mail (o de sempre)"
                            className="text-[11.5px] text-muted-foreground underline underline-offset-2"
                          >
                            no e-mail
                          </a>
                        )}
                        {t.status !== "resolved" && (
                          <button
                            onClick={() => resolver(t)}
                            disabled={resolvendo === t.id}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]
                                       font-medium hover:bg-muted transition-colors disabled:opacity-60"
                          >
                            {resolvendo === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Resolvido
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{texto}</p>

                    {t.resposta && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                          Sua resposta{t.respondido_em ? ` · ${fmtDT(t.respondido_em)}` : ""}
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{t.resposta}</p>
                      </div>
                    )}

                    {respondendo === t.id && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                        <textarea
                          value={textoResposta}
                          onChange={(e) => setTextoResposta(e.target.value)}
                          rows={6}
                          autoFocus
                          placeholder={`Escreve só o miolo — o e-mail já sai com "Oi, Nome!" no começo e "João, do CORE" no fim, e leva a mensagem da pessoa citada embaixo.`}
                          className="w-full rounded-lg border border-input bg-background p-3 text-[13.5px] leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void enviarResposta(t)}
                            disabled={enviando || textoResposta.trim().length < 5}
                            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60"
                          >
                            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Enviar e resolver
                          </button>
                          <button type="button" onClick={() => setRespondendo(null)} className="text-[12.5px] text-muted-foreground">cancelar</button>
                          <span className="text-[11px] text-muted-foreground ml-auto">vai pro e-mail da conta do chamado</span>
                        </div>
                      </div>
                    )}

                    {anexos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                          <Paperclip className="w-3 h-3" /> {anexos.length} print{anexos.length > 1 ? "s" : ""}
                        </div>
                        {/* A URL é assinada (1 ano) — abre pra quem tem o link, e é
                            por isso que o admin consegue ver o print de outra
                            pessoa mesmo com o bucket privado por pasta. */}
                        <div className="flex flex-wrap gap-2">
                          {anexos.map((u, i) => (
                            <a key={u} href={u} target="_blank" rel="noreferrer"
                               className="block w-24 h-24 rounded-xl overflow-hidden border border-border bg-muted">
                              <img src={u} alt={`Print ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {ficha && (
                      <details className="group">
                        <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground select-none">
                          Diagnóstico do aparelho
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap font-mono">
                          {ficha}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : aba === "cancelamentos" ? (
        cancelsComTexto.length === 0 ? (
          <Panel><EmptyState label="Ninguém deixou texto ao cancelar ainda." /></Panel>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              Só quem escreveu alguma coisa. Motivo escolhido na lista + o que a pessoa digitou. Quem só clicou no motivo entra na contagem dos cards, não aqui.
            </p>
            {cancelsComTexto.map((c) => {
              const d = desfecho(c.outcome);
              const email = emails[c.user_id] ?? null;
              return (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted text-foreground">{MOTIVO[c.reason ?? ""] ?? c.reason ?? "sem motivo"}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${d.cor}`}>{d.txt}</span>
                        <span className="text-[12px] text-muted-foreground">{fmtDT(c.created_at)}</span>
                      </div>
                      <div className="mt-1.5 text-[13px] font-semibold break-all">{email ?? "sem e-mail conhecido"}</div>
                    </div>
                    {email && (
                      <a href={mailtoResposta(email, "o cancelamento", c.reason_detail ?? "")}
                         className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-medium hover:bg-muted transition-colors shrink-0">
                        <Mail className="w-3.5 h-3.5" /> Responder
                      </a>
                    )}
                  </div>
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{c.reason_detail}</p>
                </div>
              );
            })}
          </div>
        )
      ) : (
        (erros ?? []).length === 0 ? (
          <Panel><EmptyState label="Nenhum erro automático nos últimos 7 dias." /></Panel>
        ) : (
          <Panel title="Erros automáticos" sub="Últimos 7 dias, agrupados por tela e mensagem. 'User already registered' é gente tentando criar conta com e-mail que já existe — não é defeito.">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Vezes</th>
                    <th className="py-2 pr-3">Onde</th>
                    <th className="py-2 pr-3">Mensagem</th>
                    <th className="py-2 pr-3">Plataforma</th>
                    <th className="py-2">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {(erros ?? []).map((e) => (
                    <tr key={e.chave} className="border-t border-border align-top">
                      <td className="py-2 pr-3 font-bold tabular-nums">{e.vezes}</td>
                      <td className="py-2 pr-3 whitespace-nowrap"><span className="text-muted-foreground">{e.evento.replace("funnel_error", "funil").replace("js_error", "js").replace("app_compra_falhou", "compra")}</span> · {e.onde}</td>
                      <td className="py-2 pr-3 font-mono text-[11.5px] break-all">{e.mensagem || "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{Object.entries(e.plataformas).map(([k, v]) => `${k} ${v}`).join(" · ")}</td>
                      <td className="py-2 whitespace-nowrap text-muted-foreground">{fmtDT(e.ultimo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )
      )}
    </div>
  );
}
