/**
 * SKINCARE DE HOJE — a folha do dia da rotina de pele, a MESMA peça na Rotina da
 * Beleza e no card da Home.
 *
 * Visual da Beleza (28/09, o dono recusou a versão "Treino azul"): cabeçalho
 * rosé com o dia em miúdo e "Skincare de hoje" com acento em serifa; MANHÃ em
 * pêssego com sol, NOITE em malva com lua (a dimensão natural da beleza, no
 * lugar da cor do dia da semana do Treino); linhas com fio fino só na
 * horizontal, a ordem de aplicação numa bolinha da cor do período e o
 * quadradinho magenta à direita. Kit em ./kit.
 *
 * Só aparecem os passos do DIA (a agenda por passo); os que ficam de fora vão no
 * rodapé ("hoje não: …"). HOJE | ONTEM: esqueceu de marcar ontem, marca ontem.
 */
import { useState, type ReactNode } from "react";
import { Bell, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  diaDaSemanaDaChave, diasPorExtenso, ehTodoDia, nomeCurto, passosDoDia, passosForaDoDia, ritmoDoPasso, rotuloDoProduto,
  type PassoDaRotina, type Periodo,
} from "@/lib/beleza-rotina";
import { DIAS_DA_SEMANA } from "@/components/treino/planner";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import { CartaoBeleza, Chip, FaixaDoPeriodo, Marcar, Serif, TEMA_BELEZA } from "./kit";
import type { Skincare } from "./use-skincare";

export const nomeDoDia = (dia: string) => DIAS_DA_SEMANA[diaDaSemanaDaChave(dia)];

/* a ordem cai embaixo do ícone da faixa e o nome do passo, embaixo de "manhã"/"noite" */
const COLUNAS = "grid grid-cols-[3rem_minmax(0,1fr)_3.25rem]";

