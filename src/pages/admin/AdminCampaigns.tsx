import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Pencil, Megaphone, Leaf, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  RangePicker, rangeToDates, type RangeKey,
  Panel, StatTile, EmptyState,
} from "./components";

/**
 * Painel "Campanhas" — estilo UTMify, mas com a NOSSA atribuição (sobrevive
 * ao navegador do Instagram). Receita/vendas vêm do RPC admin_campaign_metrics;
 * GASTO vem do Meta via edge function meta-insights (cruza pelo campaign_id,
 * que é exatamente o utm_campaign dos anúncios). Auto-refresh 60s.
 */

interface CampaignRow {
  key: string; name_utm: string | null;
  sessions: number; accounts: number; pix_opened: number; pix_generated: number;
  sales: number; sales_lifetime: number; sales_downsell: number; revenue_cents: number;
}
interface AdRow { key: string; ad: string; sales: number; revenue_cents: number }
interface Metrics {
  campaigns: CampaignRow[]; ads: AdRow[];
  totals: { sales: number; revenue_cents: number; sessions: number };
  aliases: Record<string, string>;
}
interface SpendRow { campaign_id: string; campaign_name: string; spend: number; impressions?: number; clicks?: number; ctr?: number }
interface MetaCampaign { id: string; name: string; status: string; daily_budget: number | null }

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  ACTIVE: { txt: "Ativa", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  PAUSED: { txt: "Pausada", cls: "bg-muted text-muted-foreground" },
  CAMPAIGN_PAUSED: { txt: "Pausada", cls: "bg-muted text-muted-foreground" },
  ARCHIVED: { txt: "Arquivada", cls: "bg-muted text-muted-foreground" },
  DELETED: { txt: "Excluída", cls: "bg-muted text-muted-foreground" },
};

// Taxa da Cakto estimada (medido 14/07: R$424 bruto → ~R$362 líquido)
const NET_FACTOR = 0.855;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cents = (c: number) => brl(c / 100);

// Data no calendário de Brasília (a conta do Meta é America/Sao_Paulo)
const brDate = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

