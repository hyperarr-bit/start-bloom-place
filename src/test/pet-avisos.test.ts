/**
 * AVISOS DO PET (29/09) — nascem desligados, moram na faixa 1800000–1809999,
 * um por dia (os cuidados do mesmo dia juntos), véspera só pro que se marca
 * na clínica, remédio na hora sem avisar a dose já dada, teto de 20.
 */
import { describe, it, expect } from "vitest";
import { BASES_LEMBRETES } from "@/lib/notificacoes";
import { assinaturaDos, lerDadosDosLembretes } from "@/lib/reagendar";
import { lerPrefs } from "@/lib/prefs-notificacoes";
import { contaComoAnotacao } from "@/lib/sequencia";
import {
  PREFS_LEMBRETE_PET_PADRAO, TETO_AVISOS_PET, algumLigadoPet, doPet, lerDadosDosAvisosPet, lerPrefsLembretePet, planejarAvisosPet, type DadosDosAvisosPet,
} from "@/lib/pet-avisos";
import { somarDias } from "@/lib/pet";

const BASE = 1800000;
const agora = new Date(2026, 8, 29, 7, 30); // terça 29/09/2026 07:30
const HOJE = "2026-09-29";
const d = (n: number) => somarDias(HOJE, n);
const ligado = { cuidados: true, remedios: true, hora: 10 };

describe("preferências", () => {
  it("nascem DESLIGADAS; dado antigo/torto nunca liga aviso", () => {
    expect(lerPrefsLembretePet(undefined)).toEqual(PREFS_LEMBRETE_PET_PADRAO);
    expect(PREFS_LEMBRETE_PET_PADRAO).toMatchObject({ cuidados: false, remedios: false });
    expect(lerPrefsLembretePet({ cuidados: "sim", remedios: 1, hora: 99 })).toEqual({ cuidados: false, remedios: false, hora: 10 });
    expect(algumLigadoPet(lerPrefsLembretePet({ remedios: true }))).toBe(true);
  });

  it("a chave de ajuste não conta como 'dia anotado' da sequência (e a do plano conta)", () => {
    expect(contaComoAnotacao("pet-lembrete-prefs")).toBe(false);
    expect(contaComoAnotacao("pet-dicas-prefs")).toBe(false);
    expect(contaComoAnotacao("pet-cuidados")).toBe(true);
    expect(contaComoAnotacao("pet-pesos")).toBe(true);
  });

  it("desligado: não planeja nada", () => {
    expect(planejarAvisosPet({ prefs: PREFS_LEMBRETE_PET_PADRAO, datas: [{ pet: "Thor", de: "do Thor", nome: "V10", tipo: "vacina", proxima: d(3) }], doses: [] }, BASE, agora)).toEqual([]);
  });
});

describe("faixa de id", () => {
  it("o pet tem faixa própria (1800000) registrada com os outros tipos", () => {
    expect(BASES_LEMBRETES.pet).toBe(BASE);
  });

  it("todo aviso planejado mora em 1800000–1809999", () => {
    const dados: DadosDosAvisosPet = {
      prefs: ligado,
      datas: Array.from({ length: 30 }, (_, i) => ({ pet: "Thor", de: "do Thor", nome: `C${i}`, tipo: "vermifugo" as const, proxima: d(i * 2) })),
      doses: [{ pet: "Thor", de: "do Thor", nome: "Apoquel", hora: "20:00", dadaHoje: false }, { pet: "Mia", de: "da Mia", nome: "Tapazol", hora: "08:00", dadaHoje: false }],
    };
    const avisos = planejarAvisosPet(dados, BASE, agora);
    expect(avisos.length).toBe(TETO_AVISOS_PET);
    for (const a of avisos) expect(a.id >= BASE && a.id < BASE + 10000, `${a.id}`).toBe(true);
    expect(new Set(avisos.map((a) => a.id)).size).toBe(avisos.length);
  });
});

describe("cuidados com data", () => {
  const plano = (datas: DadosDosAvisosPet["datas"]) => planejarAvisosPet({ prefs: ligado, datas, doses: [] }, BASE, agora);

  it("vermífugo: só no dia, na hora escolhida, com o nome do pet", () => {
    const [a, ...resto] = plano([{ pet: "Mia", de: "da Mia", nome: "Vermífugo", tipo: "vermifugo", proxima: d(5) }]);
    expect(resto).toEqual([]);
    expect(a.quando).toEqual(new Date(2026, 9, 4, 10, 0));
    expect(a.title).toBe("🐾 Hoje: Vermífugo da Mia");
    expect(a.id).toBe(BASE + 1004); // MMDD
    expect(a.rota).toBe("/pet?aba=saude");
    expect(a.title + a.body).not.toMatch(/\d+ dias/); // texto congela: nada de "faltam N dias"
  });

  it("vacina: véspera E dia (é coisa de marcar na clínica)", () => {
    const avisos = plano([{ pet: "Thor", de: "do Thor", nome: "V10", tipo: "vacina", proxima: d(10) }]);
    expect(avisos.map((a) => [a.quando.getDate(), a.title])).toEqual([[8, "🐾 Amanhã: V10 do Thor"], [9, "🐾 Hoje: V10 do Thor"]]);
  });

  it("dois cuidados no mesmo dia = UM aviso", () => {
    const avisos = plano([
      { pet: "Thor", de: "do Thor", nome: "Vermífugo", tipo: "vermifugo", proxima: d(3) },
      { pet: "Mia", de: "da Mia", nome: "Antipulgas", tipo: "antipulgas", proxima: d(3) },
    ]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].title).toBe("🐾 2 cuidados dos pets");
    expect(avisos[0].body).toBe("Hoje: Vermífugo do Thor e Antipulgas da Mia.");
  });

  it("atrasado: um aviso só, na próxima hora do aviso; mais de 30 dias atrasado para de cobrar", () => {
    const avisos = plano([
      { pet: "Thor", de: "do Thor", nome: "NexGard", tipo: "antipulgas", proxima: d(-2) },
      { pet: "Thor", de: "do Thor", nome: "V10", tipo: "vacina", proxima: d(-45) },
    ]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ title: "🐾 NexGard do Thor venceu" });
    expect(avisos[0].quando).toEqual(new Date(2026, 8, 29, 10, 0)); // hoje ainda dá (são 07:30)
    const depoisDasDez = planejarAvisosPet({ prefs: ligado, datas: [{ pet: "Thor", de: "do Thor", nome: "NexGard", tipo: "antipulgas", proxima: d(-2) }], doses: [] }, BASE, new Date(2026, 8, 29, 11));
    expect(depoisDasDez[0].quando).toEqual(new Date(2026, 8, 30, 10, 0));
  });

  it("nada no passado, nada além de 60 dias", () => {
    expect(plano([{ pet: "Thor", de: "do Thor", nome: "V10", tipo: "vacina", proxima: d(200) }])).toEqual([]);
    const tarde = planejarAvisosPet({ prefs: ligado, datas: [{ pet: "Thor", de: "do Thor", nome: "Vermífugo", tipo: "vermifugo", proxima: HOJE }], doses: [] }, BASE, new Date(2026, 8, 29, 22));
    expect(tarde).toEqual([]);
  });
});