/** Uma linha: a ordem numa bolinha da cor do período, o passo (+ produto) e o quadradinho. Linha fina só na horizontal. */
function LinhaDoPasso({
  n, periodo, passo, produto, feito, obrigatorio, onMarcar, onAbrir, onEscolher, rotuloAbrir,
}: {
  n: number;
  periodo: Periodo;
  passo: PassoDaRotina;
  produto: string;
  feito: boolean;
  obrigatorio: boolean;
  onMarcar: () => void;
  onAbrir: () => void;
  onEscolher?: () => void;
  rotuloAbrir: string;
}) {
  const manha = periodo === "manha";
  return (
    <div className={cn("group", COLUNAS, "min-h-[54px] border-t border-bz-linha")} data-testid="passo-skincare">
      <div className="grid place-items-center" aria-hidden="true">
        <span
          className={cn(
            "w-6 h-6 rounded-full grid place-items-center text-[11.5px] font-bold tabular-nums transition-colors",
            feito ? "bg-bz-blush text-bz-suave" : manha ? "bg-bz-manha text-bz-manha-tinta" : "bg-bz-noite text-bz-noite-tinta",
          )}
        >
          {n}
        </span>
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <button type="button" onClick={onAbrir} className="min-w-0 text-left pl-0.5 pr-2 pt-2 pb-1 rounded-lg active:bg-bz-blush/60 transition-colors" aria-label={rotuloAbrir}>
          <span className="flex items-start gap-1.5 min-w-0">
            <span className={cn("min-w-0 break-words text-[14.5px] leading-snug", feito ? "line-through text-bz-suave font-medium" : "font-semibold text-bz-tinta")}>
              {passo.name}
            </span>
            {!ehTodoDia(passo) && (
              <Chip tom={periodo === "manha" ? "manha" : "noite"} className="mt-px tabular-nums">{ritmoDoPasso(passo)}</Chip>
            )}
            {obrigatorio && <Chip tom="alerta" className="mt-px text-[9.5px] tracking-wide">OBRIGATÓRIO</Chip>}
          </span>
          {produto && <span className="mt-0.5 block truncate text-[12px] text-bz-suave" data-testid="produto-do-passo">{produto}</span>}
        </button>
        {!produto && onEscolher && (
          <button
            type="button"
            onClick={onEscolher}
            className="self-start -mt-0.5 mb-1 -ml-1 px-1.5 min-h-[28px] inline-flex items-center gap-1 rounded-full bg-transparent text-[12px] font-semibold text-bz-acento active:bg-bz-blush"
            data-testid="escolher-produto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> escolher produto
          </button>
        )}
        {!produto && !onEscolher && <span className="pb-1.5" />}
      </div>
      <div className="grid place-items-center">
        <Marcar marcado={feito} onClick={onMarcar} rotulo={`Marcar ${passo.name}`} />
      </div>
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
    <CartaoBeleza className={TEMA_BELEZA} data-card="skincare-de-hoje" data-testid={testId}>
      {/* o dia num cabeçalho rosé delicado — o dia em miúdo, "Skincare de hoje" com acento em serifa */}
      <div className="bg-bz-rose text-bz-rose-tinta px-4 pt-3 pb-3.5">
        {/* celular estreito (360): o título encolhe um pouco; ainda mais estreito, o HOJE | ONTEM desce */}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-[.16em] opacity-80">{nome} · {diaCurto(dia)}</p>
            <h3 className="mt-0.5 text-[length:clamp(18px,5.4vw,21px)] leading-[1.1] font-bold tracking-tight whitespace-nowrap">
              Skincare <Serif className="text-[length:clamp(21px,6.4vw,25px)] font-normal">{qual === "hoje" ? "de hoje" : "de ontem"}</Serif>
            </h3>
            <p className="mt-1 text-[12px] font-semibold opacity-85">
              <b className="tabular-nums" data-testid="contagem-skincare">{feitos}/{total}</b> {qual === "hoje" ? "feitos hoje" : "feitos ontem"}
            </p>
          </div>
          <div className="ml-auto shrink-0 flex rounded-full bg-bz-cartao/55 p-0.5" role="group" aria-label="Qual dia marcar">
            {(["hoje", "ontem"] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQual(q)}
                aria-pressed={qual === q}
                className={cn(
                  "h-10 px-3 rounded-full text-[11px] font-extrabold tracking-[.1em] transition-colors",
                  qual === q ? "bg-bz-cartao text-bz-rose-tinta shadow-[0_2px_8px_-4px_hsl(var(--bz-sombra)/0.5)]" : "bg-transparent text-bz-rose-tinta/75",
                )}
              >
                {q === "hoje" ? "HOJE" : "ONTEM"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2.5 h-1.5 rounded-full bg-bz-cartao/70 overflow-hidden" aria-hidden="true">
          <span className="block h-full rounded-full bg-bz-acento transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {periodos.map(({ periodo, visiveis, escondidos, feitos: marcados, nFeitos, fora }) => {
        const lembrete = s.lembrete[periodo];
        const extra =
          periodo === "noite"
            ? sensivel && escondidos
              ? "sem ativos"
              : ativosDaNoite.length
                ? `de ${ativosDaNoite.join(" e ")}`
                : rotinaTemAtivo && visiveis.length
                  ? "de descanso"
                  : undefined
            : undefined;
        // protetor pendente e o resto da manhã feito: o recado de sempre
        const idxProtetor = periodo === "manha" ? visiveis.find(({ passo }) => passo.isSunscreen)?.i ?? -1 : -1;
        const faltaSoProtetor =
          idxProtetor >= 0 && !marcados.includes(idxProtetor) && visiveis.length > 1 && visiveis.every(({ i }) => i === idxProtetor || marcados.includes(i));
        return (
          <div key={periodo} data-testid={`periodo-${periodo}`}>
            <FaixaDoPeriodo
              periodo={periodo}
              extra={extra}
              testId={`faixa-${periodo}`}
              direita={
                <>
                  {lembrete.ligado && (
                    <span className="inline-flex items-center gap-0.5 font-semibold" title="Lembrete">
                      <Bell className="w-3 h-3" aria-hidden="true" /> {lembrete.hora}
                    </span>
                  )}
                  <span>{nFeitos}/{visiveis.length}</span>
                </>
              }
            />
            {visiveis.map(({ passo, i }, k) => (
              <LinhaDoPasso
                key={i}
                n={k + 1}
                periodo={periodo}
                passo={passo}
                produto={rotuloDoProduto(s.produtoDe(passo))}
                feito={marcados.includes(i)}
                obrigatorio={!!passo.isSunscreen && !marcados.includes(i) && periodo === "manha"}
                onMarcar={() => s.alternar(periodo, i, dia)}
                onAbrir={() => onAbrirPasso(periodo, i)}
                onEscolher={modo === "modulo" && onEscolherProduto ? () => onEscolherProduto(periodo, i) : undefined}
                rotuloAbrir={modo === "home" ? `Abrir Beleza: ${passo.name}` : `Abrir ${passo.name}`}
              />
            ))}
            {visiveis.length === 0 && (
              <p className="px-4 py-3 border-t border-bz-linha text-[12.5px] text-bz-suave italic">
                {modo === "modulo" && qual === "hoje"
                  ? periodo === "manha" ? "Adicione seus passos de skincare matinal abaixo" : "Adicione seus passos de skincare noturno abaixo"
                  : "Nada neste período."}
              </p>
            )}
            {faltaSoProtetor && (
              <p className="px-4 py-2 border-t border-bz-linha text-[12px] font-semibold bg-bz-alerta text-bz-alerta-tinta">
                ☀️ Aplique o Protetor Solar para concluir a rotina!
              </p>
            )}
            {periodo === "noite" && sensivel && escondidos > 0 && (
              <p className="px-4 py-2 border-t border-bz-linha text-[12px] font-medium text-bz-alerta-tinta">
                🍅 Modo sensível — apenas hidratação e calmantes
              </p>
            )}
            {fora.length > 0 && (
              <p className="px-4 py-2 border-t border-bz-linha text-[12px] text-bz-suave" data-testid={`fora-${periodo}`}>
                {`${qual === "hoje" ? "Hoje" : "Ontem"} não: ${fora.map(({ passo }) => `${nomeCurto(passo.name)} (${diasPorExtenso(passo)})`).join(", ")}`}
              </p>
            )}
            {modo === "modulo" && qual === "hoje" && (
              <div className="flex gap-2 px-3 py-2.5 border-t border-bz-linha bg-bz-blush/45">
                <Input
                  placeholder={periodo === "manha" ? "Novo passo (ex.: Tônico)" : "Novo passo (ex.: Demaquilante)"}
                  value={novo[periodo]}
                  onChange={(e) => setNovo((n) => ({ ...n, [periodo]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") adicionar(periodo); }}
                  aria-label={periodo === "manha" ? "Novo passo da manhã" : "Novo passo da noite"}
                  className="h-10 rounded-full px-4 text-[13px] bg-bz-cartao border-bz-linha-forte"
                />
                <Button
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0 rounded-full"
                  onClick={() => adicionar(periodo)}
                  aria-label={periodo === "manha" ? "Adicionar passo da manhã" : "Adicionar passo da noite"}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {rodape}
    </CartaoBeleza>
  );
}
