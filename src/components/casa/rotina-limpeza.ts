import { localDayKey, parseLocalDay } from "@/lib/utils";

/* ROTINA DE LIMPEZA QUE ZERA (26/09, varredura). O ✓ era só `done: true` —
 * "Lavar a louça" marcado 23:57 continuava marcado 00:07 do dia seguinte, e a
 * semanal/mensal idem, pra sempre. Agora o item guarda o DIA LOCAL em que foi
 * marcado (`doneOn`) e só conta como feito dentro do período da seção, que
 * sai do nome dela: DIÁRIA, SEMANAL, QUINZENAL, MENSAL. Seção com outro nome
 * ("Faxina pesada") segue lista simples, como sempre foi.
 *
 * Compatível com o formato antigo: `done` continua sendo gravado (o widget
 * "Tarefas de hoje" da Home lê `done`), e item antigo marcado sem `doneOn`
 * ganha o carimbo de hoje — fica feito hoje e zera na próxima virada. */

export type Periodo = "dia" | "semana" | "quinzena" | "mes";
export type ItemLimpeza = { id: string; text: string; done: boolean; doneOn?: string };
export type SecaoLimpeza = { id: string; name: string; color: string; items: ItemLimpeza[] };

export const periodoDaSecao = (nome: string): Periodo | null => {
  const n = String(nome ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/diari|todo dia|todos os dias/.test(n)) return "dia";
  if (/quinzen/.test(n)) return "quinzena";
  if (/semana/.test(n)) return "semana";
  if (/mensal|todo mes/.test(n)) return "mes";
  return null;
};

/** Chave do período que contém `d` — tudo em dia LOCAL. Semana = a da segunda-feira. */
export const chaveDoPeriodo = (p: Periodo, d: Date): string => {
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (p === "dia") return localDayKey(d);
  if (p === "mes") return mes;
  if (p === "quinzena") return `${mes}-${d.getDate() <= 15 ? 1 : 2}`;
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  return localDayKey(seg);
};

/** O item conta como feito AGORA? (marcado dentro do período atual da seção) */
export const feitoNoPeriodo = (item: ItemLimpeza, periodo: Periodo | null, hoje: Date = new Date()): boolean => {
  if (!item?.done) return false;
  if (!periodo || !item.doneOn) return true;
  return chaveDoPeriodo(periodo, parseLocalDay(item.doneOn)) === chaveDoPeriodo(periodo, hoje);
};

/** Zera o que venceu e carimba o que está marcado sem data. Devolve a MESMA
 *  lista quando não há nada a mudar (pra não gravar à toa). */
export const renovarRotina = (secoes: SecaoLimpeza[], hoje: Date = new Date()): SecaoLimpeza[] => {
  let mudou = false;
  const hojeKey = localDayKey(hoje);
  const novas = secoes.map((s) => {
    const periodo = periodoDaSecao(s.name);
    if (!periodo) return s;
    let mexeu = false;
    const items = s.items.map((it) => {
      if (it.done && !it.doneOn) { mexeu = true; return { ...it, doneOn: hojeKey }; }
      if (it.done && !feitoNoPeriodo(it, periodo, hoje)) { mexeu = true; const { doneOn: _v, ...resto } = it; return { ...resto, done: false }; }
      if (!it.done && it.doneOn) { mexeu = true; const { doneOn: _v, ...resto } = it; return resto; }
      return it;
    });
    if (!mexeu) return s;
    mudou = true;
    return { ...s, items };
  });
  return mudou ? novas : secoes;
};

/** Marca (com o dia local) ou desmarca um item. Decide pelo que a tela MOSTRA:
 *  um ✓ de ontem que ainda não foi zerado conta como desmarcado → marca de novo. */
export const alternarLimpeza = (item: ItemLimpeza, periodo: Periodo | null, hoje: Date = new Date()): ItemLimpeza => {
  if (feitoNoPeriodo(item, periodo, hoje)) { const { doneOn: _v, ...resto } = item; return { ...resto, done: false }; }
  return { ...item, done: true, doneOn: localDayKey(hoje) };
};
