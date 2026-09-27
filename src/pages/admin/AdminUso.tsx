import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Panel, StatTile, EmptyState, ErroConsulta, CarregandoLento } from "./components";
import { classificarErro, rpcAdmin, type ErroAdmin } from "./rpc";
import { nomeAba, nomeCard, nomeModulo } from "./nomes";
import {
  agregarCards, agregarUso, classificarAbas, janelaDeDias, minutosPorPessoa, variacao,
  type AbaAvaliada, type AbaUso, type CardUso, type ModuloUso, type Segmento, type UsoPayload,
} from "./uso-contas";
import { buscarAssinantes, buscarCardsDoModulo, buscarVisitas, type Avanco } from "./uso-reserva";

/**
 * ABA "USO" DO ADMIN (27/09) — pedido do dono: "quero ver quais as abas mais
 * usadas, quais os módulos mais usados, pra ver o que melhorar".
 *
 * Fonte: a função admin_uso do banco (rápida). Enquanto a migração de 27/09
 * não sobe, cai no MODO RESERVA: busca module_analytics pelo REST em fatias
 * de 1 dia e agrega aqui com a mesma conta (uso-contas.ts) — mais lento, com
 * barra de progresso, mas funciona hoje.
 */

type Periodo = 7 | 30 | 90;
type Ordem = "pessoas" | "minutos" | "mediana" | "voltaram" | "tendencia";

