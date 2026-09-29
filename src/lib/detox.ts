/**
 * Check-ins do Detox (26/09, varredura). O módulo guarda `checkins` como LISTA
 * de datas ("AAAA-MM-DD"), um por dia. Até 26/09 a ação rápida da Home gravava
 * um OBJETO {data: n} no mesmo campo — no banco ele virava [] e, em hábito
 * antigo sem o campo, o Detox quebrava no `.includes`. Toda leitura passa por
 * aqui e aceita os dois formatos.
 */
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export const datasDeCheckin = (c: unknown): string[] => {
  if (Array.isArray(c)) return c.filter((x): x is string => typeof x === "string" && DIA.test(x));
  if (c && typeof c === "object") return Object.keys(c as Record<string, unknown>).filter((k) => DIA.test(k));
  return [];
};

/* ── Qual hábito (28/09) ──────────────────────────────────────────────────────
 * A ação rápida "Check-in Detox" da Home achava o hábito pelo NOME: dois
 * hábitos com o mesmo nome ("Redes sociais" de manhã e à noite, ou o mesmo
 * criado duas vezes) recebiam os dois o check-in de um toque só. A chave é o
 * `id`; hábito antigo sem id cai na POSIÇÃO da lista (#0, #1…), que não
 * muda entre abrir a folha e tocar. */
export const chaveDoHabito = (h: unknown, indice: number): string => {
  const id = h && typeof h === "object" ? (h as { id?: unknown }).id : undefined;
  if (typeof id === "string" && id) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return `#${indice}`;
};

/** Marca o check-in de HOJE só no hábito da chave (um por dia; converte o formato antigo de objeto). */
export const marcarCheckin = <T,>(habitos: T[], chave: string, hoje: string): T[] =>
  habitos.map((h, i) => {
    if (chaveDoHabito(h, i) !== chave) return h;
    const datas = datasDeCheckin((h as { checkins?: unknown }).checkins);
    return { ...h, checkins: datas.includes(hoje) ? datas : [...datas, hoje] };
  });

/* ── Estatística (26/09) ─────────────────────────────────────────────────────
 * A recaída reescreve `startDate` (a sequência recomeça), então "dias desde o
 * startDate" encolhia enquanto as recaídas acumulavam: 2 dias × 4 recaídas =
 * "-100% sucesso". O começo REAL do hábito é o mais antigo entre createdAt,
 * startDate e as recaídas. Datas no dia LOCAL (new Date("AAAA-MM-DD") é UTC e
 * pulava a sequência +1 depois das 21h). */
type HabitoDetox = { startDate?: string; createdAt?: string; relapses?: string[] };

const meiaNoite = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const doDia = (k: string) => { const [a, m, d] = k.split("-").map(Number); return new Date(a, (m || 1) - 1, d || 1); };
const diasEntre = (de: Date, ate: Date) => Math.round((meiaNoite(ate).getTime() - meiaNoite(de).getTime()) / 86_400_000);

export const inicioDoHabito = (h: HabitoDetox): string | null =>
  [h.createdAt, h.startDate, ...(h.relapses ?? [])].filter((x): x is string => typeof x === "string" && DIA.test(x)).sort()[0] ?? null;

/** Dias limpos seguidos: desde a última recaída (ou o começo), em dias de calendário. */
export const sequenciaDetox = (h: HabitoDetox, hoje = new Date()): number => {
  const recaidas = (h.relapses ?? []).filter((r) => DIA.test(r)).sort();
  const desde = recaidas.at(-1) ?? h.startDate ?? inicioDoHabito(h);
  return desde ? Math.max(0, diasEntre(doDia(desde), hoje)) : 0;
};

/** % de dias sem recaída desde o começo real (0–100). */
export const taxaDeSucesso = (h: HabitoDetox, hoje = new Date()): number => {
  const inicio = inicioDoHabito(h);
  if (!inicio) return 100;
  const total = diasEntre(doDia(inicio), hoje) + 1;
  const diasComRecaida = new Set((h.relapses ?? []).filter((r) => DIA.test(r))).size;
  return Math.max(0, Math.min(100, Math.round(((total - diasComRecaida) / total) * 100)));
};

/** Últimas 4 semanas: só conta os dias desde o começo do hábito (hábito de hoje não ganha 4 semanas cheias). */
export const semanasDetox = (h: HabitoDetox, hoje = new Date()) => {
  const inicio = inicioDoHabito(h);
  const recaidas = new Set((h.relapses ?? []).filter((r) => DIA.test(r)));
  const semanas: { name: string; pure: number; relapse: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    let pure = 0, relapse = 0;
    for (let d = 6; d >= 0; d--) {
      const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - w * 7 - d);
      const k = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
      if (!inicio || k < inicio) continue;
      if (recaidas.has(k)) relapse++; else pure++;
    }
    semanas.push({ name: `S${4 - w}`, pure, relapse });
  }
  return semanas;
};
