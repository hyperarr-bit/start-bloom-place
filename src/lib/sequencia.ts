import { localDayKey, parseLocalDay } from "@/lib/utils";

/**
 * SEQUÊNCIA NOVA (26/09): conta DIAS COM ALGO ANOTADO em qualquer módulo.
 *
 * A antiga (`core-hub-streak`) contava dias em que o app ABRIU — abrir e fechar
 * valia o mesmo que registrar o dia inteiro, e a Home mostrava "40 dias" pra
 * quem não anotava nada há semanas. Aqui a regra é o que a pessoa fez.
 *
 * Tudo neste arquivo é PURO (sem React, sem storage): quem grava é o
 * useUserData (o dia anotado) e o useSequencia (espelho dos protetores). Dia é
 * sempre a chave LOCAL "AAAA-MM-DD" — nunca UTC (no Brasil, depois das 21h o
 * UTC já é amanhã; ver datas-locais.test).
 */

export const CHAVE_DIAS_ANOTADOS = "core-dias-anotados";
export const CHAVE_PROTETORES = "conquistas-protetores";
export const CHAVE_HUB_STREAK = "core-hub-streak";

/** Quantos dias a lista guarda (o suficiente pra recorde de um ano). */
export const MAX_DIAS_GUARDADOS = 400;
/** Protetor 🧊: ganha 1 a cada 7 dias seguidos, guarda no máximo 2. */
export const DIAS_POR_PROTETOR = 7;
export const MAX_PROTETORES = 2;
/** Marcos que ganham a roseta (e o adesivo da sequência). */
export const MARCOS_SEQUENCIA = [7, 30, 100] as const;

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
export const ehDia = (v: unknown): v is string => typeof v === "string" && RE_DIA.test(v);

/** Dia local ± n. Passa pela meia-noite LOCAL (parseLocalDay), então virada de
 *  mês/ano e horário de verão não comem nem duplicam dia. */
export const somarDias = (dia: string, n: number): string => {
  const d = parseLocalDay(dia);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
};

/** Lista limpa: só "AAAA-MM-DD", sem repetir, em ordem, os últimos 400. */
export const normalizarDias = (lista: unknown): string[] => {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter(ehDia))].sort().slice(-MAX_DIAS_GUARDADOS);
};

/* ------------------------------------------------------------------------- *
 * O que conta como "algo anotado"
 * ------------------------------------------------------------------------- */

/**
 * Chaves que NÃO são anotação da pessoa: preferência, navegação, marcador de
 * sistema, carimbo automático. Tudo o mais que ela grava (gasto, hábito,
 * treino, refeição, humor, nota, livro…) conta.
 *
 * Por que lista de EXCLUSÃO e não de inclusão: são 16 módulos e ~200 chaves de
 * dado; uma lista de inclusão esquece módulo novo calado. O perigo da exclusão
 * é o contrário (carimbo automático contando como dia) — por isso as escritas
 * que acontecem sozinhas ao abrir uma tela estão aqui nomeadas, e o teste
 * sequencia-registro trava as principais.
 */
const PREFIXOS_DE_INTERFACE = [
  // tutorial, onboarding e funil
  "spotlight-", "quickstart-", "tutorial-", "force-new-user", "onboarding", "core-onboarding",
  "core-all-modules", "core-welcome", "core-missao", "core-trial", "core-funnel", "core-demo",
  "core-save-offer", "core-boas-vindas", "quicksignup-", "paywall-", "funil-", "trial-", "missao-",
  // a própria sequência, as conquistas e a gamificação antiga
  "core-hub-streak", "core-dias-anotados", "conquistas-", "gamification-", "core-dia-100",
  // aparência, lembretes, notificações, home e abas
  "core-theme", "core-home-widgets", "home-widgets", "core-module-prefs", "core-lembrete", "lembrete",
  "notif-", "abas-", "module-", "nudge-", "daily-nudge", "offline-", "core-offline",
  // identidade e marcadores de dispositivo
  "core-user-name", "core-pwa", "core-gw-arm", "core-chunk", "core-cb",
  // banners, convites e retenção
  "wrapped-", "winback-", "avaliacao-", "convite-", "pix-",
];

