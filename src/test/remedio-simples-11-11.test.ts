/**
 * REMÉDIO: MUDAR O HORÁRIO, REGRA SIMPLES DO DONO (11/11).
 *
 * A próxima dose é o 1º horário novo a PELO MENOS meio intervalo do último comprimido marcado
 * (1×/dia 12 h; 12/12 6 h; 8/8 4 h; 6/6 3 h), nunca no passado. Sem marca nas últimas 48 h: o 1º
 * horário novo que ainda não passou. Vale com a chave REMEDIO_VEZES on ou off.
 */
process.env.TZ = "America/Sao_Paulo";
import { describe, it, expect } from "vitest";
import { agruparRemedios, dosesDoGrupoAgora, gerarHorarios, linhasDosAvisos, momentoDoInicio, mudarHorarios, type Remedio } from "@/lib/remedios";
import { planejarRemedios } from "@/lib/notificacoes";
import { localDayKey } from "@/lib/utils";

type Log = Record<string, string[]>;
const D = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const dia = (d: number) => `2026-11-${String(d).padStart(2, "0")}`;
const um = (time: string): Remedio[] => [{ id: "r1", name: "Losartana", time, stock: 30, dosesPerDay: 1 }];
const grupo = (horas: string[]): Remedio[] =>
  horas.map((time, i) => ({ id: i ? `g-${i}` : "g", name: "Amoxicilina", time, stock: 30, dosesPerDay: 1, grupo: "G", inicio: `2026-11-01T${horas[0]}` }));
