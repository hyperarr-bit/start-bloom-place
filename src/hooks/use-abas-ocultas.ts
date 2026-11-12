/**
 * ABAS OCULTÁVEIS POR MÓDULO (07/09; "Organizar abas" em todos os módulos na 1.0.22, dono 28/10).
 *
 * Pedidos: duas avaliações da Play (07/09: "ocultar certas abas (ex. jejum intermitente)", "mover, editar, ocultar") e
 * dois chamados de 27–28/10 ("achei completo mas confuso", "ocultar as abas que não uso"). Os dados batem: em quase
 * todo módulo só 1–2 abas têm uso real.
 *
 * A regra mora em lib/abas-ocultas (chaves, ordem, padrão enxuto da conta nova, tutorial). Este hook só junta a regra
 * com o user_data e os eventos:
 *   aba_ocultada / aba_mostrada {modulo, aba} · abas_mostrar_todas {modulo} · aba_movida {modulo, aba, para}
 *   (abas_organizar_aberto é da fileira, que abre a folha).
 *
 * COMO ADOTAR NUMA PÁGINA:
 *   const TABS = [{ id: "semana", label: "SEMANA", icon: "📅" }, ...];   // estável (fora do componente ou useMemo)
 *   const abas = useAbasOcultas("rotina", TABS);                            // o id do módulo na rota/ModuleDrawer
 *   <AbasOcultaveis abas={abas} ativa={activeTab} onTrocar={setActiveTab} className="max-w-7xl mx-auto px-4 pb-2" />
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { CHAVE_ORIGEM_CONTA, contaEhNova, lerMarcadorOrigem } from "@/lib/home-nova";
import { bracoAbas, medicaoAbasLigada, visualAbas, type VisualAbas } from "@/lib/abas-caderno";
import { ABAS_POUCO_USO } from "@/lib/abas-enxutas";
import {
  abasEnxutasLigada, chaveAbasOcultas, chaveOrdemDasAbas, lerListaDeIds, moverNaOrdem, ocultasEfetivas, ordenarAbas,
  ouvirTodasAsAbas, todasAsAbasSeguras,
} from "@/lib/abas-ocultas";

export { chaveAbasOcultas, chaveOrdemDasAbas } from "@/lib/abas-ocultas";

export interface AbaOcultavel {
  id: string;
  label: string;
  icon?: string;
  /** O `data-spotlight` do botão, quando não é `tab-<id>` (Finanças: "financeiro"). */
  spotlight?: string;
}

export interface AbasOcultas<T extends AbaOcultavel> {
  /** O id do módulo (vai nos eventos). */
  modulo?: string;
  /** Abas que a pessoa vê, na ordem dela. */
  visiveis: T[];
  /** Abas escondidas, na ordem dela — pra listar na folha. */
  ocultas: T[];
  /** Todas, na ordem dela. */
  todas: T[];
  /** Esconde uma aba. Devolve false (e não faz nada) se seria a última visível. */
  ocultar: (id: string, origem?: OrigemDaAba) => boolean;
  mostrar: (id: string, origem?: OrigemDaAba) => void;
  mostrarTodas: (origem?: OrigemDaAba) => void;
  /** Move uma casa (−1 pra frente, +1 pra trás). Opcional: a fileira só mostra ↑↓ quando existe. */
  mover?: (id: string, delta: -1 | 1) => void;
  /** false quando só resta uma aba — a folha usa pra travar o interruptor. */
  podeOcultar: boolean;
  /** Conta nova com o padrão enxuto valendo neste módulo (a fileira mostra "Mostrar todas as abas"). */
  enxuta?: boolean;
  /** 07/11 (lib/abas-caderno, SPEC trial-abas): conta nova no braço SUMÁRIO — a porta abre o índice que não grava.
   *  Ausente = a porta de hoje. */
  porta?: "sumario";
  /** 07/11: o visual da fileira da conta nova quando não é o de hoje ("fixa" = plano B, "caderno" = divisórias). */
  visual?: Exclude<VisualAbas, "hoje">;
  /** 07/11: a medição nova (`aba_aberta`, `origem` nos eventos) está ligada aqui. */
  medir?: boolean;
}

/** De onde veio a mudança na fileira (só vai no evento com a medição nova ligada — lib/abas-caderno). */
export type OrigemDaAba = "fileira" | "folha" | "sumario" | "link" | "dica" | "missao" | "entrada";

/** O tutorial (holofote) está aberto em algum lugar? Enquanto estiver, todas as abas aparecem. */
function useTodasAsAbasSeguras(): boolean {
  const [v, setV] = useState(todasAsAbasSeguras);
  useEffect(() => { setV(todasAsAbasSeguras()); return ouvirTodasAsAbas(() => setV(todasAsAbasSeguras())); }, []);
  return v;
}

