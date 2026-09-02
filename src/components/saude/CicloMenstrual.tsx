/**
 * CICLO MENSTRUAL (01/09) — pedido de duas clientes: a avaliação 4★ de 29/08
 * e a Stephanie ("igual o Flo"), esta por suporte.
 *
 * A 4★ não pediu um calendário — ela disse POR QUE queria:
 *
 *   "acho interessante que tivesse uma aba onde pudéssemos acompanhar também
 *    os ciclos menstruais femininos, ou até mesmo na aba de saúde. Pois o
 *    ciclo também acaba auxiliando muito no humor, no quanto a gente gasta
 *    dinheiro, no quanto a gente dorme"
 *
 * Isso decidiu o escopo. Como calendário de ciclo, o Flo é melhor e sempre
 * vai ser — é o produto inteiro deles. O que eles NÃO conseguem fazer é
 * cruzar o ciclo com o humor, o sono e o gasto, porque esses dados não são
 * deles. São nossos, e já estão gravados por data em `mood-log`,
 * `core-saude-sleep` e `finance-expenses`. Por isso o card de leitura por
 * fase existe e é o ponto alto daqui, não um extra.
 *
 * NASCE DESLIGADO e some inteiro quando desligado. A Saúde é aberta por 503
 * pessoas de todos os gêneros; empurrar registro de menstruação pra todas
 * seria o oposto de cuidado.
 *
 * PREVISÃO É ESTIMATIVA, e a tela diz isso. Enquanto houver menos de dois
 * ciclos registrados a média é o valor configurado (28 dias por padrão) e o
 * rótulo avisa que é chute; a partir do segundo, a média passa a ser a DELA.
 * Nada aqui é contraceptivo e a tela também diz isso — é a diferença entre
 * um app que informa e um app que induz alguém a um erro caro.
 */
