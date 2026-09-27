/**
 * 📋 PLANO (27/09, pedido do dono: "a parte mais importante — configurar o
 * treino e os exercícios — não faz sentido ser esse botãozinho de
 * configuração; tem que ser uma aba de verdade").
 *
 * Tudo o que o ⚙️ (modelos, dias de treino, grupos, descanso, som) e o editor
 * do dia (exercícios, séries × reps × carga, força/cardio, anotação, remover
 * com Desfazer, copiar pra outros dias) faziam, num lugar só e à vista:
 *  1. MEU PLANO DA SEMANA — os 7 dias como o cabeçalho do mês (faixa na cor do
 *     dia), com o carimbo do grupo em cada um; tocar escolhe o dia. A meta da
 *     semana mora no rodapé dele.
 *  2. O DIA escolhido — faixa na cor dele e a TABELA com grade (EXERCÍCIO |
 *     SÉRIES | REPS | CARGA) editável na própria célula; tocar no nome abre
 *     renomear / mover / força ou cardio / anotação / remover. Sugestões por
 *     grupo muscular adicionam num toque.
 *  3. DESCANSO ENTRE SÉRIES e o bipe.
 *  4. MODELOS PRONTOS — no topo quando o plano está vazio (é o jeito mais
 *     rápido de começar), no fim quando já existe plano.
 * Estado todo na página (Treino.tsx): aqui só tem o que é da tela (painel
 * aberto, texto digitado).
 */
import { Fragment, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Minus, Plus, Target, Timer, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ExercicioDoPlano } from "@/lib/treino-series";
import { carimboDoPlano } from "@/lib/treino-constancia";
import {
  EMOJI_DO_MUSCULO,
  GRUPOS_MUSCULARES,
  MODELOS,
  sugestoesDoDia,
  tipoPeloNome,
  type DiaDoPlano,
  type ModeloDeTreino,
} from "@/lib/treino-plano";
import { COR_DO_DIA, DIAS_DA_SEMANA, corDoChip, textoDoDia, tomDoDia } from "./planner";

export interface AcoesDoPlano {
  escolherDia: (dia: string) => void;
  ativo: (dia: string, ativo: boolean) => void;
  musculo: (dia: string, musculo: string) => void;
  exercicio: (dia: string, indice: number, mudanca: Partial<ExercicioDoPlano>) => void;
  adicionar: (dia: string, nome: string, extra?: Partial<ExercicioDoPlano>) => void;
  remover: (dia: string, indice: number) => void;
  mover: (dia: string, de: number, para: number) => void;
  copiar: (dia: string, destinos: string[]) => void;
  modelo: (m: ModeloDeTreino) => void;
  meta: (n: number) => void;
  descanso: (segundos: number) => void;
  som: (ligado: boolean) => void;
}

export interface PropsDoPlano {
  hojeNome: string;
  /** dia do plano aberto */
  dia: string;
  plano: Record<string, DiaDoPlano | undefined>;
  diasAtivos: string[];
  /** nenhum grupo nem exercício em dia nenhum */
  vazio: boolean;
  meta: number;
  descanso: number;
  som: boolean;
  acoes: AcoesDoPlano;
}

const curto = (d: string) => (d === "SÁBADO" ? "SÁB" : d.slice(0, 3));
const nEx = (n: number) => `${n} exercício${n === 1 ? "" : "s"}`;
const tituloDoDia = (dia: string, pd: DiaDoPlano, descanso: boolean) =>
  pd.muscles.length ? pd.muscles.join(" + ") : descanso ? "Descanso" : pd.exercises.length ? `Treino de ${dia.toLowerCase()}` : "Monte o treino do dia";
const rotulo = "text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground";

/* ---------------- 1. a semana ---------------- */

