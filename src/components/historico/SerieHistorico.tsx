/**
 * SÉRIE HISTÓRICA (23/08) — nasceu da avaliação editada da Elaine (2★,
 * pagante vitalícia, uso diário): "não temos como ver os dias anteriores para
 * estar fazendo as comparações".
 *
 * Começou como bloco fixo de 7 dias e virou NAVEGÁVEL na mesma sessão, por
 * ordem do dono: "depois que passa os 7 dias devia ter como ela clicar e ver
 * o tempo todo". Uma janela de 7 dias envelhece — no dia 8 a pessoa perde
 * justamente a comparação que veio buscar. Agora são três lentes:
 *   7 dias  — detalhe, com o número em cada barra (o dia a dia)
 *   30 dias — tendência do mês (barras finas, sem número, meta como régua)
 *   por mês — a vida inteira, média de cada mês (é aqui que "melhorei" aparece)
 * A escolha fica salva por módulo (`core-serie-modo-<id>`): quem passou pra
 * "por mês" não quer voltar pro 7 dias a cada abertura.
 *
 * REGRA DE OURO: SÓ LEITURA do histórico. A única escrita é a preferência de
 * lente, e ela nasce de um TOQUE — nunca do mount (lição do bug destrutivo
 * dos widgets, 20/08).
 */
import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";

const LETRA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Modo = "7" | "30" | "mes";
type Barra = { chave: string; valor: number; rotulo: string; destaque: boolean };