/** A conta da sessão é NOVA (o marcador de origem da Home nova)? É quem o padrão enxuto e o caderno alcançam. */
function useContaNovaDasAbas(): boolean {
  const { get } = useUserData();
  const origemNaConta = lerMarcadorOrigem(get<unknown>(CHAVE_ORIGEM_CONTA, null));
  return origemNaConta === "nova" || (origemNaConta === null && contaEhNova());
}

/** 07/11: a porta deste módulo é o Sumário com abas guardadas (conta nova, braço sumário, enxuto ligado, o módulo tem
 *  aba de pouco uso)? A 3ª dica muda de texto. Beleza, Saúde e Treino não guardam nada: lá a dica fica a de hoje (dizer
 *  "ver o resto" num módulo sem resto seria mentir). */
export function usePortaDoSumario(moduloId: string): boolean {
  const nova = useContaNovaDasAbas();
  return nova && (ABAS_POUCO_USO[moduloId]?.length ?? 0) > 0 && abasEnxutasLigada() && bracoAbas() === "sumario";
}

export function useAbasOcultas<T extends AbaOcultavel>(moduloId: string, abas: T[]): AbasOcultas<T> {
  // `null` = nada gravado (o padrão enxuto da conta nova pode valer). Gravar [] = "mostrar todas", explícito.
  const [gravadaBruta, setGravada] = usePersistedState<string[] | null>(chaveAbasOcultas(moduloId), null);
  const [ordemBruta, setOrdem] = usePersistedState<string[] | null>(chaveOrdemDasAbas(moduloId), null);
  const seguras = useTodasAsAbasSeguras();

  const contaNova = useContaNovaDasAbas();
  const enxutaDaConta = abasEnxutasLigada() && contaNova;
  // 07/11 (lib/abas-caderno): fora do padrão, só a conta NOVA ganha a porta do sumário e o visual novo
  const porta = enxutaDaConta && bracoAbas() === "sumario" ? ("sumario" as const) : undefined;
  const visualAqui = contaNova ? visualAbas() : "hoje";
  const visual = visualAqui === "hoje" ? undefined : visualAqui;
  const medir = medicaoAbasLigada();
  const comOrigem = useCallback((d: Record<string, unknown>, origem?: OrigemDaAba) => (medir && origem ? { ...d, origem } : d), [medir]);

  const gravada = useMemo(() => lerListaDeIds(gravadaBruta), [gravadaBruta]);
  const ordem = useMemo(() => lerListaDeIds(ordemBruta), [ordemBruta]);
  const todas = useMemo(() => ordenarAbas(abas, ordem), [abas, ordem]);
  const ids = useMemo(() => todas.map((a) => a.id), [todas]);
  const lista = useMemo(
    () => (seguras ? [] : ocultasEfetivas({ ids, gravada, enxuta: enxutaDaConta, moduloId })),
    [ids, gravada, enxutaDaConta, moduloId, seguras],
  );
  // a lista "de verdade" (sem o tutorial), pra gravar a partir dela
  const real = useMemo(() => ocultasEfetivas({ ids, gravada, enxuta: enxutaDaConta, moduloId }), [ids, gravada, enxutaDaConta, moduloId]);

  const visiveis = useMemo(() => todas.filter((a) => !lista.includes(a.id)), [todas, lista]);
  const ocultas = useMemo(() => todas.filter((a) => lista.includes(a.id)), [todas, lista]);

  const ocultar = useCallback((id: string, origem?: OrigemDaAba) => {
    const aindaVisiveis = ids.filter((x) => !real.includes(x));
    if (!aindaVisiveis.includes(id)) return false; // já oculta ou não existe
    if (aindaVisiveis.length <= 1) return false;   // a última fica
    setGravada([...real, id]);
    trackEvent("aba_ocultada", comOrigem({ modulo: moduloId, aba: id }, origem));
    return true;
  }, [ids, real, setGravada, moduloId, comOrigem]);

  const mostrar = useCallback((id: string, origem?: OrigemDaAba) => {
    if (!real.includes(id)) return;
    setGravada(real.filter((x) => x !== id));
    trackEvent("aba_mostrada", comOrigem({ modulo: moduloId, aba: id }, origem));
  }, [real, setGravada, moduloId, comOrigem]);

  const mostrarTodas = useCallback((origem?: OrigemDaAba) => {
    setGravada([]);
    trackEvent("abas_mostrar_todas", comOrigem({ modulo: moduloId, ocultas: real.length }, origem));
  }, [setGravada, moduloId, real.length, comOrigem]);

  const mover = useCallback((id: string, delta: -1 | 1) => {
    const nova = moverNaOrdem(ids, id, delta);
    if (!nova) return;
    setOrdem(nova);
    trackEvent("aba_movida", { modulo: moduloId, aba: id, para: nova.indexOf(id) });
  }, [ids, setOrdem, moduloId]);

  return {
    modulo: moduloId, visiveis, ocultas, todas, ocultar, mostrar, mostrarTodas, mover,
    podeOcultar: visiveis.length > 1,
    enxuta: enxutaDaConta && real.length > 0,
    porta, visual, medir,
  };
}
