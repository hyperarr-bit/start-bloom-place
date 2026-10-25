import { aplicarCatalogoCaderno } from "@/components/gamification/catalogo-caderno";
import { useEffect, useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, CHAVE_PROTETORES,
  calcularSequencia, diasEfetivos, semearDoHub, somarDias, type EstadoSequencia,
} from "@/lib/sequencia";
import { acaoDoDia, type AcaoDoDia } from "@/lib/acao-do-dia";
import { faixaDoFogo, type Faixa } from "@/lib/fogo-sequencia";
import { CHAVE_ALBUM_VISTO, CHAVE_DESBLOQUEADAS, CHAVE_VISTAS, ID_DIA_UM, dataDoDiaUmSilencioso, buildBadgesSequencia, mesclarDesbloqueios, lerDesbloqueadas, ordenarParaFolha, proximoAdesivo, xpPelaTabelaAntiga } from "@/lib/conquistas-registro";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import {
  CATEGORIAS, CHAVE_NIVEL_PISO, RARIDADES, getLevel, getNextLevel, indiceDoNivel, nivelPelaEscadaAntiga, nivelPeloXp, raridadeDe,
  type Badge, type BadgeCategoria, type Level, type Raridade,
} from "@/components/gamification/types";

/* ------------------------------------------------------------------------- *
 * Sequência (26/09): leitura pra Home, Conquistas e o anel do dia
 * ------------------------------------------------------------------------- */

export interface Sequencia extends EstadoSequencia {
  hoje: string;
  /** Os dias anotados (lista limpa) — a linha da semana lê daqui. */
  lista: string[];
  /** A ação do dia — DA PESSOA, do dia da semana, com rodízio (lib/acao-do-dia.ts). */
  acao: AcaoDoDia;
  /** A faixa do fogo (laranja → vermelho → roxo → azul → dourado) pelos dias seguidos. */
  faixa: Faixa;
  /** Ontem ficou vazio e um protetor segurou (pra contar na tela). */
  protegidoOntem: boolean;
}

