/**
 * DÍVIDAS ENTRE PESSOAS (01/09) — pedido de cliente por WhatsApp:
 *
 *   "dívidas de dever pra alguma pessoa. Exemplo 5 mil na pessoa. Aí vai
 *    parcelando é que NÃO ENVOLVA a questão do gráfico e despesas. Uma
 *    dívida x que vai entrando."
 *   "Emprestei o dinheiro pra tal pessoa e ela me deve SEM PRECISAR MEXER
 *    NO CAIXA."
 *
 * As duas frases dizem a mesma coisa por lados opostos, e é essa a regra que
 * manda no arquivo: isto é um CADERNO À PARTE. Chave própria
 * (`finance-dividas-pessoas`), fora de `finance-expenses`, fora de
 * `finance-installments`, fora de `computeMonthlyOutflow`. Nada daqui entra
 * no saldo do mês, no gráfico do dashboard ou na Saúde Financeira — de
 * propósito, porque emprestar R$ 5.000 não é gastar R$ 5.000.
 *
 * MODELO: uma dívida é uma pessoa, uma direção e uma LISTA DE LANÇAMENTOS.
 * Positivo aumenta o que se deve, negativo abate. O saldo é a soma — não um
 * campo guardado. Assim "vai parcelando" e "vai entrando" são a mesma
 * operação vista de sinais diferentes, e o histórico nunca discorda do total
 * (não existe saldo salvo pra dessincronizar da lista que o gerou).
 *
 * O `installments` do módulo continua sendo outra coisa: aquilo é parcela de
 * CARTÃO, que de fato compromete o mês e por isso entra nos totais.
 *
 * ── POR PERFIL (09/09) ───────────────────────────────────────────────────
 * Cliente pagante: "a divisão de empresa e pessoal não tá tão separado, na
 * parte de dívidas e empréstimos". Este caderno nasceu antes dos perfis PF/PJ
 * e nunca ganhou a etiqueta: a lista era uma só, e o empréstimo que a empresa
 * fez aparecia no Pessoal. Agora cada dívida carrega `perfil` (sem etiqueta =
 * pessoal, como todo o resto do módulo — dado antigo continua valendo), a
 * tela vê só as do perfil ativo e a volta é mesclada por `usarListaDoPerfil`,
 * a mesma mecânica das despesas e pelo mesmo motivo: apagar uma dívida no
 * Pessoal não pode levar junto a dívida da empresa. Em "Tudo junto" aparece
 * tudo, com um selo discreto dizendo de quem é cada uma.
 */
