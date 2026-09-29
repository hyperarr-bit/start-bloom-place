import { localDayKey } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import {
  CHAVE_LAVAGENS, CHAVE_LEMBRETE_CABELO, CHAVE_PERFIL_CABELO, CHAVE_PLANO_CABELO, LEMBRETE_CABELO_PADRAO,
  agendaCapilar, criarPlano, estadoDaFila, etapaDaVez, lavagemDoDia, lavagensValidas, lerLembreteCabelo, perfilDasRespostas,
  planoValido, proximaLavagem,
  type Curvatura, type Etapa, type Frequencia, type LavagemCapilar, type LembreteCabelo, type PerfilCapilar, type PlanoCapilar, type Quimica, type Ritmo,
} from "@/lib/beleza-cabelo";
import { useChaveDaBeleza } from "./estado-compartilhado";
import { diaAnterior } from "./use-skincare";

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export type RespostasCapilares = { curvaturas: Curvatura[]; quimica: Quimica; frequencia: Frequencia; porosidade: [number, number, number] };

/**
 * O cronograma capilar inteiro, lido e gravado DIRETO no store (useChaveDaBeleza,
 * sem cópia): a aba CABELO, o card da Home e o lembrete enxergam a mesma coisa na
 * hora. Chaves novas (lib/beleza-cabelo); nenhuma chave antiga é tocada.
 */
