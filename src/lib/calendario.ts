import { registerPlugin } from "@capacitor/core";
import { isNativeShell } from "./native-shell";

/**
 * Ponte pro calendário do telefone (27/07).
 *
 * Lado nativo em `CalendarioPlugin.java` — leia lá o porquê de ACTION_INSERT
 * em vez de sincronização com permissão. Resumo: abre a tela de novo evento
 * do calendário que a pessoa já usa, preenchida, e ela confirma. Zero
 * permissão, zero declaração na ficha da loja, funciona com Google, Samsung
 * ou o que estiver instalado.
 */

interface PluginCalendario {
  adicionarEvento(opcoes: {
    titulo: string; local: string; descricao: string; inicio: number; fim: number;
  }): Promise<void>;
}

const Calendario = registerPlugin<PluginCalendario>("Calendario");

export interface EventoDeCalendario {
  titulo: string;
  /** "2026-08-14" */
  data: string;
  /** "14:30" — opcional; sem hora o evento vira o dia todo às 9h */
  hora?: string;
  local?: string;
  descricao?: string;
  /** minutos; padrão 60 */
  duracao?: number;
}

export type ResultadoCalendario = "aberto" | "sem-app" | "indisponivel" | "erro";

/**
 * Monta o instante local a partir de "2026-08-14" + "14:30".
 *
 * `new Date("2026-08-14T14:30")` sem fuso é interpretado como LOCAL pelos
 * navegadores modernos, mas o comportamento já variou; construir por partes
 * é o único jeito que não depende disso — e data errada num lembrete médico
 * é o pior tipo de erro que este app pode cometer.
 */
const instanteDe = (data: string, hora?: string): number | null => {
  const [ano, mes, dia] = (data ?? "").split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const [h, m] = (hora ?? "09:00").split(":").map(Number);
  return new Date(ano, mes - 1, dia, Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0).getTime();
};

export async function adicionarAoCalendario(evento: EventoDeCalendario): Promise<ResultadoCalendario> {
  if (!isNativeShell()) return "indisponivel";
  const inicio = instanteDe(evento.data, evento.hora);
  if (!inicio) return "erro";
  try {
    await Calendario.adicionarEvento({
      titulo: evento.titulo,
      local: evento.local ?? "",
      descricao: evento.descricao ?? "",
      inicio,
      fim: inicio + (evento.duracao ?? 60) * 60_000,
    });
    return "aberto";
  } catch (e) {
    return String((e as Error)?.message ?? "").includes("sem app") ? "sem-app" : "erro";
  }
}
