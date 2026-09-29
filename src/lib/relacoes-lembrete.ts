import { localDayKey } from "@/lib/utils";
import { normalizarHora } from "@/lib/tarefas";
import {
  CHAVE_DATAS, CHAVE_MOMENTOS, CHAVE_PESSOAS, CHAVE_PRESENTES, datasDoAno, datasValidas, diasEntre, haQuanto, momentosValidos, pessoasValidas,
  presentesDe, presentesValidos, situacaoDoContato, type DataEspecial, type Momento, type Pessoa, type Presente,
} from "@/lib/relacoes";

/**
 * OS AVISOS DE RELAÇÕES (29/09, Onda 1) — faixa própria 1900000–1999999.
 *
 * O "Aniversário chegando" (véspera, faixa 1400000, interruptor `aniversario`
 * no notif-prefs) continua sendo o que era; aqui entram os dois que faltavam
 * pra fechar o ciclo aviso → ação:
 *  - NO DIA: "Ju faz aniversário hoje" na hora escolhida. O toque abre
 *    Relações, onde o selo de hoje tem o "Mandar parabéns" (WhatsApp).
 *  - UMA SEMANA ANTES: com as ideias de presente guardadas pra pessoa (a
 *    pesquisa de 29/09: 6 de 7 apps de aniversário avisam em mais de um
 *    momento, e "aviso único" é 1★ típico — "quando chega o dia já esqueci").
 *  - MANTER CONTATO: pra quem tem frequência escolhida na ficha ("a cada 2
 *    semanas"), no dia em que vence e, se ninguém registrar a conversa, de
 *    novo a cada 7 dias — nunca todo dia. A conta é pelo dia, não pelo
 *    momento em que o app abriu, então reagendar não vira cobrança diária.
 *
 * Os três nascem DESLIGADOS (regra da casa: aviso só se a pessoa aceitar
 * ativar). Chave NOVA pras escolhas (`rel-lembrete-prefs`, objeto): nada de
 * campo novo no `notif-prefs` — o app antigo regrava aquele objeto só com os
 * campos que conhece e apagaria os daqui. O sufixo `-prefs` deixa a chave
 * fora da sequência de dias anotados (é ajuste, não registro).
 */

export const CHAVE_LEMBRETE_RELACOES = "rel-lembrete-prefs";

export type LembreteDoTipo = { ligado: boolean; hora: string };
export type LembreteRelacoes = { noDia: LembreteDoTipo; semana: LembreteDoTipo; contato: LembreteDoTipo };

/** 09:00 pro parabéns (cedo, antes do dia engolir), 12:00 pra semana antes (hora do almoço: dá pra pensar no
 *  presente — e não cai junto da véspera, que é às 10:00) e 19:30 pro "oi" (fim do expediente, na meia hora pra
 *  não empilhar com os avisos de hora cheia). */
export const LEMBRETE_RELACOES_PADRAO: LembreteRelacoes = {
  noDia: { ligado: false, hora: "09:00" },
  semana: { ligado: false, hora: "12:00" },
  contato: { ligado: false, hora: "19:30" },
};

export const lerLembreteRelacoes = (bruto: unknown): LembreteRelacoes => {
  const b = (bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {}) as Partial<Record<keyof LembreteRelacoes, Partial<LembreteDoTipo>>>;
  const um = (k: keyof LembreteRelacoes): LembreteDoTipo => {
    const x = b[k] && typeof b[k] === "object" ? b[k] : {};
    return { ligado: x?.ligado === true, hora: normalizarHora(x?.hora) ?? LEMBRETE_RELACOES_PADRAO[k].hora };
  };
  return { noDia: um("noDia"), semana: um("semana"), contato: um("contato") };
};

export const algumLembreteRelacoes = (l: LembreteRelacoes) => l.noDia.ligado || l.semana.ligado || l.contato.ligado;

type Leitor = <T>(key: string, fallback: T) => T;

export interface DadosDasRelacoes {
  prefs: LembreteRelacoes;
  pessoas: Pessoa[];
  momentos: Momento[];
  datas: DataEspecial[];
  /** as ideias de presente (entram no aviso de uma semana antes) */
  presentes: Presente[];
}