export function useCabelo() {
  const hoje = localDayKey();
  const ontem = diaAnterior(hoje);
  const [perfilBruto, setPerfil] = useChaveDaBeleza<Partial<PerfilCapilar>>(CHAVE_PERFIL_CABELO, {});
  const [planoBruto, setPlano] = useChaveDaBeleza<Partial<PlanoCapilar>>(CHAVE_PLANO_CABELO, {});
  const [lavagensBrutas, setLavagens] = useChaveDaBeleza<LavagemCapilar[]>(CHAVE_LAVAGENS, []);
  const [lembreteBruto, setLembrete] = useChaveDaBeleza<LembreteCabelo>(CHAVE_LEMBRETE_CABELO, LEMBRETE_CABELO_PADRAO);

  const plano = planoValido(planoBruto);
  const perfil = perfilBruto && typeof perfilBruto === "object" && Array.isArray(perfilBruto.curvaturas) ? (perfilBruto as PerfilCapilar) : null;
  const lavagens = lavagensValidas(lavagensBrutas);
  const lembrete = lerLembreteCabelo(lembreteBruto);
  const estado = plano ? estadoDaFila(plano, lavagens) : null;
  const agenda = plano ? agendaCapilar(plano, lavagens, hoje, 28) : [];
  const proxima = plano ? proximaLavagem(plano, lavagens, hoje) : null;

  /** A etapa da vez num dia (o que a fila diz — a R espera se veio cedo demais). */
  const etapaNoDia = (dia: string): Etapa =>
    plano && estado ? etapaDaVez(estado.fila, plano.sequencia, estado.ultimaR, dia).etapa : "hidratacao";

  /** O dia é de lavar pelo cronograma? (hoje ou adiante; no passado, pelos dias fixos) */
  const ehDiaDeLavar = (dia: string): boolean => agenda.some((a) => a.dia === dia);

  /** As 4 perguntas respondidas: perfil + cronograma novo (a fila começa do zero). */
  const montar = (r: RespostasCapilares): PlanoCapilar => {
    const perfilNovo = perfilDasRespostas(r, hoje);
    const planoNovo = criarPlano(perfilNovo, hoje, novoId());
    setPerfil(perfilNovo);
    setPlano(planoNovo);
    return planoNovo;
  };

  const doDia = (dia: string) => lavagemDoDia(plano, lavagens, dia);

  /** Muda (ou cria) a lavagem do cronograma de um dia. */
  const mudarDoDia = (dia: string, muda: (l: LavagemCapilar) => LavagemCapilar) =>
    setLavagens((prev) => {
      const todas = lavagensValidas(prev);
      const i = todas.findIndex((l) => l.data === dia && l.noPlano && (!plano || l.plano === plano.id));
      if (i >= 0) return todas.map((l, j) => (j === i ? muda(l) : l));
      const nova: LavagemCapilar = {
        id: novoId(), data: dia, etapa: etapaNoDia(dia), noPlano: true, ...(plano ? { plano: plano.id } : {}),
        feita: false, passos: [], extras: [], produtos: {}, tags: [], nota: "",
      };
      return [...todas, muda(nova)];
    });

  const alternarPasso = (dia: string, passo: string) =>
    mudarDoDia(dia, (l) => ({ ...l, passos: l.passos.includes(passo) ? l.passos.filter((p) => p !== passo) : [...l.passos, passo] }));

  const alternarExtra = (dia: string, extra: string) =>
    mudarDoDia(dia, (l) => ({ ...l, extras: l.extras.includes(extra) ? l.extras.filter((p) => p !== extra) : [...l.extras, extra] }));

  const alternarTag = (dia: string, tag: string) =>
    mudarDoDia(dia, (l) => ({ ...l, tags: l.tags.includes(tag) ? l.tags.filter((p) => p !== tag) : [...l.tags, tag] }));

  const mudarEtapa = (dia: string, etapa: Etapa) => mudarDoDia(dia, (l) => ({ ...l, etapa }));
  const mudarNota = (dia: string, nota: string) => mudarDoDia(dia, (l) => ({ ...l, nota }));
  const mudarProduto = (dia: string, passo: string, produto: string) =>
    mudarDoDia(dia, (l) => {
      const produtos = { ...l.produtos };
      if (produto.trim()) produtos[passo] = produto.trim();
      else delete produtos[passo];
      return { ...l, produtos };
    });

  /** FEITO: a etapa conta — a fila anda. */
  const concluir = (dia: string, etapa?: Etapa) =>
    mudarDoDia(dia, (l) => ({ ...l, feita: true, ...(etapa ? { etapa } : {}) }));
  const reabrir = (dia: string) => mudarDoDia(dia, (l) => ({ ...l, feita: false }));

  /** "Lavei fora do plano": registra, não mexe na fila. */
  const registrarFora = (dia: string, dados: { etapa?: Etapa | null; extras?: string[]; tags?: string[]; nota?: string }) =>
    setLavagens((prev) => [
      ...lavagensValidas(prev),
      {
        id: novoId(), data: dia, etapa: dados.etapa ?? null, noPlano: false, feita: true,
        passos: [], extras: dados.extras ?? [], produtos: {}, tags: dados.tags ?? [], nota: dados.nota ?? "",
      },
    ]);

  const apagarLavagem = (id: string) => {
    const todas = lavagens;
    const idx = todas.findIndex((l) => l.id === id);
    const alvo = todas[idx];
    if (!alvo) return;
    setLavagens((prev) => lavagensValidas(prev).filter((l) => l.id !== id));
    avisarApagado("Lavagem apagada", () =>
      setLavagens((prev) => {
        const atual = lavagensValidas(prev);
        return atual.some((l) => l.id === id) ? atual : [...atual.slice(0, idx), alvo, ...atual.slice(idx)];
      }));
  };

  /** MEU MÊS: a lavagem prevista de `de` passa pra `para` (sem refazer as perguntas). */
  const moverLavagem = (de: string, para: string) => {
    if (!plano || !para || de === para) return;
    const trocas = { ...(plano.trocas ?? {}) };
    // já era uma troca? a origem é a de antes
    const origem = Object.entries(trocas).find(([, p]) => p === de)?.[0] ?? de;
    if (origem === para) delete trocas[origem];
    else trocas[origem] = para;
    setPlano({ ...plano, trocas });
  };

  const mudarRitmo = (ritmo: Ritmo) => { if (plano) setPlano({ ...plano, ritmo, trocas: {} }); };

  const mudarLembrete = (qual: keyof LembreteCabelo, patch: Partial<LembreteCabelo["dia"]>): LembreteCabelo => {
    const novo = { ...lembrete, [qual]: { ...lembrete[qual], ...patch } };
    setLembrete(novo);
    return novo;
  };

  return {
    hoje, ontem, perfil, plano, lavagens, lembrete, estado, agenda, proxima,
    etapaNoDia, ehDiaDeLavar, doDia, montar,
    alternarPasso, alternarExtra, alternarTag, mudarEtapa, mudarNota, mudarProduto, concluir, reabrir,
    registrarFora, apagarLavagem, moverLavagem, mudarRitmo, mudarLembrete,
  };
}

export type Cabelo = ReturnType<typeof useCabelo>;
