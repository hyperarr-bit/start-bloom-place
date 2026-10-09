import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Pause, Play, RefreshCw, Send, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatTile, EmptyState } from "./components";
import {
  type AfiliadaAdmin, type DadosAdminAfiliados, type NovaAfiliada, type PagamentoAdmin, type VendaAdmin,
  ROTULO_MOTIVO, ROTULO_STATUS_PAGAMENTO, ROTULO_STATUS_VENDA, diaCurto, reais,
} from "@/lib/afiliados";

/**
 * ABA "AFILIADOS" DO /admin (09/10/2026).
 *
 * Tudo passa pela função `afiliados` (service role): os tipos gerados do
 * Supabase não conhecem as tabelas novas e a chave Pix nunca deve chegar
 * inteira no navegador (vem mascarada). O que o dono faz aqui:
 *   · cria a afiliada (nome, código, Pix, limite semanal) — o código tem que
 *     ser o MESMO da oferta criada por scripts/asc-codigo-afiliado.mjs
 *   · vê por afiliada: usaram / em teste / pagaram / comissão / pagamentos
 *   · pausa os pagamentos (as vendas continuam sendo contadas)
 *   · libera um pagamento SEGURADO (acima do limite) ou tenta de novo um que FALHOU
 *   · copia o link do painel dela e o link de resgate
 *   · "Prévia da segunda": roda o pagar_semana em ENSAIO (nada sai)
 */

/** "acima_do_limite_30000" → "acima do limite de R$ 300,00" */
const textoMotivoPagamento = (m: string) => {
  const lim = m.match(/^acima_do_limite_(\d+)$/);
  return lim ? `acima do limite de ${reais(Number(lim[1]))}` : m.replace(/_/g, " ");
};
const fmtDT = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const COR_VENDA: Record<VendaAdmin["status"], string> = {
  em_teste: "bg-muted text-muted-foreground",
  pago: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  reembolsado: "bg-destructive/10 text-destructive",
  recusado: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
};
const COR_PAGAMENTO: Record<PagamentoAdmin["status"], string> = {
  enviado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  segurado: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  falhou: "bg-destructive/10 text-destructive",
  enviando: "bg-muted text-muted-foreground",
};

export interface AcoesAdminAfiliados {
  recarregar: () => Promise<void>;
  criar: (f: NovaAfiliada) => Promise<string | null>;
  pausar: (id: string, pausado: boolean) => Promise<string | null>;
  liberar: (pagamentoId: string) => Promise<string | null>;
  novoToken: (id: string) => Promise<string | null>;
  previaSemana: () => Promise<Array<Record<string, unknown>> | string>;
}

const FORM_VAZIO: NovaAfiliada = { nome: "", codigo: "", email: "", pix_chave: "", pix_tipo: "CPF", limite_semanal_cents: 50000 };

