import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Lock } from "lucide-react";
import { RARIDADE_LABEL, fracaoDe, raridadeDe, type Badge } from "@/components/gamification/types";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { AdesivoRaro, ChipRaridade } from "./adesivos-raridade";
import { giroDoAdesivo } from "./adesivos-arte";
import { PAPEL_PONTILHADO } from "./papel";
import type { Colecao } from "./use-conquistas";
import "./conquistas.css";

export { PAPEL_PONTILHADO };

interface Props {
  folha: Badge[];
  abertos: number;
  onSelecionar: (b: Badge) => void;
}

/** Quantos dos que faltam aparecem fechados: completa a fileira e mostra mais 4 (os mais perto). */
export const quantosFaltamVisiveis = (colados: number, faltam: number, todos: boolean): number => {
  if (todos) return faltam;
  const resto = colados % 4;
  return Math.min(faltam, (resto ? 4 - resto : 0) + 4);
};

/**
 * MEUS ADESIVOS (26/09; raridade em 27/09): a folha de adesivos em 4 colunas
 * no papel pontilhado — os conquistados coloridos e colados meio tortos, com
 * o tratamento da raridade (borda azul, anel holográfico, ouro), os que
 * faltam como silhueta com a pílula do progresso ("32/50") e o chip da
 * raridade. Dos que faltam, a folha mostra só os 4 mais perto (fechando a
 * fileira): 45 círculos apagados de uma vez viram lista de afazeres e
 * escondem o que a pessoa acabou de colar. "Ver todos" abre o resto.
 */
