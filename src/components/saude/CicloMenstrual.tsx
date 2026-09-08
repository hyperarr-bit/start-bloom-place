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
 * PREVISÃO É ESTIMATIVA, e a tela diz isso. Nada aqui é contraceptivo e a
 * tela também diz isso — é a diferença entre um app que informa e um app que
 * induz alguém a um erro caro.
 *
 * ---------------------------------------------------------------------------
 * 07/09 — DM de uma CLIENTE PAGANTE: "Ciclo menstrual não está alterando os
 * dias também."
 *
 * Ela estava certa em dois lugares ao mesmo tempo, e por isso a frase é tão
 * categórica:
 *
 *  1. Não dava pra DIGITAR a duração. Os dois campos numéricos aplicavam
 *     Math.min/Math.max a cada tecla sobre um valor controlado: com "28" na
 *     tela, apagar o "8" virava Math.max(15, 2) = 15, e digitar o "3" de 30
 *     antes de apagar o resto virava Math.min(60, 283) = 60. Escrever 30, 32
 *     ou 26 era FISICAMENTE impossível — só as setinhas ±1 andavam.
 *  2. Mesmo com a duração salva, ela não mandava em nada. A partir do 2º
 *     ciclo registrado, "Seu ciclo", "Próxima" e "Ovulação estimada" passavam
 *     a usar a MÉDIA dos registros e ignoravam em silêncio o número que ela
 *     tinha configurado. Ou seja: alterar não alterava mesmo.
 *
 * A decisão de produto que saiu daí: quem manda na previsão é o número que
 * ELA configurou. A média dos registros continua sendo calculada e aparece
 * ao lado ("sua média: N dias") com um botão pra adotá-la — informação
 * oferecida, nunca aplicada por cima do que ela escreveu. Sobrescrever em
 * silêncio é exatamente a queixa; repetir isso "pra acertar mais" seria
 * trocar a confiança dela por um dia a mais de precisão.
 */
import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { Droplet, Plus, Trash2, ChevronDown, Info, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";

export type FaseCiclo = "menstrual" | "folicular" | "ovulatoria" | "lutea";

export interface RegistroCiclo {
  /** Dia em que a menstruação começou (localDayKey). */
  inicio: string;
  /**
   * Último dia de fluxo, quando informado. Era campo MORTO — declarado desde
   * 01/09 e nunca escrito por ninguém. Em vez de apagar do tipo, passou a ser
   * preenchível na edição do registro (07/09): quem informa o fim ganha a
   * fase menstrual com a duração REAL daquele ciclo em vez do padrão de
   * "dias de fluxo", e quem não informa continua exatamente como estava. É a
   * mesma lógica do resto da tela — o que a pessoa disse vale mais do que a
   * estimativa. Opcional de propósito: um campo a mais na hora de registrar
   * afastaria justamente quem só quer marcar o dia e seguir a vida.
   */
  fim?: string;
}

export interface EstadoCiclo {
  ligado: boolean;
  /** A duração que ELA configurou — é a fonte da previsão (ver cabeçalho). */
  duracaoCiclo: number;
  /** Dias de fluxo padrão; um registro com `fim` manda mais que este. */
  duracaoRegra: number;
  ciclos: RegistroCiclo[];
}

const PADRAO: EstadoCiclo = { ligado: false, duracaoCiclo: 28, duracaoRegra: 5, ciclos: [] };

export const LIMITE_CICLO = { min: 15, max: 60, padrao: 28 } as const;
export const LIMITE_FLUXO = { min: 1, max: 12, padrao: 5 } as const;

type Limites = { min: number; max: number; padrao: number };

/**
 * Põe um número dentro dos limites. Lixo (undefined, NaN, "", 0 — tudo que já
 * pôde ser gravado por versões antigas) cai no padrão, nunca em NaN na tela.
 * Isto roda na LEITURA do estado salvo, e é o que garante que nenhum dado
 * antigo de `core-saude-ciclo` precise de migração pra continuar abrindo.
 */
export const limitarNumero = (v: unknown, { min, max, padrao }: Limites) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return padrao;
  return Math.min(max, Math.max(min, n));
};

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

/** Dias de fluxo DAQUELE ciclo: o `fim` informado manda; sem ele, o padrão. */
export const diasDeFluxo = (registro: RegistroCiclo | undefined, padrao: number) => {
  if (!registro?.fim) return padrao;
  const d = diasEntre(registro.inicio, registro.fim) + 1;
  // Fora de 1–15 dias é registro digitado errado (ou `fim` antes do início):
  // melhor cair no padrão do que desenhar uma fase menstrual de 40 dias.
  return d >= 1 && d <= 15 ? d : padrao;
};

