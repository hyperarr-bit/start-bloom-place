/**
 * RESUMO DO MÓDULO — a barra compacta que só Finanças tinha.
 *
 * Avaliação 5★ da Play (07/09): "Cada aba poderia ser igual a de finanças,
 * você entrar e ja ter um resumo do que tem para fazer". Finanças abre com
 * uma faixa 2×2 (Receitas / Despesas / Dívidas / Invest.) e nenhum outro
 * módulo tinha nada parecido: Rotina, Treino, Dieta... abriam direto na aba,
 * e a pessoa tinha que rolar pra descobrir se tinha algo pra fazer hoje.
 *
 * Este componente REPRODUZ a barra de Finanças (src/pages/Index.tsx, "2×2 EM
 * VEZ DE FAIXA ROLÁVEL", 29/07): mesmo card, mesmo raio, mesma tipografia
 * de rótulo 10px + valor 12px em negrito, sempre em duas colunas — a lição
 * de lá vale aqui: quatro colunas numa tela de 360px cortam o último número
 * e leem como tela quebrada. Não é identidade nova, é a mesma faixa em
 * outros módulos.
 *
 * Cada tile pode ter `onClick`, que troca a aba do módulo: o resumo não é só
 * leitura, é a porta pro que tem pra fazer ("3 remédios pendentes" leva pra
 * aba de hoje). Tile com onClick vira <button>; sem, é só texto.
 *
 * ESTADO VAZIO: quando todos os valores são nulos/zero, a barra NÃO mostra
 * uma fileira de zeros — vira uma linha única de convite ("Nada pendente
 * hoje" / "Comece cadastrando..."), que cada módulo escolhe. Barra de zeros
 * é exatamente o "design pobre" que a varredura de 26/07 mediu nos módulos
 * sem dado.
 *
 * Sem `data-spotlight` de propósito: os tours da demo (/preview/<modulo>)
 * ancoram nos seletores das abas e dos botões existentes, e a barra entra
 * DEPOIS do cabeçalho, sem mexer neles.
 */
import { parseLocalDay, localDayKey } from "@/lib/utils";

export type TomDoResumo = "ok" | "atencao" | "neutro";

export interface ItemDoResumo {
  /** Rótulo curto; renderizado em caixa alta. */
  rotulo: string;
  /** Número ou texto. `null`/`undefined`/0/"" contam como "nada" pro estado vazio. */
  valor: string | number | null | undefined;
  /** Linha pequena abaixo do valor (ex.: nome do próximo compromisso). */
  sub?: string;
  /** Cor do valor: verde (feito), laranja (pendente) ou a cor do texto. */
  tom?: TomDoResumo;
  /** Leva a pessoa pra aba onde aquilo se resolve. */
  onClick?: () => void;
}

interface ResumoDoModuloProps {
  itens: ItemDoResumo[];
  /** Linha única mostrada quando todos os itens estão vazios. */
  vazio?: string;
  className?: string;
}

const COR_DO_TOM: Record<TomDoResumo, string> = {
  ok: "text-green-500",
  atencao: "text-orange-400",
  neutro: "text-foreground",
};

/** Zero, vazio e nulo são "nada a mostrar". "0/6" NÃO é vazio: é uma lista
 *  inteira ainda por fazer — exatamente o que a pessoa quer ver ao entrar. */
export const valorVazio = (v: ItemDoResumo["valor"]): boolean => {
  if (v == null) return true;
  if (typeof v === "number") return !(v > 0);
  const s = String(v).trim();
  return s === "" || s === "0";
};

/** Dado do store pode chegar torto (chave gravada por versão antiga, null,
 *  objeto no lugar de lista). Quem conta pro resumo nunca pode derrubar o
 *  módulo por isso — lixo vira lista vazia. */
export const comoLista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Dias de hoje até uma chave "YYYY-MM-DD" (negativo = já passou). Parse
 *  LOCAL de propósito — `new Date("2026-07-18")` vira véspera no Brasil. */
export const diasAte = (chave: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chave)) return Number.NaN;
  const alvo = parseLocalDay(chave).getTime();
  const hoje = parseLocalDay(localDayKey()).getTime();
  return Math.round((alvo - hoje) / 86_400_000);
};

/** "1 dia" / "41 dias" — o tile de sequência mostrava "1 dias" (print de 07/09). */
export const emDias = (n: number): string => `${n} ${n === 1 ? "dia" : "dias"}`;

/** "Hoje", "Amanhã", "em 5 dias" — o formato dos tiles de "próximo X". */
export const rotuloEmDias = (dias: number): string => {
  if (!Number.isFinite(dias)) return "";
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `em ${dias} dias`;
};

export const ResumoDoModulo = ({ itens, vazio = "Nada pendente hoje", className = "" }: ResumoDoModuloProps) => {
  // Só o que tem número entra na grade: tile vazio no meio dos outros vira
  // um travessão que não diz nada — e a lista de "o que fazer" fica mais
  // curta, não mais cheia de traço.
  const visiveis = itens.filter((i) => !valorVazio(i.valor)).slice(0, 4);

  if (visiveis.length === 0) {
    return (
      <div
        data-testid="resumo-do-modulo"
        data-vazio="true"
        className={`bg-card rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground ${className}`}
      >
        {vazio}
      </div>
    );
  }

  return (
    <div
      data-testid="resumo-do-modulo"
      className={`bg-card rounded-lg border border-border px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-2 ${className}`}
    >
      {visiveis.map((item) => {
        const cor = COR_DO_TOM[item.tom ?? "neutro"];
        const conteudo = (
          <>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{item.rotulo}</span>
              <span className={`text-xs font-bold truncate ${cor}`}>{item.valor}</span>
            </div>
            {item.sub && <p className="text-[10px] text-muted-foreground truncate text-right">{item.sub}</p>}
          </>
        );
        if (item.onClick) {
          return (
            <button
              key={item.rotulo}
              type="button"
              onClick={item.onClick}
              className="min-w-0 text-left rounded-md -mx-1 px-1 hover:bg-muted/60 transition-colors"
            >
              {conteudo}
            </button>
          );
        }
        return <div key={item.rotulo} className="min-w-0">{conteudo}</div>;
      })}
    </div>
  );
};

export default ResumoDoModulo;