const CHAVES_DE_INTERFACE = new Set([
  "theme", "vite-ui-theme", "user-name", "name", "email",
  // carimbos que as telas gravam SOZINHAS ao abrir (semana da grade, perfil ativo…)
  "rotina-habits-week", "treino-semana-dos-checks", "finance-perfil-ativo", "finance-keys-migrated-v2",
  "skincare-cycle-start",
  // ajustes (não é o dia da pessoa, é configuração)
  "rotina-agenda-inicio", "treino-active-days", "treino-descanso-padrao", "treino-sound",
  "estudos-grade-sabado", "estudos-schedule-name", "core-saude-copo-ml", "finance-ultima-importacao",
]);

const PADROES_DE_INTERFACE: RegExp[] = [
  /-prefs?$/, // notif-prefs, core-module-prefs…
  /-vist[oa]/, // finance-visto-dia, core-boas-vindas-visto…
  /seen/, // finance-last-seen-month
  /-ack$/, // finance-turnover-ack, finance-copia-ack
  /-dismissed$/, /-hidden$/, /-perguntad[oa]$/,
  /-migrated/, /-reset/, /-version$/,
  /-goal$/, // metas de água/sono/leitura: ajuste, não registro
  /-meta-semanal$/, /-config$/, /-week$/,
];

/** A chave é de DADO da pessoa (conta pra sequência)? */
export const contaComoAnotacao = (chave: string): boolean => {
  if (!chave) return false;
  if (CHAVES_DE_INTERFACE.has(chave)) return false;
  if (PREFIXOS_DE_INTERFACE.some((p) => chave.startsWith(p))) return false;
  if (PADROES_DE_INTERFACE.some((re) => re.test(chave))) return false;
  return true;
};

/** Valor com conteúdo (lista/objeto vazio, "" e 0 não anotam nada — é limpeza). */
export const temConteudo = (v: unknown): boolean => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v !== 0;
  return v === true;
};

/* ------------------------------------------------------------------------- *
 * Migração e registro
 * ------------------------------------------------------------------------- */

/**
 * MIGRAÇÃO SEM SUSTO: quem via "N dias" ontem na Home continua vendo N.
 *
 * O `core-hub-streak` guarda {count, lastDate} e conta o dia de HOJE quando o
 * app abriu hoje. A semente são os dias ATÉ ONTEM, pra hoje continuar em
 * aberto (anotou → sobe): lastDate = ontem → N dias; lastDate = hoje → N-1
 * (o N de hoje era só a abertura). Mais velho que ontem = sequência já quebrada.
 */
export const semearDoHub = (hub: unknown, hoje: string): string[] => {
  const h = hub as { count?: unknown; lastDate?: unknown } | null | undefined;
  if (!h || !ehDia(h.lastDate)) return [];
  const ontem = somarDias(hoje, -1);
  if (h.lastDate !== hoje && h.lastDate !== ontem) return [];
  const n = Math.min(MAX_DIAS_GUARDADOS, Math.floor(Number(h.count) || 0) - (h.lastDate === hoje ? 1 : 0));
  const dias: string[] = [];
  for (let i = n; i >= 1; i--) dias.push(somarDias(hoje, -i));
  return dias;
};

/**
 * Registra HOJE na lista. Devolve a lista nova, ou `null` quando não há nada a
 * gravar (hoje já está lá). Lista ausente = primeira vez: nasce da semente do
 * hub (migração) + hoje.
 */
export const registrarDia = (lista: unknown, hoje: string, hub?: unknown): string[] | null => {
  if (Array.isArray(lista)) {
    const atual = normalizarDias(lista);
    if (atual.includes(hoje)) return null;
    return normalizarDias([...atual, hoje]);
  }
  return normalizarDias([...semearDoHub(hub, hoje), hoje]);
};

/* ------------------------------------------------------------------------- *
 * Marcar OUTRO dia (02/10): "esqueci de marcar ontem"
 * ------------------------------------------------------------------------- */

/** Até quantos dias pra trás dá pra marcar (ontem e anteontem). */
export const DIAS_PRA_TRAS = 2;

export interface DiaRetroativo {
  dia: string;
  diasAtras: 1 | 2;
  /** "ontem" | "anteontem" */
  rotulo: string;
}

/** Os dias que ainda dá pra marcar, do mais perto pro mais longe. */
export const diasRetroativos = (hoje: string): DiaRetroativo[] => [
  { dia: somarDias(hoje, -1), diasAtras: 1, rotulo: "ontem" },
  { dia: somarDias(hoje, -2), diasAtras: 2, rotulo: "anteontem" },
];

/** 0 = hoje, 1 = ontem, 2 = anteontem; qualquer outro dia (futuro ou mais velho) = null. */
export const diasAtras = (dia: unknown, hoje: string): 0 | 1 | 2 | null => {
  if (!ehDia(dia)) return null;
  if (dia === hoje) return 0;
  const r = diasRetroativos(hoje).find((d) => d.dia === dia);
  return r ? r.diasAtras : null;
};