export const GradeAdesivos = ({ folha, abertos, onSelecionar }: Props) => {
  const [todos, setTodos] = useState(false);
  const colados = folha.filter((b) => b.unlocked);
  const faltam = folha.filter((b) => !b.unlocked);
  const quantosFaltam = quantosFaltamVisiveis(colados.length, faltam.length, todos);
  const visiveis = [...colados, ...faltam.slice(0, quantosFaltam)];
  const escondidos = faltam.length - quantosFaltam;

  return (
    <section className="rounded-2xl border border-border overflow-hidden bg-card" aria-labelledby="titulo-adesivos" data-testid="meus-adesivos">
      <div className="h-11 px-4 flex items-center border-b border-border">
        <h2 id="titulo-adesivos" className="text-[13px] font-extrabold tracking-wide">MEUS ADESIVOS</h2>
        <span className="ml-auto text-[12.5px] font-bold tabular-nums">
          {abertos} de {folha.length}
        </span>
      </div>
      <div className="bg-[#fffdf8] dark:bg-card" style={PAPEL_PONTILHADO}>
        <div className="grid grid-cols-4 gap-x-1 gap-y-0.5 px-2 pt-3 pb-2">
          {visiveis.map((b, i) => {
            const rotulo = b.unlocked ? null : rotuloProgresso(b);
            const raridade = raridadeDe(b);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelecionar(b)}
                data-adesivo-celula={b.id}
                data-aberto={b.unlocked ? "true" : "false"}
                data-raridade={raridade}
                className="flex flex-col items-center gap-1 pt-0.5 pb-1.5 rounded-xl active:scale-95 transition-transform min-w-0"
              >
                <span className="relative w-16 h-16 min-[400px]:w-[72px] min-[400px]:h-[72px] grid place-items-center">
                  <AdesivoRaro
                    id={b.id}
                    raridade={raridade}
                    tamanho={72}
                    trancado={!b.unlocked}
                    giro={b.unlocked ? giroDoAdesivo(i) : 0}
                    entradaIndice={i < 8 ? i : undefined}
                    className="ad-cel"
                  />
                  {!b.unlocked && (
                    <span className="ad-pill" data-testid="pilula-progresso">
                      {rotulo ?? <Lock className="w-3 h-3" aria-label="Trancado" />}
                    </span>
                  )}
                </span>
                <span className={`text-[10.5px] font-extrabold leading-[1.1] text-center px-0.5 ${b.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                  {b.name}
                </span>
                {!b.unlocked && raridade !== "comum" && (
                  <span className="chip-rar" data-rar={raridade} style={{ height: 14, fontSize: 7.5 }}>{RARIDADE_LABEL[raridade]}</span>
                )}
              </button>
            );
          })}
        </div>
        {(escondidos > 0 || todos) && faltam.length > 0 && (
          <button
            type="button"
            onClick={() => setTodos((t) => !t)}
            aria-expanded={todos}
            className="w-full pb-2.5 -mt-0.5 text-[12px] font-semibold text-muted-foreground inline-flex items-center justify-center gap-1"
          >
            {todos ? (
              <>Mostrar menos <ChevronUp className="w-3.5 h-3.5" aria-hidden /></>
            ) : (
              <>Ver todos · mais {escondidos} a caminho <ChevronDown className="w-3.5 h-3.5" aria-hidden /></>
            )}
          </button>
        )}
      </div>
    </section>
  );
};

/** Põe em negrito o primeiro número do "falta" ("poupança do mês em **45%** — a meta é 60%"). */
export const Destacar = ({ texto }: { texto: string }) => {
  const m = /(R\$\s?[\d.,]+(?:\s?mil)?|\d+\s?(?:%|h|horas?)?(?:\s(?:dias?|treinos?|livros?|semanas?|noites?|meses|mês|registros?|momentos?|medi(?:ção|ções)|receitas?|revis(?:ão|ões)|metas?)(?:\s\w+)?)?)/.exec(texto);
  if (!m || m.index === undefined) return <>{texto}</>;
  const antes = texto.slice(0, m.index), depois = texto.slice(m.index + m[0].length);
  return (
    <>
      {antes}<b className="text-foreground">{m[0]}</b>{depois}
    </>
  );
};

const AnelMini = ({ abertos, total }: { abertos: number; total: number }) => {
  const r = 7, c = 2 * Math.PI * r;
  const f = total > 0 ? Math.min(1, abertos / total) : 0;
  return (
    <svg viewBox="0 0 18 18" className="w-[18px] h-[18px] shrink-0" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
      <circle cx="9" cy="9" r={r} fill="none" stroke={f >= 1 ? "#d4a629" : "#8b5cf6"} strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 9 9)" strokeLinecap="round" />
    </svg>
  );
};

/**
 * PRÓXIMO ADESIVO (27/09): o mais perto de colar, com a barra e o "falta" em
 * palavras, e as COLEÇÕES por módulo ("Finanças 6/24"). A escassez que faz
 * querer o próximo é a escada, não contagem regressiva.
 */
export const CardProximo = ({ proximo, colecoes, diasDeSequencia, onSelecionar }: { proximo: Badge | null; colecoes: Colecao[]; diasDeSequencia: number; onSelecionar: (b: Badge) => void }) => {
  if (!proximo && colecoes.length === 0) return null;
  const raridade = proximo ? raridadeDe(proximo) : "comum";
  return (
    <section className="rounded-2xl border border-border overflow-hidden bg-card" aria-labelledby="titulo-proximo" data-testid="proximo-adesivo">
      <div className="h-11 px-4 flex items-center border-b border-border">
        <h2 id="titulo-proximo" className="text-[13px] font-extrabold tracking-wide">PRÓXIMO ADESIVO</h2>
        <span className="ml-auto text-[11px] font-bold text-muted-foreground">o mais perto de colar</span>
      </div>
      {proximo && (
        <button type="button" onClick={() => onSelecionar(proximo)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
          <span className="relative w-[60px] h-[60px] shrink-0 grid place-items-center">
            <AdesivoRaro id={proximo.id} raridade={raridade} tamanho={60} trancado />
          </span>
          <span className="flex-1 min-w-0">
            <ChipRaridade raridade={raridade} />
            <span className="block text-[14px] font-extrabold mt-1">{proximo.name}</span>
            <span className="barra-prox block my-1.5"><i style={{ width: `${Math.round(fracaoDe(proximo) * 100)}%` }} /></span>
            <span className="block text-[11.5px] text-muted-foreground leading-[1.35]"><Destacar texto={textoFalta(proximo, diasDeSequencia)} /></span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
      <div className="colecoes" data-testid="colecoes">
        {colecoes.map((c) => (
          <span key={c.id} className="col-chip" data-cheia={c.abertos >= c.total ? "" : undefined}>
            <AnelMini abertos={c.abertos} total={c.total} />
            <span aria-hidden>{c.emoji}</span> {c.label} <span className="n">{c.abertos}/{c.total}</span>
          </span>
        ))}
      </div>
    </section>
  );
};
