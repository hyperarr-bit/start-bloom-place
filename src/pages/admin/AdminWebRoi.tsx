import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, EmptyState } from "./components";

/**
 * ROI REAL DA WEB (20/09/2026) — pedido do dono: "focar na web, pois é algo
 * certo, eu consigo metrificar de onde vem cada venda".
 *
 * Duas fontes, nenhuma modelada:
 *  - GASTO e CLIQUES vêm da Meta por ANÚNCIO (meta-insights, nivel "ad").
 *  - SESSÕES, PASSOS e VENDAS vêm do nosso banco (admin_web_roi): a sessão
 *    que pagou carrega utm_campaign (id da campanha) e utm_content (id do
 *    anúncio) do clique. Só web — sessão do app fica de fora.
 * A junção é pelo id do anúncio; o que a Meta gastou sem nenhuma sessão nossa
 * aparece com sessão 0 (anúncio que não trouxe ninguém); o que vendeu sem
 * marca de anúncio aparece em "Sem atribuição" (bio, busca, direto).
 */
type Linha = { camp: string; ad: string; src: string; sessoes: number; start: number; quiz: number; contas: number; paywall: number; pix_gerado: number; pix_pago: number; receita_cents: number; com_fbclid: number };
type Anuncio = { ad_id: string; campaign_id?: string; criativo: string; conjunto: string; campanha: string; gasto: number; impressoes: number; cliques: number; ctr: number; compras: number };
type Row = { key: string; camp: string; ad: string; nome: string; campanha: string; gasto: number; cliques: number; compras_meta: number } & Omit<Linha, "camp" | "ad" | "src">;

const PIX_LIQ = 0.98; // Asaas cobra ~2% no Pix
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.slice(0, 10);

const zero = (): Omit<Linha, "camp" | "ad" | "src"> => ({ sessoes: 0, start: 0, quiz: 0, contas: 0, paywall: 0, pix_gerado: 0, pix_pago: 0, receita_cents: 0, com_fbclid: 0 });
const soma = (a: Omit<Linha, "camp" | "ad" | "src">, b: Omit<Linha, "camp" | "ad" | "src">) => ({
  sessoes: a.sessoes + b.sessoes, start: a.start + b.start, quiz: a.quiz + b.quiz, contas: a.contas + b.contas, paywall: a.paywall + b.paywall,
  pix_gerado: a.pix_gerado + b.pix_gerado, pix_pago: a.pix_pago + b.pix_pago, receita_cents: a.receita_cents + b.receita_cents, com_fbclid: a.com_fbclid + b.com_fbclid,
});