export function lerDadosDasRelacoes(get: Leitor): DadosDasRelacoes {
  return {
    prefs: lerLembreteRelacoes(get<unknown>(CHAVE_LEMBRETE_RELACOES, undefined)),
    pessoas: pessoasValidas(get<unknown>(CHAVE_PESSOAS, [])),
    momentos: momentosValidos(get<unknown>(CHAVE_MOMENTOS, [])),
    datas: datasValidas(get<unknown>(CHAVE_DATAS, [])),
    presentes: presentesValidos(get<unknown>(CHAVE_PRESENTES, [])),
  };
}

/** O que muda o agendamento (pra assinatura do reagendador não reagendar a cada render). */
export function assinaturaDasRelacoes(d: DadosDasRelacoes): unknown {
  if (!algumLembreteRelacoes(d.prefs)) return false;
  return [
    d.prefs,
    (d.prefs.noDia.ligado || d.prefs.semana.ligado) && [d.pessoas.map((p) => [p.id, p.name, p.birthday, p.semAno]), d.datas.map((x) => [x.id, x.title, x.date, x.type, x.person])],
    d.prefs.semana.ligado && (d.presentes ?? []).map((g) => [g.pessoaId, g.person, g.idea, g.status]),
    d.prefs.contato.ligado && [
      d.pessoas.filter((p) => (p.cadencia ?? 0) > 0).map((p) => [p.id, p.name, p.cadencia, p.cadenciaDesde]),
      d.momentos.map((m) => [m.pessoaId, m.person, m.date]),
    ],
  ];
}

export type AvisoDeRelacoes = { quando: Date; title: string; body: string; id: number };

/** Janela do "no dia" (como a véspera, que já olha 60 dias) e do "manter contato" (10 dias, como os diários). */
const HORIZONTE_NO_DIA = 60;
const HORIZONTE_CONTATO = 10;
/** Teto da série: bem abaixo dos 64 pendentes que o iPhone aceita pro app inteiro. */
const TETO = 20;