describe("remédio na hora", () => {
  const plano = (doses: DadosDosAvisosPet["doses"], quando = agora) => planejarAvisosPet({ prefs: { ...ligado, cuidados: false }, datas: [], doses }, BASE, quando);

  it("hoje, amanhã e depois; a dose de hoje já dada não avisa", () => {
    const avisos = plano([{ pet: "Thor", de: "do Thor", nome: "Apoquel", hora: "20:00", dadaHoje: true }]);
    expect(avisos.map((a) => a.quando.getDate())).toEqual([30, 1]);
    expect(avisos[0].title).toBe("💊 Apoquel do Thor");
    expect(avisos[0].id).toBeGreaterThanOrEqual(BASE + 2000);
  });

  it("respeita o fim do tratamento e junta doses do mesmo horário", () => {
    const avisos = plano([
      { pet: "Thor", de: "do Thor", nome: "Apoquel", hora: "08:00", ate: HOJE, dadaHoje: false },
      { pet: "Mia", de: "da Mia", nome: "Tapazol", hora: "08:00", dadaHoje: false },
    ]);
    expect(avisos[0].title).toBe("💊 Apoquel do Thor e Tapazol da Mia");
    expect(avisos.slice(1).every((a) => !a.title.includes("Apoquel"))).toBe(true);
  });

  it("do/da/de pelo sexo cadastrado", () => {
    expect(doPet({ name: "Mia", sexo: "femea" })).toBe("da Mia");
    expect(doPet({ name: "Thor", sexo: "macho" })).toBe("do Thor");
    expect(doPet({ name: "Bidu" })).toBe("de Bidu");
  });
});

describe("leitura dos dados e reagendamento", () => {
  const store: Record<string, unknown> = {
    "pet-list": [{ id: "p1", name: "Thor", species: "cachorro", breed: "", weight: "", birthday: "", sexo: "macho" }],
    "pet-health": [{ id: "h1", petId: "p1", type: "deworming", name: "Drontal", date: d(-85), nextDate: d(5) }],
    "pet-cuidados": [{ id: "r1", petId: "p1", tipo: "remedio", nome: "Apoquel", horarios: ["20:00"] }],
    "pet-lembrete-prefs": ligado,
  };
  const leitor = (extra: Record<string, unknown> = {}) => <T,>(k: string, f: T): T => (k in extra ? (extra[k] as T) : k in store ? (store[k] as T) : f);

  it("lê datas da carteirinha e doses de hoje (inclusive do app antigo)", () => {
    const dados = lerDadosDosAvisosPet(leitor(), HOJE);
    expect(dados.datas).toEqual([{ pet: "Thor", de: "do Thor", nome: "Drontal", tipo: "vermifugo", proxima: d(5) }]);
    expect(dados.doses).toEqual([{ pet: "Thor", de: "do Thor", nome: "Apoquel", hora: "20:00", ate: undefined, dadaHoje: false }]);
  });

  it("desligado: não lê nada (e não pesa na abertura)", () => {
    expect(lerDadosDosAvisosPet(leitor({ "pet-lembrete-prefs": undefined }), HOJE)).toMatchObject({ datas: [], doses: [] });
  });

  it("marcar a dose de hoje muda a assinatura (o aviso pendente é refeito sem ela)", () => {
    const prefs = lerPrefs(undefined);
    const antes = assinaturaDos(lerDadosDosLembretes(leitor()), prefs);
    const hoje = new Date();
    const chave = `pet-routine-${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const depois = assinaturaDos(lerDadosDosLembretes(leitor({ [chave]: { p1: { "rem:r1:20:00": true } } })), prefs);
    expect(depois).not.toBe(antes);
    // desligado, o pet nem entra na assinatura
    const off = assinaturaDos(lerDadosDosLembretes(leitor({ "pet-lembrete-prefs": { cuidados: false, remedios: false, hora: 10 } })), prefs);
    const off2 = assinaturaDos(lerDadosDosLembretes(leitor({ "pet-lembrete-prefs": { cuidados: false, remedios: false, hora: 10 }, [chave]: { p1: { "rem:r1:20:00": true } } })), prefs);
    expect(off).toBe(off2);
  });
});