/**
 * Anota um dia PASSADO (ontem ou anteontem) na lista. Devolve a lista nova, ou
 * `null` quando não há nada a gravar (o dia já está lá, ou está fora da janela
 * de 2 dias). Lista ausente = primeira vez: nasce da semente do hub.
 *
 * Não mexe em hoje: marcar ontem não faz hoje contar. A sequência é refeita
 * do zero pelos dias (calcularSequencia), então o dia que entrou fecha o
 * buraco sozinho — e entrar duas vezes é a mesma lista (nada duplica).
 */
export const registrarDiaRetroativo = (lista: unknown, dia: string, hoje: string, hub?: unknown): string[] | null => {
  const atras = diasAtras(dia, hoje);
  if (atras === null || atras === 0) return null;
  const base = Array.isArray(lista) ? normalizarDias(lista) : semearDoHub(hub, hoje);
  if (base.includes(dia)) return null;
  return normalizarDias([...base, dia]);
};

/* ------------------------------------------------------------------------- *
 * A conta
 * ------------------------------------------------------------------------- */

export interface EstadoSequencia {
  /** Sequência viva: dias anotados na corrente atual (dia protegido segura, não soma). */
  dias: number;
  /** Hoje já tem algo anotado. */
  hojeFeito: boolean;
  /** Protetores guardados agora (0–2). */
  saldo: number;
  /** Dias vazios que um protetor segurou (histórico, em ordem). */
  usados: string[];
  /** Maior sequência já alcançada. */
  recorde: number;
}

export const SEQUENCIA_VAZIA: EstadoSequencia = { dias: 0, hojeFeito: false, saldo: 0, usados: [], recorde: 0 };

/**
 * Refaz a sequência do zero a partir dos dias anotados — determinística: dois
 * aparelhos com a mesma lista chegam no mesmo número, e ninguém precisa
 * "lembrar" de gastar protetor.
 *
 * Regras do protetor:
 *  - ganha 1 a cada 7 dias seguidos (7, 14, 21…), no máximo 2 guardados;
 *  - um buraco de N dias vazios só é coberto se houver N protetores — aí cada
 *    dia vazio gasta 1 e a corrente continua (o dia protegido não soma);
 *  - sem protetor suficiente a sequência zera e os protetores FICAM guardados
 *    (gastar 1 num buraco de 2 não salvaria nada — não se cobra à toa);
 *  - hoje nunca é buraco: o dia ainda está em aberto.
 */
export function calcularSequencia(lista: unknown, hoje: string): EstadoSequencia {
  const dias = normalizarDias(lista).filter((d) => d <= hoje);
  if (!dias.length) return { ...SEQUENCIA_VAZIA, usados: [] };
  const anotados = new Set(dias);

  let corrente = 0;
  let saldo = 0;
  let recorde = 0;
  const usados: string[] = [];
  const somar = () => {
    corrente += 1;
    if (corrente % DIAS_POR_PROTETOR === 0) saldo = Math.min(MAX_PROTETORES, saldo + 1);
    if (corrente > recorde) recorde = corrente;
  };

  let d = dias[0];
  while (d < hoje) {
    if (anotados.has(d)) {
      somar();
      d = somarDias(d, 1);
      continue;
    }
    // buraco: mede até o próximo dia anotado (ou até hoje, que ainda está aberto)
    const vazios: string[] = [];
    let fim = d;
    while (fim < hoje && !anotados.has(fim)) {
      vazios.push(fim);
      fim = somarDias(fim, 1);
    }
    if (corrente > 0 && vazios.length <= saldo) {
      saldo -= vazios.length;
      usados.push(...vazios);
    } else {
      corrente = 0;
    }
    d = fim;
  }

  const hojeFeito = anotados.has(hoje);
  if (hojeFeito) somar();
  return { dias: corrente, hojeFeito, saldo, usados, recorde };
}

/** Lista efetiva: a gravada, ou (antes da 1ª gravação) a semente do hub. */
export const diasEfetivos = (lista: unknown, hub: unknown, hoje: string): string[] =>
  Array.isArray(lista) ? normalizarDias(lista) : semearDoHub(hub, hoje);

/** "12 dias seguidos" / "1 dia seguido". */
export const textoDias = (n: number): string => `${n} ${n === 1 ? "dia seguido" : "dias seguidos"}`;