const juntar = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
const nomesCurtos = (nomes: string[], max = 3) =>
  nomes.length <= max ? juntar(nomes) : `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;

const naHora = (dia: Date, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, 0, 0);
};

/**
 * Todos os avisos de Relações, com id na faixa (`base + i`, em ordem de tempo).
 * PURA (recebe `agora`) pra ser testável sem o plugin.
 */
export function planejarRelacoes(d: DadosDasRelacoes, base: number, agora: Date = new Date()): AvisoDeRelacoes[] {
  const avisos: Omit<AvisoDeRelacoes, "id">[] = [];
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  if (d.prefs.noDia.ligado) {
    // o dia de cada data nos próximos 60 dias; mesma data = um aviso só
    const porDia = new Map<string, { aniversarios: { nome: string; faz: number | null }[]; outras: string[] }>();
    for (const item of datasDoAno(d.pessoas, d.datas, hoje)) {
      if (item.dias > HORIZONTE_NO_DIA) continue;
      const quando = naHora(item.proxima, d.prefs.noDia.hora);
      if (quando.getTime() <= agora.getTime()) continue;
      const k = localDayKey(item.proxima);
      const g = porDia.get(k) ?? { aniversarios: [], outras: [] };
      if (item.tipo === "aniversario") g.aniversarios.push({ nome: item.titulo, faz: item.faz });
      else g.outras.push(item.titulo);
      porDia.set(k, g);
    }
    for (const [k, g] of porDia) {
      const [a, m, dd] = k.split("-").map(Number);
      const quando = naHora(new Date(a, m - 1, dd), d.prefs.noDia.hora);
      if (g.aniversarios.length === 1 && !g.outras.length) {
        const { nome, faz } = g.aniversarios[0];
        avisos.push({
          quando,
          title: faz ? `🎂 ${nome} faz ${faz} anos hoje` : `🎂 ${nome} faz aniversário hoje`,
          body: "Toca pra mandar os parabéns pelo WhatsApp.",
        });
      } else if (g.aniversarios.length) {
        const nomes = [...g.aniversarios.map((x) => x.nome), ...g.outras];
        avisos.push({ quando, title: `🎂 Hoje tem ${g.aniversarios.length > 1 ? `${g.aniversarios.length} aniversários` : "aniversário"}`, body: `${nomesCurtos(nomes)}. Está em Relações.` });
      } else {
        avisos.push({ quando, title: `💛 Hoje: ${nomesCurtos(g.outras, 2)}`, body: "Uma data especial pra lembrar. Está em Relações." });
      }
    }
  }

  if (d.prefs.semana.ligado) {
    // sete dias antes de cada ANIVERSÁRIO (de gente — data de casal e outras ficam no "no dia"), com as ideias guardadas
    const porDia = new Map<string, { nome: string; ideias: string[] }[]>();
    for (const item of datasDoAno(d.pessoas, d.datas, hoje)) {
      if (item.tipo !== "aniversario" || item.dias < 7 || item.dias > HORIZONTE_NO_DIA + 7) continue;
      const dia = new Date(item.proxima.getFullYear(), item.proxima.getMonth(), item.proxima.getDate() - 7);
      const quando = naHora(dia, d.prefs.semana.hora);
      if (quando.getTime() <= agora.getTime()) continue;
      const pessoa = item.pessoaId ? d.pessoas.find((p) => p.id === item.pessoaId) : undefined;
      const ideias = pessoa ? presentesDe(pessoa, d.presentes ?? []).filter((g) => g.status === "idea").map((g) => g.idea) : [];
      const k = localDayKey(dia);
      porDia.set(k, [...(porDia.get(k) ?? []), { nome: item.titulo, ideias }]);
    }
    for (const [k, lista] of porDia) {
      const [a, m, dd] = k.split("-").map(Number);
      const quando = naHora(new Date(a, m - 1, dd), d.prefs.semana.hora);
      if (lista.length === 1) {
        const { nome, ideias } = lista[0];
        avisos.push({
          quando,
          title: `🎁 ${nome} faz aniversário daqui a uma semana`,
          body: ideias.length ? `Ideias guardadas: ${nomesCurtos(ideias, 2)}.` : "Ainda sem ideia de presente — toca pra guardar uma.",
        });
      } else {
        avisos.push({ quando, title: `🎁 ${lista.length} aniversários daqui a uma semana`, body: `${nomesCurtos(lista.map((x) => x.nome))}. As ideias de presente estão em Relações.` });
      }
    }
  }

  if (d.prefs.contato.ligado) {
    for (let k = 0; k <= HORIZONTE_CONTATO; k++) {
      const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + k);
      const quando = naHora(dia, d.prefs.contato.hora);
      if (quando.getTime() <= agora.getTime()) continue;
      const devidos: { nome: string; desde: number | null }[] = [];
      for (const p of d.pessoas) {
        if (!p.cadencia) continue;
        const s = situacaoDoContato(p, d.momentos, dia);
        // no dia em que vence e, se ninguém registrou a conversa, de 7 em 7 dias
        if (s.devido && s.atraso % 7 === 0) devidos.push({ nome: p.name, desde: s.desde });
      }
      if (!devidos.length) continue;
      if (devidos.length === 1) {
        const { nome, desde } = devidos[0];
        avisos.push({
          quando,
          title: `💌 Que tal mandar um oi pra ${nome}?`,
          body: desde == null ? "Você quis lembrar de falar com essa pessoa. Toca pra abrir." : `A última conversa foi ${haQuanto(desde)}.`,
        });
      } else {
        avisos.push({ quando, title: `💌 ${devidos.length} pessoas esperando seu oi`, body: `${nomesCurtos(devidos.map((x) => x.nome))}. Está em Relações.` });
      }
    }
  }

  return avisos
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .slice(0, TETO)
    .map((a, i) => ({ ...a, id: base + i }));
}

/** Pra tela de Avisos: os próximos avisos que o celular vai receber (a mesma conta, sem faixa). */
export function previaDosAvisos(d: DadosDasRelacoes, agora: Date = new Date(), max = 4) {
  return planejarRelacoes(d, 0, agora).slice(0, max).map((a) => ({ ...a, emDias: diasEntre(agora, a.quando) }));
}
