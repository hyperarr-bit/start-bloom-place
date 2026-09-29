/**
 * CABELO DE HOJE (28/09, Onda 1). A folha do dia do cabelo, no mesmo desenho do
 * "Skincare de hoje": cabeçalho rosé com o dia, a faixa da ETAPA na cor dela
 * (hidratação babosa, nutrição mel, reconstrução ameixa) e a tabela ORDEM | ETAPA |
 * FEITO com os passos da lavagem.
 *
 * HOJE | ONTEM | OUTRO DIA: esqueceu de marcar, marca no dia certo. A etapa só anda
 * com FEITO; "Lavei fora do plano" registra sem pular a etapa (o cronograma espera).
 * Em cada lavagem: o produto de cada passo (de MEUS PRODUTOS › Cabelo ou digitado),
 * as etapas extras (umectação, acidificação…), como ficou (brilho, frizz…) e uma nota.
 */
import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, parseLocalDay } from "@/lib/utils";
import { rotuloDoProduto, type ProdutoDaBancada } from "@/lib/beleza-rotina";
import { DIAS_DA_SEMANA } from "@/components/treino/planner";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import { HAIR_RESULT_TAGS } from "./utils";
import { ETAPAS, EXTRAS, passosDaLavagem, somarDias, type Etapa, type LavagemCapilar } from "@/lib/beleza-cabelo";
import { buscarNaLista, carregarCatalogoCabelo, itemDoCabelo, produtoDaLista, type ItemDaLista } from "@/lib/beleza-produtos";
import {
  BOTAO_CONTORNO, BOTAO_PILULA, CartaoBeleza, Chip, LetraDaEtapa, Marcar, ROTULO_BZ, Serif, TEMA_BELEZA, TOM_DA_ETAPA,
} from "./kit";
import { useChaveDaBeleza } from "./estado-compartilhado";
import type { Cabelo } from "./use-cabelo";

