import { localDayKey } from "@/lib/utils";
import { normalizarHora } from "@/lib/tarefas";
import {
  CHAVE_FEITOS, CHAVE_PASSOS, diaDaSemana, diasDoPasso, ehTodoDia, nomeCurto, passoValido, type Periodo,
} from "@/lib/beleza-rotina";

/**
 * LEMBRETE DO SKINCARE, MANHÃ E NOITE (28/09). Nas avaliações de apps de pele, o
 * lembrete no horário é o pedido funcional mais repetido ("se tivesse lembretes
 * seria um vencedor") e é o coração do app de beleza mais usado do Brasil
 * (Meu Cronograma Capilar). Os módulos com lembrete + presença na Home ficam no
 * topo do uso; a Beleza não tinha nenhum dos dois.
 *
 * Mesma infraestrutura das tarefas com horário: notificação LOCAL do app (não
 * toca no site), série limpa e refeita a cada mudança na faixa própria de id
 * (notificacoes → BASES.beleza), texto congelado no agendamento. Por isso:
 *  - o texto de cada dia é o que a AGENDA diz pra aquele dia da semana (é
 *    determinístico: muda só se a pessoa mudar a rotina, e aí reagenda);
 *  - HOJE é o único dia de que sabemos mais: se o período já foi todo marcado,
 *    o aviso de hoje não existe; se foi em parte, diz o que falta; pele marcada
 *    "Sensível" hoje tira os ativos do aviso da noite.
 *
 * Nasce DESLIGADO, como todo lembrete diário (ordem do dono: "só se o usuário
 * aceitar ativar"). Liga na própria Beleza (ou na central de notificações).
 *
 * Chave NOVA (`skincare-lembrete-prefs`, objeto): nada de campo novo no
 * `notif-prefs` — o app antigo relê aquele objeto com os campos que conhece e,
 * ao gravar qualquer interruptor, apagaria os daqui. O sufixo `-prefs` deixa a
 * chave fora da sequência de dias anotados (é ajuste, não registro).
 */

export const CHAVE_LEMBRETE_SKINCARE = "skincare-lembrete-prefs";

export type LembreteDoPeriodo = { ligado: boolean; hora: string };
export type LembreteSkincare = { manha: LembreteDoPeriodo; noite: LembreteDoPeriodo };

/**
 * 07:30 e 21:30 — de propósito na MEIA hora: os outros diários tocam em hora
 * cheia (limite do dia 08:00, fechamento 21:00, leitura 22:00) e dois avisos no
 * mesmo minuto chegam empilhados. Decisão final dos horários: do dono.
 */
export const LEMBRETE_PADRAO: LembreteSkincare = {
  manha: { ligado: false, hora: "07:30" },
  noite: { ligado: false, hora: "21:30" },
};

/** Normaliza o que veio do storage — dado torto nunca derruba, só volta pro padrão. */
export const lerLembreteSkincare = (bruto: unknown): LembreteSkincare => {
  const b = (bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {}) as Partial<Record<Periodo, Partial<LembreteDoPeriodo>>>;
  const um = (p: Periodo): LembreteDoPeriodo => {
    const x = b[p] && typeof b[p] === "object" ? b[p] : {};
    return { ligado: x?.ligado === true, hora: normalizarHora(x?.hora) ?? LEMBRETE_PADRAO[p].hora };
  };
  return { manha: um("manha"), noite: um("noite") };
};

export const algumLigado = (l: LembreteSkincare): boolean => l.manha.ligado || l.noite.ligado;

/* ------------------------------------------------------------ o que o aviso precisa saber */

type Leitor = <T>(key: string, fallback: T) => T;

export type PassoDoAviso = { i: number; nome: string; dias: number[]; ativo: boolean; todoDia: boolean };

export interface DadosDoSkincare {
  prefs: LembreteSkincare;
  manha: PassoDoAviso[];
  noite: PassoDoAviso[];
  /** índices (no array inteiro) marcados hoje */
  feitosHoje: Record<Periodo, number[]>;
  /** "Como está sua pele hoje?" = Sensível: os ativos da noite saem */
  sensivelHoje: boolean;
}

const passosDoAviso = (lista: unknown): PassoDoAviso[] =>
  (Array.isArray(lista) ? lista : [])
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => passoValido(p))
    .map(({ p, i }) => ({ i, nome: String(p.name).trim(), dias: diasDoPasso(p), ativo: !!p.isAcid, todoDia: ehTodoDia(p) }));

