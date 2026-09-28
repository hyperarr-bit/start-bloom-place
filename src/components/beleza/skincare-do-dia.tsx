/**
 * SKINCARE DE HOJE (28/09, protótipo) — a folha do dia da rotina de pele, a
 * MESMA peça na Rotina da Beleza e no card da Home.
 *
 * Cara de PLANNER (o dono recusou mockup genérico em 26/09): faixa na cor do
 * dia da semana, tabela com grade fina (ORDEM | PASSO | FEITO — a ordem é a de
 * aplicação), CAIXA ALTA nos títulos e o quadradinho de marcar. Manhã em verde e
 * noite em roxo, as cores que a Beleza já usava pros dois períodos.
 *
 * Só aparecem os passos do DIA (a agenda por passo: o ácido 3× por semana, o
 * protetor todo dia); os que ficam de fora vão no rodapé ("hoje não: …").
 * HOJE | ONTEM: esqueceu de marcar ontem, marca ontem — o check vai pro dia certo.
 */
import { useState, type ReactNode } from "react";
import { Bell, Plus, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  diaDaSemanaDaChave, diasPorExtenso, ehTodoDia, nomeCurto, passosDoDia, passosForaDoDia, ritmoDoPasso, rotuloDoProduto,
  type PassoDaRotina, type Periodo,
} from "@/lib/beleza-rotina";
import { COR_DO_DIA, DIAS_DA_SEMANA, Quadradinho, textoDoDia } from "@/components/treino/planner";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import type { Skincare } from "./use-skincare";

export type TomDoPeriodo = { claro: string; linha: string; titulo: string; chip: string; rotulo: string; emoji: string };

export const TOM_DO_PERIODO: Record<Periodo, TomDoPeriodo> = {
  manha: {
    claro: "bg-green-50", linha: "border-green-100", titulo: "text-green-900",
    chip: "bg-green-100 text-green-800", rotulo: "MANHÃ", emoji: "☀️",
  },
  noite: {
    claro: "bg-purple-50", linha: "border-purple-100", titulo: "text-purple-900",
    chip: "bg-purple-100 text-purple-800", rotulo: "NOITE", emoji: "🌙",
  },
};

export const nomeDoDia = (dia: string) => DIAS_DA_SEMANA[diaDaSemanaDaChave(dia)];

const COLUNAS = "grid grid-cols-[2.25rem_minmax(0,1fr)_3rem]";

/** Uma linha: ordem, passo (+ produto), quadradinho. */
function LinhaDoPasso({
  n, passo, produto, feito, tom, obrigatorio, onMarcar, onAbrir, onEscolher, rotuloAbrir,
}: {
  n: number;
  passo: PassoDaRotina;
  produto: string;
  feito: boolean;
  tom: TomDoPeriodo;
  obrigatorio: boolean;
  onMarcar: () => void;
  onAbrir: () => void;
  onEscolher?: () => void;
  rotuloAbrir: string;
}) {
  return (
    <div className={cn("group", COLUNAS, "min-h-[52px] border-t", tom.linha)} data-testid="passo-skincare">
      <div className={cn("border-r grid place-items-center text-[13px] font-bold tabular-nums text-muted-foreground", tom.linha)} aria-hidden="true">
        {n}
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <button type="button" onClick={onAbrir} className="min-w-0 text-left px-3 pt-2 pb-1 active:bg-muted/40 transition-colors" aria-label={rotuloAbrir}>
          <span className="flex items-start gap-1.5 min-w-0">
            <span className={cn("min-w-0 break-words text-[14px] leading-snug", feito ? "line-through text-muted-foreground font-medium" : "font-semibold")}>{passo.name}</span>
            {!ehTodoDia(passo) && (
              <span className={cn("shrink-0 mt-px rounded px-1.5 py-px text-[10px] font-bold tabular-nums", tom.chip)}>{ritmoDoPasso(passo)}</span>
            )}
            {obrigatorio && (
              <span className="shrink-0 mt-px rounded px-1.5 py-px text-[9.5px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">OBRIGATÓRIO</span>
            )}
          </span>
          {produto && <span className="mt-0.5 block truncate text-[12px] text-muted-foreground" data-testid="produto-do-passo">{produto}</span>}
        </button>
        {!produto && onEscolher && (
          <button
            type="button"
            onClick={onEscolher}
            className="self-start -mt-0.5 mb-1 ml-1.5 px-1.5 min-h-[28px] inline-flex items-center gap-1 rounded-md text-[12px] font-medium text-sky-700 dark:text-sky-300 active:bg-muted/40"
            data-testid="escolher-produto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> escolher produto
          </button>
        )}
        {!produto && !onEscolher && <span className="pb-1.5" />}
      </div>
      <div className={cn("border-l grid place-items-center", tom.linha)}>
        <Quadradinho comoCaixa marcado={feito} onClick={onMarcar} rotulo={`Marcar ${passo.name}`} />
      </div>
    </div>
  );
}