import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { Droplet, Plus, Trash2, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";

export type FaseCiclo = "menstrual" | "folicular" | "ovulatoria" | "lutea";

export interface RegistroCiclo {
  /** Dia em que a menstruação começou (localDayKey). */
  inicio: string;
  /** Último dia de fluxo, quando informado. */
  fim?: string;
}

export interface EstadoCiclo {
  ligado: boolean;
  /** Usado como estimativa até existirem 2 ciclos registrados. */
  duracaoCiclo: number;
  duracaoRegra: number;
  ciclos: RegistroCiclo[];
}

const PADRAO: EstadoCiclo = { ligado: false, duracaoCiclo: 28, duracaoRegra: 5, ciclos: [] };

export const FASES: Record<FaseCiclo, { nome: string; emoji: string; cor: string; texto: string }> = {
  menstrual:  { nome: "Menstrual",  emoji: "🩸", cor: "hsl(0 72% 55%)",   texto: "Energia costuma estar mais baixa — respeite o descanso." },
  folicular:  { nome: "Folicular",  emoji: "🌱", cor: "hsl(142 60% 45%)", texto: "Energia subindo. Boa fase para começar coisas." },
  ovulatoria: { nome: "Ovulatória", emoji: "✨", cor: "hsl(38 92% 50%)",  texto: "Pico de energia e disposição social." },
  lutea:      { nome: "Lútea",      emoji: "🌙", cor: "hsl(280 55% 58%)", texto: "TPM pode aparecer: sono, humor e vontade de gastar mudam." },
};

const DIA_MS = 86_400_000;

/** Diferença em dias entre duas chaves de dia, no fuso local. */
export const diasEntre = (de: string, ate: string) =>
  Math.round((parseLocalDay(ate).getTime() - parseLocalDay(de).getTime()) / DIA_MS);

export const somarDias = (chave: string, n: number) => {
  const d = parseLocalDay(chave);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
};

/**
 * Média dos ciclos REAIS. Só entra na conta o intervalo entre dois inícios
 * consecutivos que caiba em 15–60 dias: fora disso é quase sempre registro
 * esquecido ou digitado errado, e um intervalo de 180 dias entortaria a
 * previsão dos meses seguintes inteiros. Usa no máximo os 6 últimos — ciclo
 * de um ano atrás não diz nada sobre o próximo.
 */
export const mediaDeCiclo = (ciclos: RegistroCiclo[], padrao: number) => {
  const inicios = [...ciclos].map(c => c.inicio).sort();
  const gaps: number[] = [];
  for (let i = 1; i < inicios.length; i++) {
    const g = diasEntre(inicios[i - 1], inicios[i]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  if (gaps.length === 0) return { media: padrao, estimado: true, amostras: 0 };
  const usados = gaps.slice(-6);
  return {
    media: Math.round(usados.reduce((a, b) => a + b, 0) / usados.length),
    estimado: false,
    amostras: usados.length,
  };
};

export const faseDoDia = (diaDoCiclo: number, mediaCiclo: number, duracaoRegra: number): FaseCiclo => {
  if (diaDoCiclo <= duracaoRegra) return "menstrual";
  // A fase lútea é a parte estável do ciclo (~14 dias); é o começo que varia.
  // Por isso a ovulação é contada de trás pra frente, a partir do próximo
  // início — e não "sempre no dia 14", que só vale pra ciclo de 28.
  const ovulacao = mediaCiclo - 14;
  if (diaDoCiclo >= ovulacao - 1 && diaDoCiclo <= ovulacao + 1) return "ovulatoria";
  return diaDoCiclo < ovulacao ? "folicular" : "lutea";
};

const fmt = (k: string) => {
  try {
    return parseLocalDay(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return k; }
};

export const CicloMenstrual = () => {
  const [estado, setEstado] = usePersistedState<EstadoCiclo>("core-saude-ciclo", PADRAO);
  const [novoInicio, setNovoInicio] = useState("");
  const [config, setConfig] = useState(false);

  /* Lê SEM ESCREVER os baldes dos outros módulos — a leitura cruzada é o
     motivo pelo qual esta tela existe, e ler é tudo o que ela faz com eles. */
  const [moodLog] = usePersistedState<Record<string, { mood: number; note: string }>>("mood-log", {});
  const [sleepLog] = usePersistedState<Record<string, number>>("core-saude-sleep", {});

  const ciclos = useMemo(
    () => [...(estado.ciclos || [])].sort((a, b) => (a.inicio < b.inicio ? 1 : -1)),
    [estado.ciclos],
  );
  const ultimo = ciclos[0];
  const { media, estimado, amostras } = mediaDeCiclo(estado.ciclos || [], estado.duracaoCiclo);

  const hoje = localDayKey();
  const diaDoCiclo = ultimo ? diasEntre(ultimo.inicio, hoje) + 1 : 0;
  const dentroDoCiclo = diaDoCiclo >= 1 && diaDoCiclo <= media + 14;
  const fase = dentroDoCiclo ? faseDoDia(diaDoCiclo, media, estado.duracaoRegra) : null;
  const proxima = ultimo ? somarDias(ultimo.inicio, media) : null;
  const faltam = proxima ? diasEntre(hoje, proxima) : null;
  const ovulacaoDia = ultimo ? somarDias(ultimo.inicio, media - 14) : null;

  /* Média de humor e de sono POR FASE, a partir dos registros que já existem.
     É a resposta à frase dela ("o ciclo auxilia no humor... no quanto a gente
     dorme"), e nenhum dado novo precisou ser pedido pra ela. */
  const leituraPorFase = useMemo(() => {
    if (ciclos.length === 0) return null;
    const balde: Record<FaseCiclo, { humor: number[]; sono: number[] }> = {
      menstrual: { humor: [], sono: [] }, folicular: { humor: [], sono: [] },
      ovulatoria: { humor: [], sono: [] }, lutea: { humor: [], sono: [] },
    };
    const inicios = [...ciclos].map(c => c.inicio).sort();
    for (let i = 0; i < inicios.length; i++) {
      const inicio = inicios[i];
      const fim = inicios[i + 1] ? diasEntre(inicio, inicios[i + 1]) : media;
      for (let d = 1; d <= Math.min(fim, 60); d++) {
        const chave = somarDias(inicio, d - 1);
        const f = faseDoDia(d, media, estado.duracaoRegra);
        const h = Number(moodLog?.[chave]?.mood);
        if (Number.isFinite(h) && h > 0) balde[f].humor.push(h);
        const s = Number(sleepLog?.[chave]);
        if (Number.isFinite(s) && s > 0) balde[f].sono.push(s);
      }
    }
    const medias = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const linhas = (Object.keys(balde) as FaseCiclo[]).map(f => ({
      fase: f, humor: medias(balde[f].humor), sono: medias(balde[f].sono),
      dias: Math.max(balde[f].humor.length, balde[f].sono.length),
    }));
    return linhas.some(l => l.dias > 0) ? linhas : null;
  }, [ciclos, media, estado.duracaoRegra, moodLog, sleepLog]);

  const registrar = (dia: string) => {
    const chave = (dia || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chave)) return;
    if ((estado.ciclos || []).some(c => c.inicio === chave)) return;
    setEstado({ ...estado, ciclos: [...(estado.ciclos || []), { inicio: chave }] });
    setNovoInicio("");
  };

  if (!estado.ligado) {
    return (
      <button
        onClick={() => setEstado({ ...estado, ligado: true })}
        className="w-full bg-card rounded-lg border border-border px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors"
      >
        <Droplet className="w-4 h-4 text-rose-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Acompanhar meu ciclo</p>
          <p className="text-[10px] text-muted-foreground">
            Previsão da próxima menstruação e como o ciclo mexe no seu humor e no seu sono
          </p>
        </div>
        <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  const corFase = fase ? FASES[fase].cor : "hsl(var(--muted-foreground))";

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border">
      <div className="px-4 py-2 flex items-center gap-2 border-b border-border" style={{ background: `${corFase}14` }}>
        <Droplet className="w-4 h-4" style={{ color: corFase }} />
        <span className="font-bold text-sm tracking-wide">MEU CICLO</span>
        <button
          onClick={() => setConfig(c => !c)}
          aria-expanded={config}
          className="ml-auto text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Ajustes <ChevronDown className={`w-3 h-3 transition-transform ${config ? "rotate-180" : ""}`} />
        </button>
      </div>

      {config && (
        <div className="px-4 py-3 border-b border-border bg-muted/20 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Duração do ciclo</span>
              <Input
                type="number" inputMode="numeric" min={15} max={60}
                value={estado.duracaoCiclo}
                onChange={(e) => setEstado({ ...estado, duracaoCiclo: Math.min(60, Math.max(15, Number(e.target.value) || 28)) })}
                className="h-8 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Dias de fluxo</span>
              <Input
                type="number" inputMode="numeric" min={1} max={12}
                value={estado.duracaoRegra}
                onChange={(e) => setEstado({ ...estado, duracaoRegra: Math.min(12, Math.max(1, Number(e.target.value) || 5)) })}
                className="h-8 text-xs"
              />
            </label>
          </div>
          <button
            onClick={() => setEstado({ ...estado, ligado: false })}
            className="text-[10px] text-muted-foreground hover:text-destructive underline underline-offset-2"
          >
            Desligar o acompanhamento do ciclo
          </button>
        </div>
      )}

      {/* Hoje */}
      <div className="px-4 py-4">
        {!ultimo ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Registre o primeiro dia da sua última menstruação para começar.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <div
              className="w-[74px] h-[74px] rounded-full flex flex-col items-center justify-center shrink-0 border-[3px]"
              style={{ borderColor: corFase, background: `${corFase}12` }}
            >
              <span className="text-[9px] text-muted-foreground leading-none">DIA</span>
              <span className="text-2xl font-black tabular-nums leading-tight">{dentroDoCiclo ? diaDoCiclo : "—"}</span>
            </div>
            <div className="min-w-0">
              {fase ? (
                <>
                  <p className="text-sm font-bold">{FASES[fase].emoji} Fase {FASES[fase].nome.toLowerCase()}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{FASES[fase].texto}</p>
                </>
              ) : (
                <p className="text-sm font-bold">Faz {diaDoCiclo} dias do último registro</p>
              )}
              {proxima && faltam !== null && (
                <p className="text-[11px] mt-1.5">
                  <span className="text-muted-foreground">Próxima: </span>
                  <span className="font-bold">{fmt(proxima)}</span>
                  <span className="text-muted-foreground">
                    {faltam > 0 ? ` · em ${faltam} dia${faltam > 1 ? "s" : ""}` : faltam === 0 ? " · é hoje" : ` · ${Math.abs(faltam)} dia${Math.abs(faltam) > 1 ? "s" : ""} de atraso`}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {ultimo && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Seu ciclo</p>
            <p className="text-sm font-bold tabular-nums">
              {media} dias{" "}
              <span className="text-[10px] font-normal text-muted-foreground">
                {estimado ? "(estimado)" : `(média de ${amostras})`}
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Ovulação estimada</p>
            <p className="text-sm font-bold">{ovulacaoDia ? fmt(ovulacaoDia) : "—"}</p>
          </div>
        </div>
      )}

      {/* A leitura cruzada — o motivo pelo qual a cliente pediu isto aqui e
          não no Flo. Só aparece quando há registro suficiente pra dizer algo. */}
      {leituraPorFase && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Como cada fase te afeta
          </p>
          <div className="space-y-1">
            {leituraPorFase.map((l) => (
              <div key={l.fase} className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: FASES[l.fase].cor }} />
                <span className="flex-1 truncate">{FASES[l.fase].emoji} {FASES[l.fase].nome}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {l.humor !== null ? `humor ${l.humor.toFixed(1).replace(".", ",")}` : "—"}
                </span>
                <span className="tabular-nums text-muted-foreground shrink-0 w-[62px] text-right">
                  {l.sono !== null ? `sono ${l.sono.toFixed(1).replace(".", ",")}h` : "—"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9.5px] text-muted-foreground mt-2">
            Médias tiradas do que você já registrou no humor da Rotina e no sono da Saúde.
          </p>
        </div>
      )}

      {/* Registro */}
      <div className="px-4 py-3 border-t border-border bg-muted/10 space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <CampoData
              rotulo="Começou a menstruar em"
              value={novoInicio}
              onChange={(e) => setNovoInicio(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button size="sm" className="h-9" onClick={() => registrar(novoInicio || hoje)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
          </Button>
        </div>
        {novoInicio === "" && (
          <button
            onClick={() => registrar(hoje)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Começou hoje
          </button>
        )}

        {ciclos.length > 0 && (
          <div className="space-y-1 pt-1">
            {ciclos.slice(0, 6).map((c, i) => {
              const seguinte = ciclos[i - 1];
              const dur = seguinte ? diasEntre(c.inicio, seguinte.inicio) : null;
              return (
                <div key={c.inicio} className="flex items-center gap-2 text-[11px] rounded-md bg-card border border-border/60 px-2 py-1.5">
                  <span className="tabular-nums">{fmt(c.inicio)}</span>
                  <span className="flex-1 text-muted-foreground">
                    {dur ? `ciclo de ${dur} dias` : "ciclo em andamento"}
                  </span>
                  <button
                    onClick={() => setEstado({ ...estado, ciclos: (estado.ciclos || []).filter(x => x.inicio !== c.inicio) })}
                    aria-label={`Apagar registro de ${fmt(c.inicio)}`}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="px-4 py-2 text-[9.5px] text-muted-foreground border-t border-border flex items-start gap-1.5">
        <Info className="w-3 h-3 shrink-0 mt-px" />
        Estimativas baseadas nos seus registros. Não servem como método contraceptivo nem substituem avaliação médica.
      </p>
    </div>
  );
};