/**
 * "YYYY-MM-DD" que existe MESMO no calendário. `parseLocalDay("2026-02-31")`
 * devolve 03/03 sem reclamar, então a ida-e-volta é a checagem honesta.
 */
export const dataDeDiaValida = (chave: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(chave) && localDayKey(parseLocalDay(chave)) === chave;

/**
 * Média dos ciclos REAIS. Desde 07/09 ela é INFORMAÇÃO, não a previsão: a
 * tela mostra "sua média: N dias" com um botão pra adotar, e quem manda no
 * cálculo é a duração configurada. O comportamento da função não mudou (o
 * `padrao` continua sendo a resposta quando não há intervalo aproveitável) —
 * mudou quem a consome e pra quê.
 *
 * Só entra na conta o intervalo entre dois inícios
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

/**
 * Campo numérico que se deixa DIGITAR (07/09, DM da cliente).
 *
 * Regra: enquanto o dedo está no campo, o texto é dela — pode ficar vazio,
 * pode passar do teto por um instante ("28" + "3" antes de apagar o resto).
 * O limite só é aplicado quando ela SAI do campo.
 *
 * E o valor é salvo assim que o que está escrito já é um número legal, sem
 * esperar o blur: quem digita "30" tem 30 gravado no "0", e sair da tela pelo
 * botão voltar do Android — que não dispara blur nenhum — não desfaz o que
 * ela acabou de escrever. Fora do foco, o campo mostra o que está salvo.
 */
const CampoNumero = ({
  rotulo, valor, limites, onCommit,
}: { rotulo: string; valor: number; limites: Limites; onCommit: (n: number) => void }) => {
  const [rascunho, setRascunho] = useState<string | null>(null);

  const digitar = (texto: string) => {
    setRascunho(texto);
    // Já é um número dentro dos limites? Salva agora, sem mexer no que ela vê.
    const n = Math.round(Number(texto));
    if (texto.trim() !== "" && Number.isFinite(n) && n >= limites.min && n <= limites.max && n !== valor) {
      onCommit(n);
    }
  };

  const confirmar = () => {
    if (rascunho === null) return;
    const texto = rascunho.trim();
    setRascunho(null); // volta a exibir o que ficou salvo
    // Campo vazio no blur MANTÉM o valor de antes: apagar pra redigitar é o
    // gesto normal de quem troca 28 por 30, não um pedido de reset.
    if (texto === "") return;
    const n = limitarNumero(texto, limites);
    if (n !== valor) onCommit(n);
  };

  return (
    <label className="space-y-1">
      <span className="text-[10px] text-muted-foreground">{rotulo}</span>
      <Input
        type="number" inputMode="numeric" min={limites.min} max={limites.max}
        aria-label={rotulo}
        value={rascunho ?? String(valor)}
        onChange={(e) => digitar(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-8 text-xs"
      />
    </label>
  );
};

export const CicloMenstrual = () => {
  const [estado, setEstado] = usePersistedState<EstadoCiclo>("core-saude-ciclo", PADRAO);
  const [novoInicio, setNovoInicio] = useState("");
  const [config, setConfig] = useState(false);
  /* O `registrar` recusava data repetida e data inválida com um `return` mudo:
     ela tocava em Registrar, NADA acontecia na tela e não havia como saber por
     quê. Silêncio é o pior aviso possível — some com a ação E com o motivo. */
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<{ chave: string; inicio: string; fim: string } | null>(null);
  const [erroEdicao, setErroEdicao] = useState("");

  /* Lê SEM ESCREVER os baldes dos outros módulos — a leitura cruzada é o
     motivo pelo qual esta tela existe, e ler é tudo o que ela faz com eles. */
  const [moodLog] = usePersistedState<Record<string, { mood: number; note: string }>>("mood-log", {});
  const [sleepLog] = usePersistedState<Record<string, number>>("core-saude-sleep", {});

  const ciclos = useMemo(
    () => [...(estado.ciclos || [])].sort((a, b) => (a.inicio < b.inicio ? 1 : -1)),
    [estado.ciclos],
  );
  const ultimo = ciclos[0];

  /* A DURAÇÃO CONFIGURADA É A FONTE DA PREVISÃO (07/09). Antes, a partir do 2º
     ciclo registrado a média dos registros tomava o lugar dela em silêncio —
     era metade da queixa "não está alterando os dias". A média continua aqui,
     mas como informação com um botão pra adotar. `limitarNumero` sanea o que
     já está gravado (inclusive o 15/60 que o clamp por tecla forçou em quem
     tentou digitar), sem migração nem reescrita da chave. */
  const duracaoCiclo = limitarNumero(estado.duracaoCiclo, LIMITE_CICLO);
  const duracaoRegra = limitarNumero(estado.duracaoRegra, LIMITE_FLUXO);
  const { media, estimado, amostras } = mediaDeCiclo(estado.ciclos || [], duracaoCiclo);

  const hoje = localDayKey();
  const diaDoCiclo = ultimo ? diasEntre(ultimo.inicio, hoje) + 1 : 0;
  const dentroDoCiclo = diaDoCiclo >= 1 && diaDoCiclo <= duracaoCiclo + 14;
  const fluxoAtual = diasDeFluxo(ultimo, duracaoRegra);
  const fase = dentroDoCiclo ? faseDoDia(diaDoCiclo, duracaoCiclo, fluxoAtual) : null;
  const proxima = ultimo ? somarDias(ultimo.inicio, duracaoCiclo) : null;
  const faltam = proxima ? diasEntre(hoje, proxima) : null;
  const ovulacaoDia = ultimo ? somarDias(ultimo.inicio, duracaoCiclo - 14) : null;

  /* Média de humor e de sono POR FASE, a partir dos registros que já existem.
     É a resposta à frase dela ("o ciclo auxilia no humor... no quanto a gente
     dorme"), e nenhum dado novo precisou ser pedido pra ela. */
  const leituraPorFase = useMemo(() => {
    if (ciclos.length === 0) return null;
    const balde: Record<FaseCiclo, { humor: number[]; sono: number[] }> = {
      menstrual: { humor: [], sono: [] }, folicular: { humor: [], sono: [] },
      ovulatoria: { humor: [], sono: [] }, lutea: { humor: [], sono: [] },
    };
    const ordenados = [...ciclos].sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const inicios = ordenados.map(c => c.inicio);
    for (let i = 0; i < inicios.length; i++) {
      const inicio = inicios[i];
      const fim = inicios[i + 1] ? diasEntre(inicio, inicios[i + 1]) : duracaoCiclo;
      // Cada ciclo usa o fluxo que ELA registrou naquele mês (`fim`), caindo
      // no padrão quando não informou: mês de fluxo longo não fica marcado
      // como folicular só porque o padrão dela é 5 dias.
      const fluxo = diasDeFluxo(ordenados[i], duracaoRegra);
      for (let d = 1; d <= Math.min(fim, 60); d++) {
        const chave = somarDias(inicio, d - 1);
        const f = faseDoDia(d, duracaoCiclo, fluxo);
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
  }, [ciclos, duracaoCiclo, duracaoRegra, moodLog, sleepLog]);

  /** Por que esta data não serve — em uma frase, na língua dela. */
  const problemaNaData = (chave: string, ignorar?: string) => {
    if (!dataDeDiaValida(chave)) return "Escolha uma data válida.";
    if (chave > hoje) return "Essa data ainda não chegou.";
    if ((estado.ciclos || []).some(c => c.inicio === chave && c.inicio !== ignorar)) {
      return "Você já registrou esse dia.";
    }
    return "";
  };

  const registrar = (dia: string) => {
    const chave = (dia || "").slice(0, 10);
    const problema = problemaNaData(chave);
    if (problema) { setErro(problema); return; }
    setEstado({ ...estado, ciclos: [...(estado.ciclos || []), { inicio: chave }] });
    setNovoInicio("");
    setErro("");
  };

  /* Editar a data de um registro (07/09). Até aqui o único conserto pra um
     dia digitado errado era APAGAR e criar de novo — e apagar o registro
     errado mexe na média, na previsão e na leitura por fase de tabela. O
     `fim` opcional entra aqui: é o lugar onde ela já está corrigindo aquele
     mês, não mais um campo no caminho de quem só quer marcar o dia. */
  const comecarEdicao = (c: RegistroCiclo) => {
    setErro("");
    setErroEdicao("");
    setEditando({ chave: c.inicio, inicio: c.inicio, fim: c.fim || "" });
  };

  const salvarEdicao = () => {
    if (!editando) return;
    const inicio = (editando.inicio || "").slice(0, 10);
    const problema = problemaNaData(inicio, editando.chave);
    if (problema) { setErroEdicao(problema); return; }

    const fim = (editando.fim || "").slice(0, 10);
    if (fim) {
      if (!dataDeDiaValida(fim) || fim > hoje) { setErroEdicao("Escolha uma data válida."); return; }
      const dias = diasEntre(inicio, fim) + 1;
      if (dias < 1 || dias > 15) { setErroEdicao("O fim do fluxo tem que vir depois do começo."); return; }
    }

    setEstado({
      ...estado,
      ciclos: (estado.ciclos || []).map(c => {
        if (c.inicio !== editando.chave) return c;
        const atualizado: RegistroCiclo = { ...c, inicio }; // preserva campos futuros
        if (fim) atualizado.fim = fim; else delete atualizado.fim;
        return atualizado;
      }),
    });
    setEditando(null);
    setErroEdicao("");
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
            <CampoNumero
              rotulo="Duração do ciclo"
              valor={duracaoCiclo}
              limites={LIMITE_CICLO}
              onCommit={(n) => setEstado({ ...estado, duracaoCiclo: n })}
            />
            <CampoNumero
              rotulo="Dias de fluxo"
              valor={duracaoRegra}
              limites={LIMITE_FLUXO}
              onCommit={(n) => setEstado({ ...estado, duracaoRegra: n })}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            É este número que a previsão usa. Sua média dos registros aparece ao lado dela, se você quiser adotar.
          </p>
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
              {duracaoCiclo} dias{" "}
              <span className="text-[10px] font-normal text-muted-foreground">(o que você configurou)</span>
            </p>
            {/* A média deixou de mandar e virou oferta. Quem quiser a média
                adota em um toque; quem configurou 30 continua com 30 na tela
                seguinte — que é o que a cliente pediu ao dizer que "não está
                alterando os dias". */}
            {!estimado && (media === duracaoCiclo ? (
              <p className="text-[10px] text-muted-foreground">
                bate com sua média de {amostras} ciclo{amostras > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                sua média: {media} dias{" · "}
                <button
                  onClick={() => setEstado({ ...estado, duracaoCiclo: limitarNumero(media, LIMITE_CICLO) })}
                  className="font-bold text-foreground underline underline-offset-2 hover:text-primary"
                >
                  usar minha média
                </button>
              </p>
            ))}
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
              aria-label="Começou a menstruar em"
              value={novoInicio}
              onChange={(e) => { setNovoInicio(e.target.value); setErro(""); }}
              className="h-9 text-xs"
            />
          </div>
          <Button size="sm" className="h-9" onClick={() => registrar(novoInicio || hoje)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
          </Button>
        </div>
        {/* O aviso fica COLADO no campo e no botão que ela acabou de tocar —
            não num toast na borda da tela, longe do dedo e por cima da barra
            de navegação do Android, que some antes de ela olhar pra lá. */}
        {erro && <p role="alert" className="text-[11px] text-destructive leading-snug">{erro}</p>}
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

              if (editando?.chave === c.inicio) {
                return (
                  <div key={c.inicio} className="rounded-md border border-primary/40 bg-background/70 p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <CampoData
                        rotulo="Começou em" aria-label="Começou em" autoFocus
                        value={editando.inicio}
                        onChange={(e) => { setEditando({ ...editando, inicio: e.target.value }); setErroEdicao(""); }}
                        className="h-8 text-xs"
                      />
                      <CampoData
                        rotulo="Fim do fluxo" aria-label="Fim do fluxo"
                        value={editando.fim}
                        onChange={(e) => { setEditando({ ...editando, fim: e.target.value }); setErroEdicao(""); }}
                        className="h-8 text-xs"
                      />
                    </div>
                    {erroEdicao && <p role="alert" className="text-[11px] text-destructive leading-snug">{erroEdicao}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={salvarEdicao}
                        className="h-8 flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                      <button
                        onClick={() => { setEditando(null); setErroEdicao(""); }}
                        className="h-8 px-3 rounded-md border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={c.inicio} className="flex items-center gap-2 text-[11px] rounded-md bg-card border border-border/60 px-2 py-1.5">
                  <span className="tabular-nums">{fmt(c.inicio)}</span>
                  <span className="flex-1 text-muted-foreground truncate">
                    {dur ? `ciclo de ${dur} dias` : "ciclo em andamento"}
                    {c.fim ? ` · ${diasEntre(c.inicio, c.fim) + 1}d de fluxo` : ""}
                  </span>
                  {/* Lápis VISÍVEL (mesmo padrão do PetList): no celular
                      ninguém encontra ícone que só aparece no hover, e sem ele
                      corrigir um dia errado só dava apagando o registro. */}
                  <button
                    onClick={() => comecarEdicao(c)}
                    aria-label={`Editar registro de ${fmt(c.inicio)}`}
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEstado({ ...estado, ciclos: (estado.ciclos || []).filter(x => x.inicio !== c.inicio) })}
                    aria-label={`Apagar registro de ${fmt(c.inicio)}`}
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
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