export function AdminWebRoi({ from, to, tick }: { from: string; to: string; tick: number }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErro(null);
    const [roi, meta] = await Promise.all([
      // @ts-expect-error RPC nova (migração 20260920210000); os tipos gerados do Supabase ainda não a conhecem
      supabase.rpc("admin_web_roi", { _from: from, _to: to }),
      supabase.functions.invoke("meta-insights", { body: { since: brDate(from), until: brDate(to), nivel: "ad" } }),
    ]);
    if (roi.error) { setErro(roi.error.message); return; }
    setLinhas(((roi.data as { linhas?: Linha[] } | null)?.linhas) ?? []);
    const m = meta.data as { anuncios?: Anuncio[]; error?: string } | null;
    setAnuncios(meta.error || !m || m.error ? null : (m.anuncios ?? []));
  }, [from, to]);

  useEffect(() => { void load(); }, [load, tick]);

  const { campanhas, semAtrib, totais } = useMemo(() => {
    const porAd = new Map<string, Row>();
    const nomeCamp = new Map<string, string>();
    for (const a of anuncios ?? []) {
      const camp = String(a.campaign_id ?? "");
      if (camp) nomeCamp.set(camp, a.campanha);
      porAd.set(String(a.ad_id), { key: String(a.ad_id), camp, ad: String(a.ad_id), nome: a.criativo, campanha: a.campanha, gasto: a.gasto, cliques: a.cliques, compras_meta: a.compras, ...zero() });
    }
    const semAtrib: Row[] = [];
    for (const l of linhas ?? []) {
      const ehAnuncio = /^\d{12,}$/.test(l.camp);
      if (!ehAnuncio) { semAtrib.push({ key: `${l.camp}|${l.src}`, camp: l.camp, ad: "", nome: l.camp ? `${l.camp}${l.src ? ` · ${l.src}` : ""}` : (l.src || "direto / sem marca"), campanha: "", gasto: 0, cliques: 0, compras_meta: 0, ...l }); continue; }
      const k = l.ad || `camp:${l.camp}`;
      const atual = porAd.get(k) ?? { key: k, camp: l.camp, ad: l.ad, nome: l.ad ? `anúncio ${l.ad.slice(-6)}` : "sem id do anúncio", campanha: nomeCamp.get(l.camp) ?? l.camp, gasto: 0, cliques: 0, compras_meta: 0, ...zero() };
      porAd.set(k, { ...atual, ...soma(atual, l) });
    }
    // agrupa por campanha
    const grupos = new Map<string, { camp: string; nome: string; gasto: number; cliques: number; compras_meta: number; ads: Row[] } & Omit<Linha, "camp" | "ad" | "src">>();
    for (const r of porAd.values()) {
      const g = grupos.get(r.camp) ?? { camp: r.camp, nome: nomeCamp.get(r.camp) ?? r.campanha ?? r.camp, gasto: 0, cliques: 0, compras_meta: 0, ads: [], ...zero() };
      grupos.set(r.camp, { ...g, ...soma(g, r), gasto: g.gasto + r.gasto, cliques: g.cliques + r.cliques, compras_meta: g.compras_meta + r.compras_meta, ads: [...g.ads, r] });
    }
    const campanhas = [...grupos.values()].filter((g) => g.gasto > 0 || g.sessoes > 0).sort((a, b) => b.gasto - a.gasto || b.receita_cents - a.receita_cents);
    const totais = campanhas.reduce((t, g) => ({ ...soma(t, g), gasto: t.gasto + g.gasto, cliques: t.cliques + g.cliques }), { ...zero(), gasto: 0, cliques: 0 });
    return { campanhas, semAtrib: semAtrib.sort((a, b) => b.receita_cents - a.receita_cents), totais };
  }, [linhas, anuncios]);

  const roas = (receita: number, gasto: number) => (gasto > 0 ? (receita / 100) * PIX_LIQ / gasto : null);
  const fmtRoas = (r: number | null) => (r == null ? "—" : `${r.toFixed(2)}x`);
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : "—");

  const Cabecalho = () => (
    <thead>
      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
        <th className="py-2 pr-2">Campanha / anúncio</th>
        <th className="py-2 pr-2 text-right">Gasto</th>
        <th className="py-2 pr-2 text-right">Cliques</th>
        <th className="py-2 pr-2 text-right">Sessões</th>
        <th className="py-2 pr-2 text-right">Quiz</th>
        <th className="py-2 pr-2 text-right">Conta</th>
        <th className="py-2 pr-2 text-right">Paywall</th>
        <th className="py-2 pr-2 text-right">Pix</th>
        <th className="py-2 pr-2 text-right">Pago</th>
        <th className="py-2 pr-2 text-right">Receita</th>
        <th className="py-2 pr-2 text-right">R$/venda</th>
        <th className="py-2 text-right">ROAS líq.</th>
      </tr>
    </thead>
  );
  const Celulas = ({ r, gasto, cliques }: { r: Omit<Linha, "camp" | "ad" | "src">; gasto: number; cliques: number }) => (
    <>
      <td className="py-2 pr-2 text-right tabular-nums">{gasto > 0 ? brl(gasto) : "—"}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{cliques || "—"}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{r.sessoes}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{r.quiz} <span className="text-muted-foreground text-[11px]">{pct(r.quiz, r.sessoes)}</span></td>
      <td className="py-2 pr-2 text-right tabular-nums">{r.contas}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{r.paywall} <span className="text-muted-foreground text-[11px]">{pct(r.paywall, r.sessoes)}</span></td>
      <td className="py-2 pr-2 text-right tabular-nums">{r.pix_gerado}</td>
      <td className="py-2 pr-2 text-right tabular-nums font-semibold">{r.pix_pago}</td>
      <td className="py-2 pr-2 text-right tabular-nums font-semibold">{brl(r.receita_cents / 100)}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{gasto > 0 && r.pix_pago > 0 ? brl(gasto / r.pix_pago) : "—"}</td>
      <td className={`py-2 text-right tabular-nums font-semibold ${roas(r.receita_cents, gasto) == null ? "" : (roas(r.receita_cents, gasto)! >= 1 ? "text-success" : "text-destructive")}`}>{fmtRoas(roas(r.receita_cents, gasto))}</td>
    </>
  );

  return (
    <Panel title="ROI real da web" sub="Gasto e cliques: Meta por anúncio · sessões, funil e vendas: nossa atribuição (utm do clique) · ROAS = receita líquida do Pix ÷ gasto">
      {erro ? <EmptyState label={`Erro: ${erro}`} /> : linhas == null ? (
        <div className="grid place-items-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto -mx-1" data-testid="web-roi">
          {anuncios == null && <p className="text-[12px] text-destructive mb-2">Gasto da Meta indisponível agora — só a nossa parte está na tabela.</p>}
          <table className="w-full text-[13px] min-w-[900px]">
            <Cabecalho />
            <tbody>
              {campanhas.length === 0 && semAtrib.length === 0 && (<tr><td colSpan={12}><EmptyState label="Nada no período." /></td></tr>)}
              {campanhas.map((g) => (
                <FragmentoCampanha key={g.camp} aberta={aberta === g.camp} onToggle={() => setAberta(aberta === g.camp ? null : g.camp)} nome={g.nome} camp={g.camp} ads={g.ads}
                  linha={<Celulas r={g} gasto={g.gasto} cliques={g.cliques} />}
                  linhaAd={(a) => <Celulas r={a} gasto={a.gasto} cliques={a.cliques} />} />
              ))}
              {semAtrib.map((r) => (
                <tr key={r.key} className="border-b border-border/60 text-muted-foreground">
                  <td className="py-2 pr-2">Sem anúncio · {r.nome}</td>
                  <Celulas r={r} gasto={0} cliques={0} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="py-2 pr-2">Total dos anúncios</td>
                <Celulas r={totais} gasto={totais.gasto} cliques={totais.cliques} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

function FragmentoCampanha({ aberta, onToggle, nome, camp, ads, linha, linhaAd }: { aberta: boolean; onToggle: () => void; nome: string; camp: string; ads: Row[]; linha: React.ReactNode; linhaAd: (a: Row) => React.ReactNode }) {
  return (
    <>
      <tr className="border-b border-border/60 cursor-pointer hover:bg-muted/40" onClick={onToggle}>
        <td className="py-2 pr-2">
          <span className="mr-1 text-muted-foreground">{aberta ? "▾" : "▸"}</span>{nome}
          <span className="ml-1 text-[11px] text-muted-foreground">{camp.slice(-6)}</span>
        </td>
        {linha}
      </tr>
      {aberta && ads.sort((a, b) => b.gasto - a.gasto).map((a) => (
        <tr key={a.key} className="border-b border-border/40 bg-muted/20 text-[12px]">
          <td className="py-1.5 pr-2 pl-6 text-muted-foreground">{a.nome} <span className="text-[10px]">{a.ad.slice(-6)}</span></td>
          {linhaAd(a)}
        </tr>
      ))}
    </>
  );
}