const doses = (itens: Remedio[], t: Date) => dosesDoGrupoAgora(agruparRemedios(itens)[0], t);
const fmt = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
const avisos = (itens: Remedio[], agora: Date, log: Log = {}) => {
  const hoje = localDayKey(agora);
  const amanha = localDayKey(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  const lista = linhasDosAvisos(itens, agora).map((s) => ({
    id: String(s.id), nome: s.name, hora: String(s.time),
    tomadoHoje: (log[hoje] ?? []).includes(String(s.id)),
    ...((log[amanha] ?? []).includes(String(s.id)) ? { tomadoAmanha: true } : {}),
    ...(s.ate ? { ate: s.ate } : {}),
    ...(s.inicio ? { desde: s.inicio } : {}),
  }));
  return planejarRemedios(lista, agora).map((a) => fmt(a.quando));
};

describe("mudar o horário: a próxima dose pela regra do meio intervalo (11/11)", () => {
  it("1× 00:00 tomada à 00:00, ao meio-dia muda pra 20:00 → hoje 20:00", () => {
    const log: Log = { [dia(7)]: ["r1"] };
    const r = mudarHorarios(um("00:00"), ["20:00"], D(7, 12), undefined, log);
    expect(r.novoDesde).toBe("2026-11-07T20:00");
    expect(doses(r.itens, D(7, 12)).map((d) => [d.time, d.dia])).toEqual([["00:00", dia(7)]]); // o ✓ de hoje fica
    expect(doses(r.itens, D(7, 17, 30)).map((d) => [d.time, d.dia])).toEqual([["20:00", dia(7)]]);
    expect(avisos(r.itens, D(7, 12), log)[0]).toBe("07/20:00");
  });

  it("1× 23:00 tomada às 23:00, às 23:10 muda pra 00:30 → 00:30 do dia depois de amanhã (25 h 30)", () => {
    const log: Log = { [dia(7)]: ["r1"] };
    const r = mudarHorarios(um("23:00"), ["00:30"], D(7, 23, 10), undefined, log);
    expect(r.novoDesde).toBe("2026-11-09T00:30");
    expect(avisos(r.itens, D(7, 23, 10), log)[0]).toBe("09/00:30");
  });

  it("1× 08:00 tomada às 08:00, às 10:00 muda pra 23:00 → hoje 23:00", () => {
    const r = mudarHorarios(um("08:00"), ["23:00"], D(7, 10), undefined, { [dia(7)]: ["r1"] });
    expect(r.novoDesde).toBe("2026-11-07T23:00");
    expect(avisos(r.itens, D(7, 10))[0]).toBe("07/23:00");
  });

  it("12/12 08/20, tomou a das 08:00, às 10:00 muda pra 09/21 → hoje 21:00 (a das 20:00 de antes some)", () => {
    const log: Log = { [dia(6)]: ["g", "g-1"], [dia(7)]: ["g"] };
    const r = mudarHorarios(grupo(["08:00", "20:00"]), ["09:00", "21:00"], D(7, 10), undefined, log);
    expect(r.novoDesde).toBe("2026-11-07T21:00");
    expect(doses(r.itens, D(7, 10)).map((d) => d.time)).toEqual(["21:00"]);
    expect(avisos(r.itens, D(7, 10), log).slice(0, 3)).toEqual(["07/21:00", "08/09:00", "08/21:00"]);
  });

  it("8/8 08/16/00, tomou a das 16:00, às 17:00 muda a 1ª pra 07:00 → hoje 23:00 (4 h depois da das 16:00 é 20:00)", () => {
    const log: Log = { [dia(6)]: ["g", "g-1"], [dia(7)]: ["g-2", "g", "g-1"] };
    const r = mudarHorarios(grupo(["08:00", "16:00", "00:00"]), gerarHorarios("07:00", 3), D(7, 17), undefined, log);
    expect(r.novoDesde).toBe("2026-11-07T23:00");
    expect(doses(r.itens, D(7, 18)).map((d) => [d.time, d.dia])).toEqual([["23:00", dia(7)]]);
    expect(avisos(r.itens, D(7, 17), log).slice(0, 2)).toEqual(["07/23:00", "08/07:00"]);
  });

  it("12/12 com o dia todo marcado: o dia de antes fica na tela (✓) até virar, e a próxima é a 1ª nova a 6 h da última", () => {
    const log: Log = { [dia(7)]: ["g", "g-1"] };
    const r = mudarHorarios(grupo(["08:00", "20:00"]), ["09:00", "21:00"], D(7, 21), undefined, log);
    expect(r.novoDesde).toBe("2026-11-08T09:00");
    expect(doses(r.itens, D(7, 22)).every((d) => log[d.dia]?.includes(d.id))).toBe(true);
    expect(doses(r.itens, D(8, 8)).map((d) => [d.time, d.dia])).toEqual([["09:00", dia(8)], ["21:00", dia(8)]]);
  });

  it("mudar 2 vezes seguidas antes da dose nova: a conta parte dos horários de antes; voltar desfaz", () => {
    const log: Log = { [dia(7)]: ["r1"] };
    const a = mudarHorarios(um("00:00"), ["20:00"], D(7, 12), undefined, log);
    const b = mudarHorarios(a.itens, ["21:00"], D(7, 13), undefined, log);
    expect(b.novoDesde).toBe("2026-11-07T21:00");
    expect(b.itens[0].horaAntes).toBe("00:00");
    const c = mudarHorarios(b.itens, ["00:00"], D(7, 14), undefined, log);
    expect(c.itens).toEqual(um("00:00"));
  });

  it("mudar de novo depois de tomar a dose nova: conta a partir dela", () => {
    const a = mudarHorarios(um("08:00"), ["23:00"], D(7, 10), undefined, { [dia(7)]: ["r1"] });
    const nova = doses(a.itens, D(7, 23));
    expect(nova.map((d) => [d.time, d.dia])).toEqual([["23:00", dia(7)]]);
    const log: Log = { [dia(7)]: ["r1", ...(nova[0].id === "r1" ? [] : [nova[0].id])] };
    // a das 23:00 nova ganhou id próprio (as duas caem no dia 7) e a marca dela é a última
    expect(nova[0].id).not.toBe("r1");
    const b = mudarHorarios(a.itens, ["08:00"], D(8, 9), undefined, log);
    expect(b.novoDesde).toBe("2026-11-09T08:00"); // 23:00 + 12 h = 11:00 do dia 8
  });

  it("sem marca nas últimas 48 h: o 1º horário novo que ainda não passou", () => {
    const log: Log = { [dia(4)]: ["r1"] };
    expect(mudarHorarios(um("08:00"), ["09:00"], D(7, 10), undefined, log).novoDesde).toBe("2026-11-08T09:00");
    expect(mudarHorarios(um("08:00"), ["11:00"], D(7, 10), undefined, log).novoDesde).toBe("2026-11-07T11:00");
    expect(mudarHorarios(grupo(["08:00", "20:00"]), ["09:00", "21:00"], D(7, 10), undefined, {}).novoDesde).toBe("2026-11-07T21:00");
  });
});

/**
 * VARREDURA: 1, 2, 3 e 4 doses por dia, horários de antes e novos variados, mudado a cada 2 h 30 de um
 * dia, com a pessoa em dia (tudo de antes marcado) ou tendo esquecido a última. Depois da troca, de 15 em
 * 15 min por 48 h, a pessoa toma toda dose que chega.
 */
describe("varredura da regra simples", () => {
  const primeirasAntes = ["00:00", "08:00", "20:00", "23:00"];
  const primeirasNovas = ["00:30", "07:00", "09:00", "21:00", "23:30"];
  for (const n of [1, 2, 3, 4]) {
    it(`${n}× ao dia: nada em aberto fora do horário novo; a 1ª nova a meio intervalo do último comprimido; nunca mais doses que as do dia`, () => {
      const meio = (24 / n / 2) * 3600_000;
      let casos = 0;
      for (const pa of primeirasAntes) for (const pn of primeirasNovas) for (const esqueceu of [false, true]) {
        const antes = gerarHorarios(pa, n);
        const novos = gerarHorarios(pn, n);
        if (novos.every((h, i) => h === antes[i])) continue;
        for (let k = 0; k < 10; k++) {
          const troca = new Date(D(7, 0).getTime() + k * 150 * 60_000);
          const itens0 = n === 1 ? um(pa) : grupo(antes);
          // a pessoa tomou toda dose de antes que chegou desde o dia 5 (ou esqueceu a última)
          const log: Log = {};
          const tomados: number[] = [];
          // cada "id no dia" marcado é de UMA dose só, antes e depois da troca (senão a marca cai na dose errada)
          const dono = new Map<string, number>();
          const umaSo = (d: { id: string; dia: string; quando: number }, ctx: string) => {
            const k = `${d.id}@${d.dia}`;
            expect(dono.get(k) ?? d.quando, `${ctx}: ${k} é de 2 doses`).toBe(d.quando);
            dono.set(k, d.quando);
          };
          for (let t = D(5, 0).getTime(); t <= troca.getTime(); t += 15 * 60_000) {
            for (const d of doses(itens0, new Date(t))) {
              if (d.quando > t || log[d.dia]?.includes(d.id)) continue;
              umaSo(d, "antes"); // só as de antes que ficaram marcadas: a não marcada some da tela na troca
              (log[d.dia] ??= []).push(d.id);
              tomados.push(d.quando);
            }
          }
          if (esqueceu && tomados.length) {
            const ultima = Math.max(...tomados);
            for (const k2 of Object.keys(log)) log[k2] = log[k2].filter((id) => doses(itens0, new Date(ultima)).every((d) => !(d.id === id && d.dia === k2 && d.quando === ultima)));
            tomados.splice(tomados.indexOf(ultima), 1);
          }
          const r = mudarHorarios(itens0, novos, troca, undefined, log);
          const logNaTroca: Log = JSON.parse(JSON.stringify(log));
          const P = momentoDoInicio(r.novoDesde)!.getTime();
          const ctx = `${n}× ${pa}→${pn} às ${fmt(troca)}${esqueceu ? " (esqueceu)" : ""}`;
          expect(P, ctx).toBeGreaterThanOrEqual(troca.getTime() - 60_000);
          const ultimo = tomados.length ? Math.max(...tomados) : undefined;
          if (ultimo !== undefined) expect(P - ultimo, ctx).toBeGreaterThanOrEqual(meio);
          const depois: number[] = [];
          for (let t = troca.getTime(); t <= troca.getTime() + 48 * 3600_000; t += 15 * 60_000) {
            const ds = doses(r.itens, new Date(t));
            expect(ds.length, ctx).toBeLessThanOrEqual(n);
            for (const d of ds) {
              umaSo(d, ctx);
              if (log[d.dia]?.includes(d.id)) continue;
              // em aberto: só dose do horário novo, a partir da 1ª nova
              expect(novos.includes(d.time) && d.quando >= P, `${ctx}: ${d.time} ${d.dia} em aberto às ${fmt(new Date(t))}`).toBe(true);
              if (d.quando <= t) { (log[d.dia] ??= []).push(d.id); depois.push(d.quando); }
            }
          }
          expect(depois.length, ctx).toBeGreaterThan(0);
          expect(Math.min(...depois), ctx).toBe(P);
          if (ultimo !== undefined) expect(Math.min(...depois) - ultimo, ctx).toBeGreaterThanOrEqual(meio);
          // a Home: as marcas de um dia nunca passam das doses do dia (o hook corta no total de linhas)
          for (const d of Object.keys(log)) expect(Math.min(log[d].length, r.itens.length)).toBeLessThanOrEqual(n);
          // o 1º aviso depois da troca é o da 1ª dose nova (a que cai no minuto da troca já está na tela, sem aviso)
          const proximo = avisos(r.itens, troca, logNaTroca)[0];
          if (P > troca.getTime()) expect(proximo, ctx).toBe(fmt(new Date(P)));
          casos++;
        }
      }
      expect(casos).toBeGreaterThan(300);
    }, 120_000);
  }
});