export function SerieHistorico({
  registros,
  meta,
  cor,
  unidade = "",
  formatar,
  id,
}: {
  /** { "2026-08-23": 6, ... } — a MESMA chave por data que o card já grava */
  registros: Record<string, number>;
  /** meta diária: linha tracejada + contagem de dias batidos */
  meta?: number;
  /** cor da barra (ex.: "hsl(var(--saude-blue))") */
  cor: string;
  unidade?: string;
  formatar?: (n: number) => string;
  /** identifica a preferência de lente deste card (ex.: "agua", "sono") */
  id: string;
}) {
  const [modo, setModo] = usePersistedState<Modo>(`core-serie-modo-${id}`, "7");
  const [tocado, setTocado] = useState<string | null>(null);
  const fmt = formatar ?? ((n: number) => String(Math.round(n * 10) / 10).replace(".", ","));

  const diasComRegistro = Object.entries(registros).filter(([, v]) => Number(v) > 0);
  // Sem NENHUM registro a série seria só barras vazias — ruído. Some até
  // existir o que comparar (aparece no 1º registro).
  if (diasComRegistro.length === 0) return null;

  const hoje = new Date();
  const hojeChave = localDayKey(hoje);

  const ultimosDias = (n: number): Barra[] =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - (n - 1 - i));
      const chave = localDayKey(d);
      return {
        chave,
        valor: Number(registros[chave] ?? 0),
        // 7 dias: letra do dia da semana. 30 dias: data curta — em um mês
        // inteiro "12" sozinho não localiza ninguém, "12/8" sim.
        rotulo: n <= 7 ? LETRA[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`,
        destaque: chave === hojeChave,
      };
    });

  const porMes = (): Barra[] => {
    const mapa: Record<string, { soma: number; dias: number }> = {};
    for (const [chave, v] of diasComRegistro) {
      const mes = chave.slice(0, 7); // "2026-08"
      mapa[mes] ??= { soma: 0, dias: 0 };
      mapa[mes].soma += Number(v);
      mapa[mes].dias += 1;
    }
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // um ano de leitura cabe na largura do card
      .map(([mes, { soma, dias }]) => ({
        chave: mes,
        valor: soma / dias, // MÉDIA do mês: mês incompleto não parece pior que os outros
        rotulo: MES_CURTO[Number(mes.slice(5, 7)) - 1],
        destaque: mes === hojeChave.slice(0, 7),
      }));
  };

  const barras = modo === "7" ? ultimosDias(7) : modo === "30" ? ultimosDias(30) : porMes();
  const comValor = barras.filter((b) => b.valor > 0);
  const maior = Math.max(...barras.map((b) => b.valor), meta ?? 0, 1);
  const media = comValor.length ? comValor.reduce((s, b) => s + b.valor, 0) / comValor.length : 0;
  const bateram = meta ? barras.filter((b) => b.valor >= meta).length : 0;

  const resumo =
    modo === "mes"
      ? `média ${fmt(media)}${unidade} por dia`
      : `média ${fmt(media)}${unidade}${meta ? ` · meta em ${bateram}/${barras.length}` : ""}`;

  // 30 barras não cabem com número em cima; e nos meses o número volta.
  const mostraNumero = modo !== "30";
  const LENTES: Array<[Modo, string]> = [["7", "7 dias"], ["30", "30 dias"], ["mes", "Por mês"]];

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Histórico
        </span>
        <span className="text-[10.5px] font-semibold text-muted-foreground tabular-nums text-right">
          {resumo}
        </span>
      </div>

      {/* Lentes: mesmo desenho dos chips de hábito (v67) — a pessoa já
          aprendeu esse gesto num módulo, repete no outro. */}
      <div className="flex gap-1.5 mb-2.5">
        {LENTES.map(([m, texto]) => (
          <button
            key={m}
            onClick={() => {
              setModo(m);
              setTocado(null);
              trackEvent("serie_lente", { card: id, lente: m });
            }}
            className={`px-2.5 min-h-[26px] rounded-full text-[10.5px] font-bold border transition-colors ${
              modo === m ? "text-white border-transparent" : "bg-card border-border text-muted-foreground"
            }`}
            style={modo === m ? { background: cor } : undefined}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between gap-[3px] h-[64px] relative">
        {meta ? (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border pointer-events-none"
            style={{ bottom: `${(meta / maior) * 46 + 18}px` }}
            aria-hidden
          />
        ) : null}

        {barras.map((b, i) => {
          const altura = b.valor > 0 ? Math.max(4, (b.valor / maior) * 46) : 3;
          // Em 30 dias só cabem 3 âncoras: começo, meio e hoje — mais que isso
          // vira borrão. A barra TOCADA também mostra a própria data, que é o
          // que transforma o toque em resposta ("quanto foi no dia 12/8?").
          const rotuloVisivel =
            modo === "30" ? b.destaque || tocado === b.chave || i === 0 || i === 15 : true;
          return (
            <button
              key={b.chave}
              onClick={() => setTocado(tocado === b.chave ? null : b.chave)}
              className="flex-1 flex flex-col items-center justify-end gap-1 relative z-[1] min-w-0"
              aria-label={`${b.rotulo}: ${fmt(b.valor)}${unidade}`}
            >
              <span className="text-[9.5px] font-bold tabular-nums text-muted-foreground leading-none h-[10px] whitespace-nowrap">
                {(mostraNumero || tocado === b.chave) && b.valor > 0 ? fmt(b.valor) : ""}
              </span>
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${altura}px`,
                  background: b.valor > 0 ? cor : "hsl(var(--muted))",
                  opacity: b.valor > 0 ? (b.destaque || tocado === b.chave ? 1 : 0.55) : 1,
                }}
              />
              <span
                className={`text-[9.5px] leading-none h-[10px] ${
                  b.destaque ? "font-black text-foreground" : "font-semibold text-muted-foreground"
                }`}
              >
                {b.destaque && modo !== "mes" && tocado !== b.chave
                  ? "hoje"
                  : rotuloVisivel
                  ? b.rotulo
                  : ""}
              </span>
            </button>
          );
        })}
      </div>

      {modo === "30" && (
        <p className="text-[9.5px] text-muted-foreground text-center mt-1.5">
          toque numa barra pra ver o dia
        </p>
      )}
    </div>
  );
}
