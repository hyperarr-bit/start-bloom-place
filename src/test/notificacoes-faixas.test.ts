/**
 * Faixas de id dos lembretes (26/09). Saúde nasceu em 800000 (07/09) e
 * aniversário em 900000 (11/09) — as MESMAS faixas da régua do teste grátis e
 * da missão. Reagendar os remédios (toda abertura do app) limpava 800000–809999
 * e levava o D1/D2/D3 do teste; os ids 800001–800003 ainda sobrescreviam os
 * dele. Este teste impede qualquer sobreposição de novo.
 */
import { describe, it, expect } from "vitest";
import { BASES_LEMBRETES, FAIXAS_AVULSAS, planejarRemedios, planejarLimiteDoDia } from "@/lib/notificacoes";
import { planejarAvisosPet } from "@/lib/pet-avisos";
import { planejarRelacoes } from "@/lib/relacoes-lembrete";
import { pessoasValidas } from "@/lib/relacoes";

const LARGURA = 10000;
const faixa = (base: number) => [base, base + LARGURA] as const;
const sobrepoe = (a: readonly [number, number], b: readonly [number, number]) => a[0] < b[1] && b[0] < a[1];

describe("faixas de id dos lembretes", () => {
  it("nenhum tipo divide faixa com outro tipo", () => {
    const tipos = Object.entries(BASES_LEMBRETES);
    for (let i = 0; i < tipos.length; i++)
      for (let j = i + 1; j < tipos.length; j++)
        expect(sobrepoe(faixa(tipos[i][1]), faixa(tipos[j][1])), `${tipos[i][0]} × ${tipos[j][0]}`).toBe(false);
  });

  it("nenhum tipo invade a régua do teste, da missão ou do resgate", () => {
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES))
      for (const [regua, baseRegua] of Object.entries(FAIXAS_AVULSAS))
        expect(sobrepoe(faixa(base), faixa(baseRegua)), `${tipo} × ${regua}`).toBe(false);
  });

  it("os remédios agendados moram na faixa de saúde, longe do 800001–800003 do teste", () => {
    const agora = new Date(2026, 8, 26, 7, 0);
    const avisos = planejarRemedios([{ id: "r1", nome: "Losartana", hora: "08:00", tomadoHoje: false }, { id: "r2", nome: "Ômega 3", hora: "21:00", tomadoHoje: false }], agora);
    expect(avisos.length).toBeGreaterThan(0);
    for (const a of avisos) {
      expect(a.id! >= BASES_LEMBRETES.saude && a.id! < BASES_LEMBRETES.saude + LARGURA).toBe(true);
      expect([FAIXAS_AVULSAS.teste + 1, FAIXAS_AVULSAS.teste + 2, FAIXAS_AVULSAS.teste + 3]).not.toContain(a.id);
    }
  });
});

describe("pet (29/09): faixa 1800000–1809999", () => {
  it("os avisos do pet (cuidados e remédio) moram na faixa própria", () => {
    expect(BASES_LEMBRETES.pet).toBe(1800000);
    const avisos = planejarAvisosPet({
      prefs: { cuidados: true, remedios: true, hora: 10, antes: 1 },
      datas: [{ pet: "Thor", de: "do Thor", nome: "V10", tipo: "vacina", proxima: "2026-10-10" }, { pet: "Mia", de: "da Mia", nome: "Vermífugo", tipo: "vermifugo", proxima: "2026-12-31" }],
      doses: [{ pet: "Thor", de: "do Thor", nome: "Apoquel", hora: "20:00", dadaHoje: false }],
    }, BASES_LEMBRETES.pet, new Date(2026, 8, 26, 7, 0));
    expect(avisos.length).toBeGreaterThan(3);
    for (const a of avisos) expect(a.id >= BASES_LEMBRETES.pet && a.id < BASES_LEMBRETES.pet + LARGURA, `${a.id}`).toBe(true);
  });
});

describe("Relações (29/09): faixa própria 1900000–1999999", () => {
  it("o tipo relacoes mora em 1900000, longe de todo o resto", () => {
    expect(BASES_LEMBRETES.relacoes).toBe(1900000);
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) {
      if (tipo === "relacoes") continue;
      expect(sobrepoe(faixa(1900000), faixa(base)), `relacoes × ${tipo}`).toBe(false);
    }
  });
  it("os avisos planejados (no dia + manter contato) ficam dentro da faixa", () => {
    const avisos = planejarRelacoes({
      prefs: { noDia: { ligado: true, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: true, hora: "19:30" } },
      pessoas: pessoasValidas([{ id: "a", name: "Ana", birthday: "1990-10-02", cadencia: 7, cadenciaDesde: "2026-09-01" }]),
      momentos: [],
      datas: [],
      presentes: [],
    }, BASES_LEMBRETES.relacoes, new Date(2026, 8, 28, 7, 0));
    expect(avisos.length).toBeGreaterThan(0);
    for (const a of avisos) expect(a.id >= 1900000 && a.id < 1900000 + LARGURA).toBe(true);
  });
});

describe("limite do dia", () => {
  const segunda7h = new Date(2026, 8, 28, 7, 0); // 28/09/2026 é segunda
  it("quem nunca usou Finanças não recebe nada", () => {
    expect(planejarLimiteDoDia({ temFinancas: false, abriuFinancasHoje: false }, 8, segunda7h)).toEqual([]);
  });
  it("de manhã, todo dia, com o texto do dia da semana", () => {
    const avisos = planejarLimiteDoDia({ temFinancas: true, abriuFinancasHoje: false }, 8, segunda7h);
    expect(avisos[0].quando).toEqual(new Date(2026, 8, 28, 8, 0));
    expect(avisos[0].title).toMatch(/Semana nova/);
    expect(avisos.find((a) => a.quando.getDay() === 5)?.title).toMatch(/Sexta/);
    expect(avisos.every((a) => !/R\$/.test(a.title + a.body))).toBe(true); // valor congelaria: nunca no texto
  });
  it("quem já abriu Finanças hoje não recebe o de hoje", () => {
    const avisos = planejarLimiteDoDia({ temFinancas: true, abriuFinancasHoje: true }, 8, segunda7h);
    expect(avisos[0].quando.getDate()).toBe(29);
  });
});