const ORDEM_ETAPAS: Etapa[] = ["hidratacao", "nutricao", "reconstrucao"];
const nomeDoDia = (dia: string) => DIAS_DA_SEMANA[(parseLocalDay(dia).getDay() + 6) % 7];
const diaMes = (dia: string) => parseLocalDay(dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const diaSemanaCurto = (dia: string) => parseLocalDay(dia).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

/** Chip que liga/desliga (extras, resultado). */
function ChipAlterna({ ativo, onClick, children, testId }: { ativo: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn("h-9 px-3 rounded-full text-[12px] font-semibold border transition-colors", ativo ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave")}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** O produto usado num passo: MEUS PRODUTOS › Cabelo em chips, a lista de cabelo (busca) ou digitado. */
function EscolherProdutoDoPasso({ valor, produtos, onEscolher, onDaLista, onFechar }: { valor: string; produtos: ProdutoDaBancada[]; onEscolher: (v: string) => void; onDaLista: (i: ItemDaLista) => void; onFechar: () => void }) {
  const [texto, setTexto] = useState(produtos.some((p) => p.id === valor) ? "" : valor);
  const [lista, setLista] = useState<ItemDaLista[] | null>(null);
  useEffect(() => {
    if (lista || texto.trim().length < 2) return;
    let vivo = true;
    void carregarCatalogoCabelo().then((l) => { if (vivo) setLista(l.map(itemDoCabelo)); });
    return () => { vivo = false; };
  }, [texto, lista]);
  const achados = lista ? buscarNaLista(lista, texto, 5) : [];
  return (
    <div className="px-3 pb-3 pt-1 space-y-2" data-testid="produto-do-passo-cabelo">
      {produtos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {produtos.map((p) => (
            <ChipAlterna key={p.id} ativo={valor === p.id} onClick={() => { onEscolher(p.id); onFechar(); }}>
              {rotuloDoProduto(p)}
            </ChipAlterna>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={produtos.length ? "busque na lista ou digite" : "Qual produto? (busque ou digite)"}
          aria-label="Produto usado"
          className="h-10 rounded-full px-4 text-[13px] bg-bz-cartao border-bz-linha-forte"
          onKeyDown={(e) => { if (e.key === "Enter") { onEscolher(texto); onFechar(); } }}
        />
        <button type="button" onClick={() => { onEscolher(texto); onFechar(); }} className={BOTAO_PILULA}>OK</button>
      </div>
      {achados.length > 0 && (
        <div className="rounded-2xl border border-bz-linha overflow-hidden divide-y divide-bz-linha" data-testid="achados-cabelo">
          {achados.map((i) => (
            <button key={i.id} type="button" onClick={() => { onDaLista(i); onFechar(); }} className="w-full text-left px-3 py-2 min-h-[44px] flex items-center gap-2 bg-bz-cartao active:bg-bz-blush/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold tracking-[.12em] uppercase text-bz-suave truncate">{i.marca}</span>
                <span className="block text-[12.5px] font-semibold text-bz-tinta line-clamp-2">{i.nome}</span>
              </span>
              <Chip tom="blush" className="shrink-0">{i.rotulo}</Chip>
            </button>
          ))}
        </div>
      )}
      {!produtos.length && <p className="text-[11.5px] text-bz-suave">O que você escolher da lista entra em MEUS PRODUTOS › Cabelo.</p>}
    </div>
  );
}

/** A lavagem de um dia: faixa da etapa, passos, extras, resultado, nota e o FEITO. */
function FolhaDaLavagem({ c, dia, lavagem, etapa }: { c: Cabelo; dia: string; lavagem: LavagemCapilar | null; etapa: Etapa }) {
  const [produtosBrutos, setProdutos] = useChaveDaBeleza<ProdutoDaBancada[]>("beauty-products", []);
  const cabelo = (Array.isArray(produtosBrutos) ? produtosBrutos : []).filter((p) => p && !p.finished && p.category === "Cabelo");
  /** Da lista de cabelo: entra em MEUS PRODUTOS (se ainda não está) e vira o produto do passo. */
  const daLista = (passo: string, i: ItemDaLista) => {
    const ja = cabelo.find((p) => (p as ProdutoDaBancada & { catalogoId?: string }).catalogoId === i.id);
    const id = ja?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);
    if (!ja) setProdutos((prev) => [...(Array.isArray(prev) ? prev : []), produtoDaLista(i, id)]);
    c.mudarProduto(dia, passo, id);
  };
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const feita = !!lavagem?.feita;
  const etapaAtual = (lavagem?.etapa as Etapa | null) ?? etapa;
  const passos = passosDaLavagem(etapaAtual);
  const marcados = lavagem?.passos ?? [];
  const nomeDoProduto = (v: string) => rotuloDoProduto(cabelo.find((p) => p.id === v) ?? null) || v;
  const posicao = c.estado ? `${Math.min(c.estado.feitasNoCiclo + (feita ? 0 : 1), c.plano?.sequencia.length ?? 0)}/${c.plano?.sequencia.length ?? 0}` : "";
  const rEspera = !lavagem && c.estado && c.plano && c.estado.fila[0] === "reconstrucao" && etapa !== "reconstrucao";

  return (
    <div data-testid="lavagem-do-dia">
      {/* a etapa, na cor dela */}
      <div className={cn(TOM_DA_ETAPA[etapaAtual], "flex items-center gap-2 pl-2.5 pr-2 min-h-[52px]")} data-testid="faixa-etapa">
        <LetraDaEtapa etapa={etapaAtual} feita={feita} className="bg-bz-cartao/85" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold tracking-[.12em] leading-tight">{ETAPAS[etapaAtual].rotulo}</p>
          <p className="text-[11px] font-semibold opacity-80 leading-tight truncate">{feita ? "feita ✓" : "etapa da vez"}{posicao ? ` · ${posicao}` : ""}</p>
        </div>
        {!feita && (
          <div className="flex gap-0.5 shrink-0" role="group" aria-label="Trocar a etapa">
            {ORDEM_ETAPAS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => c.mudarEtapa(dia, e)}
                aria-pressed={etapaAtual === e}
                aria-label={`Etapa: ${ETAPAS[e].rotulo.toLowerCase()}`}
                className={cn("w-10 h-10 rounded-full grid place-items-center text-[12px] font-extrabold transition-colors", etapaAtual === e ? "bg-bz-cartao/90" : "bg-transparent opacity-60")}
              >
                {ETAPAS[e].letra}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="px-4 py-2 text-[12px] leading-snug text-bz-dica-tinta bg-bz-dica border-t border-bz-dica-borda/60" data-testid="dica-da-etapa">
        {rEspera && c.estado?.ultimaR
          ? `A reconstrução espera: a última foi em ${diaMes(c.estado.ultimaR)} (no mínimo 15 dias entre uma e outra). `
          : ""}
        {ETAPAS[etapaAtual].dica}
      </p>

      {/* ORDEM | ETAPA | FEITO */}
      {passos.map((p, k) => {
        const produto = lavagem?.produtos?.[p.id];
        const ok = marcados.includes(p.id);
        return (
          <div key={p.id} className="border-t border-bz-linha" data-testid="passo-cabelo">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_3.25rem] min-h-[54px]">
              <div className="grid place-items-center" aria-hidden="true">
                <span className={cn("w-6 h-6 rounded-full grid place-items-center text-[11.5px] font-bold tabular-nums", ok ? "bg-bz-blush text-bz-suave" : TOM_DA_ETAPA[etapaAtual])}>{k + 1}</span>
              </div>
              <div className="min-w-0 flex flex-col justify-center py-1.5 pr-2">
                <span className={cn("text-[14.5px] leading-snug", ok ? "line-through text-bz-suave font-medium" : "font-semibold text-bz-tinta")}>{p.rotulo}</span>
                {produto ? (
                  <button type="button" onClick={() => setAbrindo(abrindo === p.id ? null : p.id)} className="self-start text-left text-[12px] text-bz-suave truncate max-w-full bg-transparent" data-testid="produto-usado">
                    {nomeDoProduto(produto)}
                  </button>
                ) : (
                  <button type="button" onClick={() => setAbrindo(abrindo === p.id ? null : p.id)} className="self-start -ml-1 px-1.5 min-h-[28px] inline-flex items-center gap-1 rounded-full bg-transparent text-[12px] font-semibold text-bz-acento active:bg-bz-blush">
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> produto usado
                  </button>
                )}
              </div>
              <div className="grid place-items-center">
                <Marcar marcado={ok} onClick={() => c.alternarPasso(dia, p.id)} rotulo={`Marcar ${p.rotulo}`} />
              </div>
            </div>
            {abrindo === p.id && (
              <EscolherProdutoDoPasso valor={produto ?? ""} produtos={cabelo} onEscolher={(v) => c.mudarProduto(dia, p.id, v)} onDaLista={(i) => daLista(p.id, i)} onFechar={() => setAbrindo(null)} />
            )}
          </div>
        );
      })}

      <div className="px-4 py-3 border-t border-bz-linha space-y-3">
        <div>
          <p className={ROTULO_BZ}>Extras desta lavagem</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EXTRAS.map((x) => (
              <ChipAlterna key={x.id} ativo={!!lavagem?.extras.includes(x.id)} onClick={() => c.alternarExtra(dia, x.id)} testId={`extra-${x.id}`}>{x.rotulo}</ChipAlterna>
            ))}
          </div>
        </div>
        <div>
          <p className={ROTULO_BZ}>Como ficou</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {HAIR_RESULT_TAGS.map((t) => (
              <ChipAlterna key={t.id} ativo={!!lavagem?.tags.includes(t.id)} onClick={() => c.alternarTag(dia, t.id)} testId={`tag-${t.id}`}>{t.emoji} {t.label}</ChipAlterna>
            ))}
          </div>
        </div>
        <Input
          value={lavagem?.nota ?? ""}
          onChange={(e) => c.mudarNota(dia, e.target.value)}
          placeholder="Nota (ex.: deixei a máscara 20 min)"
          aria-label="Nota da lavagem"
          className="h-10 rounded-full px-4 text-[13px] bg-bz-cartao border-bz-linha-forte"
        />
      </div>

      <div className="px-4 pb-4 pt-1">
        {feita ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tom="ok" className="text-[12px] leading-[26px] px-3"><Check className="w-3.5 h-3.5" aria-hidden="true" /> {ETAPAS[etapaAtual].rotulo} feita</Chip>
            {c.proxima && <span className="text-[12px] text-bz-suave" data-testid="proxima-depois">próxima: {diaSemanaCurto(c.proxima.dia)} · {ETAPAS[c.proxima.etapa].rotulo}</span>}
            <button type="button" onClick={() => c.reabrir(dia)} className="ml-auto h-10 px-3 rounded-full bg-transparent text-[12px] font-semibold text-bz-suave">Desfazer</button>
          </div>
        ) : (
          <button type="button" onClick={() => c.concluir(dia, etapaAtual)} className={cn(BOTAO_PILULA, "w-full h-11")} data-testid="lavagem-feita">
            FEITO · {ETAPAS[etapaAtual].rotulo}
          </button>
        )}
      </div>
    </div>
  );
}

/** "Lavei fora do plano": registra sem mexer na fila. */
function FormForaDoPlano({ onSalvar, onCancelar }: { onSalvar: (d: { etapa: Etapa | null; tags: string[]; nota: string }) => void; onCancelar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  return (
    <div className="px-4 py-3 border-t border-bz-linha space-y-3 bg-bz-papel" data-testid="form-fora-do-plano">
      <p className="text-[12.5px] text-bz-tinta">Registra a lavagem <b>sem pular</b> a etapa da vez.</p>
      <div>
        <p className={ROTULO_BZ}>Fez alguma etapa?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <ChipAlterna ativo={etapa === null} onClick={() => setEtapa(null)}>Só lavei</ChipAlterna>
          {ORDEM_ETAPAS.map((e) => <ChipAlterna key={e} ativo={etapa === e} onClick={() => setEtapa(e)}>{ETAPAS[e].rotulo.toLowerCase()}</ChipAlterna>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {HAIR_RESULT_TAGS.map((t) => (
          <ChipAlterna key={t.id} ativo={tags.includes(t.id)} onClick={() => setTags((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))}>{t.emoji} {t.label}</ChipAlterna>
        ))}
      </div>
      <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota da lavagem fora do plano" className="h-10 rounded-full px-4 text-[13px] bg-bz-cartao border-bz-linha-forte" />
      <div className="flex gap-2">
        <button type="button" onClick={() => onSalvar({ etapa, tags, nota })} className={cn(BOTAO_PILULA, "flex-1")} data-testid="salvar-fora">Registrar</button>
        <button type="button" onClick={onCancelar} className="h-10 px-4 rounded-full bg-transparent text-[13px] font-semibold text-bz-suave">Cancelar</button>
      </div>
    </div>
  );
}

export function CabeloDeHoje({ c, dia, onDia }: { c: Cabelo; dia: string; onDia: (dia: string) => void }) {
  const [forcar, setForcar] = useState<string | null>(null);
  const [fora, setFora] = useState(false);
  // OUTRO DIA é escolha da pessoa (o dia pode até ser ontem); o MEU MÊS também manda dia antigo pra cá
  const [outro, setOutro] = useState(dia !== c.hoje && dia !== c.ontem);
  useEffect(() => { if (dia !== c.hoje && dia !== c.ontem) setOutro(true); }, [dia, c.hoje, c.ontem]);
  const qual = outro ? "outro" : dia === c.hoje ? "hoje" : "ontem";
  const lavagem = c.doDia(dia);
  const foraDoDia = c.lavagens.filter((l) => l.data === dia && !l.noPlano);
  const etapa = (lavagem?.etapa as Etapa | null) ?? c.etapaNoDia(dia);
  const diaDeLavar = c.ehDiaDeLavar(dia);
  const mostraFolha = !!lavagem || diaDeLavar || forcar === dia;
  const titulo = qual === "hoje" ? "de hoje" : qual === "ontem" ? "de ontem" : `do dia ${diaMes(dia)}`;
  const status = lavagem?.feita
    ? `${ETAPAS[etapa].rotulo} feita`
    : diaDeLavar || lavagem
      ? `Dia de ${ETAPAS[etapa].rotulo}`
      : c.proxima
        ? `Não é dia de lavar · próxima: ${diaSemanaCurto(c.proxima.dia)} · ${ETAPAS[c.proxima.etapa].rotulo}`
        : "Não é dia de lavar";

  return (
    <CartaoBeleza className={TEMA_BELEZA} data-card="cabelo-de-hoje" data-testid="cabelo-de-hoje">
      <div className="bg-bz-rose text-bz-rose-tinta px-4 pt-3 pb-3">
        <p className="text-[11px] font-extrabold tracking-[.16em] opacity-80">{nomeDoDia(dia)} · {diaCurto(dia)}</p>
        <h3 className="mt-0.5 text-[length:clamp(18px,5.4vw,21px)] leading-[1.1] font-bold tracking-tight">
          Cabelo <Serif className="text-[length:clamp(21px,6.4vw,25px)] font-normal">{titulo}</Serif>
        </h3>
        <p className="mt-1 text-[12px] font-semibold opacity-85" data-testid="status-cabelo">{status}</p>
        <div className="mt-2.5 flex rounded-full bg-bz-cartao/55 p-0.5" role="group" aria-label="Qual dia marcar">
          {(["hoje", "ontem", "outro"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setFora(false);
                setOutro(q === "outro");
                if (q === "hoje") onDia(c.hoje);
                else if (q === "ontem") onDia(c.ontem);
                else if (!outro) onDia(somarDias(c.hoje, -2));
              }}
              aria-pressed={qual === q}
              className={cn("flex-1 h-10 rounded-full text-[11px] font-extrabold tracking-[.1em] transition-colors", qual === q ? "bg-bz-cartao text-bz-rose-tinta shadow-[0_2px_8px_-4px_hsl(var(--bz-sombra)/0.5)]" : "bg-transparent text-bz-rose-tinta/75")}
            >
              {q === "hoje" ? "HOJE" : q === "ontem" ? "ONTEM" : "OUTRO DIA"}
            </button>
          ))}
        </div>
        {qual === "outro" && (
          <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold">
            Dia:
            <input
              type="date"
              value={dia}
              max={c.hoje}
              onChange={(e) => { if (e.target.value && e.target.value <= c.hoje) onDia(e.target.value); }}
              className="h-10 px-3 rounded-full border border-bz-linha-forte bg-bz-cartao text-bz-tinta text-[13px] font-bold"
              aria-label="Escolher o dia da lavagem"
              data-testid="outro-dia"
            />
          </label>
        )}
      </div>

      {mostraFolha ? (
        <FolhaDaLavagem c={c} dia={dia} lavagem={lavagem} etapa={etapa} />
      ) : (
        <div className="px-4 py-3 border-t border-bz-linha space-y-2.5" data-testid="nao-e-dia">
          <p className="text-[13.5px] text-bz-tinta">
            {qual === "hoje" ? "Hoje não é dia de lavar." : "Nesse dia não teve lavagem do cronograma."}
            {c.proxima && <> A próxima é <b>{diaSemanaCurto(c.proxima.dia)}, {diaMes(c.proxima.dia)}</b>: <b>{ETAPAS[c.proxima.etapa].rotulo.toLowerCase()}</b>.</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setForcar(dia)} className={BOTAO_CONTORNO} data-testid="lavar-mesmo-assim">
              {qual === "hoje" ? "Lavar hoje mesmo" : "Lavei nesse dia"} · {ETAPAS[c.etapaNoDia(dia)].rotulo.toLowerCase()}
            </button>
            <button type="button" onClick={() => setFora(true)} className="h-10 px-3 rounded-full bg-transparent text-[13px] font-semibold text-bz-suave" data-testid="lavei-fora">
              Lavei fora do plano
            </button>
          </div>
        </div>
      )}

      {fora && (
        <FormForaDoPlano
          onSalvar={(d) => { c.registrarFora(dia, d); setFora(false); }}
          onCancelar={() => setFora(false)}
        />
      )}

      {foraDoDia.length > 0 && (
        <div className="border-t border-bz-linha" data-testid="fora-do-dia">
          {foraDoDia.map((l) => (
            <div key={l.id} className="px-4 py-2 flex items-center gap-2 text-[12.5px] text-bz-suave">
              <span className="w-2 h-2 rounded-full bg-bz-base shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Fora do plano{l.etapa ? ` · ${ETAPAS[l.etapa].rotulo.toLowerCase()}` : ""}{l.nota ? ` · ${l.nota}` : ""}</span>
              <button type="button" onClick={() => c.apagarLavagem(l.id)} aria-label="Apagar lavagem fora do plano" className="w-10 h-10 grid place-items-center rounded-full bg-transparent text-bz-suave">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {mostraFolha && !lavagem?.feita && !fora && (
        <button type="button" onClick={() => setFora(true)} className="w-full h-11 border-t border-bz-linha bg-transparent text-[12.5px] font-semibold text-bz-suave active:bg-bz-blush" data-testid="lavei-fora">
          Lavei fora do plano (não conta na etapa)
        </button>
      )}
    </CartaoBeleza>
  );
}