import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { numeroBR } from "@/lib/data-normalizers";
import { Plus, Trash2, ArrowDownLeft, ArrowUpRight, HandCoins, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { usarListaDoPerfil, etiquetar, nomeDoPerfil, PERFIL_PESSOAL, PERFIL_TODOS, type Perfil } from "@/lib/finance-perfil";

/** Positivo aumenta a dívida; negativo abate (pagamento / devolução). */
export interface LancamentoDivida {
  id: string;
  data: string;
  valor: number;
  nota?: string;
}

/** Parcela PREVISTA (22/09): "emprestei 10 mil e ele me paga 10× de 1.000". É
 *  só o calendário combinado; o dinheiro que entra continua sendo lançamento. */
export interface ParcelaPrevista {
  n: number;
  data: string;
  valor: number;
  paga?: boolean;
}

export interface DividaPessoal {
  id: string;
  pessoa: string;
  /** "devo" = eu devo a ela. "medevem" = emprestei e ela me deve. */
  direcao: "devo" | "medevem";
  criadaEm: string;
  lancamentos: LancamentoDivida[];
  /** Perfil PF/PJ dono da dívida. Ausente = pessoal (legado). */
  perfil?: string;
  /** Calendário combinado (22/09). Ausente = sem parcelas, como sempre foi. */
  parcelas?: ParcelaPrevista[];
  /** Juros combinados, % ao mês sobre o saldo (22/09). Ausente = sem juros. */
  jurosMes?: number;
}

interface Props {
  /** Perfil ativo (PF/PJ). Sem a prop, comporta-se como sempre: pessoal. */
  perfil?: string;
  /** Só pra dar nome ao selo em "Tudo junto". */
  perfis?: Perfil[];
  /** Juros de quem ME deve viram receita do mês em Finanças (22/09, chamado:
   *  "se eu emprestar a juros, como coloco esse rendimento mensal na minha
   *  conta?"). Só o JURO entra — o principal continua fora do caixa. */
  onReceita?: (r: { descricao: string; valor: number; data: string }) => void;
}

/** Gera as parcelas previstas: valor dividido igual, última ajustada pro centavo; datas mês a mês a partir da primeira. */
export const gerarParcelas = (total: number, n: number, primeira: string): ParcelaPrevista[] => {
  if (!Number.isInteger(n) || n < 2 || !(total > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(primeira)) return [];
  const [a, m, d] = primeira.split("-").map(Number);
  const base = Math.floor((total / n) * 100) / 100;
  const out: ParcelaPrevista[] = [];
  let soma = 0;
  for (let i = 0; i < n; i++) {
    const dt = new Date(a, m - 1 + i, 1);
    const ultimo = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(d, ultimo));
    const valor = i === n - 1 ? Math.round((total - soma) * 100) / 100 : base;
    soma += valor;
    out.push({ n: i + 1, data: localDayKey(dt), valor });
  }
  return out;
};

const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const saldoDaDivida = (d: DividaPessoal) =>
  (d.lancamentos || []).reduce((s, l) => s + (Number.isFinite(l.valor) ? l.valor : 0), 0);

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dataCurta = (k: string) => {
  try {
    return parseLocalDay(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return k;
  }
};

export const DividasEntrePessoas = ({ perfil = PERFIL_PESSOAL, perfis = [], onReceita }: Props) => {
  const [dividasTodas, setDividasTodas] = usePersistedState<DividaPessoal[]>("finance-dividas-pessoas", []);
  /* A tela só enxerga o perfil ativo; a escrita volta mesclada com as dívidas
     dos outros perfis (finance-perfil.ts). */
  const [dividas, setDividas] = usarListaDoPerfil(dividasTodas, setDividasTodas, perfil);
  const consolidado = perfil === PERFIL_TODOS;
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState({ pessoa: "", valor: "", direcao: "devo" as DividaPessoal["direcao"], parcelas: "", primeira: "", juros: "" });
  const [combinado, setCombinado] = useState(false);
  const [movimento, setMovimento] = useState<{ id: string; valor: string; sinal: 1 | -1 } | null>(null);

  const criar = () => {
    const valor = numeroBR(nova.valor);
    if (!nova.pessoa.trim()) { toast.error("Escreva o nome da pessoa"); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Informe um valor maior que zero"); return; }
    const hoje = localDayKey();
    const nParcelas = parseInt(nova.parcelas, 10);
    const parcelas = combinado && Number.isInteger(nParcelas) && nParcelas >= 2 ? gerarParcelas(valor, nParcelas, nova.primeira || hoje) : [];
    if (combinado && nova.parcelas && !parcelas.length) { toast.error("Parcelas: número de 2 a 99 e a data da primeira"); return; }
    const juros = numeroBR(nova.juros);
    setDividas([
      ...dividas,
      // Nasce etiquetada com o perfil ativo (a mesclagem também etiquetaria;
      // aqui é explícito pra ninguém depender do efeito colateral).
      etiquetar({
        id: novoId(),
        pessoa: nova.pessoa.trim(),
        direcao: nova.direcao,
        criadaEm: hoje,
        // O valor de abertura é o PRIMEIRO lançamento, não um campo à parte:
        // é o que mantém saldo e histórico sempre contando a mesma história.
        lancamentos: [{ id: novoId(), data: hoje, valor, nota: "Valor inicial" }],
        ...(parcelas.length ? { parcelas } : {}),
        ...(combinado && Number.isFinite(juros) && juros > 0 ? { jurosMes: juros } : {}),
      }, perfil),
    ]);
    setNova({ pessoa: "", valor: "", direcao: nova.direcao, parcelas: "", primeira: "", juros: "" });
    setCombinado(false);
  };

  /** Parcela prevista recebida/paga: vira lançamento de abatimento e fica marcada. */
  const quitarParcela = (d: DividaPessoal, p: ParcelaPrevista) => {
    setDividas(dividas.map((x) => x.id !== d.id ? x : {
      ...x,
      lancamentos: [...x.lancamentos, { id: novoId(), data: localDayKey(), valor: -p.valor, nota: `Parcela ${p.n}/${x.parcelas?.length ?? 0}` }],
      parcelas: (x.parcelas ?? []).map((q) => (q.n === p.n ? { ...q, paga: true } : q)),
    }));
  };

  /** Juros do mês sobre o saldo: aumenta a dívida; se me devem, é rendimento e pode ir pra receita. */
  const lancarJuros = (d: DividaPessoal) => {
    const saldo = Math.max(0, saldoDaDivida(d));
    const juros = Math.round(saldo * ((d.jurosMes ?? 0) / 100) * 100) / 100;
    if (!(juros > 0)) { toast.error("Sem saldo pra render juros"); return; }
    const hoje = localDayKey();
    const mesRotulo = new Date().toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    setDividas(dividas.map((x) => x.id !== d.id ? x : {
      ...x, lancamentos: [...x.lancamentos, { id: novoId(), data: hoje, valor: juros, nota: `Juros ${mesRotulo} (${d.jurosMes}%)` }],
    }));
    if (d.direcao === "medevem" && onReceita) {
      onReceita({ descricao: `Juros — ${d.pessoa}`, valor: juros, data: hoje });
      toast.success(`R$ ${brl(juros)} de juros lançados na dívida e como receita do mês`);
    } else {
      toast.success(`R$ ${brl(juros)} de juros lançados`);
    }
  };

  const lancar = (id: string, valorBruto: number, sinal: 1 | -1, nota: string) => {
    if (!Number.isFinite(valorBruto) || valorBruto <= 0) { toast.error("Informe um valor maior que zero"); return; }
    setDividas(dividas.map((d) => d.id !== id ? d : {
      ...d,
      lancamentos: [...d.lancamentos, { id: novoId(), data: localDayKey(), valor: valorBruto * sinal, nota }],
    }));
    setMovimento(null);
  };

  const apagarLancamento = (dividaId: string, lancId: string) =>
    setDividas(dividas.map((d) => d.id !== dividaId ? d : {
      ...d, lancamentos: d.lancamentos.filter((l) => l.id !== lancId),
    }));

  const totalDevo = dividas.filter(d => d.direcao === "devo").reduce((s, d) => s + Math.max(0, saldoDaDivida(d)), 0);
  const totalMeDevem = dividas.filter(d => d.direcao === "medevem").reduce((s, d) => s + Math.max(0, saldoDaDivida(d)), 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-muted/40 py-2 px-4 flex items-center gap-2">
        <HandCoins className="w-4 h-4 text-muted-foreground" />
        <span className="font-bold text-sm tracking-wide">DÍVIDAS E EMPRÉSTIMOS</span>
      </div>

      {/* A regra escrita na tela, não só no código: é isso que impede alguém
          de achar que o app "perdeu" R$ 5.000 do saldo do mês. */}
      <p className="px-4 py-2 text-[10px] text-muted-foreground border-b border-border bg-muted/10">
        Caderno à parte: nada aqui entra no saldo do mês, nas despesas ou nos gráficos.
      </p>

      {/* Novo registro */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          {([["devo", "Eu devo"], ["medevem", "Me devem"]] as const).map(([v, texto]) => (
            <button
              key={v}
              onClick={() => setNova({ ...nova, direcao: v })}
              aria-pressed={nova.direcao === v}
              className={`h-9 rounded-md border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                nova.direcao === v
                  ? v === "devo"
                    ? "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400"
                    : "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {v === "devo" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
              {texto}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={nova.direcao === "devo" ? "Devo para quem?" : "Quem me deve?"}
            value={nova.pessoa}
            onChange={(e) => setNova({ ...nova, pessoa: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            className="h-9 text-xs flex-1"
          />
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Valor"
            value={nova.valor}
            onChange={(e) => setNova({ ...nova, valor: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            className="h-9 text-xs w-24 text-right"
          />
          <button
            onClick={criar}
            aria-label="Registrar dívida"
            className="h-9 w-9 flex-shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {/* COMBINADO (22/09): parcelas previstas e juros ao mês, opcionais */}
        <button
          type="button"
          onClick={() => setCombinado(!combinado)}
          aria-expanded={combinado}
          className="text-[11px] text-muted-foreground underline underline-offset-2"
          data-testid="divida-combinado"
        >
          {combinado ? "Sem parcelas nem juros" : "Parcelado? Com juros?"}
        </button>
        {combinado && (
          <div className="grid grid-cols-3 gap-1.5" data-testid="divida-combinado-campos">
            <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
              Parcelas
              <Input type="number" inputMode="numeric" min={2} max={99} placeholder="Ex: 10" value={nova.parcelas} onChange={(e) => setNova({ ...nova, parcelas: e.target.value })} className="h-8 text-xs" aria-label="Número de parcelas" />
            </label>
            <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
              1ª parcela
              <Input type="date" value={nova.primeira} onChange={(e) => setNova({ ...nova, primeira: e.target.value })} className="h-8 text-xs" aria-label="Data da primeira parcela" />
            </label>
            <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
              Juros % ao mês
              <Input type="number" inputMode="decimal" min={0} step="0.1" placeholder="Ex: 2" value={nova.juros} onChange={(e) => setNova({ ...nova, juros: e.target.value })} className="h-8 text-xs" aria-label="Juros ao mês em porcento" />
            </label>
          </div>
        )}
      </div>

      {/* Lista */}
      <div>
        {dividas.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhuma dívida registrada</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Ex.: "devo 5.000 ao João" ou "emprestei 300 pra Ana"
            </p>
          </div>
        ) : dividas.map((d) => {
          const saldo = saldoDaDivida(d);
          const inicial = d.lancamentos.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0);
          const pago = inicial - saldo;
          const pct = inicial > 0 ? Math.min(100, Math.max(0, (pago / inicial) * 100)) : 0;
          const quitada = saldo <= 0.005;
          const devo = d.direcao === "devo";
          const expandida = aberta === d.id;

          return (
            <div key={d.id} className="border-b border-border/50">
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAberta(expandida ? null : d.id)}
                    className="flex-1 min-w-0 text-left"
                    aria-expanded={expandida}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{d.pessoa}</span>
                      <span className={`category-badge ${devo
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25"
                        : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25"}`}>
                        {devo ? "eu devo" : "me deve"}
                      </span>
                      {quitada && (
                        <span className="category-badge bg-muted text-muted-foreground border-border">
                          <Check className="w-3 h-3 inline -mt-0.5" /> quitada
                        </span>
                      )}
                      {/* Só no consolidado: em Pessoal ou numa empresa o
                          próprio chip do topo já diz de quem é. */}
                      {consolidado && (
                        <span className="category-badge bg-muted/60 text-muted-foreground border border-border/60 text-[10px]" data-testid="selo-perfil">
                          {nomeDoPerfil(d.perfil, perfis)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {pago > 0 ? `R$ ${brl(pago)} de R$ ${brl(inicial)} já ${devo ? "pagos" : "devolvidos"}` : `desde ${dataCurta(d.criadaEm)}`}
                    </p>
                  </button>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${quitada ? "text-muted-foreground line-through" : devo ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                      R$ {brl(Math.max(0, saldo))}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expandida ? "rotate-180" : ""}`} />
                </div>

                {inicial > 0 && (
                  <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${devo ? "bg-red-400" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              {expandida && (
                <div className="px-3 pb-3 space-y-2 bg-muted/10">
                  <div className="flex gap-1.5">
                    <Button
                      size="sm" variant="outline"
                      className="h-8 flex-1 text-[11px]"
                      onClick={() => setMovimento({ id: d.id, valor: "", sinal: -1 })}
                    >
                      {devo ? "Paguei uma parte" : "Recebi uma parte"}
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-8 flex-1 text-[11px]"
                      onClick={() => setMovimento({ id: d.id, valor: "", sinal: 1 })}
                    >
                      Aumentou
                    </Button>
                  </div>

                  {/* Calendário combinado (22/09): cada parcela vira abatimento com um toque */}
                  {(d.parcelas?.length ?? 0) > 0 && (
                    <div className="space-y-1" data-testid="parcelas-previstas">
                      <p className="text-[10px] font-bold text-muted-foreground">
                        PARCELAS COMBINADAS · {d.parcelas!.filter((p) => p.paga).length}/{d.parcelas!.length}
                      </p>
                      {d.parcelas!.map((p) => (
                        <div key={p.n} className={`flex items-center gap-2 text-[11px] rounded-md border px-2 py-1 ${p.paga ? "bg-muted/40 border-border/40 text-muted-foreground" : "bg-card border-border/60"}`}>
                          <span className="tabular-nums w-8 shrink-0">{p.n}/{d.parcelas!.length}</span>
                          <span className="tabular-nums text-muted-foreground shrink-0">{dataCurta(p.data)}</span>
                          <span className={`flex-1 text-right tabular-nums font-semibold ${p.paga ? "line-through" : ""}`}>R$ {brl(p.valor)}</span>
                          {p.paga ? (
                            <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold shrink-0">✓ {devo ? "paga" : "recebida"}</span>
                          ) : (
                            <button type="button" onClick={() => quitarParcela(d, p)} className="h-6 px-2 rounded-md bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
                              {devo ? "Paguei" : "Recebi"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(d.jurosMes ?? 0) > 0 && !quitada && (
                    <button
                      type="button"
                      onClick={() => lancarJuros(d)}
                      className="w-full h-8 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:bg-muted/40"
                      data-testid="lancar-juros"
                    >
                      Lançar juros do mês: {d.jurosMes}% de R$ {brl(Math.max(0, saldo))} = R$ {brl(Math.round(Math.max(0, saldo) * (d.jurosMes! / 100) * 100) / 100)}
                      {!devo && onReceita ? " (entra como receita)" : ""}
                    </button>
                  )}

                  {movimento?.id === d.id && (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        type="number"
                        inputMode="decimal"
                        placeholder={movimento.sinal === -1 ? "Quanto foi abatido?" : "Quanto aumentou?"}
                        value={movimento.valor}
                        onChange={(e) => setMovimento({ ...movimento, valor: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") lancar(d.id, numeroBR(movimento.valor), movimento.sinal, movimento.sinal === -1 ? "Abatimento" : "Aumento");
                          if (e.key === "Escape") setMovimento(null);
                        }}
                        className="h-8 text-xs flex-1"
                      />
                      <button
                        onClick={() => lancar(d.id, numeroBR(movimento.valor), movimento.sinal, movimento.sinal === -1 ? "Abatimento" : "Aumento")}
                        className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold"
                      >
                        Lançar
                      </button>
                    </div>
                  )}

                  <div className="space-y-1">
                    {[...d.lancamentos].reverse().map((l) => (
                      <div key={l.id} className="flex items-center gap-2 text-[11px] rounded-md bg-card border border-border/60 px-2 py-1.5">
                        <span className="text-muted-foreground tabular-nums shrink-0">{dataCurta(l.data)}</span>
                        <span className="flex-1 truncate text-muted-foreground">{l.nota || (l.valor > 0 ? "Aumento" : "Abatimento")}</span>
                        <span className={`tabular-nums font-bold ${l.valor > 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                          {l.valor > 0 ? "+" : "−"} R$ {brl(Math.abs(l.valor))}
                        </span>
                        <button
                          onClick={() => apagarLancamento(d.id, l.id)}
                          aria-label="Apagar lançamento"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setDividas(dividas.filter(x => x.id !== d.id)); setAberta(null); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive underline underline-offset-2"
                  >
                    Apagar esta dívida inteira
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totais das duas direções, separados — somar os dois num número só
          esconderia justamente a informação que a pessoa vem buscar. */}
      {dividas.length > 0 && (
        <div className="grid grid-cols-2 border-t border-border divide-x divide-border">
          <div className="px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground">Você deve</p>
            <p className="text-sm font-bold tabular-nums text-red-500">R$ {brl(totalDevo)}</p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground">Te devem</p>
            <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">R$ {brl(totalMeDevem)}</p>
          </div>
        </div>
      )}
    </div>
  );
};
