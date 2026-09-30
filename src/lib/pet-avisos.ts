/**
 * AVISOS DO PET (29/09) — véspera/dia da vacina, do vermífugo, do antipulgas,
 * da consulta; e o remédio na hora. Nascem DESLIGADOS (regra da casa: aviso
 * novo só com o sim da pessoa) e ligam no próprio módulo ou na central.
 *
 * Faixa de id própria: 1800000–1809999 (BASES.pet em lib/notificacoes).
 *   - cuidados com data: BASE + MMDD do dia do aviso (um aviso por dia, os
 *     cuidados do mesmo dia juntos — três avisos no mesmo dia viram um);
 *   - remédio: BASE + 2000 + sequência (um por horário, doses do mesmo
 *     horário juntas).
 * Teto de 20 avisos: o iPhone descarta acima de 64 pendentes no app inteiro.
 *
 * O texto CONGELA no agendamento (notificação local não roda código na hora):
 * nada de "faltam N dias" — só o que continua verdade até disparar. Marcar
 * como feito muda o dado → o useLembretes reagenda → o aviso some.
 *
 * PURA (recebe `agora`) pra ser testável sem plugin.
 */
import { localDayKey } from "@/lib/utils";
import {
  CHAVE_CUIDADOS, CHAVE_LEMBRETE, CHAVE_PETS, CHAVE_REGISTROS, chaveRotinaDoDia, petsValidos, rotinaValida, somarDias, type Pet,
} from "@/lib/pet";
import { dosesDoDia, linhasDaCarteirinha, type TipoCuidado } from "@/lib/pet-cuidados";

export interface PrefsLembretePet {
  /** véspera e dia dos cuidados com data (vacina, vermífugo, antipulgas, consulta, banho) */
  cuidados: boolean;
  /** remédio com horário, na hora */
  remedios: boolean;
  /** hora dos avisos de cuidado (o remédio usa o horário de cada dose) */
  hora: number;
  /** vacina, consulta e banho (coisa de marcar na clínica): avisar também N dias antes (0 = só no dia) */
  antes: number;
}

export const ANTECEDENCIAS = [0, 1, 3, 7] as const;
export const PREFS_LEMBRETE_PET_PADRAO: PrefsLembretePet = { cuidados: false, remedios: false, hora: 10, antes: 1 };

/** Só liga o que alguém disse `true` explicitamente — dado antigo/torto nunca liga aviso. */
export function lerPrefsLembretePet(bruto: unknown): PrefsLembretePet {
  const p = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<PrefsLembretePet>;
  const h = Number(p.hora);
  const antes = Number(p.antes);
  return {
    cuidados: p.cuidados === true,
    remedios: p.remedios === true,
    hora: Number.isInteger(h) && h >= 6 && h <= 22 ? h : PREFS_LEMBRETE_PET_PADRAO.hora,
    antes: (ANTECEDENCIAS as readonly number[]).includes(antes) ? antes : PREFS_LEMBRETE_PET_PADRAO.antes,
  };
}

export const algumLigadoPet = (p: PrefsLembretePet) => p.cuidados || p.remedios;

export interface DadosDosAvisosPet {
  prefs: PrefsLembretePet;
  /** cuidados com data prevista (inclui os atrasados) */
  datas: { pet: string; de: string; nome: string; tipo: TipoCuidado; proxima: string }[];
  /** doses de remédio com horário */
  doses: { pet: string; de: string; nome: string; hora: string; ate?: string; dadaHoje: boolean }[];
}

/** "do Caramelo", "da Frida", "de Bidu" (sem sexo cadastrado). */
export const doPet = (p: Pick<Pet, "name" | "sexo">) => `${p.sexo === "femea" ? "da" : p.sexo === "macho" ? "do" : "de"} ${p.name}`;

type Leitor = <T>(key: string, fallback: T) => T;

export function lerDadosDosAvisosPet(get: Leitor, hoje: string = localDayKey()): DadosDosAvisosPet {
  const prefs = lerPrefsLembretePet(get<unknown>(CHAVE_LEMBRETE, undefined));
  if (!algumLigadoPet(prefs)) return { prefs, datas: [], doses: [] };
  const pets = petsValidos(get<unknown>(CHAVE_PETS, []));
  const cuidados = get<unknown>(CHAVE_CUIDADOS, []);
  const registros = get<unknown>(CHAVE_REGISTROS, []);
  const rotinaHoje = rotinaValida(get<unknown>(chaveRotinaDoDia(hoje), {}));
  const datas: DadosDosAvisosPet["datas"] = [];
  const doses: DadosDosAvisosPet["doses"] = [];
  for (const p of pets) {
    const de = doPet(p);
    if (prefs.cuidados) {
      for (const l of linhasDaCarteirinha(p.id, cuidados, registros, hoje)) {
        if (l.proxima) datas.push({ pet: p.name, de, nome: l.nome, tipo: l.tipo, proxima: l.proxima });
      }
    }
    if (prefs.remedios) {
      for (const d of dosesDoDia(p.id, cuidados, hoje)) {
        const c = (Array.isArray(cuidados) ? cuidados : []).find((x: { id?: string }) => x?.id === d.cuidadoId) as { ate?: string; nome?: string } | undefined;
        doses.push({ pet: p.name, de, nome: c?.nome ?? d.label, hora: d.hora, ate: c?.ate, dadaHoje: rotinaHoje[p.id]?.[d.id] === true });
      }
    }
  }
  return { prefs, datas, doses };
}

export interface AvisoPet { id: number; quando: Date; title: string; body: string; rota: string }

