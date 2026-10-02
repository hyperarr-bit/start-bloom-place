/**
 * TREINO DE ONTEM (02/10) — "como marcar um exercício feito ontem? esqueci de
 * marcar na hora". Um pé discreto no HOJE ("ESQUECEU? ONTEM · ANTEONTEM") abre
 * uma folha na cor do dia que passou, com o treino daquele dia da semana: as
 * séries começam COMO ESTAVAM PREVISTAS (a última vez, ou o alvo do plano), a
 * pessoa marca o que fez e ajusta carga/reps se foi diferente. A tela de hoje
 * não muda e a sessão de hoje não é tocada.
 *
 * As regras (o que grava, o que sai) moram em lib/treino-outro-dia; a página
 * grava, dentro do escopo do dia, pra a sequência anotar ONTEM e não hoje.
 */
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { diasRetroativos } from "@/lib/sequencia";
import { diaEmMiudo } from "@/hooks/use-marcar-ontem";
import { nomeDoDiaDaRotina } from "@/lib/rotina-habitos";
import { chavesDosExercicios, type EntradaDoHistorico, type ExercicioDoPlano, type SerieDaSessao } from "@/lib/treino-series";
import { seriesDoDiaPassado, treinouNoDia } from "@/lib/treino-outro-dia";
import { AvisoOutroDia, FolhaDeOutroDia, SeletorDeOutroDia } from "@/components/ontem/folha-de-outro-dia";
import { Chip, COR_DO_DIA, Quadradinho, tomDoDia } from "./planner";
import { TabelaDeSeries } from "./TabelaDeSeries";
import { alvoDaLinha } from "./TreinoHoje";

export type PlanoPorDia = Record<string, { muscles: string[]; exercises: ExercicioDoPlano[] } | undefined>;

export interface PedidoDeSalvar {
  dia: string;
  diaDoPlano: string;
  series: Record<string, SerieDaSessao[]>;
}

