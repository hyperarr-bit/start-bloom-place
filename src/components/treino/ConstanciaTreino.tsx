/**
 * CONSTÂNCIA NOVA (26/09, mockup p7 — o dono recusou o mapa de calor copiado
 * da Rotina). Três peças:
 *  (a) META: N TREINOS POR SEMANA — 12 colunas, um quadradinho por treino,
 *      ✓ nas semanas que bateram; a sequência é de SEMANAS na meta;
 *  (b) o MÊS com cabeçalho nas cores dos dias e um CARIMBO por dia treinado
 *      com o grupo muscular (toque no dia = o que foi feito);
 *  (c) post-it quando um grupo do plano está há ≥ 10 dias sem treino.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Target, X } from "lucide-react";
import { cn, parseLocalDay } from "@/lib/utils";
import {
  CARIMBOS,
  mesCarimbado,
  nomeDoMes,
  type FonteDosTreinos,
  type GrupoEsquecido,
  type SemanaDaMeta,
} from "@/lib/treino-constancia";
import { seriesDaEntrada, textoDaUltimaVez, type EntradaDoHistorico } from "@/lib/treino-series";
import { COR_DO_DIA, DIAS_DA_SEMANA, PostIt, textoDoDia, tomDoDia } from "./planner";

const DIA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function ConstanciaTreino({
  meta,
  onMeta,
  semanas,
  sequencia,
  hoje,
  hojeNome,
  log,
  fonte,
  notas,
  esquecido,
}: {
  meta: number;
  onMeta: (n: number) => void;
  semanas: SemanaDaMeta[];
  sequencia: number;
  hoje: string;
  hojeNome: string;
  log: string[];
  fonte: FonteDosTreinos;
  notas: Record<string, string>;
  esquecido: GrupoEsquecido | null;
}) {
  const [editandoMeta, setEditandoMeta] = useState(false);
  const agora = parseLocalDay(hoje);
  const [visto, setVisto] = useState({ ano: agora.getFullYear(), mes: agora.getMonth() });
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const noMesAtual = visto.ano === agora.getFullYear() && visto.mes === agora.getMonth();
  const mes = useMemo(() => mesCarimbado(visto.ano, visto.mes, log, fonte, hoje), [visto, log, fonte, hoje]);
  const altura = Math.max(meta, 1, ...semanas.map((s) => s.treinos));
  const horas = mes.minutos / 60;
  const tomHoje = tomDoDia(hojeNome);

  const irPara = (delta: number) => {
    setSelecionado(null);
    setVisto((v) => {
      const d = new Date(v.ano, v.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  };

  const doDia = selecionado ? (fonte.historico as EntradaDoHistorico[]).filter((h) => h?.date === selecionado) : [];
  const metaDoDia = selecionado ? fonte.sessoes?.[selecionado] : undefined;
  const dSel = selecionado ? parseLocalDay(selecionado) : null;

  return (
    <>
      {/* (a) meta semanal */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card" data-testid="meta-semanal">
        <div className="min-h-[48px] px-4 py-2 flex items-center gap-2 text-white bg-gradient-to-r from-blue-500 to-indigo-500">
          <Target className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          <h2 className="text-[13.5px] font-extrabold tracking-wide min-w-0">
            META: {meta} TREINO{meta === 1 ? "" : "S"} POR SEMANA
          </h2>
          <button
            type="button"
            onClick={() => setEditandoMeta((e) => !e)}
            className="ml-auto shrink-0 h-9 px-2 text-[12px] font-bold opacity-90 underline-offset-2 hover:underline"
            aria-expanded={editandoMeta}
          >
            {editandoMeta ? "pronto" : "editar"}
          </button>
        </div>
        {editandoMeta && (
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 bg-muted/40">
            <button type="button" onClick={() => onMeta(Math.max(1, meta - 1))} disabled={meta <= 1} aria-label="Menos um treino na meta" className="w-9 h-9 rounded-lg border border-border bg-card grid place-items-center disabled:opacity-40">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-[22px] font-extrabold tabular-nums w-6 text-center" data-testid="meta-valor">{meta}</span>
            <button type="button" onClick={() => onMeta(Math.min(7, meta + 1))} disabled={meta >= 7} aria-label="Mais um treino na meta" className="w-9 h-9 rounded-lg border border-border bg-card grid place-items-center disabled:opacity-40">
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-[12.5px] text-muted-foreground leading-snug">treinos por semana — a sequência passa a contar por essa meta</span>
          </div>
        )}
        <div className="px-4 pt-3 pb-3">
          {sequencia > 0 ? (
            <p className="flex items-baseline gap-2">
              <span className="text-[26px] font-extrabold tabular-nums">🔥 {sequencia}</span>
              <span className="text-[14px] font-bold">semana{sequencia === 1 ? "" : "s"} seguida{sequencia === 1 ? "" : "s"} na meta</span>
            </p>
          ) : (
            <p className="text-[14px] font-bold">Feche esta semana com {meta} treino{meta === 1 ? "" : "s"} pra começar a sequência.</p>
          )}
          <p className="text-[12px] text-muted-foreground mt-0.5">Descanso não quebra a sequência — o que conta é fechar a semana.</p>
          <div className="mt-3 grid gap-[6px] items-end" style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
            {semanas.map((s) => (
              <div
                key={s.inicio}
                className="flex flex-col-reverse gap-[3px]"
                role="img"
                aria-label={`Semana de ${s.rotulo}: ${s.treinos} treino${s.treinos === 1 ? "" : "s"}${s.bateu ? ", meta batida" : ""}`}
                data-testid={`semana-meta-${s.rotulo}`}
              >
                {Array.from({ length: altura }, (_, k) => {
                  if (k < s.treinos) return <i key={k} className={cn("marca-grafico block h-[13px] rounded-[3px]", s.bateu ? "bg-green-500" : "bg-blue-300")} />;
                  if (k < meta) return <i key={k} className={cn("block h-[13px] rounded-[3px] border-[1.5px]", s.atual ? "border-blue-500" : "border-border")} />;
                  return <i key={k} className="block h-[13px]" />;
                })}
                <span className="text-center text-[12px] h-4 leading-4 font-extrabold text-green-600">{s.bateu ? "✓" : ""}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-[6px] mt-1.5 text-[9.5px] font-bold text-muted-foreground text-center tabular-nums" style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
            {semanas.map((s) => (
              <span key={s.inicio} className={cn("truncate", s.atual && "text-blue-600")}>{s.rotulo}</span>
            ))}
          </div>
        </div>
      </div>

      {/* (b) o mês carimbado */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card" data-testid="mes-carimbado">
        <div className="bg-foreground text-background dark:bg-muted dark:text-foreground min-h-[44px] pl-2 pr-4 flex items-center gap-1">
          <button type="button" onClick={() => irPara(-1)} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10" aria-label="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-[13px] font-extrabold tracking-wide uppercase">
            {nomeDoMes(visto.mes)}{visto.ano !== agora.getFullYear() ? ` ${visto.ano}` : ""}
          </h2>
          <button type="button" onClick={() => irPara(1)} disabled={noMesAtual} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30" aria-label="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-auto text-[12px] opacity-75 tabular-nums">
            {mes.treinos} treino{mes.treinos === 1 ? "" : "s"}
            {horas > 0 && ` · ${horas >= 10 ? Math.round(horas) : horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`}
          </span>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-extrabold">
          {DIAS_DA_SEMANA.map((d) => (
            <div key={d} className={cn(COR_DO_DIA[d], textoDoDia(d), "py-1.5")}>{d === "SÁBADO" ? "SÁB" : d.slice(0, 3)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
          {Array.from({ length: mes.vazioAntes }, (_, i) => (
            <div key={`vazio-${i}`} className="h-[46px] border-b border-r border-border/60 bg-muted/40" />
          ))}
          {mes.dias.map((x) => {
            const tom = tomDoDia(DIAS_DA_SEMANA[x.coluna]);
            const cls = cn(
              "relative h-[46px] border-b border-r border-border/60",
              x.hoje && cn("ring-2 ring-inset", tomHoje.anel),
              selecionado === x.data && "bg-muted",
            );
            const conteudo = (
              <>
                <span className={cn("absolute left-1 top-0.5 text-[9.5px] font-bold tabular-nums", x.futuro ? "text-muted-foreground/40" : "text-muted-foreground")}>{x.dia}</span>
                {x.carimbo && (
                  <span className={cn("absolute inset-0 m-auto w-8 h-8 rounded-full grid place-items-center text-[16px] ring-2 ring-inset", tom.carimbo, tom.anel)} aria-hidden="true">
                    {x.carimbo.emoji}
                  </span>
                )}
              </>
            );
            return x.treinou ? (
              <button
                key={x.data}
                type="button"
                onClick={() => setSelecionado(selecionado === x.data ? null : x.data)}
                className={cls}
                aria-label={`Dia ${x.dia}: treinou${x.carimbo && x.carimbo.grupo !== "outro" ? ` (${CARIMBOS[x.carimbo.grupo].rotulo})` : ""}. Ver o treino`}
                data-testid={`dia-${x.data}`}
              >
                {conteudo}
              </button>
            ) : (
              <div key={x.data} className={cls} data-testid={`dia-${x.data}`}>{conteudo}</div>
            );
          })}
        </div>

        {selecionado && dSel && (
          <div className="px-4 py-3 border-b border-border bg-muted/30" data-testid="dia-selecionado">
            <div className="flex items-center gap-2">
              <p className="text-[12.5px] font-extrabold tracking-wide">
                {DIA_CURTO[dSel.getDay()]}, {String(dSel.getDate()).padStart(2, "0")}/{String(dSel.getMonth() + 1).padStart(2, "0")}
                {metaDoDia?.minutos ? <span className="font-semibold text-muted-foreground"> · {metaDoDia.minutos} min</span> : null}
              </p>
              <button type="button" onClick={() => setSelecionado(null)} className="ml-auto w-9 h-9 grid place-items-center rounded-md hover:bg-muted" aria-label="Fechar o dia">
                <X className="w-4 h-4" />
              </button>
            </div>
            {doDia.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground mt-1">Treino marcado sem as séries.</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {doDia.map((h, i) => {
                  const s = seriesDaEntrada(h);
                  const detalhe = h.tipo === "cardio"
                    ? [h.duracao ? `${h.duracao} min` : "", h.distancia ?? ""].filter(Boolean).join(" · ") || "cardio"
                    : s.length ? textoDaUltimaVez(s) : "";
                  return (
                    <li key={`${h.exercise}-${i}`} className="text-[12.5px] flex gap-2">
                      <span className="font-semibold min-w-0 truncate">{h.exercise}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{detalhe}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {notas[selecionado] && <p className="mt-1.5 text-[12px] text-amber-700">📝 {notas[selecionado]}</p>}
          </div>
        )}

        <div className="px-4 py-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {mes.grupos.map((g) => (
            <span key={g}>{CARIMBOS[g].emoji} {CARIMBOS[g].rotulo}</span>
          ))}
          <span className="ml-auto">{mes.treinos > 0 ? "toque num dia pra ver o treino" : "cada treino concluído ganha um carimbo"}</span>
        </div>
      </div>

      {/* (c) grupo esquecido */}
      {esquecido && (
        <PostIt testId="postit-esquecido">
          Faz <b>{esquecido.dias} dias</b> sem {esquecido.regiao === "cardio" ? "fazer" : "treinar"} <b>{esquecido.nome}</b>. {esquecido.pergunta}
        </PostIt>
      )}
    </>
  );
}