export const TETO_AVISOS_PET = 20;
const HORIZONTE_CUIDADOS = 60; // dias
const HORIZONTE_REMEDIO = 3; // hoje, amanhã e depois — reagenda a cada abertura
const ATRASO_MAX = 30; // passou de 1 mês atrasado, para de cobrar

const dd = (n: number) => String(n).padStart(2, "0");
const diaDe = (d: Date) => localDayKey(d);
const naHora = (dia: string, hora: number, minuto = 0) => {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d, hora, minuto, 0, 0);
};
const juntar = (itens: string[]) => {
  const vis = itens.slice(0, 3);
  const resto = itens.length - vis.length;
  const base = vis.length <= 1 ? vis.join("") : `${vis.slice(0, -1).join(", ")} e ${vis[vis.length - 1]}`;
  return resto > 0 ? `${base} e mais ${resto}` : base;
};
/** aviso ANTES só pro que pede planejamento (marcar a clínica, o banho); vermífugo e antipulgas se dão em casa, no dia */
const PEDE_ANTES: TipoCuidado[] = ["vacina", "consulta", "banho"];
const ROTULO_ANTES: Record<number, string> = { 1: "Amanhã", 3: "Em 3 dias", 7: "Em 1 semana" };

export function planejarAvisosPet(dados: DadosDosAvisosPet, base: number, agora: Date = new Date()): AvisoPet[] {
  const hoje = diaDe(agora);
  const avisos: AvisoPet[] = [];

  if (dados.prefs.cuidados) {
    // dia do aviso → { amanhã: [...], hoje: [...], atrasado: [...] }
    const porDia = new Map<string, { vespera: string[]; noDia: string[]; atrasado: string[] }>();
    const pegar = (dia: string) => porDia.get(dia) ?? porDia.set(dia, { vespera: [], noDia: [], atrasado: [] }).get(dia)!;
    const proxHora = naHora(hoje, dados.prefs.hora) > agora ? hoje : somarDias(hoje, 1);
    for (const d of dados.datas) {
      const item = `${d.nome} ${d.de}`;
      if (d.proxima < hoje) {
        const atraso = Math.round((naHora(hoje, 12).getTime() - naHora(d.proxima, 12).getTime()) / 86_400_000);
        if (atraso <= ATRASO_MAX) pegar(proxHora).atrasado.push(item);
        continue;
      }
      if (PEDE_ANTES.includes(d.tipo) && dados.prefs.antes > 0) {
        const antes = somarDias(d.proxima, -dados.prefs.antes);
        if (naHora(antes, dados.prefs.hora) > agora) pegar(antes).vespera.push(item);
      }
      if (naHora(d.proxima, dados.prefs.hora) > agora) pegar(d.proxima).noDia.push(item);
    }
    const limite = somarDias(hoje, HORIZONTE_CUIDADOS);
    for (const [dia, g] of [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (dia > limite) continue;
      const [, m, d] = dia.split("-").map(Number);
      const todos = [...g.noDia, ...g.vespera, ...g.atrasado];
      let title: string, body: string;
      if (todos.length === 1 && g.noDia.length === 1) {
        title = `🐾 Hoje: ${g.noDia[0]}`;
        body = "Deu? Marque como feito no CORE e a próxima data se ajusta sozinha.";
      } else if (todos.length === 1 && g.vespera.length === 1) {
        title = `🐾 ${ROTULO_ANTES[dados.prefs.antes] ?? "Amanhã"}: ${g.vespera[0]}`;
        body = "Já marcou o horário? A carteirinha está no CORE, em Pet.";
      } else if (todos.length === 1) {
        title = `🐾 ${g.atrasado[0]} venceu`;
        body = "Se já foi feito, marque no CORE. Se não, hoje é um bom dia.";
      } else {
        title = `🐾 ${todos.length} cuidados dos pets`;
        body = [
          g.noDia.length ? `Hoje: ${juntar(g.noDia)}.` : "",
          g.vespera.length ? `${ROTULO_ANTES[dados.prefs.antes] ?? "Amanhã"}: ${juntar(g.vespera)}.` : "",
          g.atrasado.length ? `Venceu: ${juntar(g.atrasado)}.` : "",
        ].filter(Boolean).join(" ");
      }
      avisos.push({ id: base + Number(`${m}${dd(d)}`), quando: naHora(dia, dados.prefs.hora), title, body, rota: "/pet?aba=saude" });
    }
  }

  if (dados.prefs.remedios) {
    const porMomento = new Map<string, string[]>();
    for (const dose of dados.doses) {
      const [h, min] = dose.hora.split(":").map(Number);
      for (let i = 0; i < HORIZONTE_REMEDIO; i++) {
        const dia = somarDias(hoje, i);
        if (dose.ate && dia > dose.ate) break;
        if (dia === hoje && dose.dadaHoje) continue;
        const quando = naHora(dia, h, min);
        if (quando <= agora) continue;
        const chave = quando.toISOString();
        porMomento.set(chave, [...(porMomento.get(chave) ?? []), `${dose.nome} ${dose.de}`]);
      }
    }
    [...porMomento.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([chave, itens], i) => {
      avisos.push({
        id: base + 2000 + i,
        quando: new Date(chave),
        // "Hora do Apoquel" × "Hora da prednisolona": o nome vai sozinho no título, sem artigo
        title: `💊 ${juntar(itens)}`,
        body: itens.length === 1 ? "Hora do remédio. Deu? Marque no CORE pra ninguém dar duas vezes." : "Hora dos remédios. Marque cada dose no CORE pra ninguém dar duas vezes.",
        rota: "/pet",
      });
    });
  }

  // os mais próximos primeiro, até o teto
  return avisos.sort((a, b) => a.quando.getTime() - b.quando.getTime()).slice(0, TETO_AVISOS_PET);
}