const PERIODOS: { v: Periodo; rotulo: string }[] = [
  { v: 7, rotulo: "7 dias" },
  { v: 30, rotulo: "30 dias" },
  { v: 90, rotulo: "90 dias" },
];
const SEGMENTOS_UI: { v: Segmento; rotulo: string }[] = [
  { v: "todos", rotulo: "Todos" },
  { v: "com", rotulo: "Com assinatura" },
  { v: "sem", rotulo: "Sem assinatura" },
];

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const fmtMin = (m: number) => (m >= 10 ? Math.round(m).toLocaleString("pt-BR") : m.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const fmtN = (n: number) => n.toLocaleString("pt-BR");

function Tendencia({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[11px] text-muted-foreground">novo</span>;
  const p = Math.round(v * 100);
  if (Math.abs(p) < 3) return <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="w-3 h-3" />0%</span>;
  const sobe = p > 0;
  const Icone = sobe ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${sobe ? "text-success" : "text-destructive"}`}>
      <Icone className="w-3 h-3" />{sobe ? "+" : ""}{p}%
    </span>
  );
}

/** Pessoas por dia em barrinhas (a série do módulo). */
function Serie({ valores }: { valores: number[] }) {
  if (!valores.length) return null;
  const max = Math.max(...valores, 1);
  return (
    <div className="flex items-end gap-[2px] h-6 w-24" aria-hidden>
      {valores.map((v, i) => (
        <i key={i} className="block flex-1 rounded-t-[2px] bg-accent/70" style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function Segmentado<T extends string | number>({ valor, opcoes, onChange }: { valor: T; opcoes: { v: T; rotulo: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
      {opcoes.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={`px-3 h-8 rounded-[10px] text-[12.5px] font-semibold transition-colors ${valor === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function TabelaAbas({ abas, ativos }: { abas: AbaUso[]; ativos: number }) {
  if (!abas.length) return <EmptyState label="Este módulo não registrou abas no período" />;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12.5px] min-w-[520px]">
        <thead>
          <tr className="text-[11px] text-muted-foreground text-left">
            <th className="font-semibold py-1.5 px-1">Aba</th>
            <th className="font-semibold py-1.5 px-1 text-right">Pessoas</th>
            <th className="font-semibold py-1.5 px-1 text-right">% dos ativos</th>
            <th className="font-semibold py-1.5 px-1 text-right">s por visita</th>
            <th className="font-semibold py-1.5 px-1 text-right">Voltaram</th>
            <th className="font-semibold py-1.5 px-1 text-right">vs antes</th>
          </tr>
        </thead>
        <tbody>
          {abas.map((a) => (
            <tr key={a.aba} className="border-t border-border/60">
              <td className="py-1.5 px-1 font-medium">{nomeAba(a.modulo, a.aba)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{fmtN(a.pessoas)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{pct(a.pessoas, ativos)}%</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{a.mediana_seg}</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{pct(a.voltaram, a.pessoas)}%</td>
              <td className="py-1.5 px-1 text-right"><Tendencia v={variacao(a.pessoas, a.pessoas_ant)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaCards({ cards }: { cards: CardUso[] }) {
  if (!cards.length) return <EmptyState label="Sem eventos de card neste módulo no período" />;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12.5px] min-w-[460px]">
        <thead>
          <tr className="text-[11px] text-muted-foreground text-left">
            <th className="font-semibold py-1.5 px-1">Card</th>
            <th className="font-semibold py-1.5 px-1">Aba</th>
            <th className="font-semibold py-1.5 px-1 text-right">Viram</th>
            <th className="font-semibold py-1.5 px-1 text-right">Usaram</th>
            <th className="font-semibold py-1.5 px-1 text-right">Uso</th>
          </tr>
        </thead>
        <tbody>
          {cards.slice(0, 40).map((c) => (
            <tr key={`${c.aba}|${c.card}`} className="border-t border-border/60">
              <td className="py-1.5 px-1 font-medium">{nomeCard(c.card)}</td>
              <td className="py-1.5 px-1 text-muted-foreground">{c.aba ? nomeAba(c.modulo, c.aba) : "—"}</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{fmtN(c.viram)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{fmtN(c.usaram)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums">{c.viram ? `${pct(c.usaram, c.viram)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cards agrupados pela aba (na ordem das abas mais usadas) e, dentro dela, pelos mais vistos. */
function ordenarCards(cards: CardUso[], abasDoModulo: AbaUso[]): CardUso[] {
  const rank = new Map(abasDoModulo.map((a, i) => [a.aba, i]));
  return [...cards].sort((a, b) => (rank.get(a.aba) ?? 999) - (rank.get(b.aba) ?? 999) || b.viram - a.viram || b.usaram - a.usaram);
}

function ListaAvaliada({ titulo, itens, limite = 12 }: { titulo?: string; itens: AbaAvaliada[]; limite?: number }) {
  const [todas, setTodas] = useState(false);
  if (!itens.length) return null;
  const visiveis = todas ? itens : itens.slice(0, limite);
  return (
    <div>
      {titulo && <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{titulo} <span className="tabular-nums">({itens.length})</span></p>}
      <ul className="space-y-1.5">
        {visiveis.map((a) => (
          <li key={`${a.modulo}|${a.aba}`} className="text-[12.5px]">
            <b>{nomeModulo(a.modulo).nome} › {nomeAba(a.modulo, a.aba)}</b> <span className="text-muted-foreground">— {a.motivo}</span>
          </li>
        ))}
      </ul>
      {itens.length > limite && (
        <button onClick={() => setTodas((t) => !t)} className="mt-2 text-[12px] font-semibold text-accent hover:underline">
          {todas ? "Mostrar menos" : `Ver todas (${itens.length})`}
        </button>
      )}
    </div>
  );
}

export default function AdminUso() {
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [segmento, setSegmento] = useState<Segmento>("todos");
  const [ordem, setOrdem] = useState<Ordem>("pessoas");
  const [dados, setDados] = useState<UsoPayload | null>(null);
  const [erro, setErro] = useState<ErroAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [avanco, setAvanco] = useState<Avanco | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  // modo reserva: cards lidos sob demanda, guardados com os 3 recortes (trocar o recorte não relê)
  const [cardsReserva, setCardsReserva] = useState<Record<string, Record<Segmento, CardUso[]> | "carregando" | ErroAdmin>>({});
  const abortRef = useRef<AbortController | null>(null);
  const assinantesRef = useRef<Set<string> | null>(null);

  const carregar = useCallback(async (dias: Periodo) => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setCarregando(true);
    setErro(null);
    setAvanco(null);
    setAberto(null);
    setCardsReserva({});
    const janela = janelaDeDias(dias);

    // 1) a função do banco (rápida, quando a migração estiver no ar)
    const sql = await rpcAdmin<UsoPayload>("admin_uso", { _from: janela.de, _to: janela.ate });
    if (ctl.signal.aborted) return;
    if (sql.data && !sql.error) {
      setDados({ ...sql.data, fonte: "sql" });
      setCarregando(false);
      return;
    }
    if (sql.error && sql.error.tipo !== "sem_funcao") {
      setErro(sql.error);
      setCarregando(false);
      return;
    }

    // 2) modo reserva: lê as visitas e agrega aqui (período atual + anterior)
    try {
      const assinantes = await buscarAssinantes(ctl.signal);
      assinantesRef.current = assinantes;
      const linhas = await buscarVisitas(janela.de_anterior, janela.ate, ctl.signal, (a) => setAvanco(a));
      if (ctl.signal.aborted) return;
      setDados(agregarUso(linhas, { de: janela.de, ate: janela.ate, assinantes, fonte: "reserva" }));
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setErro(classificarErro(e));
    } finally {
      if (!ctl.signal.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(periodo);
    return () => abortRef.current?.abort();
  }, [carregar, periodo]);

  const recorte = dados?.segmentos[segmento] ?? null;
  const ativos = recorte?.totais.ativos ?? 0;

  const modulos = useMemo(() => {
    if (!recorte) return [] as ModuloUso[];
    const lista = [...recorte.modulos];
    const chave = (m: ModuloUso): number => {
      switch (ordem) {
        case "minutos": return minutosPorPessoa(m);
        case "mediana": return m.mediana_seg;
        case "voltaram": return m.pessoas ? m.voltaram / m.pessoas : 0;
        case "tendencia": return variacao(m.pessoas, m.pessoas_ant) ?? -Infinity;
        default: return m.pessoas;
      }
    };
    return lista.sort((a, b) => chave(b) - chave(a));
  }, [recorte, ordem]);

  const avaliacao = useMemo(() => (recorte ? classificarAbas(recorte.abas, ativos) : null), [recorte, ativos]);

  // cards de um módulo: no modo SQL já vêm no payload; na reserva, sob demanda (7 dias)
  const abrirModulo = async (mod: string) => {
    const vai = aberto === mod ? null : mod;
    setAberto(vai);
    if (!vai || !dados || dados.fonte === "sql" || cardsReserva[mod]) return;
    setCardsReserva((c) => ({ ...c, [mod]: "carregando" }));
    // o mesmo sinal da carga principal: trocar o período cancela esta leitura
    const sinal = abortRef.current?.signal ?? new AbortController().signal;
    try {
      const sete = janelaDeDias(7);
      const eventos = await buscarCardsDoModulo(mod, sete.de, sete.ate, sinal);
      if (sinal.aborted) return;
      const porSeg = agregarCards(eventos, assinantesRef.current ?? new Set());
      setCardsReserva((c) => ({ ...c, [mod]: porSeg }));
    } catch (e) {
      if (sinal.aborted || (e as Error)?.name === "AbortError") return;
      setCardsReserva((c) => ({ ...c, [mod]: classificarErro(e) }));
    }
  };

  const cardsDo = (mod: string): CardUso[] | "carregando" | ErroAdmin | null => {
    if (!dados) return null;
    const abasDoModulo = (recorte?.abas ?? []).filter((a) => a.modulo === mod);
    if (dados.fonte === "sql") return ordenarCards((recorte?.cards ?? []).filter((c) => c.modulo === mod), abasDoModulo);
    const c = cardsReserva[mod];
    if (!c) return null;
    if (c === "carregando" || "tipo" in c) return c as "carregando" | ErroAdmin;
    return ordenarCards(c[segmento].filter((x) => x.modulo === mod), abasDoModulo);
  };

  const tot = recorte?.totais;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Uso do app</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Módulos, abas e cards mais usados — pra decidir o que melhorar, juntar ou tirar.
            {dados && <span className="ml-1">{dados.fonte === "sql" ? "Fonte: banco." : "Modo reserva (a função rápida ainda não está no banco)."}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmentado valor={periodo} opcoes={PERIODOS} onChange={(v) => setPeriodo(v)} />
          <Segmentado valor={segmento} opcoes={SEGMENTOS_UI} onChange={(v) => setSegmento(v)} />
        </div>
      </div>

      {erro && <ErroConsulta erro={erro} onRetry={() => void carregar(periodo)} />}

      {carregando && (
        avanco ? (
          <Panel>
            <p className="text-[13px] font-semibold">Lendo as visitas dia a dia (modo reserva)…</p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct(avanco.feitos, avanco.total)}%` }} />
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-1.5 tabular-nums">
              {avanco.feitos} de {avanco.total} dias · {fmtN(avanco.linhas)} visitas lidas
            </p>
          </Panel>
        ) : (
          <CarregandoLento aviso="Consultando o banco — pode levar alguns segundos." depoisDe={4000} />
        )
      )}

      {!carregando && recorte && tot && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Pessoas que usaram" value={fmtN(tot.ativos)} sub={`antes: ${fmtN(tot.ativos_ant)}`} />
            <StatTile label="Com assinatura" value={fmtN(tot.com_assinatura)} sub={`${pct(tot.com_assinatura, tot.ativos)}% dos ativos`} />
            <StatTile label="Minutos por pessoa" value={fmtMin(tot.ativos ? tot.seg_total / 60 / tot.ativos : 0)} sub="no período" />
            <StatTile label="Voltaram em 2+ dias" value={`${pct(tot.voltaram, tot.ativos)}%`} sub={`${fmtN(tot.voltaram)} pessoas`} />
          </div>

          <Panel title="Módulos" sub="Toque num módulo pra ver as abas e os cards dele. Tendência = pessoas contra o período anterior do mesmo tamanho.">
            <div className="flex flex-wrap gap-1.5 mb-3 text-[11.5px]">
              <span className="text-muted-foreground mr-1 self-center">Ordenar por</span>
              {([
                ["pessoas", "pessoas"], ["minutos", "minutos/pessoa"], ["mediana", "s por visita"], ["voltaram", "voltaram"], ["tendencia", "tendência"],
              ] as [Ordem, string][]).map(([k, r]) => (
                <button key={k} onClick={() => setOrdem(k)}
                  className={`px-2.5 h-7 rounded-lg border ${ordem === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
            {!modulos.length ? <EmptyState label="Ninguém usou o app neste recorte" /> : (
              <div className="divide-y divide-border/60">
                {modulos.map((m) => {
                  const { emoji, nome } = nomeModulo(m.modulo);
                  const estaAberto = aberto === m.modulo;
                  const cards = estaAberto ? cardsDo(m.modulo) : null;
                  return (
                    <div key={m.modulo}>
                      <button onClick={() => void abrirModulo(m.modulo)} className="w-full py-2.5 flex items-center gap-3 text-left hover:bg-muted/40 rounded-lg px-1">
                        {estaAberto ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                        <span className="text-[16px] w-6 text-center shrink-0" aria-hidden>{emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold truncate">{nome}</span>
                          <span className="block text-[11.5px] text-muted-foreground tabular-nums">
                            {fmtN(m.pessoas)} pessoas · {pct(m.pessoas, ativos)}% · {fmtMin(minutosPorPessoa(m))} min/pessoa · {m.mediana_seg} s/visita · {pct(m.voltaram, m.pessoas)}% voltaram
                          </span>
                        </span>
                        <span className="hidden sm:block shrink-0"><Serie valores={recorte.serie[m.modulo] ?? []} /></span>
                        <span className="shrink-0 w-14 text-right"><Tendencia v={variacao(m.pessoas, m.pessoas_ant)} /></span>
                      </button>
                      {estaAberto && (
                        <div className="pl-9 pr-1 pb-4 space-y-4">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Abas</p>
                            <TabelaAbas abas={recorte.abas.filter((a) => a.modulo === m.modulo)} ativos={ativos} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                              Cards {dados?.fonte === "reserva" && <span className="normal-case font-medium tracking-normal">(últimos 7 dias)</span>}
                            </p>
                            {cards === "carregando" ? <CarregandoLento depoisDe={3000} aviso="Lendo os eventos de card…" />
                              : cards && !Array.isArray(cards) ? <ErroConsulta erro={cards} compacto />
                              : <TabelaCards cards={Array.isArray(cards) ? cards : []} />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {avaliacao && (
            <div className="grid md:grid-cols-2 gap-3">
              <Panel title="Abas fracas" sub={`Muita gente entra e sai em segundos (e quase ninguém volta), ou pouca gente (menos de ${avaliacao.corte} pessoas).`}>
                {!avaliacao.fracas.length ? <EmptyState label="Nenhuma aba fraca neste recorte" /> : (
                  <div className="space-y-4">
                    <ListaAvaliada titulo="Abre e sai" itens={avaliacao.fracas.filter((a) => a.tipo === "abre_e_sai")} />
                    <ListaAvaliada titulo="Pouca gente" itens={avaliacao.fracas.filter((a) => a.tipo === "pouca_gente")} />
                  </div>
                )}
              </Panel>
              <Panel title="Abas fortes" sub="Muita gente voltando em 2 ou mais dias — hábito de verdade.">
                {!avaliacao.fortes.length ? <EmptyState label="Nenhuma aba forte neste recorte" /> : <ListaAvaliada itens={avaliacao.fortes} />}
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