function Botao({ children, onClick, tom = "neutro", disabled, title }: { children: React.ReactNode; onClick?: () => void; tom?: "neutro" | "forte" | "perigo"; disabled?: boolean; title?: string }) {
  const cls = tom === "forte" ? "bg-accent text-accent-foreground border-transparent hover:opacity-90"
    : tom === "perigo" ? "border-destructive/40 text-destructive hover:bg-destructive/5"
    : "border-border bg-background hover:bg-muted";
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-60 ${cls}`}>
      {children}
    </button>
  );
}

function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Botao onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); window.setTimeout(() => setOk(false), 2000); } catch { /* sem clipboard */ } }} title={texto}>
      {ok ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {ok ? "Copiado" : rotulo}
    </Botao>
  );
}

/** A tela, pura. O container (abaixo) e o /dev/afiliados a alimentam. */
export function AdminAfiliadosVista({ dados, loading, erro, acoes, abrirFormInicial = false, selecionadoInicial = null }: {
  dados: DadosAdminAfiliados | null; loading: boolean; erro: string | null; acoes: AcoesAdminAfiliados; abrirFormInicial?: boolean; selecionadoInicial?: string | null;
}) {
  const [abrirForm, setAbrirForm] = useState(abrirFormInicial);
  const [form, setForm] = useState<NovaAfiliada>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(selecionadoInicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Array<Record<string, unknown>> | null>(null);

  const afiliados = dados?.afiliados ?? [];
  const porAfiliado = useMemo(() => {
    const m = new Map<string, { vendas: VendaAdmin[]; pagamentos: PagamentoAdmin[]; usaram: number; emTeste: number; pagaram: number; comissao: number; aReceber: number; pago: number; segurado: number }>();
    for (const a of afiliados) m.set(a.id, { vendas: [], pagamentos: [], usaram: 0, emTeste: 0, pagaram: 0, comissao: 0, aReceber: 0, pago: 0, segurado: 0 });
    const pagPorId = new Map((dados?.pagamentos ?? []).map((p) => [p.id, p]));
    for (const v of dados?.vendas ?? []) {
      const r = m.get(v.afiliado_id); if (!r) continue;
      r.vendas.push(v); r.usaram++;
      if (v.status === "em_teste") r.emTeste++;
      if (v.status === "pago") {
        r.pagaram++; r.comissao += v.comissao_cents;
        const pg = v.pagamento_id ? pagPorId.get(v.pagamento_id) : undefined;
        if (!pg || pg.status !== "enviado") r.aReceber += v.comissao_cents;
      }
    }
    for (const p of dados?.pagamentos ?? []) {
      const r = m.get(p.afiliado_id); if (!r) continue;
      r.pagamentos.push(p);
      if (p.status === "enviado") r.pago += p.valor_cents;
      if (p.status === "segurado") r.segurado += p.valor_cents;
    }
    return m;
  }, [afiliados, dados]);

  const totais = useMemo(() => {
    let usaram = 0, pagaram = 0, aReceber = 0, segurados = 0;
    for (const r of porAfiliado.values()) { usaram += r.usaram; pagaram += r.pagaram; aReceber += r.aReceber; segurados += r.pagamentos.filter((p) => p.status === "segurado" || p.status === "falhou" || p.status === "enviando").length; }
    return { usaram, pagaram, aReceber, segurados };
  }, [porAfiliado]);

  const sel = selecionado ? afiliados.find((a) => a.id === selecionado) ?? null : null;
  const resumoSel = sel ? porAfiliado.get(sel.id) : undefined;

  const criar = async () => {
    setErroForm(null);
    const codigo = form.codigo.trim().toUpperCase();
    if (form.nome.trim().length < 2) return setErroForm("Nome curto.");
    if (!/^[A-Z0-9]{3,64}$/.test(codigo)) return setErroForm("Código: 3 a 64 letras/números, sem acento ou símbolo (é o mesmo da App Store).");
    if (!form.pix_chave.trim()) return setErroForm("Falta a chave Pix.");
    setSalvando(true);
    const e = await acoes.criar({ ...form, codigo });
    setSalvando(false);
    if (e) return setErroForm(e);
    setForm(FORM_VAZIO); setAbrirForm(false);
  };

  const rodar = async (chave: string, fn: () => Promise<string | null>) => {
    setOcupado(chave); setAviso(null);
    const e = await fn();
    setOcupado(null);
    if (e) setAviso(e);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-5" data-testid="admin-afiliados">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Afiliados</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Cada código é uma oferta da App Store com 7 dias grátis. Comissão: 50% do 1º pagamento líquido. Pix automático toda segunda{dados ? ` (próximo: ${diaCurto(dados.proxima_segunda)})` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Botao onClick={() => acoes.recarregar()} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar</Botao>
          <Botao tom="forte" onClick={() => setAbrirForm((v) => !v)}>{abrirForm ? "Fechar" : "Nova afiliada"}</Botao>
        </div>
      </div>

      {(erro || aviso) && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">{erro ?? aviso}</div>}

      {abrirForm && (
        <Panel title="Nova afiliada" sub="O código tem que ser o MESMO da oferta criada na App Store (node scripts/asc-codigo-afiliado.mjs CODIGO --executar). Sem a oferta, o link não dá os 7 dias; sem a afiliada aqui, o webhook ignora a venda.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="form-nova">
            <label className="text-[12px] font-medium text-muted-foreground">Nome
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground" placeholder="Beatriz Souza" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">Código (maiúsculo, sem símbolo)
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground tracking-wider" placeholder="BIA" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">E-mail (pra falar com ela)
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground" placeholder="bia@exemplo.com" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">Limite semanal (R$) — acima disso o Pix é segurado
              <input type="number" min={0} step={50} value={form.limite_semanal_cents / 100} onChange={(e) => setForm({ ...form, limite_semanal_cents: Math.round((Number(e.target.value) || 0) * 100) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">Chave Pix
              <input value={form.pix_chave} onChange={(e) => setForm({ ...form, pix_chave: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground" placeholder="CPF, e-mail, telefone ou chave aleatória" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">Tipo da chave
              <select value={form.pix_tipo} onChange={(e) => setForm({ ...form, pix_tipo: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground">
                <option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Telefone (+55…)</option><option value="EVP">Aleatória</option>
              </select>
            </label>
          </div>
          {erroForm && <p className="mt-3 text-[12.5px] text-destructive">{erroForm}</p>}
          <div className="mt-4 flex items-center gap-2">
            <Botao tom="forte" onClick={criar} disabled={salvando}>{salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Criar afiliada</Botao>
            <span className="text-[12px] text-muted-foreground">O link do painel dela aparece na lista depois de criar.</span>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Afiliadas" value={String(afiliados.length)} sub={`${afiliados.filter((a) => a.pausado).length} pausada(s)`} />
        <StatTile label="Usaram um código" value={String(totais.usaram)} sub={`${totais.pagaram} pagaram`} />
        <StatTile label="Comissão a pagar" value={reais(totais.aReceber)} sub="confirmadas, ainda não enviadas" />
        <StatTile label="Precisam de você" value={String(totais.segurados)} sub="segurados, falhos ou presos" />
      </div>

      {loading && !dados ? (
        <Panel><div className="grid place-items-center py-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div></Panel>
      ) : afiliados.length === 0 ? (
        <Panel><EmptyState label="Nenhuma afiliada ainda. Crie a primeira em “Nova afiliada”." /></Panel>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
          <Panel className="p-2 md:p-2">
            <ul className="divide-y divide-border" data-testid="lista-afiliadas">
              {afiliados.map((a) => {
                const r = porAfiliado.get(a.id)!;
                const ativo = a.id === selecionado;
                return (
                  <li key={a.id}>
                    <button onClick={() => setSelecionado(a.id)} className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${ativo ? "bg-accent/10" : "hover:bg-muted"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold truncate">{a.nome}</span>
                        <span className={`text-[11px] font-bold tracking-wider ${ativo ? "text-accent" : "text-muted-foreground"}`}>{a.codigo}</span>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{r.usaram} usaram · {r.pagaram} pagaram · {reais(r.aReceber)} a pagar</span>
                        {a.pausado && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 font-bold">pausada</span>}
                        {r.segurado > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 font-bold">segurado</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="space-y-4">
            {!sel || !resumoSel ? (
              <Panel><EmptyState label="Escolha uma afiliada à esquerda." /></Panel>
            ) : (
              <>
                <Panel>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-[16px] font-bold">{sel.nome} <span className="text-accent text-[13px] font-bold tracking-wider ml-1">{sel.codigo}</span></h2>
                      <p className="text-[12.5px] text-muted-foreground mt-0.5">
                        Pix {sel.pix_tipo} {sel.pix_chave} · limite {reais(sel.limite_semanal_cents)}/semana · desde {diaCurto(sel.criado_em)}{sel.email ? ` · ${sel.email}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Copiar texto={`${typeof window !== "undefined" ? window.location.origin : "https://www.coreaplicativo.com.br"}${sel.link_painel}`} rotulo="Link do painel" />
                      <Copiar texto={sel.link_resgate} rotulo="Link de resgate" />
                      <Botao onClick={() => rodar(`pausar-${sel.id}`, () => acoes.pausar(sel.id, !sel.pausado))} disabled={ocupado === `pausar-${sel.id}`} tom={sel.pausado ? "forte" : "perigo"}>
                        {sel.pausado ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />} {sel.pausado ? "Retomar pagamentos" : "Pausar pagamentos"}
                      </Botao>
                      <Botao onClick={() => { if (window.confirm("Gerar um link novo? O atual deixa de funcionar na hora.")) rodar(`token-${sel.id}`, () => acoes.novoToken(sel.id)); }} title="Se o link do painel vazou"><Shield className="w-3.5 h-3.5" /> Novo link</Botao>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    <StatTile label="Usaram" value={String(resumoSel.usaram)} />
                    <StatTile label="Em teste" value={String(resumoSel.emTeste)} />
                    <StatTile label="Pagaram" value={String(resumoSel.pagaram)} sub={`${resumoSel.vendas.filter((v) => v.status === "reembolsado").length} reembolso · ${resumoSel.vendas.filter((v) => v.status === "recusado").length} não pagou`} />
                    <StatTile label="A pagar" value={reais(resumoSel.aReceber)} sub={resumoSel.segurado ? `${reais(resumoSel.segurado)} segurado` : "confirmadas"} />
                    <StatTile label="Já pago" value={reais(resumoSel.pago)} />
                  </div>
                </Panel>

                <Panel title="Pagamentos" sub="Segurado = passou do limite semanal. Falhou = o Asaas recusou. Enviando = conferir no Asaas pela referência externa (id) antes de qualquer coisa.">
                  {resumoSel.pagamentos.length === 0 ? <EmptyState label="Nenhum pagamento ainda." /> : (
                    <ul className="divide-y divide-border" data-testid="pagamentos">
                      {resumoSel.pagamentos.map((p) => (
                        <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap text-[13px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${COR_PAGAMENTO[p.status]}`}>{ROTULO_STATUS_PAGAMENTO[p.status]}</span>
                            <span className="font-semibold tabular-nums">{reais(p.valor_cents)}</span>
                            <span className="text-muted-foreground">{p.vendas_ids.length} venda(s) · semana {diaCurto(p.semana)} · {fmtDT(p.criado_em)}</span>
                            {p.asaas_status && <span className="text-muted-foreground">Asaas {p.asaas_status}</span>}
                            {p.erro && <span className="text-destructive text-[12px]">{p.erro}</span>}
                            {p.motivo && p.status === "segurado" && <span className="text-amber-700 dark:text-amber-400 text-[12px]">{textoMotivoPagamento(p.motivo)}</span>}
                          </div>
                          {(p.status === "segurado" || p.status === "falhou") && (
                            <Botao tom="forte" onClick={() => { if (window.confirm(`Mandar ${reais(p.valor_cents)} por Pix pra ${sel.nome} agora?`)) rodar(`liberar-${p.id}`, () => acoes.liberar(p.id)); }} disabled={ocupado === `liberar-${p.id}`}>
                              <Send className="w-3.5 h-3.5" /> {p.status === "segurado" ? "Liberar Pix" : "Tentar de novo"}
                            </Botao>
                          )}
                          {p.status === "enviando" && <span className="text-[12px] text-muted-foreground">id {p.id.slice(0, 8)}…</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Vendas com o código" sub="Uma linha por assinatura: teste → pagou → (reembolso). Comissão só na 1ª cobrança.">
                  {resumoSel.vendas.length === 0 ? <EmptyState label="Ninguém usou o código ainda." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px]" data-testid="vendas">
                        <thead className="text-left text-muted-foreground">
                          <tr><th className="py-1.5 pr-3 font-medium">Começou</th><th className="py-1.5 pr-3 font-medium">Situação</th><th className="py-1.5 pr-3 font-medium">Cobrado em</th><th className="py-1.5 pr-3 font-medium text-right">Bruto</th><th className="py-1.5 pr-3 font-medium text-right">Líquido</th><th className="py-1.5 pr-3 font-medium text-right">Comissão</th><th className="py-1.5 font-medium">Pix</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {resumoSel.vendas.map((v) => {
                            const pg = v.pagamento_id ? resumoSel.pagamentos.find((p) => p.id === v.pagamento_id) : undefined;
                            return (
                              <tr key={v.id}>
                                <td className="py-2 pr-3 tabular-nums whitespace-nowrap">{fmtDT(v.criado_em)} <span className="text-muted-foreground">{v.plataforma === "ios" ? "iPhone" : "Android"}</span></td>
                                <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${COR_VENDA[v.status]}`}>{ROTULO_STATUS_VENDA[v.status]}</span>{v.motivo && <span className="ml-1.5 text-muted-foreground">{ROTULO_MOTIVO[v.motivo] ?? v.motivo}</span>}</td>
                                <td className="py-2 pr-3 tabular-nums whitespace-nowrap">{v.cobrado_em ? fmtDT(v.cobrado_em) : "—"}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{v.valor_bruto_cents ? reais(v.valor_bruto_cents) : "—"}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{v.valor_liquido_cents ? reais(v.valor_liquido_cents) : "—"}</td>
                                <td className="py-2 pr-3 text-right tabular-nums font-semibold">{v.comissao_cents ? reais(v.comissao_cents) : "—"}</td>
                                <td className="py-2 text-muted-foreground">{v.status !== "pago" ? "—" : pg ? ROTULO_STATUS_PAGAMENTO[pg.status] : "na fila"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </>
            )}

            <Panel title="Prévia da segunda" sub="Roda a conta do Pix semanal em ENSAIO: mostra quem receberia quanto, sem mandar nada.">
              <div className="flex items-center gap-3 flex-wrap">
                <Botao onClick={async () => { setOcupado("previa"); const r = await acoes.previaSemana(); setOcupado(null); if (typeof r === "string") setAviso(r); else setPrevia(r); }} disabled={ocupado === "previa"}>
                  {ocupado === "previa" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Calcular prévia
                </Botao>
                {previa && previa.length === 0 && <span className="text-[12.5px] text-muted-foreground">Nenhuma comissão madura (7+ dias) pra pagar agora.</span>}
              </div>
              {previa && previa.length > 0 && (
                <ul className="mt-3 divide-y divide-border text-[13px]" data-testid="previa">
                  {previa.map((p, i) => (
                    <li key={i} className="py-2 flex items-center gap-3">
                      <span className="font-bold tracking-wider">{String(p.codigo)}</span>
                      <span className="tabular-nums font-semibold">{reais(Number(p.valor_cents ?? 0))}</span>
                      <span className="text-muted-foreground">{String(p.vendas)} venda(s)</span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${p.decisao === "pagar" ? COR_PAGAMENTO.enviado : COR_PAGAMENTO.segurado}`}>{p.decisao === "pagar" ? "vai pagar" : p.decisao === "segurar" ? "vai SEGURAR (acima do limite)" : "pausada"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ container: fala com a função */

type Resposta = Record<string, unknown> & { error?: string };
async function chamar(body: Record<string, unknown>): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke("afiliados", { body });
  if (error) return { error: error.message };
  return (data ?? {}) as Resposta;
}
const ERROS: Record<string, string> = {
  codigo_ja_existe: "Já existe uma afiliada com esse código.",
  codigo_invalido: "Código inválido: 3 a 64 letras/números, sem acento ou símbolo.",
  forbidden: "Sem permissão.",
};
const traduzir = (e: unknown) => ERROS[String(e)] ?? String(e);

export default function AdminAfiliados() {
  const [dados, setDados] = useState<DadosAdminAfiliados | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true); setErro(null);
    const r = await chamar({ action: "listar" });
    setLoading(false);
    if (r.error) { setErro(traduzir(r.error)); return; }
    setDados(r as unknown as DadosAdminAfiliados);
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);

  const acoes: AcoesAdminAfiliados = useMemo(() => ({
    recarregar,
    criar: async (f) => { const r = await chamar({ action: "criar", ...f, email: f.email || null }); if (r.error) return traduzir(r.error); await recarregar(); return null; },
    pausar: async (id, pausado) => { const r = await chamar({ action: "pausar", id, pausado }); if (r.error) return traduzir(r.error); await recarregar(); return null; },
    liberar: async (id) => { const r = await chamar({ action: "liberar_pagamento", id }); await recarregar(); if (r.error) return traduzir(r.error); if (r.status === "falhou") return `O Asaas recusou: ${String(r.erro ?? "")}`; return null; },
    novoToken: async (id) => { const r = await chamar({ action: "novo_token", id }); if (r.error) return traduzir(r.error); await recarregar(); return null; },
    previaSemana: async () => { const r = await chamar({ action: "pagar_semana", ensaio: true }); if (r.error) return traduzir(r.error); return (r.planos as Array<Record<string, unknown>>) ?? []; },
  }), [recarregar]);

  return <AdminAfiliadosVista dados={dados} loading={loading} erro={erro} acoes={acoes} />;
}