/** O pé do HOJE: dois botões, com ✓ no dia que já tem treino. */
export function PeDoEsqueceu({ hoje, log, onAbrir }: { hoje: string; log: unknown; onAbrir: (dia: string) => void }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2"
      data-testid="treino-esqueceu"
    >
      <span className="shrink-0 text-[10px] font-extrabold tracking-[.12em] text-blue-900">ESQUECEU?</span>
      {diasRetroativos(hoje).map((d) => {
        const treinou = treinouNoDia(log, d.dia);
        return (
          <button
            key={d.dia}
            type="button"
            onClick={() => onAbrir(d.dia)}
            data-testid={`treino-${d.rotulo}`}
            aria-label={`Marcar o treino de ${d.rotulo}, ${diaEmMiudo(d.dia)}${treinou ? " (já marcado)" : ""}`}
            className="h-10 px-2.5 rounded-lg border border-blue-200 bg-card text-[11px] font-extrabold tracking-[.08em] inline-flex items-center gap-1.5 active:scale-95 transition"
          >
            {d.rotulo.toUpperCase()}
            {treinou && <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function TreinoDeOntem({
  dia: diaAberto, hoje, plano, historico, onFechar, onTrocarDia, onSalvar, podeLimpar,
}: {
  /** o dia aberto na folha; null = fechada */
  dia: string | null;
  hoje: string;
  plano: PlanoPorDia;
  historico: Partial<EntradaDoHistorico>[];
  onFechar: () => void;
  onTrocarDia: (dia: string) => void;
  onSalvar: (p: PedidoDeSalvar) => void;
  /** o dia já tem treino gravado (salvar sem nada marcado desfaz) */
  podeLimpar: (dia: string) => boolean;
}) {
  // a folha fecha devagar: segue mostrando o último dia em vez de descer vazia
  const [ultimo, setUltimo] = useState<string>(diasRetroativos(hoje)[0].dia);
  const dia = diaAberto ?? ultimo;
  if (diaAberto && diaAberto !== ultimo) setUltimo(diaAberto);
  const rotulo = diasRetroativos(hoje).find((d) => d.dia === dia)?.rotulo ?? "ontem";
  const [semana, data] = diaEmMiudo(dia).split(" ");
  const nomeDoDia = nomeDoDiaDaRotina(dia);

  const comTreino = Object.keys(plano).filter((d) => (plano[d]?.exercises.length ?? 0) > 0);
  const [escolhido, setEscolhido] = useState<{ dia: string; plano: string } | null>(null);
  // por padrão, o treino do dia da semana daquela data; sem treino montado nele, o primeiro que existe
  const diaDoPlano = escolhido && escolhido.dia === dia && comTreino.includes(escolhido.plano)
    ? escolhido.plano
    : comTreino.includes(nomeDoDia) ? nomeDoDia : comTreino[0] ?? nomeDoDia;
  const exercicios = plano[diaDoPlano]?.exercises ?? [];
  const musculos = plano[diaDoPlano]?.muscles ?? [];

  return (
    <FolhaDeOutroDia
      aberta={diaAberto !== null}
      onFechar={onFechar}
      dia={dia}
      titulo={`${semana.toUpperCase()} · TREINO DE ${rotulo.toUpperCase()}`}
      sub={<>{musculos.length ? `${musculos.join(" + ")} · ` : ""}{data}</>}
      testId="folha-treino-ontem"
    >
      <div className="px-4 pt-4 space-y-3">
        <SeletorDeOutroDia hoje={hoje} atual={dia} onEscolher={onTrocarDia} />
        <AvisoOutroDia rotulo={rotulo} dia={dia}>Conta na sua sequência e na sua semana de treino.</AvisoOutroDia>
        {comTreino.length > 1 && (
          <div>
            <p className="text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground">QUAL TREINO FOI?</p>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5 scrollbar-hide" role="group" aria-label="Qual treino foi">
              {comTreino.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setEscolhido({ dia, plano: d })}
                  aria-pressed={d === diaDoPlano}
                  aria-label={`Treino de ${d.toLowerCase()}: ${(plano[d]?.muscles ?? []).join(" + ") || `${plano[d]?.exercises.length} exercícios`}`}
                  className={cn(
                    "h-10 shrink-0 pl-2 pr-3 rounded-lg border text-[12px] font-extrabold tracking-[.06em] inline-flex items-center gap-1.5 active:scale-95 transition",
                    d === diaDoPlano ? "border-foreground bg-card" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <i className={cn("w-1.5 h-5 rounded", COR_DO_DIA[d])} aria-hidden="true" />
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {exercicios.length === 0 ? (
        <p className="px-4 pt-4 pb-2 text-[13.5px] text-muted-foreground" data-testid="treino-ontem-vazio">
          Ainda não tem treino montado no seu plano. Monte na aba 📋 PLANO e volte aqui.
        </p>
      ) : (
        // remonta ao trocar de dia ou de treino: o rascunho de um não vaza pro outro
        <Rascunho
          key={`${dia}|${diaDoPlano}`}
          dia={dia}
          diaDoPlano={diaDoPlano}
          nomeDoDia={nomeDoDia}
          rotulo={rotulo}
          exercicios={exercicios}
          historico={historico}
          podeLimpar={podeLimpar(dia)}
          onSalvar={onSalvar}
        />
      )}
    </FolhaDeOutroDia>
  );
}

function Rascunho({
  dia, diaDoPlano, nomeDoDia, rotulo, exercicios, historico, podeLimpar, onSalvar,
}: {
  dia: string; diaDoPlano: string; nomeDoDia: string; rotulo: string; exercicios: ExercicioDoPlano[];
  historico: Partial<EntradaDoHistorico>[]; podeLimpar: boolean; onSalvar: (p: PedidoDeSalvar) => void;
}) {
  const tom = tomDoDia(nomeDoDia);
  const chaves = useMemo(() => chavesDosExercicios(exercicios), [exercicios]);
  const [series, setSeries] = useState(() => seriesDoDiaPassado({ exercicios, chaves, historico, dia }));
  const [aberto, setAberto] = useState<string | null>(null);
  const [ativa, setAtiva] = useState<Record<string, number | undefined>>({});

  const muda = (k: string, f: (l: SerieDaSessao[]) => SerieDaSessao[]) => setSeries((s) => ({ ...s, [k]: f((s[k] ?? []).map((x) => ({ ...x }))) }));
  const completo = (k: string) => (series[k] ?? []).length > 0 && (series[k] ?? []).every((s) => s.feito);
  const parcial = (k: string) => !completo(k) && (series[k] ?? []).some((s) => s.feito);

  let feitas = 0;
  let total = 0;
  exercicios.forEach((ex, i) => {
    const l = series[chaves[i]] ?? [];
    feitas += l.filter((s) => s.feito).length;
    total += l.length;
  });
  const soCardio = exercicios.every((e) => e.tipo === "cardio");
  const unidade = soCardio ? "exercícios" : "séries";
  const podeSalvar = feitas > 0 || podeLimpar;

  return (
    <div data-testid="rascunho-treino-ontem">
      <div className="mt-3">
        {exercicios.map((ex, i) => {
          const k = chaves[i];
          const lista = series[k] ?? [];
          const feito = completo(k);
          const cardio = ex.tipo === "cardio";
          const aberta = aberto === k;
          return (
            <div key={k} className={cn("border-t", tom.linha)} data-testid={`ontem-${k}`}>
              <div className="flex items-center gap-1 pl-3.5 pr-2 min-h-[52px]">
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
                <button
                  type="button"
                  disabled={cardio}
                  onClick={() => setAberto(aberta ? null : k)}
                  aria-expanded={cardio ? undefined : aberta}
                  aria-label={cardio ? ex.name : `${aberta ? "Fechar" : "Ajustar"} as séries de ${ex.name}`}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left py-2 pl-1.5"
                >
                  <Chip indice={i} riscado={feito}>{ex.name}</Chip>
                  {!cardio && <span className="ml-auto shrink-0 pl-1 text-[12px] text-muted-foreground tabular-nums">{alvoDaLinha(lista)}</span>}
                </button>
                <Quadradinho
                  marcado={feito}
                  parcial={parcial(k)}
                  tom={tom}
                  onClick={() => muda(k, (l) => l.map((s) => ({ ...s, feito: !feito, ok: true })))}
                  rotulo={`${feito ? "Desmarcar" : "Marcar"} ${ex.name} inteiro em ${rotulo}`}
                />
              </div>
              {aberta && !cardio && (
                <div className="px-2 min-[400px]:px-3.5 pb-3">
                  <TabelaDeSeries
                    nome={ex.name}
                    series={lista}
                    tom={tom}
                    ativa={ativa[k] ?? null}
                    onAtivar={(j) => setAtiva((a) => ({ ...a, [k]: j }))}
                    onAlternar={(j) => muda(k, (l) => l.map((s, n) => (n === j ? { ...s, feito: !s.feito, ok: true } : s)))}
                    onValor={(j, campo, v) =>
                      muda(k, (l) => l.map((s, n) => (n === j ? { ...s, [campo]: campo === "reps" ? Math.max(0, Math.round(v)) : Math.max(0, v), ok: true } : s)))}
                  />
                  <p className="mt-1.5 ml-1 text-[11.5px] text-muted-foreground">Cinza = o que estava previsto. Toque num número pra mudar.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={cn("px-4 pt-3 border-t space-y-2", tom.linha)}>
        <p className="text-[12.5px] font-bold tabular-nums text-center" data-testid="contagem-ontem">{feitas}/{total} {unidade} marcados</p>
        <Button
          onClick={() => onSalvar({ dia, diaDoPlano, series })}
          disabled={!podeSalvar}
          className="w-full h-11 text-[14px] font-bold"
          data-testid="salvar-treino-ontem"
        >
          {feitas === 0 && podeLimpar ? `Tirar o treino de ${rotulo}` : `Salvar treino de ${rotulo}`}
        </Button>
        {!podeSalvar && <p className="text-center text-[11.5px] text-muted-foreground">Marque pelo menos uma série pra salvar.</p>}
      </div>
    </div>
  );
}