export function useSequencia(): Sequencia {
  const { get } = useUserData();
  const hoje = localDayKey();
  const lista = get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
  const hub = get<unknown>(CHAVE_HUB_STREAK, null);
  const efetivos = useMemo(() => diasEfetivos(lista, hub, hoje), [lista, hub, hoje]);
  const estado = useMemo(() => calcularSequencia(efetivos, hoje), [efetivos, hoje]);
  const acao = useMemo(() => acaoDoDia(get, hoje), [get, hoje]);
  const faixa = useMemo(() => faixaDoFogo(estado.dias), [estado.dias]);
  return { ...estado, hoje, lista: efetivos, acao, faixa, protegidoOntem: estado.usados.includes(somarDias(hoje, -1)) };
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

export interface Colecao {
  id: BadgeCategoria;
  label: string;
  emoji: string;
  abertos: number;
  total: number;
}

export interface EstadoConquistas {
  /** Todas, com `unlocked` já somando o que está gravado. */
  adesivos: Badge[];
  arquivados?: Badge[];
  /** Na ordem da folha (conquistados, depois os que faltam). */
  folha: Badge[];
  desbloqueadas: Record<string, string>;
  abertos: number;
  xp: number;
  /** Nível efetivo (XP ou piso, o maior). */
  nivel: Level;
  /** Nível só pelo XP — diferente do efetivo quando o piso está valendo. */
  nivelPorXp: Level;
  /** O piso gravado está segurando o nível (escada nova mais alta que a antiga). */
  pisoValendo: boolean;
  proximoNivel: Level | null;
  proximo: Badge | null;
  /** Conquistados e total por raridade ("1 de 14 épicos do CORE"). */
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  /** Por módulo ("Finanças 6/24"). */
  colecoes: Colecao[];
  /** Já existe o registro gravado (fora a 1ª abertura desta versão). */
  registroPronto: boolean;
  /** 26/10: conta que JÁ usava o app — a "1 Dia Anotado" (nova na 1.0.19) cola em silêncio, sem festa/toast. */
  diaUmSilencioso: boolean;
}

/** Contagem por raridade e por módulo — puro, pra testes e pras artes. */
export const contarAdesivos = (adesivos: Badge[]) => {
  const porRaridade = Object.fromEntries(RARIDADES.map((r) => [r, { abertos: 0, total: 0 }])) as Record<Raridade, { abertos: number; total: number }>;
  for (const b of adesivos) {
    const r = porRaridade[raridadeDe(b)];
    r.total++;
    if (b.unlocked) r.abertos++;
  }
  const colecoes: Colecao[] = CATEGORIAS.map((c) => {
    const dela = adesivos.filter((b) => b.category === c.id);
    return { id: c.id, label: c.label, emoji: c.emoji, abertos: dela.filter((b) => b.unlocked).length, total: dela.length };
  }).filter((c) => c.total > 0);
  return { porRaridade, colecoes };
};

export function useConquistas(): EstadoConquistas {
  const { get, set, loaded } = useUserData();
  const hoje = localDayKey();
  const lista = get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
  const hub = get<unknown>(CHAVE_HUB_STREAK, null);
  const seq = useMemo(() => {
    const efetivos = diasEfetivos(lista, hub, hoje);
    return { ...calcularSequencia(efetivos, hoje), diasAnotados: efetivos.length };
  }, [lista, hub, hoje]);
  const gravadas = get<unknown>(CHAVE_DESBLOQUEADAS, undefined);
  const piso = get<unknown>(CHAVE_NIVEL_PISO, undefined);
  // 26/10: "1 Dia Anotado" pra quem JÁ usava o app cola em silêncio, datada do 1º registro (lib/conquistas-registro)
  const dataDoDiaUm = useMemo(() => dataDoDiaUmSilencioso(diasEfetivos(lista, hub, hoje), lerDesbloqueadas(gravadas), hoje), [lista, hub, hoje, gravadas]);

  const r = useMemo(() => {
    const daSequencia = buildBadgesSequencia(seq.recorde, { protetoresUsados: seq.usados.length, diasAnotados: seq.diasAnotados });
    let calculadas: Badge[] = [];
    try {
      calculadas = [...daSequencia, ...buildBadgesFinancas(get), ...buildBadgesVida(get, hoje)];
    } catch (e) {
      console.error("[conquistas] cálculo falhou:", e);
      calculadas = daSequencia;
    }
    return mesclarDesbloqueios(aplicarCatalogoCaderno(calculadas, get, lerDesbloqueadas(gravadas), hoje), gravadas, hoje);
  }, [get, gravadas, seq, hoje]);

  /*
   * Grava o que abriu agora. Na 1ª vez (sem registro) grava tudo em silêncio:
   * é a linha de base, não "desbloqueio novo".
   *
   * 17/10 (revisão tela a tela, #95): a linha de base do ÁLBUM (`conquistas-album-visto`) nasce JUNTO,
   * no mesmo instante. Antes o registro só era gravado quando algo abria — a conta VAZIA ficava sem
   * registro, o álbum esperava o "registro pronto" pra gravar a base dele e, quando a pessoa abria as
   * Conquistas depois do 1º gasto, a 1ª figurinha entrava na base como "vista": sem "1 nova pra colar"
   * e sem o momento de colar (da 2ª em diante funcionava). Agora a conta vazia grava `{}` e `[]` assim
   * que a conta chega (os Momentos montam em toda tela de módulo): a 1ª figurinha chega como a 2ª.
   * Quem já tinha registro e nunca abriu o álbum segue como antes (a base do álbum na 1ª abertura dele).
   * A festa não muda (outra chave, `conquistas-vistas`, e no teste com a Missão ela continua quieta).
   */
  const novasTxt = r.novas.join(",");
  const primeiraVez = gravadas === undefined;
  useEffect(() => {
    if (!loaded || (!novasTxt && !primeiraVez)) return;
    const novas = novasTxt ? novasTxt.split(",") : [];
    // 26/10: a "1 Dia Anotado" de quem JÁ usava o app entra datada do 1º registro, já vista e já colada (em silêncio)
    const diaUmSilencioso = !primeiraVez && novas.includes(ID_DIA_UM) && dataDoDiaUm !== null;
    set(CHAVE_DESBLOQUEADAS, diaUmSilencioso ? { ...r.desbloqueadas, [ID_DIA_UM]: dataDoDiaUm } : r.desbloqueadas, { system: true });
    if (primeiraVez) {
      if (get<unknown>(CHAVE_ALBUM_VISTO, undefined) === undefined) {
        set(CHAVE_ALBUM_VISTO, r.adesivos.filter((b) => b.unlocked).map((b) => b.id), { system: true });
      }
      return;
    }
    if (diaUmSilencioso) {
      const visto = get<unknown>(CHAVE_ALBUM_VISTO, undefined);
      if (Array.isArray(visto) && !visto.includes(ID_DIA_UM)) set(CHAVE_ALBUM_VISTO, [...visto, ID_DIA_UM], { system: true });
      const vistas = get<unknown>(CHAVE_VISTAS, undefined) as { adesivos?: unknown } | undefined;
      if (vistas && typeof vistas === "object" && Array.isArray(vistas.adesivos) && !vistas.adesivos.includes(ID_DIA_UM)) {
        set(CHAVE_VISTAS, { ...vistas, adesivos: [...vistas.adesivos, ID_DIA_UM] }, { system: true });
      }
    }
    for (const id of novas) {
      if (eventosDeAdesivo.has(id)) continue;
      eventosDeAdesivo.add(id);
      trackEvent("adesivo_desbloqueado", diaUmSilencioso && id === ID_DIA_UM ? { id, silencioso: true } : { id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, novasTxt, primeiraVez]);

  /*
   * PISO DE NÍVEL (27/09): a escada nova é mais alta (Prata 300, Ouro 800…) e
   * ninguém pode acordar num nível abaixo do que já tinha. Na 1ª vez, o piso é
   * o nível pela escada ANTIGA com o XP que os adesivos valiam antes; depois,
   * sobe sempre que o XP passa de um degrau. Só escreve com o servidor
   * respondido (antes disso a lista de desbloqueios pode estar só no cache).
   */
  const nivelPorXp = nivelPeloXp(r.xp);
  const pisoInicial = piso === undefined ? nivelPelaEscadaAntiga(xpPelaTabelaAntiga(r.adesivos)).name : null;
  useEffect(() => {
    if (!loaded) return;
    if (piso === undefined) {
      const inicial = indiceDoNivel(pisoInicial) > indiceDoNivel(nivelPorXp.name) ? pisoInicial : nivelPorXp.name;
      set(CHAVE_NIVEL_PISO, inicial, { system: true });
      return;
    }
    if (indiceDoNivel(nivelPorXp.name) > indiceDoNivel(piso)) set(CHAVE_NIVEL_PISO, nivelPorXp.name, { system: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, piso, pisoInicial, nivelPorXp.name]);

  return useMemo(() => {
    const ativos = r.adesivos.filter(b => !b.arquivada);
    const folha = ordenarParaFolha(ativos, r.desbloqueadas);
    const pisoEfetivo = piso === undefined ? pisoInicial : piso;
    const nivel = getLevel(r.xp, pisoEfetivo);
    return {
      adesivos: ativos,
      arquivados: r.adesivos.filter(b => b.arquivada),
      folha,
      desbloqueadas: r.desbloqueadas,
      abertos: ativos.filter((b) => b.unlocked).length,
      xp: r.xp,
      nivel,
      nivelPorXp,
      pisoValendo: indiceDoNivel(nivel.name) > indiceDoNivel(nivelPorXp.name),
      proximoNivel: getNextLevel(r.xp, pisoEfetivo),
      proximo: proximoAdesivo(ativos),
      ...contarAdesivos(ativos),
      registroPronto: gravadas !== undefined,
      diaUmSilencioso: dataDoDiaUm !== null,
    };
  }, [r, gravadas, piso, pisoInicial, nivelPorXp, dataDoDiaUm]);
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

/** "2026" — o ano do "membro desde", pra carteirinha ("DESDE 2026"). */
export const anoDeMembro = (membroDesde: string, hoje: string = localDayKey()): number => {
  const m = /(\d{4})/.exec(membroDesde);
  return m ? Number(m[1]) : Number(hoje.slice(0, 4));
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