function SemanaDoPlano({ plano, diasAtivos, hojeNome, dia, meta, acoes }: Pick<PropsDoPlano, "plano" | "diasAtivos" | "hojeNome" | "dia" | "meta" | "acoes">) {
  const diasDeTreino = DIAS_DA_SEMANA.filter((d) => diasAtivos.includes(d) || (plano[d]?.exercises.length ?? 0) > 0).length;
  return (
    <section className="rounded-2xl border border-blue-100 overflow-hidden bg-card" data-testid="plano-semana">
      <div className="bg-blue-50 px-4 min-h-[44px] flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold tracking-wide text-blue-900">MEU PLANO DA SEMANA</h2>
        <span className="ml-auto text-[12px] font-bold text-blue-900 tabular-nums whitespace-nowrap">
          {diasDeTreino} dia{diasDeTreino === 1 ? "" : "s"} de treino
        </span>
      </div>
      <div className="grid grid-cols-7 border-t border-blue-100">
        {DIAS_DA_SEMANA.map((d) => {
          const pd = plano[d] ?? { muscles: [], exercises: [] };
          const n = pd.exercises.length;
          const ativo = diasAtivos.includes(d);
          const descanso = !ativo && n === 0;
          const vazio = !descanso && n === 0 && pd.muscles.length === 0;
          const carimbo = carimboDoPlano(pd).emoji;
          const eHoje = d === hojeNome;
          const sel = d === dia;
          const tom = tomDoDia(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => acoes.escolherDia(d)}
              aria-pressed={sel}
              aria-label={`${d.charAt(0)}${d.slice(1).toLowerCase()}${eHoje ? " (hoje)" : ""}: ${descanso ? "descanso" : `${tituloDoDia(d, pd, false)}${n ? `, ${nEx(n)}` : ""}`}`}
              data-testid={`plano-dia-${d}`}
              className="flex flex-col min-w-0 border-r border-border/60 last:border-r-0 active:scale-[.97] transition-transform"
            >
              <span className={cn(COR_DO_DIA[d], textoDoDia(d), "py-1.5 text-[10px] font-extrabold tracking-wide text-center")}>{curto(d)}</span>
              <span
                className={cn(
                  "h-[58px] flex flex-col items-center justify-center gap-1",
                  sel ? cn(tom.claro, "ring-2 ring-inset", tom.anel) : descanso && "bg-muted/40",
                )}
              >
                {vazio ? (
                  <Plus className="w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
                ) : (
                  <span className="text-[18px] leading-none" aria-hidden="true">{descanso ? "😴" : carimbo === "✓" ? "🏋️" : carimbo}</span>
                )}
                <span
                  className={cn(
                    "text-[10px] leading-none tabular-nums",
                    eHoje ? cn("font-extrabold", tom.forte) : "font-semibold text-muted-foreground",
                  )}
                >
                  {eHoje ? "hoje" : descanso ? "folga" : n ? `${n} ex.` : "montar"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-4 pt-2.5 pb-2 border-t border-blue-100" data-testid="plano-meta">
        <div className="flex items-center gap-2.5">
          <Target className="w-[18px] h-[18px] text-blue-600 shrink-0 max-[379px]:hidden" aria-hidden="true" />
          <p className="min-w-0 text-[12px] font-extrabold tracking-[.06em] text-blue-900 whitespace-nowrap">META DA SEMANA</p>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => acoes.meta(Math.max(1, meta - 1))}
              disabled={meta <= 1}
              aria-label="Menos um treino na meta"
              className="w-9 h-9 rounded-lg border border-border bg-card grid place-items-center disabled:opacity-40"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center leading-none">
              <span className="block text-[20px] font-extrabold tabular-nums" data-testid="plano-meta-valor">{meta}</span>
              <span className="block text-[10px] font-semibold text-muted-foreground mt-0.5">treino{meta === 1 ? "" : "s"}</span>
            </span>
            <button
              type="button"
              onClick={() => acoes.meta(Math.min(7, meta + 1))}
              disabled={meta >= 7}
              aria-label="Mais um treino na meta"
              className="w-9 h-9 rounded-lg border border-border bg-card grid place-items-center disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11.5px] text-muted-foreground leading-snug">Treinos por semana — a sequência 🔥 conta as semanas que batem a meta.</p>
      </div>
    </section>
  );
}

/* ---------------- 2. o dia ---------------- */

const celula =
  "w-full h-10 rounded-md bg-transparent text-center text-[14.5px] font-bold tabular-nums text-foreground outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-ring placeholder:font-normal placeholder:text-muted-foreground";

function OpcoesDoExercicio({
  ex,
  i,
  total,
  onMudar,
  onMover,
  onRemover,
  onFechar,
}: {
  ex: ExercicioDoPlano;
  i: number;
  total: number;
  onMudar: (m: Partial<ExercicioDoPlano>) => void;
  onMover: (para: number) => void;
  onRemover: () => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(ex.name);
  const cardio = ex.tipo === "cardio";
  const salvarNome = () => {
    const n = nome.trim();
    if (n && n !== ex.name) onMudar({ name: n });
    else setNome(ex.name);
  };
  const botaoTipo = (ligado: boolean) =>
    cn("h-9 px-3 text-[12.5px] font-semibold transition-colors", ligado ? "bg-foreground text-background" : "bg-card text-foreground/80");
  return (
    <div className="space-y-2.5" data-testid={`plano-opcoes-${i}`}>
      <label className="block">
        <span className={rotulo}>NOME</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={salvarNome}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          aria-label={`Nome de ${ex.name}`}
          className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-[14px] font-semibold outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <div className="flex items-center gap-2">
        <div role="group" aria-label={`Tipo de ${ex.name}`} className="inline-flex rounded-lg border border-border overflow-hidden">
          <button type="button" aria-pressed={!cardio} onClick={() => { if (cardio) onMudar({ tipo: undefined }); }} className={botaoTipo(!cardio)}>
            🏋️ Força
          </button>
          <button type="button" aria-pressed={cardio} onClick={() => { if (!cardio) onMudar({ tipo: "cardio" }); }} className={cn(botaoTipo(cardio), "border-l border-border")}>
            🏃 Cardio
          </button>
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => onMover(i - 1)}
            disabled={i === 0}
            aria-label={`Subir ${ex.name}`}
            className="w-10 h-9 rounded-lg border border-border bg-card grid place-items-center disabled:opacity-30"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover(i + 1)}
            disabled={i >= total - 1}
            aria-label={`Descer ${ex.name}`}
            className="w-10 h-9 rounded-lg border border-border bg-card grid place-items-center disabled:opacity-30"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>
      <input
        value={ex.obs}
        onChange={(e) => onMudar({ obs: e.target.value })}
        placeholder="💬 Anotação: banco, pegada, dor…"
        aria-label={`Anotação de ${ex.name}`}
        className="w-full h-10 rounded-md border border-amber-200 bg-amber-50 px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${ex.name}`}
          className="h-9 px-3 rounded-lg bg-red-50 text-red-600 text-[12.5px] font-bold inline-flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          Remover
        </button>
        <button type="button" onClick={onFechar} className="ml-auto h-9 px-4 rounded-lg bg-foreground text-background text-[12.5px] font-bold">
          Pronto
        </button>
      </div>
    </div>
  );
}

function CartaoDoDia({ dia, hojeNome, pd, ativo, acoes }: { dia: string; hojeNome: string; pd: DiaDoPlano; ativo: boolean; acoes: AcoesDoPlano }) {
  const exs = pd.exercises;
  const ms = pd.muscles;
  const [novo, setNovo] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [gruposAbertos, setGruposAbertos] = useState(() => ms.length === 0 && exs.length === 0);
  const [copiando, setCopiando] = useState(false);
  const [destinos, setDestinos] = useState<string[]>([]);
  const tom = tomDoDia(dia);
  const descanso = !ativo && exs.length === 0;
  const outros = DIAS_DA_SEMANA.filter((x) => x !== dia);
  const sugestoes = descanso ? [] : sugestoesDoDia(ms, exs.map((e) => e.name), exs.length ? 4 : 6);
  const soCardio = exs.length > 0 && exs.every((e) => e.tipo === "cardio");
  const linha = cn("border-b", tom.linha);

  const adicionar = () => {
    const n = novo.trim();
    if (!n) return;
    const tipo = tipoPeloNome(n);
    acoes.adicionar(dia, n, tipo ? { tipo } : undefined);
    setNovo("");
  };

  return (
    <section className="rounded-2xl border border-border overflow-hidden bg-card" data-testid="plano-do-dia">
      {/* faixa do dia: a cor do dia da semana, igual no app todo */}
      <div className={cn(COR_DO_DIA[dia], textoDoDia(dia), "px-4 py-3 flex items-center gap-2")}>
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold tracking-wide">
            {dia}
            {dia === hojeNome ? " · HOJE" : ""}
          </h2>
          <p className="text-[12.5px] opacity-90 leading-snug">
            {tituloDoDia(dia, pd, descanso)}
            {!descanso && exs.length > 0 && ` · ${nEx(exs.length)}`}
          </p>
        </div>
        {/* COPIAR PRA OUTROS DIAS (22/09, chamado: "senti a falta de ter como
            copiar para outro dia da semana igual tem na dieta") */}
        {(exs.length > 0 || ms.length > 0) && (
          <button
            type="button"
            onClick={() => { setCopiando((c) => !c); setDestinos([]); }}
            className="ml-auto shrink-0 h-9 px-2.5 rounded-lg bg-white/20 inline-flex items-center gap-1 text-[12px] font-bold"
            aria-label={`Copiar treino de ${dia} para outros dias`}
            aria-expanded={copiando}
            data-testid={`copiar-treino-${dia}`}
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copiar
          </button>
        )}
      </div>

      {copiando && (
        <div className="px-4 py-3 bg-muted/50 border-b border-border space-y-2" data-testid="painel-copiar-treino">
          <div className="flex items-center">
            <p className={rotulo}>COPIAR {dia} PARA</p>
            <button type="button" onClick={() => setCopiando(false)} className="ml-auto w-8 h-8 grid place-items-center rounded-md hover:bg-muted" aria-label="Fechar o copiar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer min-h-[32px]">
            <Checkbox checked={destinos.length === outros.length} onCheckedChange={(v) => setDestinos(v ? outros : [])} />
            Todos
          </label>
          <div className="grid grid-cols-2 gap-1">
            {outros.map((x) => (
              <label key={x} className="flex items-center gap-2 text-[12.5px] cursor-pointer min-h-[32px]">
                <Checkbox checked={destinos.includes(x)} onCheckedChange={(v) => setDestinos((p) => (v ? [...p, x] : p.filter((y) => y !== x)))} />
                {x}
              </label>
            ))}
          </div>
          <p className="text-[11.5px] text-muted-foreground">Os dias marcados ficam com os grupos e os exercícios de {dia.toLowerCase()} — o que eles tinham sai (dá pra desfazer).</p>
          <button
            type="button"
            disabled={!destinos.length}
            onClick={() => { acoes.copiar(dia, destinos); setCopiando(false); setDestinos([]); }}
            className="w-full h-10 rounded-lg bg-foreground text-background text-[13px] font-bold disabled:opacity-40"
          >
            Copiar ({destinos.length})
          </button>
        </div>
      )}

      {descanso ? (
        <p className="px-4 pt-4 pb-1 text-[13.5px] leading-snug">
          😴 Dia de descanso. Descanso não quebra a sequência — o que conta é fechar a semana.
        </p>
      ) : (
        <>
          {/* grupos musculares: o título do dia e as sugestões saem daqui */}
          <div className={cn("px-4 py-2", linha)} data-testid="plano-grupos">
            <div className="flex items-center gap-2 min-h-[36px]">
              <span className={cn(rotulo, "shrink-0")}>GRUPOS</span>
              {!gruposAbertos && (
                ms.length ? (
                  <span className="flex flex-wrap gap-1 min-w-0">
                    {ms.map((m) => (
                      <span key={m} className={cn("px-2 py-0.5 rounded-md text-[12px] font-semibold", tom.carimbo, tom.titulo)}>{m}</span>
                    ))}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-muted-foreground">nenhum marcado</span>
                )
              )}
              <button
                type="button"
                onClick={() => setGruposAbertos((v) => !v)}
                aria-expanded={gruposAbertos}
                className="ml-auto shrink-0 h-9 px-1.5 text-[12.5px] font-bold underline underline-offset-2"
              >
                {gruposAbertos ? "pronto" : ms.length ? "mudar" : "escolher"}
              </button>
            </div>
            {gruposAbertos && (
              <div className="pb-1.5 flex flex-wrap gap-1.5">
                {GRUPOS_MUSCULARES.map((m) => {
                  const sel = ms.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => acoes.musculo(dia, m)}
                      aria-pressed={sel}
                      className={cn(
                        "h-9 px-2.5 rounded-md text-[12.5px] border transition",
                        sel ? cn(tom.botao, "border-transparent font-semibold") : "border-border text-muted-foreground bg-card",
                      )}
                    >
                      {EMOJI_DO_MUSCULO[m] ?? "💪"} {m}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* a ficha do dia: tabela com grade, escrita na própria célula */}
          <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" data-testid="plano-exercicios">
            <colgroup>
              <col className="w-[28px]" />
              <col />
              <col className="w-[50px]" />
              <col className="w-[50px]" />
              <col className="w-[66px]" />
            </colgroup>
            <thead>
              <tr className={cn("h-8 text-[10px] tracking-[.08em]", tom.claro, tom.titulo)}>
                <th className={cn(linha, "border-r font-extrabold")}>#</th>
                <th className={cn(linha, "border-r font-extrabold text-left pl-2")}>EXERCÍCIO</th>
                {soCardio ? (
                  <>
                    <th colSpan={2} className={cn(linha, "border-r font-extrabold")}>TEMPO</th>
                    <th className={cn(linha, "font-extrabold")}>DIST.</th>
                  </>
                ) : (
                  <>
                    <th className={cn(linha, "border-r font-extrabold")}>SÉRIES</th>
                    <th className={cn(linha, "border-r font-extrabold")}>REPS</th>
                    <th className={cn(linha, "font-extrabold")}>CARGA</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {exs.length === 0 && (
                <tr>
                  <td colSpan={5} className={cn(linha, "px-4 py-4 text-center text-[12.5px] text-muted-foreground")}>
                    Nenhum exercício ainda — escreva abaixo ou toque numa sugestão.
                  </td>
                </tr>
              )}
              {exs.map((ex, i) => {
                const cardio = ex.tipo === "cardio";
                const estaAberto = aberto === i;
                return (
                  // chave pela posição: renomear não remonta a linha (nem as opções abertas)
                  <Fragment key={i}>
                    <tr className="h-[52px]" data-testid={`plano-exercicio-${i}`}>
                      <td className={cn(linha, "border-r text-center text-[11px] font-bold text-muted-foreground tabular-nums")}>{i + 1}</td>
                      <td className={cn(linha, "border-r pl-1.5 pr-1 py-1.5")}>
                        <button
                          type="button"
                          onClick={() => setAberto(estaAberto ? null : i)}
                          aria-expanded={estaAberto}
                          aria-label={`Opções de ${ex.name}`}
                          className="w-full min-w-0 flex items-center gap-0.5 text-left min-h-[36px]"
                        >
                          {/* o nome inteiro, em até duas linhas (no HOJE o chip corta; aqui é onde se lê a ficha) */}
                          <span className={cn("min-w-0 rounded-md px-2 py-0.5 text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]", corDoChip(i))}>{ex.name}</span>
                          <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform", estaAberto && "rotate-180")} aria-hidden="true" />
                        </button>
                        {ex.obs && !estaAberto && <p className="mt-0.5 pl-1 text-[11px] text-amber-700 truncate">💬 {ex.obs}</p>}
                      </td>
                      {cardio ? (
                        <>
                          {/* cardio: o tempo ocupa SÉRIES + REPS, a distância fica na CARGA */}
                          <td colSpan={2} className={cn(linha, "border-r px-0.5")}>
                            <span className="flex items-center justify-center gap-0.5 pr-1">
                              <span className="text-[13px] shrink-0" aria-hidden="true">🏃</span>
                              <input
                                value={ex.duracao ?? ""}
                                onChange={(e) => acoes.exercicio(dia, i, { duracao: e.target.value })}
                                placeholder="—"
                                inputMode="decimal"
                                aria-label={`Minutos de ${ex.name}`}
                                className={cn(celula, "w-11")}
                              />
                              <span className="text-[12px] font-semibold text-muted-foreground shrink-0">min</span>
                            </span>
                          </td>
                          <td className={cn(linha, "px-0.5")}>
                            <input
                              value={ex.distancia ?? ""}
                              onChange={(e) => acoes.exercicio(dia, i, { distancia: e.target.value })}
                              placeholder="km"
                              aria-label={`Distância de ${ex.name}`}
                              className={cn(celula, "text-[13px]")}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={cn(linha, "border-r px-0.5")}>
                            <input value={ex.sets} onChange={(e) => acoes.exercicio(dia, i, { sets: e.target.value })} placeholder="—" inputMode="numeric" aria-label={`Séries de ${ex.name}`} className={celula} />
                          </td>
                          <td className={cn(linha, "border-r px-0.5")}>
                            <input value={ex.reps} onChange={(e) => acoes.exercicio(dia, i, { reps: e.target.value })} placeholder="—" aria-label={`Repetições de ${ex.name}`} className={celula} />
                          </td>
                          <td className={cn(linha, "px-0.5")}>
                            <input value={ex.carga} onChange={(e) => acoes.exercicio(dia, i, { carga: e.target.value })} placeholder="kg" inputMode="decimal" aria-label={`Carga de ${ex.name}`} className={cn(celula, "text-[13.5px]")} />
                          </td>
                        </>
                      )}
                    </tr>
                    {estaAberto && (
                      <tr>
                        <td colSpan={5} className={cn(linha, "px-3 py-3 bg-muted/40")}>
                          <OpcoesDoExercicio
                            ex={ex}
                            i={i}
                            total={exs.length}
                            onMudar={(m) => acoes.exercicio(dia, i, m)}
                            onMover={(para) => { acoes.mover(dia, i, para); setAberto(para); }}
                            onRemover={() => { setAberto(null); acoes.remover(dia, i); }}
                            onFechar={() => setAberto(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <form
            onSubmit={(e) => { e.preventDefault(); adicionar(); }}
            className={cn("flex items-center gap-2 pl-3.5 pr-2 py-1.5", linha)}
          >
            <Plus className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder={exs.length ? "Novo exercício..." : "Ex.: Supino reto"}
              aria-label={`Novo exercício de ${dia.toLowerCase()}`}
              className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!novo.trim()}
              aria-label="Adicionar exercício"
              className={cn(
                "w-10 h-10 shrink-0 rounded-lg grid place-items-center active:scale-95 transition",
                novo.trim() ? "bg-foreground text-background" : "border border-border text-muted-foreground",
              )}
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {sugestoes.length > 0 && (
            <div className={cn("px-3.5 pt-2.5 pb-3", linha)} data-testid="plano-sugestoes">
              <p className={rotulo}>SUGESTÕES · UM TOQUE ADICIONA</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugestoes.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => acoes.adicionar(dia, s.name, { sets: s.sets, reps: s.reps, ...(s.tipo ? { tipo: s.tipo, duracao: s.duracao ?? "" } : {}) })}
                    aria-label={`Adicionar ${s.name}`}
                    className="h-9 pl-1.5 pr-2.5 rounded-md border border-dashed border-border bg-card text-[12.5px] font-semibold text-foreground/85 inline-flex items-center gap-1 active:scale-95 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {exs.length > 0 && (
            <p className="px-4 pt-2.5 text-[11.5px] leading-snug text-muted-foreground">
              Toque no nome do exercício pra renomear, mudar de ordem, virar cardio ou remover.
            </p>
          )}
        </>
      )}

      <label className="px-4 py-2.5 flex items-center justify-between gap-3 min-h-[52px] cursor-pointer" data-testid="plano-dia-de-treino">
        <span>
          <span className="block text-[13.5px] font-semibold">Dia de treino</span>
          <span className="block text-[11.5px] text-muted-foreground">
            {ativo ? "Conta na sua semana e na meta" : exs.length ? `Desligado — os ${nEx(exs.length)} ficam guardados` : "Desligado = descanso"}
          </span>
        </span>
        <Switch checked={ativo} onCheckedChange={(v) => acoes.ativo(dia, v)} aria-label={`${dia} é dia de treino`} />
      </label>
    </section>
  );
}

/* ---------------- 3. descanso ---------------- */

function DescansoEntreSeries({ descanso, som, acoes }: { descanso: number; som: boolean; acoes: AcoesDoPlano }) {
  return (
    <section className="rounded-2xl border border-border overflow-hidden bg-card" data-testid="plano-descanso">
      <div className="min-h-[44px] px-4 py-2 flex items-center gap-2 bg-muted/60 border-b border-border">
        <Timer className="w-4 h-4 shrink-0" aria-hidden="true" />
        <h2 className="text-[13px] font-extrabold tracking-wide">DESCANSO ENTRE SÉRIES</h2>
      </div>
      <div className="px-4 pt-3 pb-1">
        <p className="text-[12px] text-muted-foreground leading-snug">Começa sozinho quando você marca uma série no HOJE.</p>
        <div className="mt-2.5 grid grid-cols-5 gap-1.5">
          {[30, 45, 60, 90, 120].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => acoes.descanso(t)}
              aria-pressed={descanso === t}
              className={cn(
                "h-10 rounded-lg border text-[13px] font-bold tabular-nums transition-colors",
                descanso === t ? "bg-foreground text-background border-foreground" : "border-border bg-card",
              )}
            >
              {t === 120 ? "2 min" : `${t}s`}
            </button>
          ))}
        </div>
        <label className="mt-1.5 flex items-center justify-between gap-3 min-h-[52px] cursor-pointer">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
            {som ? <Volume2 className="w-4 h-4 text-blue-600" aria-hidden="true" /> : <VolumeX className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
            Bipe no fim do descanso
          </span>
          <Switch checked={som} onCheckedChange={(v) => acoes.som(v)} aria-label="Bipe no fim do descanso" />
        </label>
      </div>
    </section>
  );
}

/* ---------------- 4. modelos ---------------- */

function ModelosProntos({ vazio, acoes }: { vazio: boolean; acoes: AcoesDoPlano }) {
  return (
    <section className="rounded-2xl border border-amber-200 overflow-hidden bg-card scroll-mt-36" data-testid="modelos-prontos">
      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200">
        <h2 className="text-[13px] font-extrabold tracking-wide text-amber-900">{vazio ? "COMECE COM UM MODELO PRONTO" : "MODELOS PRONTOS"}</h2>
        <p className="mt-0.5 text-[11.5px] leading-snug text-amber-900">
          {vazio
            ? "Um toque monta a semana com 5 exercícios por dia. Séries, repetições e carga você ajusta depois."
            : "Troca os grupos de cada dia. Dia que já tem exercício fica com os seus; dia vazio ganha os do modelo."}
        </p>
      </div>
      <ul>
        {MODELOS.map((m, i) => (
          <li key={m.name} className={cn("px-4 py-3", i > 0 && "border-t border-amber-200")} data-testid={`modelo-${m.name}`}>
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-bold leading-snug">
                  <span aria-hidden="true">{m.emoji} </span>
                  {m.name}
                </p>
                <p className="text-[11.5px] text-muted-foreground leading-snug">{m.descricao}</p>
              </div>
              <button
                type="button"
                onClick={() => acoes.modelo(m)}
                aria-label={`Usar o modelo ${m.name}`}
                className="ml-auto shrink-0 h-9 px-3.5 rounded-lg bg-foreground text-background text-[12.5px] font-bold active:scale-95 transition"
              >
                Usar
              </button>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
              {DIAS_DA_SEMANA.map((d) => {
                const ms = m.plan[d] ?? [];
                const emoji = carimboDoPlano({ muscles: ms }).emoji;
                return (
                  <span
                    key={d}
                    className={cn(
                      "rounded-md text-center pt-1 pb-0.5 text-[9.5px] font-extrabold leading-none",
                      ms.length ? cn(COR_DO_DIA[d], textoDoDia(d)) : "bg-muted text-muted-foreground",
                    )}
                  >
                    {curto(d)}
                    <span className="block text-[13px] leading-[20px]">{ms.length ? (emoji === "✓" ? "🏋️" : emoji) : "😴"}</span>
                  </span>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TreinoPlano(p: PropsDoPlano) {
  const pd = p.plano[p.dia] ?? { muscles: [], exercises: [] };
  return (
    <div className="space-y-3.5" data-testid="treino-plano">
      {p.vazio && (
        <>
          <ModelosProntos vazio acoes={p.acoes} />
          <p className="text-center text-[12px] font-semibold text-muted-foreground">ou monte dia a dia 👇</p>
        </>
      )}
      <SemanaDoPlano plano={p.plano} diasAtivos={p.diasAtivos} hojeNome={p.hojeNome} dia={p.dia} meta={p.meta} acoes={p.acoes} />
      <CartaoDoDia key={p.dia} dia={p.dia} hojeNome={p.hojeNome} pd={pd} ativo={p.diasAtivos.includes(p.dia)} acoes={p.acoes} />
      <DescansoEntreSeries descanso={p.descanso} som={p.som} acoes={p.acoes} />
      {!p.vazio && <ModelosProntos vazio={false} acoes={p.acoes} />}
    </div>
  );
}