/** Lê de uma vez tudo o que o aviso precisa (o `get` do useUserData ou o leitor sobreposto). */
export function lerDadosDoSkincare(get: Leitor, hoje: string = localDayKey()): DadosDoSkincare {
  const feitos = (chave: string): number[] => {
    const mapa = get<unknown>(chave, {});
    const v = mapa && typeof mapa === "object" && !Array.isArray(mapa) ? (mapa as Record<string, unknown>)[hoje] : undefined;
    return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];
  };
  const checkins = get<unknown>("skincare-daily-checkin", {});
  const peleHoje = checkins && typeof checkins === "object" ? (checkins as Record<string, unknown>)[hoje] : undefined;
  return {
    prefs: lerLembreteSkincare(get<unknown>(CHAVE_LEMBRETE_SKINCARE, undefined)),
    manha: passosDoAviso(get<unknown>(CHAVE_PASSOS.manha, [])),
    noite: passosDoAviso(get<unknown>(CHAVE_PASSOS.noite, [])),
    feitosHoje: { manha: feitos(CHAVE_FEITOS.manha), noite: feitos(CHAVE_FEITOS.noite) },
    sensivelHoje: peleHoje === "sensivel",
  };
}

/* ------------------------------------------------------------ o plano dos avisos */

export type AvisoDeSkincare = { quando: Date; title: string; body: string; id: number };

/** Mesma janela dos outros diários: 10 dias à frente sobrevivem a uma semana sem abrir o app. */
const HORIZONTE_DIAS = 10;
/** Dois por dia × 11 dias = 22 — abaixo do teto de 24 por tipo (o iOS descarta acima de 64 no app inteiro). */
const TETO = 24;

/** "Limpeza · Retinol · Hidratante", no máximo 4 nomes + "e mais N". */
const listar = (nomes: string[]): string => {
  const vis = nomes.slice(0, 4);
  const resto = nomes.length - vis.length;
  return `${vis.join(" · ")}${resto > 0 ? ` e mais ${resto}` : ""}`;
};

/** "Retinol", "Retinol e Ácido salicílico" */
const juntar = (nomes: string[]): string =>
  nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

/** Título e corpo de UM aviso (também é a "prévia" que a Beleza mostra no card do lembrete). */
export function textoDoAviso(
  periodo: Periodo,
  passosDoDia: PassoDoAviso[],
  opcoes: { feitos?: number[]; sensivel?: boolean; rotinaTemAtivo?: boolean } = {},
): { title: string; body: string } | null {
  const sensivel = periodo === "noite" && !!opcoes.sensivel;
  const passos = sensivel ? passosDoDia.filter((p) => !p.ativo) : passosDoDia;
  if (!passos.length) return null;
  const feitos = opcoes.feitos ?? [];
  const faltam = passos.filter((p) => !feitos.includes(p.i));
  if (!faltam.length) return null;
  const nomes = faltam.map((p) => nomeCurto(p.nome));
  const corpo = faltam.length < passos.length ? `Falta: ${listar(nomes)}` : listar(nomes);
  if (periodo === "manha") return { title: "☀️ Skincare da manhã", body: corpo };
  if (sensivel) return { title: "🌙 Skincare da noite", body: `Pele sensível hoje: sem ativos. ${corpo}` };
  const ativosDoDia = passos.filter((p) => p.ativo && !p.todoDia).map((p) => nomeCurto(p.nome));
  if (ativosDoDia.length) return { title: `🌙 Hoje é noite de ${juntar(ativosDoDia)}`, body: corpo };
  if (opcoes.rotinaTemAtivo) return { title: "🌙 Noite de descanso da pele", body: corpo };
  return { title: "🌙 Skincare da noite", body: corpo };
}

/**
 * Os avisos a agendar, já com id na faixa (`base + i`): manhã e noite, na hora
 * escolhida, nos próximos 10 dias, só no futuro e só nos dias em que aquele
 * período tem passo. A série é limpa e refeita a cada mudança (marcar um passo
 * muda a assinatura), então o id precisa ser único, não estável.
 * PURA (recebe `agora`) pra ser testável sem plugin.
 */
export function planejarSkincare(d: DadosDoSkincare, base: number, agora = new Date()): AvisoDeSkincare[] {
  const hoje = localDayKey(agora);
  const rotinaTemAtivo = d.noite.some((p) => p.ativo && !p.todoDia);
  const avisos: Omit<AvisoDeSkincare, "id">[] = [];
  for (let k = 0; k <= HORIZONTE_DIAS; k++) {
    for (const periodo of ["manha", "noite"] as const) {
      const pref = d.prefs[periodo];
      if (!pref.ligado) continue;
      const [h, m] = pref.hora.split(":").map(Number);
      const quando = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + k, h, m, 0, 0);
      if (quando.getTime() <= agora.getTime()) continue;
      const ehHoje = localDayKey(quando) === hoje;
      const dia = diaDaSemana(quando);
      const texto = textoDoAviso(periodo, d[periodo].filter((p) => p.dias.includes(dia)), {
        feitos: ehHoje ? d.feitosHoje[periodo] : [],
        sensivel: ehHoje && d.sensivelHoje,
        rotinaTemAtivo,
      });
      if (texto) avisos.push({ quando, ...texto });
    }
  }
  return avisos
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .slice(0, TETO)
    .map((a, i) => ({ ...a, id: base + i }));
}
