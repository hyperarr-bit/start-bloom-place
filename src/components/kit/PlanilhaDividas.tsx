import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, Printer, Check, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { numeroBR } from "@/lib/data-normalizers";
import { localDayKey } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";
import { compartilharPlanilha } from "@/lib/compartilhar";
import { trackEvent } from "@/lib/analytics";
import type { Parcela } from "@/lib/finance-parcelas";
import {
  CHAVE_KIT_DIVIDAS, JUROS_ALTOS, dividasEmCSV, jurosDoMes, lerDividas, ordemBolaDeNeve, rotuloMeses, simularBolaDeNeve,
  type Divida,
} from "@/lib/kit-primeiro-mes";

const brl = (v: number) =>
  `R$ ${(Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Reais digitados: além do numeroBR, "2.000" / "12.500" (só pontos de milhar) é dois mil, não 2. */
const reaisDigitados = (v: string) => {
  const t = v.replace(/[^\d.,-]/g, "");
  return /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, "")) : numeroBR(t);
};

type Rascunho = { nome: string; saldo: string; juros: string; parcela: string };
const VAZIO: Rascunho = { nome: "", saldo: "", juros: "", parcela: "" };

/**
 * PLANILHA DE DÍVIDAS do Kit Primeiro Mês (18/10). Separada dos Parcelamentos
 * (que são compras no cartão/carnê e entram nos totais do mês): aqui é o mapa
 * de TUDO o que a pessoa deve — cartão rotativo, empréstimo, cheque especial,
 * acordo — com juros, e a ordem pra atacar. Não mexe em nenhum total de
 * Finanças. "Trazer dos parcelamentos" copia o que falta das parcelas.
 */
export const PlanilhaDividas = ({ parcelamentos = [] }: { parcelamentos?: Parcela[] }) => {
  const [bruto, setBruto] = usePersistedState<Divida[]>(CHAVE_KIT_DIVIDAS, []);
  const dividas = useMemo(() => lerDividas(bruto), [bruto]);
  const ordem = useMemo(() => ordemBolaDeNeve(dividas), [dividas]);
  const fim = useMemo(() => simularBolaDeNeve(dividas), [dividas]);
  const [form, setForm] = useState<Rascunho | null>(null);
  const [editando, setEditando] = useState<string | null>(null);

  const total = dividas.reduce((s, d) => s + d.saldo, 0);
  const totalParcelas = dividas.reduce((s, d) => s + d.parcela, 0);
  const totalJuros = dividas.reduce((s, d) => s + jurosDoMes(d), 0);

  const salvar = () => {
    if (!form) return;
    const saldo = reaisDigitados(form.saldo);
    const juros = form.juros.trim() ? numeroBR(form.juros) : 0;
    const parcela = reaisDigitados(form.parcela);
    if (!form.nome.trim()) return toast.error("Dê um nome pra dívida (ex.: cartão, empréstimo).");
    if (!Number.isFinite(saldo) || saldo <= 0) return toast.error("Coloque quanto falta pagar.");
    if (!Number.isFinite(juros) || juros < 0 || juros > 100) return toast.error("Juros ao mês: um número de 0 a 100.");
    if (!Number.isFinite(parcela) || parcela < 0) return toast.error("Coloque a parcela (ou o mínimo) por mês.");
    const nova: Divida = { id: editando ?? `div-${Date.now()}`, nome: form.nome.trim().slice(0, 80), saldo, juros, parcela };
    setBruto(editando ? dividas.map((d) => (d.id === editando ? nova : d)) : [...dividas, nova]);
    if (!editando) trackEvent("kit_divida_adicionada", { total: dividas.length + 1 });
    setForm(null);
    setEditando(null);
  };

  const editar = (d: Divida) => {
    setEditando(d.id);
    setForm({ nome: d.nome, saldo: String(d.saldo).replace(".", ","), juros: d.juros ? String(d.juros).replace(".", ",") : "", parcela: String(d.parcela).replace(".", ",") });
  };

  const apagar = (d: Divida) => {
    const antes = dividas;
    setBruto(dividas.filter((x) => x.id !== d.id));
    toast(`"${d.nome}" saiu da planilha`, { action: { label: "Desfazer", onClick: () => setBruto(antes) } });
  };

  const abertas = parcelamentos.filter((p) => (Number(p.totalInstallments) || 0) > (Number(p.paidInstallments) || 0));
  const trazerParcelas = () => {
    const ja = new Set(dividas.map((d) => d.id));
    const novas: Divida[] = abertas
      .filter((p) => !ja.has(`parc-${p.id}`))
      .map((p) => ({
        id: `parc-${p.id}`,
        nome: p.description || "Parcelamento",
        saldo: Math.max(0, (Number(p.totalInstallments) - Number(p.paidInstallments)) * (Number(p.installmentValue) || 0)),
        juros: 0,
        parcela: Number(p.installmentValue) || 0,
      }))
      .filter((d) => d.saldo > 0);
    if (!novas.length) return toast("Os parcelamentos em aberto já estão na planilha.");
    setBruto([...dividas, ...novas]);
    toast.success(`${novas.length} parcelamento${novas.length > 1 ? "s" : ""} na planilha. Ajuste os juros se tiver.`);
  };

  const exportar = async () => {
    trackEvent("kit_dividas_exportar", { formato: "csv", n: dividas.length });
    const r = await compartilharPlanilha(dividasEmCSV(dividas), `dividas_${localDayKey()}.csv`, "Planilha de dívidas", "kit_dividas");
    if (r === "downloaded") toast.success("Planilha baixada — abre no Excel ou no Google Planilhas.");
    else if (r === "failed") toast.error("Não deu pra exportar neste aparelho.");
  };

  const imprimir = () => {
    trackEvent("kit_dividas_exportar", { formato: "pdf", n: dividas.length });
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const linhas = ordem
      .map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.nome)}</td><td>${brl(d.saldo)}</td><td>${d.juros.toLocaleString("pt-BR")}%</td><td>${brl(d.parcela)}</td><td>${esc(rotuloMeses(fim[d.id] ?? null))}</td></tr>`)
      .join("");
    w.document.write(`<html><head><title>Planilha de dívidas</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#222}h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#555;margin:0 0 14px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#f4f4f4}
      tfoot td{font-weight:bold}</style></head><body>
      <h1>Planilha de dívidas</h1>
      <p>Ordem sugerida: bola de neve — quite a menor primeiro; quando ela acabar, a parcela dela vai pra próxima. Previsão estimada com os números abaixo.</p>
      <table><thead><tr><th>#</th><th>Dívida</th><th>Quanto falta</th><th>Juros/mês</th><th>Parcela</th><th>Previsão</th></tr></thead>
      <tbody>${linhas}</tbody><tfoot><tr><td></td><td>Total</td><td>${brl(total)}</td><td></td><td>${brl(totalParcelas)}</td><td></td></tr></tfoot></table>
      <p style="margin-top:14px">CORE · Kit Primeiro Mês Organizado · ${new Date().toLocaleDateString("pt-BR")}</p>
      </body></html>`);
    w.document.close();
    w.print();
  };

  const campo = (k: keyof Rascunho, rotulo: string, ph: string, modo: "text" | "decimal" = "decimal") => (
    <label className="block min-w-0">
      <span className="block text-[10.5px] font-semibold text-muted-foreground mb-1">{rotulo}</span>
      <Input
        value={form?.[k] ?? ""}
        inputMode={modo}
        placeholder={ph}
        onChange={(e) => setForm((f) => ({ ...(f ?? VAZIO), [k]: e.target.value }))}
        className="h-9 text-[13px]"
      />
    </label>
  );

  return (
    <div id="kit-dividas" className="bg-card rounded-lg border border-border p-4 scroll-mt-24" data-testid="kit-dividas">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h4 className="text-xs font-bold">📋 PLANILHA DE DÍVIDAS</h4>
        {dividas.length > 0 && <span className="text-[10.5px] text-muted-foreground font-semibold">{dividas.length} {dividas.length === 1 ? "dívida" : "dívidas"}</span>}
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-snug">
        Ordem sugerida: <b className="text-foreground">bola de neve</b> — quite a menor primeiro; quando ela acabar, a parcela dela vai pra próxima.
      </p>

      {dividas.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-lg bg-secondary px-2.5 py-2 min-w-0">
              <p className="text-[10px] text-muted-foreground">Falta pagar</p>
              <p className="text-[13px] font-bold tabular-nums truncate">{brl(total)}</p>
            </div>
            <div className="rounded-lg bg-secondary px-2.5 py-2 min-w-0">
              <p className="text-[10px] text-muted-foreground">Parcelas/mês</p>
              <p className="text-[13px] font-bold tabular-nums truncate">{brl(totalParcelas)}</p>
            </div>
            <div className="rounded-lg bg-secondary px-2.5 py-2 min-w-0">
              <p className="text-[10px] text-muted-foreground">Juros/mês</p>
              <p className="text-[13px] font-bold tabular-nums truncate text-orange-500">{brl(totalJuros)}</p>
            </div>
          </div>

          <ol className="mt-3 space-y-2" data-testid="kit-dividas-ordem">
            {ordem.map((d, i) => {
              const meses = fim[d.id] ?? null;
              const naoCobre = d.saldo > 0 && d.parcela <= jurosDoMes(d);
              return (
                <li key={d.id} className={`rounded-xl border p-3 ${i === 0 && d.saldo > 0 ? "border-accent/60 bg-accent/5" : "border-border bg-background"}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 ${i === 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold leading-tight truncate">{d.nome}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        {brl(d.saldo)} · {d.juros ? `${d.juros.toLocaleString("pt-BR")}% ao mês` : "sem juros"} · parcela {brl(d.parcela)}
                      </p>
                      <p className="text-[11px] mt-1">
                        {i === 0 && d.saldo > 0 && <b className="text-accent">Comece por esta · </b>}
                        <span className="text-muted-foreground">Previsão: {rotuloMeses(meses)}</span>
                      </p>
                      {naoCobre && (
                        <p className="text-[11px] text-orange-500 mt-1 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Sozinha, a parcela não cobre os juros do mês ({brl(jurosDoMes(d))}). Vale renegociar ou pagar mais.
                        </p>
                      )}
                      {!naoCobre && d.juros >= JUROS_ALTOS && (
                        <p className="text-[11px] text-orange-500 mt-1">Juros altos: se der, pague mais que o mínimo nesta.</p>
                      )}
                    </div>
                    <div className="flex shrink-0">
                      <button type="button" onClick={() => editar(d)} aria-label={`Editar ${d.nome}`} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-muted">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button type="button" onClick={() => apagar(d)} aria-label={`Apagar ${d.nome}`} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-muted">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-[10.5px] text-muted-foreground mt-2 leading-snug">
            Previsão = estimativa com os números que você pôs, pagando as parcelas em dia e passando a parcela de quem acabou pra próxima. Juros e parcelas podem mudar.
          </p>
        </>
      )}

      {form ? (
        <div className="mt-3 rounded-xl border border-border bg-background p-3 space-y-2.5" data-testid="kit-dividas-form">
          {campo("nome", "Nome", "Ex.: cartão Nubank, empréstimo", "text")}
          <div className="grid grid-cols-3 gap-2">
            {campo("saldo", "Quanto falta (R$)", "1.200")}
            {campo("juros", "Juros ao mês (%)", "0")}
            {campo("parcela", "Parcela/mês (R$)", "150")}
          </div>
          <p className="text-[10.5px] text-muted-foreground">Não sabe os juros? Deixe 0 e ajuste depois — está no boleto, na fatura ou no app do banco.</p>
          <div className="flex gap-2">
            <button type="button" onClick={salvar} className="flex-1 h-9 rounded-lg bg-foreground text-background text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
              <Check className="w-4 h-4" /> {editando ? "Salvar" : "Adicionar"}
            </button>
            <button type="button" onClick={() => { setForm(null); setEditando(null); }} className="h-9 px-3 rounded-lg border border-border text-[12.5px] font-semibold inline-flex items-center gap-1">
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setForm(VAZIO)} className="h-9 px-3 rounded-lg bg-foreground text-background text-[12.5px] font-bold inline-flex items-center gap-1.5 active:scale-[0.98]" data-testid="kit-dividas-adicionar">
            <Plus className="w-4 h-4" /> Adicionar dívida
          </button>
          {abertas.length > 0 && (
            <button type="button" onClick={trazerParcelas} className="h-9 px-3 rounded-lg border border-border text-[12.5px] font-semibold">
              Trazer dos parcelamentos
            </button>
          )}
          {dividas.length > 0 && (
            <>
              <button type="button" onClick={exportar} className="h-9 px-3 rounded-lg border border-border text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Planilha (Excel)
              </button>
              {!isNativeShell() && (
                <button type="button" onClick={imprimir} className="h-9 px-3 rounded-lg border border-border text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                  <Printer className="w-4 h-4" /> PDF
                </button>
              )}
            </>
          )}
        </div>
      )}
      {dividas.length === 0 && !form && (
        <p className="text-[11px] text-muted-foreground mt-2">Cartão, empréstimo, cheque especial, acordo, dinheiro emprestado. Ver tudo num lugar só já ajuda a decidir.</p>
      )}
    </div>
  );
};
