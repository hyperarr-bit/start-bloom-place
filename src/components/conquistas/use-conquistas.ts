import { useEffect, useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, CHAVE_PROTETORES,
  calcularSequencia, diasEfetivos, semearDoHub, somarDias, type EstadoSequencia,
} from "@/lib/sequencia";
import { acaoMaisUsada, type AcaoDoDia } from "@/lib/conquistas-acao";
import { CHAVE_DESBLOQUEADAS, buildBadgesSequencia, mesclarDesbloqueios, ordenarParaFolha, proximoAdesivo } from "@/lib/conquistas-registro";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { getLevel, getNextLevel, type Badge, type Level } from "@/components/gamification/types";

/* ------------------------------------------------------------------------- *
 * Sequência (26/09): leitura pra Home, Conquistas e o anel do dia
 * ------------------------------------------------------------------------- */

export interface Sequencia extends EstadoSequencia {
  hoje: string;
  /** O que sugerir no "falta 1 coisa" (módulo que a pessoa mais usa). */
  acao: AcaoDoDia;
  /** Ontem ficou vazio e um protetor segurou (pra contar na tela). */
  protegidoOntem: boolean;
}

export function useSequencia(): Sequencia {
  const { get } = useUserData();
  const hoje = localDayKey();
  const lista = get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
  const hub = get<unknown>(CHAVE_HUB_STREAK, null);
  const estado = useMemo(() => calcularSequencia(diasEfetivos(lista, hub, hoje), hoje), [lista, hub, hoje]);
  const acao = useMemo(() => acaoMaisUsada(get, hoje), [get, hoje]);
  return { ...estado, hoje, acao, protegidoOntem: estado.usados.includes(somarDias(hoje, -1)) };
}

/**
 * Escritas da sequência — montar UMA vez por tela (MomentosConquistas):
 *  1. migração: grava a semente do hub na 1ª vez (lista ausente);
 *  2. espelho `conquistas-protetores` {saldo, usados} + evento quando um
 *     protetor novo foi gasto (a conta de verdade é refeita dos dias).
 * Só depois do servidor responder — antes disso a lista pode estar só no cache.
 */
export function useEfeitosSequencia(seq: Sequencia) {
  const { get, set, loaded } = useUserData();
  const listaGravada = Array.isArray(get<unknown>(CHAVE_DIAS_ANOTADOS, undefined));

  useEffect(() => {
    if (!loaded || listaGravada) return;
    set(CHAVE_DIAS_ANOTADOS, semearDoHub(get(CHAVE_HUB_STREAK, null), localDayKey()), { system: true });
  }, [loaded, listaGravada, get, set]);

  const usadosTxt = seq.usados.slice(-60).join(",");
  useEffect(() => {
    if (!loaded || !listaGravada) return;
    const salvo = get<{ saldo?: number; usados?: unknown } | null>(CHAVE_PROTETORES, null);
    const usadosSalvos = Array.isArray(salvo?.usados) ? (salvo!.usados as string[]) : [];
    if (salvo && salvo.saldo === seq.saldo && usadosSalvos.join(",") === usadosTxt) return;
    const usados = usadosTxt ? usadosTxt.split(",") : [];
    const novos = usados.filter((d) => !usadosSalvos.includes(d));
    set(CHAVE_PROTETORES, { saldo: seq.saldo, usados }, { system: true });
    if (salvo && novos.length) trackEvent("sequencia_protetor_usado", { dias: seq.dias, protegidos: novos.length });
  }, [loaded, listaGravada, seq.saldo, seq.dias, usadosTxt, get, set]);
}

/* ------------------------------------------------------------------------- *
 * Conquistas (adesivos, XP e nível)
 * ------------------------------------------------------------------------- */

// Um evento por adesivo por sessão, mesmo com a tela e os momentos lendo juntos.
const eventosDeAdesivo = new Set<string>();

export interface EstadoConquistas {
  /** Todas, com `unlocked` já somando o que está gravado. */
  adesivos: Badge[];
  /** Na ordem da folha (conquistados, depois os que faltam). */
  folha: Badge[];
  desbloqueadas: Record<string, string>;
  abertos: number;
  xp: number;
  nivel: Level;
  proximoNivel: Level | null;
  proximo: Badge | null;
  /** Já existe o registro gravado (fora a 1ª abertura desta versão). */
  registroPronto: boolean;
}

export function useConquistas(): EstadoConquistas {
  const { get, set, loaded } = useUserData();
  const hoje = localDayKey();
  const lista = get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
  const hub = get<unknown>(CHAVE_HUB_STREAK, null);
  const recorde = useMemo(() => calcularSequencia(diasEfetivos(lista, hub, hoje), hoje).recorde, [lista, hub, hoje]);
  const gravadas = get<unknown>(CHAVE_DESBLOQUEADAS, undefined);

  const r = useMemo(() => {
    let calculadas: Badge[] = [];
    try {
      calculadas = [...buildBadgesSequencia(recorde), ...buildBadgesFinancas(get), ...buildBadgesVida(get)];
    } catch (e) {
      console.error("[conquistas] cálculo falhou:", e);
      calculadas = buildBadgesSequencia(recorde);
    }
    return mesclarDesbloqueios(calculadas, gravadas, hoje);
  }, [get, gravadas, recorde, hoje]);

  // Grava o que abriu agora. Na 1ª vez (sem registro) grava tudo em silêncio:
  // é a linha de base, não "desbloqueio novo".
  const novasTxt = r.novas.join(",");
  useEffect(() => {
    if (!loaded || !novasTxt) return;
    const primeiraVez = gravadas === undefined;
    set(CHAVE_DESBLOQUEADAS, r.desbloqueadas, { system: true });
    if (primeiraVez) return;
    for (const id of novasTxt.split(",")) {
      if (eventosDeAdesivo.has(id)) continue;
      eventosDeAdesivo.add(id);
      trackEvent("adesivo_desbloqueado", { id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, novasTxt]);

  return useMemo(() => {
    const folha = ordenarParaFolha(r.adesivos, r.desbloqueadas);
    return {
      adesivos: r.adesivos,
      folha,
      desbloqueadas: r.desbloqueadas,
      abertos: r.adesivos.filter((b) => b.unlocked).length,
      xp: r.xp,
      nivel: getLevel(r.xp),
      proximoNivel: getNextLevel(r.xp),
      proximo: proximoAdesivo(r.adesivos),
      registroPronto: gravadas !== undefined,
    };
  }, [r, gravadas]);
}

/* ------------------------------------------------------------------------- *
 * Quem é (nome da etiqueta e "membro desde")
 * ------------------------------------------------------------------------- */

/** "julho de 2026" — mês de criação da conta (sem conta: o 1º dia anotado). */
export const membroDesdeTexto = (criadaEm: string | undefined | null, primeiroDia: string | undefined, hoje: string): string => {
  let d: Date | null = null;
  if (criadaEm) {
    const x = new Date(criadaEm);
    if (!Number.isNaN(x.getTime())) d = x;
  }
  if (!d) d = parseLocalDay(primeiroDia || hoje);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export function usePerfilConquistas() {
  const { user } = useAuth();
  const { get } = useUserData();
  const hoje = localDayKey();
  const lista = get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
  const nome =
    (get<string>("core-user-name", "") || "").trim() ||
    (get<string>("user-name", "") || "").trim() ||
    user?.email?.split("@")[0] ||
    "Você";
  const primeiro = Array.isArray(lista) ? diasEfetivos(lista, null, hoje)[0] : undefined;
  return { nome, membroDesde: membroDesdeTexto(user?.created_at, primeiro, hoje) };
}