/** "☀️ MANHÃ · 🔔 07:30 ………… 2/4" */
function FaixaDoPeriodo({ periodo, tom, feitos, total, extra, hora }: { periodo: Periodo; tom: TomDoPeriodo; feitos: number; total: number; extra?: string; hora?: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 min-h-[36px] border-t", tom.claro, tom.titulo, tom.linha)} data-testid={`faixa-${periodo}`}>
      <span className="text-[11px] font-extrabold tracking-[.12em] whitespace-nowrap">{tom.emoji} {tom.rotulo}</span>
      {extra && <span className="min-w-0 truncate text-[11.5px] font-semibold opacity-80">· {extra}</span>}
      <span className="ml-auto flex items-center gap-2 shrink-0">
        {hora && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums" title="Lembrete">
            <Bell className="w-3 h-3" aria-hidden="true" /> {hora}
          </span>
        )}
        <span className="text-[11px] font-bold tabular-nums">{feitos}/{total}</span>
      </span>
    </div>
  );
}

export function FolhaDoSkincare({
  s,
  modo,
  onAbrirPasso,
  onEscolherProduto,
  rodape,
  testId = "skincare-do-dia",
}: {
  s: Skincare;
  modo: "modulo" | "home";
  onAbrirPasso: (periodo: Periodo, i: number) => void;
  onEscolherProduto?: (periodo: Periodo, i: number) => void;
  rodape?: ReactNode;
  testId?: string;
}) {
  const [qual, setQual] = useState<"hoje" | "ontem">("hoje");
  const [novo, setNovo] = useState<Record<Periodo, string>>({ manha: "", noite: "" });
  const dia = qual === "hoje" ? s.hoje : s.ontem;
  const nome = nomeDoDia(dia);
  const semana = diaDaSemanaDaChave(dia);
  const sensivel = s.checkins?.[dia] === "sensivel";

  const periodos = (["manha", "noite"] as const).map((periodo) => {
    const todos = passosDoDia(s.passos[periodo], semana);
    // pele sensível no dia: os ativos da NOITE saem (o comportamento de sempre)
    const visiveis = periodo === "noite" && sensivel ? todos.filter(({ passo }) => !passo.isAcid) : todos;
    const escondidos = todos.length - visiveis.length;
    const feitos = s.feitosDoDia(periodo, dia);
    const nFeitos = visiveis.filter(({ i }) => feitos.includes(i)).length;
    const fora = passosForaDoDia(s.passos[periodo], semana);
    return { periodo, visiveis, escondidos, feitos, nFeitos, fora };
  });
  const total = periodos.reduce((t, p) => t + p.visiveis.length, 0);
  const feitos = periodos.reduce((t, p) => t + p.nFeitos, 0);
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  const ativosDaNoite = periodos[1].visiveis.filter(({ passo }) => passo.isAcid && !ehTodoDia(passo)).map(({ passo }) => nomeCurto(passo.name));
  const rotinaTemAtivo = s.passos.noite.some((p) => p?.isAcid && !ehTodoDia(p));

  const adicionar = (periodo: Periodo) => {
    s.adicionarPasso(periodo, novo[periodo]);
    setNovo((n) => ({ ...n, [periodo]: "" }));
  };

  return (
    <section
      className={cn("bg-card rounded-2xl border overflow-hidden", modo === "home" ? "border-border/50 shadow-sm" : "border-border")}
      data-card="skincare-de-hoje"
      data-testid={testId}
    >
      {/* faixa do dia: a cor do dia da semana, igual no app todo */}
      <div className={cn(COR_DO_DIA[nome], textoDoDia(nome), "px-4 pt-2.5 pb-2.5")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-extrabold tracking-wide leading-tight">
              {nome} · {diaCurto(dia)}
            </h3>
            <p className="text-[12px] opacity-90 mt-0.5 inline-flex items-center gap-1 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {qual === "hoje" ? "Skincare de hoje" : "Marcando ontem"} · <b className="tabular-nums" data-testid="contagem-skincare">{feitos}/{total}</b>
            </p>
          </div>
          <div className="ml-auto shrink-0 flex rounded-lg bg-black/15 overflow-hidden" role="group" aria-label="Qual dia marcar">
            {(["hoje", "ontem"] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQual(q)}
                aria-pressed={qual === q}
                className={cn("h-10 px-3 text-[11.5px] font-extrabold tracking-wide transition-colors", qual === q ? "bg-white/25" : "opacity-75")}
              >
                {q === "hoje" ? "HOJE" : "ONTEM"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full relative overflow-hidden" aria-hidden="true">
          <span className="absolute inset-0 bg-current opacity-30" />
          <span className="relative block h-full rounded-full bg-current transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {periodos.map(({ periodo, visiveis, escondidos, feitos: marcados, nFeitos, fora }) => {
        const tom = TOM_DO_PERIODO[periodo];
        const lembrete = s.lembrete[periodo];
        const extra =
          periodo === "noite"
            ? sensivel && escondidos
              ? "sem ativos"
              : ativosDaNoite.length
                ? `noite de ${ativosDaNoite.join(" e ")}`
                : rotinaTemAtivo && visiveis.length
                  ? "noite de descanso"
                  : undefined
            : undefined;
        // protetor pendente e o resto da manhã feito: o recado de sempre
        const idxProtetor = periodo === "manha" ? visiveis.find(({ passo }) => passo.isSunscreen)?.i ?? -1 : -1;
        const faltaSoProtetor =
          idxProtetor >= 0 && !marcados.includes(idxProtetor) && visiveis.length > 1 && visiveis.every(({ i }) => i === idxProtetor || marcados.includes(i));
        return (
          <div key={periodo} data-testid={`periodo-${periodo}`}>
            <FaixaDoPeriodo periodo={periodo} tom={tom} feitos={nFeitos} total={visiveis.length} extra={extra} hora={lembrete.ligado ? lembrete.hora : undefined} />
            {visiveis.map(({ passo, i }, k) => {
              const feito = marcados.includes(i);
              return (
                <LinhaDoPasso
                  key={i}
                  n={k + 1}
                  passo={passo}
                  produto={rotuloDoProduto(s.produtoDe(passo))}
                  feito={feito}
                  tom={tom}
                  obrigatorio={!!passo.isSunscreen && !feito && periodo === "manha"}
                  onMarcar={() => s.alternar(periodo, i, dia)}
                  onAbrir={() => onAbrirPasso(periodo, i)}
                  onEscolher={modo === "modulo" && onEscolherProduto ? () => onEscolherProduto(periodo, i) : undefined}
                  rotuloAbrir={modo === "home" ? `Abrir Beleza: ${passo.name}` : `Abrir ${passo.name}`}
                />
              );
            })}
            {visiveis.length === 0 && (
              <p className={cn("px-3 py-2.5 border-t text-[12px] text-muted-foreground italic", tom.linha)}>
                {modo === "modulo" && qual === "hoje"
                  ? periodo === "manha" ? "Adicione seus passos de skincare matinal abaixo" : "Adicione seus passos de skincare noturno abaixo"
                  : "Nada neste período."}
              </p>
            )}
            {faltaSoProtetor && (
              <p className={cn("px-3 py-2 border-t text-[11.5px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20", tom.linha)}>
                ☀️ Aplique o Protetor Solar para concluir a rotina!
              </p>
            )}
            {periodo === "noite" && sensivel && escondidos > 0 && (
              <p className={cn("px-3 py-2 border-t text-[11.5px] font-medium text-red-600 dark:text-red-400", tom.linha)}>
                🍅 Modo sensível — apenas hidratação e calmantes
              </p>
            )}
            {fora.length > 0 && (
              <p className={cn("px-3 py-2 border-t text-[11.5px] text-muted-foreground", tom.linha)} data-testid={`fora-${periodo}`}>
                {`${qual === "hoje" ? "Hoje" : "Ontem"} não: ${fora.map(({ passo }) => `${nomeCurto(passo.name)} (${diasPorExtenso(passo)})`).join(", ")}`}
              </p>
            )}
            {modo === "modulo" && qual === "hoje" && (
              <div className={cn("flex gap-2 p-2.5 border-t", tom.claro, tom.linha)}>
                <Input
                  placeholder={periodo === "manha" ? "Novo passo (ex.: Tônico)" : "Novo passo (ex.: Demaquilante)"}
                  value={novo[periodo]}
                  onChange={(e) => setNovo((n) => ({ ...n, [periodo]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") adicionar(periodo); }}
                  aria-label={periodo === "manha" ? "Novo passo da manhã" : "Novo passo da noite"}
                  className="h-10 text-[13px] bg-card border-dashed"
                />
                <Button size="sm" className="h-10 w-10 p-0 shrink-0" onClick={() => adicionar(periodo)} aria-label={periodo === "manha" ? "Adicionar passo da manhã" : "Adicionar passo da noite"}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {rodape}
    </section>
  );
}
