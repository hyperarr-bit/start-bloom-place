import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatTile, EmptyState } from "./components";

/**
 * CHAMADOS DE SUPORTE (07/09).
 *
 * A tabela `support_tickets` existia desde abril e estava MORTA: só o fluxo
 * de cancelamento escrevia nela, e ninguém — nenhuma tela, nenhum relatório —
 * lia. Um formulário de suporte que grava onde ninguém olha é pior que não
 * ter formulário: promete resposta e não entrega. Esta tela é a outra ponta
 * do pedido da cliente ("coloca um formulário pra gente por o bug").
 *
 * Consulta DIRETA, sem função edge: as policies da tabela já dão SELECT e
 * UPDATE pra quem tem papel admin (has_role), o mesmo mecanismo do resto do
 * /admin. Não há o que deployar pra esta tela funcionar.
 */

interface Ticket {
  id: string;
  user_id: string;
  source: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

const ROTULO: Record<string, { txt: string; cor: string }> = {
  app_erro: { txt: "Erro", cor: "bg-destructive/10 text-destructive" },
  app_duvida: { txt: "Dúvida", cor: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  app_sugestao: { txt: "Sugestão", cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  cancel_flow: { txt: "Cancelamento", cor: "bg-muted text-muted-foreground" },
};
const rotulo = (s: string) => ROTULO[s] ?? { txt: s, cor: "bg-muted text-muted-foreground" };

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

export default function AdminSuporte() {
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soAbertos, setSoAbertos] = useState(true);
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("support_tickets")
      .select("id, user_id, source, message, status, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (err) { setError(err.message); setLoading(false); return; }
    const lista = (data ?? []) as Ticket[];
    setRows(lista);

    // e-mail: o rodapé do chamado já traz, mas o do cancel_flow (e chamado
    // antigo) não — aí busca em subscriptions, que o admin também lê.
    const faltando = [...new Set(lista.filter((t) => !emailDoRodape(t.message)).map((t) => t.user_id))];
    if (faltando.length) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id, customer_email")
        .in("user_id", faltando);
      const mapa: Record<string, string> = {};
      for (const s of subs ?? []) if (s.customer_email) mapa[s.user_id] = s.customer_email;
      setEmails(mapa);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const abertos = useMemo(() => (rows ?? []).filter((t) => t.status !== "resolved"), [rows]);
  const visiveis = soAbertos ? abertos : rows ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Suporte</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Chamados abertos pelo app (menu → Ajuda e suporte) e pelo fluxo de cancelamento
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
          {[{ id: true, l: "Abertos" }, { id: false, l: "Todos" }].map((o) => (
            <button
              key={String(o.id)}
              onClick={() => setSoAbertos(o.id)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                soAbertos === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Erro: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Em aberto" value={String(abertos.length)} sub="esperando resposta" />
        <StatTile label="Total" value={String(rows?.length ?? 0)} sub="últimos 300 chamados" />
      </div>

      {loading && !rows ? (
        <Panel><div className="grid place-items-center py-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div></Panel>
      ) : visiveis.length === 0 ? (
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
                  {t.status !== "resolved" && (
                    <button
                      onClick={() => resolver(t)}
                      disabled={resolvendo === t.id}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]
                                 font-medium hover:bg-muted transition-colors disabled:opacity-60 shrink-0"
                    >
                      {resolvendo === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Marcar resolvido
                    </button>
                  )}
                </div>

                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{texto}</p>

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
    </div>
  );
}