export default function AdminCampaigns() {
  const [range, setRange] = useState<RangeKey>("today");
  const [data, setData] = useState<Metrics | null>(null);
  const [spend, setSpend] = useState<SpendRow[] | null>(null);
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [spendErr, setSpendErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const { from, to } = rangeToDates(range);
    const [metricsRes, spendRes] = await Promise.all([
      supabase.rpc("admin_campaign_metrics", { _from: from, _to: to }),
      supabase.functions.invoke("meta-insights", { body: { since: brDate(from), until: brDate(to) } }),
    ]);
    if (metricsRes.error) setError(metricsRes.error.message);
    else setData(metricsRes.data as unknown as Metrics);

    const sd = spendRes.data as { spend?: SpendRow[]; campaigns?: MetaCampaign[]; error?: string; detail?: string } | null;
    if (spendRes.error || !sd || sd.error) {
      setSpend(null);
      setMetaCampaigns([]);
      setSpendErr(sd?.error === "token_missing"
        ? "token_missing"
        : (sd?.detail || sd?.error || spendRes.error?.message || "erro"));
    } else {
      setSpend(sd.spend ?? []);
      setMetaCampaigns(sd.campaigns ?? []);
      setSpendErr(null);
    }
    setUpdatedAt(new Date());
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);
  // tempo real: atualiza sozinho a cada 60s
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const spendByCamp = useMemo(() => {
    const m: Record<string, SpendRow> = {};
    for (const s of spend ?? []) m[s.campaign_id] = s;
    return m;
  }, [spend]);

  const metaById = useMemo(() => {
    const m: Record<string, MetaCampaign> = {};
    for (const c of metaCampaigns) m[c.id] = c;
    return m;
  }, [metaCampaigns]);

  // Nome exibido: apelido salvo > nome do Meta (campanhas OU insights) > nome
  // vindo da UTM (nome|id) > id cru
  const displayName = (c: CampaignRow) => {
    if (c.key.startsWith("organic:")) return `Orgânico (${c.key.slice(8)})`;
    if (c.key === "none") return "Sem atribuição";
    return data?.aliases?.[c.key] || metaById[c.key]?.name || spendByCamp[c.key]?.campaign_name || c.name_utm || c.key;
  };

  const rename = async (c: CampaignRow) => {
    const current = data?.aliases?.[c.key] || "";
    const name = window.prompt(`Apelido pra campanha ${c.key}:`, current);
    if (name == null) return;
    await supabase.rpc("admin_set_campaign_alias", { _id: c.key, _name: name.trim() });
    load(true);
  };

  // Campanhas do Meta com gasto no período mas SEM linha nossa (0 tráfego/venda)
  const spendOnlyRows: CampaignRow[] = useMemo(() => {
    if (!spend || !data) return [];
    const known = new Set(data.campaigns.map((c) => c.key));
    return spend
      .filter((s) => s.spend > 0 && !known.has(s.campaign_id))
      .map((s) => ({
        key: s.campaign_id, name_utm: s.campaign_name,
        sessions: 0, accounts: 0, pix_opened: 0, pix_generated: 0,
        sales: 0, sales_lifetime: 0, sales_downsell: 0, revenue_cents: 0,
      }));
  }, [spend, data]);

  const rows = useMemo(() => {
    const all = [...(data?.campaigns ?? []), ...spendOnlyRows];
    return all.sort((a, b) =>
      (b.revenue_cents - a.revenue_cents) ||
      ((spendByCamp[b.key]?.spend ?? 0) - (spendByCamp[a.key]?.spend ?? 0)) ||
      (b.sessions - a.sessions));
  }, [data, spendOnlyRows, spendByCamp]);

  const totalSpend = (spend ?? []).reduce((a, s) => a + s.spend, 0);
  const totalRevenue = (data?.totals.revenue_cents ?? 0) / 100;
  const totalNet = totalRevenue * NET_FACTOR;
  const profit = totalNet - totalSpend;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;

  const adsFor = (key: string) => (data?.ads ?? []).filter((a) => a.key === key);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-accent" /> Campanhas
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Receita pela nossa atribuição · gasto direto do Meta
            {updatedAt && ` · atualizado ${updatedAt.toLocaleTimeString("pt-BR")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker value={range} onChange={setRange} />
          <button
            onClick={() => load()}
            className="grid place-items-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <Panel><EmptyState label={`Erro: ${error}`} /></Panel>
      ) : !data ? null : (
        <>
          {/* Gastou → voltou */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="💸 Gastou (Meta)" value={spend ? brl(totalSpend) : "—"} sub={spendErr === "token_missing" ? "configure o token" : undefined} />
            <StatTile label="💰 Voltou (bruto)" value={brl(totalRevenue)} sub={`${data.totals.sales} vendas · líq. ~${brl(totalNet)}`} />
            <StatTile label="Lucro (líq. − gasto)" value={spend ? brl(profit) : "—"} sub={spend ? (profit >= 0 ? "no verde ✅" : "no vermelho ⚠️") : undefined} />
            <StatTile label="ROAS" value={roas ? `${roas.toFixed(2)}x` : "—"} sub={roas ? "receita bruta / gasto" : undefined} />
          </div>

          {spendErr === "token_missing" && (
            <Panel>
              <p className="text-[13px] text-muted-foreground">
                <strong className="text-foreground">Gasto do Meta não configurado.</strong>{" "}
                Gere um token de sistema (Business Manager → Usuários do sistema → permissão{" "}
                <code className="text-[12px]">ads_read</code>) e me mande — eu configuro os secrets{" "}
                <code className="text-[12px]">META_ADS_TOKEN</code> e <code className="text-[12px]">META_AD_ACCOUNT_ID</code>.
              </p>
            </Panel>
          )}
          {spendErr && spendErr !== "token_missing" && (
            <Panel><p className="text-[13px] text-destructive">Gasto do Meta indisponível: {spendErr}</p></Panel>
          )}

          {/* Tabela por campanha */}
          <Panel title="Por campanha" sub="Clique na linha pra abrir os anúncios · lápis renomeia">
            {rows.length === 0 ? (
              <EmptyState label="Nada no período." />
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[13px] min-w-[760px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="pb-2 pl-1 font-semibold">Campanha</th>
                      <th className="pb-2 font-semibold text-right">Gasto</th>
                      <th className="pb-2 font-semibold text-right">Sessões</th>
                      <th className="pb-2 font-semibold text-right">Contas</th>
                      <th className="pb-2 font-semibold text-right">Abriu Pix</th>
                      <th className="pb-2 font-semibold text-right">Vendas</th>
                      <th className="pb-2 font-semibold text-right">Receita</th>
                      <th className="pb-2 font-semibold text-right">CAC</th>
                      <th className="pb-2 pr-1 font-semibold text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const sp = spendByCamp[c.key]?.spend;
                      const rev = c.revenue_cents / 100;
                      const cac = sp != null && c.sales > 0 ? sp / c.sales : null;
                      const cRoas = sp ? rev / sp : null;
                      const open = openKey === c.key;
                      const isOrganic = c.key.startsWith("organic:");
                      const isNone = c.key === "none";
                      const ads = adsFor(c.key);
                      return (
                        <FragmentRows
                          key={c.key}
                          c={c} sp={sp} rev={rev} cac={cac} cRoas={cRoas}
                          open={open} ads={ads} isOrganic={isOrganic} isNone={isNone}
                          name={displayName(c)}
                          status={metaById[c.key]?.status ?? null}
                          onToggle={() => setOpenKey(open ? null : c.key)}
                          onRename={() => rename(c)}
                          aliases={data.aliases}
                        />
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="py-2.5 pl-1">Total</td>
                      <td className="py-2.5 text-right tabular-nums">{spend ? brl(totalSpend) : "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">{data.totals.sessions}</td>
                      <td className="py-2.5 text-right tabular-nums" colSpan={2} />
                      <td className="py-2.5 text-right tabular-nums">{data.totals.sales}</td>
                      <td className="py-2.5 text-right tabular-nums">{brl(totalRevenue)}</td>
                      <td className="py-2.5 text-right tabular-nums" />
                      <td className="py-2.5 pr-1 text-right tabular-nums">{roas ? `${roas.toFixed(2)}x` : "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function FragmentRows({
  c, sp, rev, cac, cRoas, open, ads, isOrganic, isNone, name, status, onToggle, onRename, aliases,
}: {
  c: CampaignRow; sp: number | undefined; rev: number; cac: number | null; cRoas: number | null;
  open: boolean; ads: AdRow[]; isOrganic: boolean; isNone: boolean; name: string; status: string | null;
  onToggle: () => void; onRename: () => void; aliases: Record<string, string>;
}) {
  const st = status ? STATUS_LABEL[status] : null;
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={onToggle}>
        <td className="py-2.5 pl-1">
          <span className="inline-flex items-center gap-1.5 font-medium">
            {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            {isOrganic && <Leaf className="w-3.5 h-3.5 text-emerald-600" />}
            {isNone && <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />}
            {name}
            {st && (
              <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${st.cls}`}>
                {st.txt}
              </span>
            )}
            {!isOrganic && !isNone && (
              <button
                onClick={(e) => { e.stopPropagation(); onRename(); }}
                className="text-muted-foreground/50 hover:text-foreground"
                aria-label="Renomear"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </span>
          {!isOrganic && !isNone && aliases[c.key] && (
            <span className="block text-[10px] text-muted-foreground/60 ml-5">{c.key}</span>
          )}
        </td>
        <td className="py-2.5 text-right tabular-nums">{sp != null ? brl(sp) : "—"}</td>
        <td className="py-2.5 text-right tabular-nums">{c.sessions}</td>
        <td className="py-2.5 text-right tabular-nums">{c.accounts}</td>
        <td className="py-2.5 text-right tabular-nums">{c.pix_opened}</td>
        <td className="py-2.5 text-right tabular-nums">
          {c.sales}
          {c.sales > 0 && (
            <span className="block text-[10px] text-muted-foreground">
              {c.sales_lifetime} cheio{c.sales_downsell > 0 ? ` + ${c.sales_downsell} oferta` : ""}
            </span>
          )}
        </td>
        <td className="py-2.5 text-right tabular-nums font-semibold">{cents(c.revenue_cents)}</td>
        <td className="py-2.5 text-right tabular-nums">{cac != null ? brl(cac) : "—"}</td>
        <td className={`py-2.5 pr-1 text-right tabular-nums font-semibold ${cRoas != null ? (cRoas >= 1 ? "text-emerald-600" : "text-destructive") : ""}`}>
          {cRoas != null ? `${cRoas.toFixed(2)}x` : "—"}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border/50 bg-muted/20">
          <td colSpan={9} className="py-2 pl-8 pr-2">
            {ads.length === 0 ? (
              <span className="text-[12px] text-muted-foreground">Sem venda atribuída a anúncio neste período.</span>
            ) : (
              <div className="space-y-1">
                {ads.map((a) => (
                  <div key={a.ad || "(vazio)"} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">anúncio {a.ad || "(sem id)"}</span>
                    <span className="tabular-nums">{a.sales} venda{a.sales > 1 ? "s" : ""} · <strong>{cents(a.revenue_cents)}</strong></span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
