/**
 * PET (29/09) — as contas do módulo refeito, sem tela.
 *
 * O que trava aqui:
 *  1. o FORMATO ANTIGO abre igual (pet-list em texto livre, pet-health com
 *     vaccine/deworming/visit, pet-routine-<dia>) — nenhuma chave muda de tipo;
 *  2. a carteirinha soma o plano novo (pet-cuidados) e o histórico de sempre
 *     (pet-health) sem migrar nada — inclusive o antipulgas que o app antigo
 *     obrigava a registrar como "Vermífugo";
 *  3. as datas: intervalo do plano manda, data marcada vale até a próxima
 *     aplicação, série de filhote, status (venceu / hoje / em N dias);
 *  4. o começo pronto por espécie e fase da vida.
 */
import { describe, it, expect } from "vitest";
import {
  comMarca, comPeso, especieDe, faixaEtaria, idadeCurta, idadeExtenso, lerPeso, pesoComUnidade, pesosDoPet, pesoTexto, petsValidos, rotinaPadraoDe,
  rotinaValida, somarDias, tarefasDoPet, type Pet,
} from "@/lib/pet";
import {
  cuidadosDasSugestoes, dosesDoDia, familiaDe, linhasDaCarteirinha, proximosCuidados, quandoTexto, registrarAplicacao, statusDe, sugerirCuidados,
  tipoEfetivo, type Cuidado, type Registro,
} from "@/lib/pet-cuidados";
import { rotaDeHoje } from "@/lib/pet-hoje";

const HOJE = "2026-09-29"; // terça
const d = (n: number) => somarDias(HOJE, n);
const pet = (m: Partial<Pet> = {}): Pet => ({ id: "p1", name: "Thor", species: "Cachorro", breed: "", weight: "", birthday: "", ...m });

/* ─────────────────────────────── formato antigo ─────────────────────────────── */

describe("pet-list antigo abre sem mudar nada", () => {
  const antigo = [
    { id: "1727000000000", name: "Thor", species: "cachorro", breed: "Golden", weight: "28 kg", birthday: "2021-04-15" },
    { id: "1727000000001", name: "Mia", species: "gata", breed: "", weight: "4,2", birthday: "" },
  ];

  it("lê os itens de sempre e ignora lixo sem derrubar", () => {
    const lidos = petsValidos([...antigo, null, "x", { id: "", name: "Sem id" }, { id: "9", name: "" }, 7]);
    expect(lidos.map((p) => p.name)).toEqual(["Thor", "Mia"]);
    expect(petsValidos("lixo")).toEqual([]);
    expect(petsValidos(undefined)).toEqual([]);
  });

  it("peso em texto livre vira número; o texto que o app antigo mostra é só o número", () => {
    expect(lerPeso("28 kg")).toBe(28);
    expect(lerPeso("4,2")).toBe(4.2);
    expect(lerPeso("4.2kg")).toBe(4.2);
    expect(lerPeso("")).toBeNull();
    expect(lerPeso("gordinho")).toBeNull();
    expect(lerPeso("65 g")).toBe(0.065); // calopsita
    expect(lerPeso("65g")).toBe(0.065);
    expect(lerPeso("1,2 kg")).toBe(1.2);
    expect(pesoTexto(18.4)).toBe("18,4");
    expect(pesoTexto(4)).toBe("4");
    expect(pesoTexto(0.065)).toBe("0,065");
    expect(pesoComUnidade(0.065)).toBe("65 g");
    expect(pesoComUnidade(18.4)).toBe("18,4 kg");
  });

  it("sem histórico de peso, o weight antigo vira o ponto atual (e nada é gravado)", () => {
    const [thor] = petsValidos(antigo);
    expect(pesosDoPet(thor, undefined)).toEqual([{ dia: "", kg: 28 }]);
    expect(pesosDoPet(thor, { "1727000000000": [{ dia: "2026-09-01", kg: 27.5 }, { dia: "lixo", kg: 3 }] })).toEqual([{ dia: "2026-09-01", kg: 27.5 }]);
  });

  it("peso novo substitui o do mesmo dia e mantém a ordem", () => {
    let m = comPeso(undefined, "p1", "2026-09-10", 10);
    m = comPeso(m, "p1", "2026-09-01", 9.5);
    m = comPeso(m, "p1", "2026-09-10", 10.2);
    expect(m.p1).toEqual([{ dia: "2026-09-01", kg: 9.5 }, { dia: "2026-09-10", kg: 10.2 }]);
    expect(comPeso({ outro: [{ dia: "2026-01-01", kg: 1 }] }, "p1", "2026-09-01", 2).outro).toHaveLength(1);
  });

  it("a rotina gravada pelo app antigo continua sendo lida; sem lista gravada, a padrão da espécie", () => {
    const gravada = [{ id: "food", label: "Comida", emoji: "🍖" }, { id: "custom-1", label: "Remédio do ouvido", emoji: "💊" }];
    expect(tarefasDoPet(pet(), gravada).map((t) => t.id)).toEqual(["food", "custom-1"]);
    // cachorro sem lista: tem passeio com o id que as insígnias contam ("walk"); banho não é tarefa DIÁRIA
    const cao = tarefasDoPet(pet(), null);
    expect(cao.map((t) => t.id)).toContain("walk");
    expect(cao.map((t) => t.id)).not.toContain("bath");
    expect(tarefasDoPet(pet({ species: "gata" }), undefined).map((t) => t.id)).toContain("areia");
    expect(tarefasDoPet(pet({ species: "calopsita" }), null).map((t) => t.id)).toEqual(["food", "water"]);
    expect(tarefasDoPet(pet({ species: "peixe betta" }), null).map((t) => t.id)).toEqual(["food"]);
  });

  it("pet-routine-<dia> continua objeto de objetos: marcar não mexe no dos outros", () => {
    const antes = { p1: { food: true }, p2: { walk: true } };
    const depois = comMarca(antes, "p1", "walk", true);
    expect(depois).toEqual({ p1: { food: true, walk: true }, p2: { walk: true } });
    expect(Array.isArray(depois)).toBe(false);
    expect(rotinaValida(["lixo"])).toEqual({});
    expect(rotinaValida({ p1: { a: true, b: "sim", c: false } })).toEqual({ p1: { a: true, c: false } });
  });
});

/* ─────────────────────────────── espécie e idade ─────────────────────────────── */

describe("espécie e idade", () => {
  it("entende a espécie em texto livre", () => {
    expect(especieDe("Cachorro")).toBe("cao");
    expect(especieDe("cadela")).toBe("cao");
    expect(especieDe("vira-lata")).toBe("cao");
    expect(especieDe("Cão")).toBe("cao");
    expect(especieDe("gata")).toBe("gato");
    expect(especieDe("Gatinho persa")).toBe("gato");
    expect(especieDe("calopsita")).toBe("ave");
    expect(especieDe("peixe betta")).toBe("peixe");
    expect(especieDe("hamster")).toBe("roedor");
    expect(especieDe("coelho")).toBe("coelho");
    expect(especieDe("jabuti")).toBe("reptil");
    expect(especieDe("")).toBe("outro");
    expect(especieDe(undefined)).toBe("outro");
  });

  it("idade por extenso e curta, com data aproximada e sem data", () => {
    expect(idadeExtenso({ birthday: "2023-07-20" }, HOJE)).toBe("3 anos e 2 meses");
    expect(idadeCurta({ birthday: "2023-07-20" }, HOJE)).toBe("3a 2m");
    expect(idadeExtenso({ birthday: "2026-04-10" }, HOJE)).toBe("5 meses");
    expect(idadeExtenso({ birthday: "2026-09-01" }, HOJE)).toBe("4 semanas");
    expect(idadeExtenso({ birthday: "2022-09-29" }, HOJE)).toBe("4 anos");
    expect(idadeExtenso({ birthday: "2020-03-01", nascimentoAprox: true }, HOJE)).toBe("cerca de 6 anos");
    expect(idadeCurta({ birthday: "2020-03-01", nascimentoAprox: true }, HOJE)).toBe("~6a");
    expect(idadeExtenso({ birthday: "", faixa: "idoso" }, HOJE)).toBe("Idoso");
    expect(idadeCurta({ birthday: "" }, HOJE)).toBe("—");
  });

  it("fase da vida: filhote < 1 ano; idoso pelo porte", () => {
    expect(faixaEtaria(pet({ birthday: "2026-03-01" }), HOJE)).toBe("filhote");
    expect(faixaEtaria(pet({ birthday: "2017-06-01", porte: "grande" }), HOJE)).toBe("idoso"); // 9,3 anos, grande (idoso ≥ 8,5)
    expect(faixaEtaria(pet({ birthday: "2017-06-01", porte: "pequeno" }), HOJE)).toBe("adulto"); // pequeno só ≥ 10
    expect(faixaEtaria(pet({ birthday: "2017-06-01" }), HOJE)).toBe("adulto"); // sem porte (≈ SRD): ≥ 9,5
    expect(faixaEtaria(pet({ species: "Gato", birthday: "2015-01-01" }), HOJE)).toBe("idoso");
    expect(faixaEtaria(pet({ faixa: "idoso" }), HOJE)).toBe("idoso");
    expect(faixaEtaria(pet(), HOJE)).toBe("adulto");
  });
});

/* ─────────────────────────────── carteirinha ─────────────────────────────── */

const reg = (m: Partial<Registro>): Registro => ({ id: Math.random().toString(36).slice(2), petId: "p1", type: "vaccine", name: "V10", date: d(-10), nextDate: "", ...m });

describe("carteirinha a partir do pet-health ANTIGO (sem plano nenhum)", () => {
  const antigos = [
    reg({ id: "h1", type: "vaccine", name: "V10", date: d(-340), nextDate: d(25) }),
    reg({ id: "h2", type: "deworming", name: "Drontal", date: d(-95), nextDate: d(-5) }),
    reg({ id: "h3", type: "deworming", name: "Bravecto", date: d(-80), nextDate: d(4) }),
    reg({ id: "h4", type: "visit", name: "Check-up anual", date: d(-20), nextDate: d(345) }),
    reg({ id: "h5", petId: "outro", type: "vaccine", name: "V4", date: d(-5), nextDate: d(360) }),
  ];
  const linhas = linhasDaCarteirinha("p1", undefined, antigos, HOJE);

  it("uma linha por cuidado, só do pet, com a próxima e o status", () => {
    expect(linhas).toHaveLength(4);
    const por = Object.fromEntries(linhas.map((l) => [l.nome, l]));
    expect(por["Drontal"]).toMatchObject({ tipo: "vermifugo", proxima: d(-5), status: "atrasado", diasAte: -5 });
    expect(por["V10"]).toMatchObject({ tipo: "vacina", proxima: d(25), status: "em-dia" });
    expect(por["Check-up anual"]).toMatchObject({ tipo: "consulta", status: "em-dia" });
  });

  it("Bravecto registrado como Vermífugo (o app antigo não tinha antipulgas) aparece como ANTIPULGAS", () => {
    const bravecto = linhas.find((l) => l.nome === "Bravecto");
    expect(bravecto?.tipo).toBe("antipulgas");
    expect(bravecto).toMatchObject({ status: "logo", diasAte: 4 });
    expect(tipoEfetivo({ type: "deworming", name: "NexGard Spectra" })).toBe("antipulgas");
    expect(tipoEfetivo({ type: "deworming", name: "Drontal Plus" })).toBe("vermifugo");
  });

  it("os urgentes vêm primeiro: venceu → esta semana → o próximo em dia", () => {
    expect(proximosCuidados(linhas, 3).map((l) => l.nome)).toEqual(["Drontal", "Bravecto", "V10"]);
  });

  it("registro torto (sem data, sem nome) fica de fora sem derrubar a tela", () => {
    expect(linhasDaCarteirinha("p1", "lixo", [{ id: "x", petId: "p1", name: "", date: HOJE }, { id: "y", petId: "p1", name: "V8", date: "ontem" }, null], HOJE)).toEqual([]);
  });
});

describe("plano (pet-cuidados) + histórico", () => {
  const plano = (m: Partial<Cuidado>): Cuidado => ({ id: "c1", petId: "p1", tipo: "vacina", nome: "V10", intervaloDias: 365, ...m });

  it("V10 e V-10 são a mesma linha; a sugestão 'V8 ou V10' absorve a V10 registrada antes", () => {
    const regs = [reg({ id: "a", name: "V10", date: d(-400) }), reg({ id: "b", name: "V-10", date: d(-35) })];
    expect(linhasDaCarteirinha("p1", [], regs, HOJE)).toHaveLength(1);
    const comSugestao = linhasDaCarteirinha("p1", [plano({ nome: "V8 ou V10", sugerido: true })], regs, HOJE);
    expect(comSugestao).toHaveLength(1);
    expect(comSugestao[0]).toMatchObject({ nome: "V8 ou V10", ultima: d(-35), proxima: d(330) });
    expect(familiaDe("vacina", "Antirrábica")).toBe(familiaDe("vacina", "Anti-rábica"));
    expect(familiaDe("vacina", "V4 ou V5")).toBe(familiaDe("vacina", "V5"));
  });

  it("o intervalo do PLANO manda (trocou o antipulgas de mensal pra trimestral)", () => {
    const regs = [reg({ id: "a", type: "antipulgas", name: "Bravecto", date: d(-40), nextDate: d(-10), cuidadoId: "c1" })];
    const [l] = linhasDaCarteirinha("p1", [plano({ tipo: "antipulgas", nome: "Bravecto", intervaloDias: 90 })], regs, HOJE);
    expect(l).toMatchObject({ proxima: d(50), status: "em-dia" });
  });

  it("data marcada vale até a próxima aplicação", () => {
    const c = plano({ proxima: d(3) });
    expect(linhasDaCarteirinha("p1", [c], [reg({ id: "a", date: d(-300), cuidadoId: "c1" })], HOJE)[0]).toMatchObject({ proxima: d(3), status: "logo" });
    // aplicou depois da data marcada: volta a contar pelo intervalo
    expect(linhasDaCarteirinha("p1", [c], [reg({ id: "a", date: d(4), cuidadoId: "c1" })], d(5))[0].proxima).toBe(d(369));
  });

  it("sugestão sem data fica 'sem data' e não entra nos próximos", () => {
    const linhas = linhasDaCarteirinha("p1", [plano({ sugerido: true })], [], HOJE);
    expect(linhas[0].status).toBe("sem-data");
    expect(linhas[0].proxima).toBeUndefined();
    expect(proximosCuidados(linhas)).toEqual([]);
  });

  it("série de filhote: 3 doses com 21 dias, depois reforço anual", () => {
    const c = plano({ doses: 3, intervaloSerie: 21 });
    const l0 = linhasDaCarteirinha("p1", [c], [], HOJE)[0];
    expect(l0.doseDaSerie).toEqual({ atual: 1, total: 3 });
    const r1 = registrarAplicacao(l0, HOJE).registro;
    expect(r1).toMatchObject({ type: "vaccine", date: HOJE, nextDate: d(21), cuidadoId: "c1" });
    const l1 = linhasDaCarteirinha("p1", [c], [r1], HOJE)[0];
    expect(l1).toMatchObject({ doseDaSerie: { atual: 2, total: 3 }, proxima: d(21) });
    const r2 = registrarAplicacao(l1, d(21)).registro;
    const l2 = linhasDaCarteirinha("p1", [c], [r1, r2], d(21))[0];
    const r3 = registrarAplicacao(l2, d(42)).registro;
    expect(r3.nextDate).toBe(d(42 + 365)); // a última dose já aponta o reforço anual
    expect(linhasDaCarteirinha("p1", [c], [r1, r2, r3], d(42))[0]).toMatchObject({ doseDaSerie: undefined, proxima: d(407) });
  });

  it("'Feito hoje' grava no formato de sempre e limpa a sugestão/data marcada", () => {
    const [l] = linhasDaCarteirinha("p1", [plano({ tipo: "vermifugo", nome: "Vermífugo", intervaloDias: 90, sugerido: true, proxima: d(2) })], [], HOJE);
    const { registro, cuidado } = registrarAplicacao(l, HOJE, { obs: " Drontal " });
    expect(registro).toMatchObject({ petId: "p1", type: "deworming", name: "Vermífugo", date: HOJE, nextDate: d(90), cuidadoId: "c1", obs: "Drontal" });
    expect(cuidado).toMatchObject({ sugerido: false, proxima: undefined });
    // tipos novos entram como texto (o app antigo só não mostra o rótulo)
    const [pulga] = linhasDaCarteirinha("p1", [plano({ id: "c2", tipo: "antipulgas", nome: "NexGard", intervaloDias: 30 })], [], HOJE);
    expect(registrarAplicacao(pulga, HOJE).registro.type).toBe("antipulgas");
  });

  it("linha só do histórico: feito hoje repete o intervalo que o último registro tinha", () => {
    const [l] = linhasDaCarteirinha("p1", [], [reg({ id: "a", type: "deworming", name: "Drontal", date: d(-95), nextDate: d(-5) })], HOJE);
    const { registro, cuidado } = registrarAplicacao(l, HOJE);
    expect(registro).toMatchObject({ type: "deworming", name: "Drontal", nextDate: d(90) });
    expect(registro.cuidadoId).toBeUndefined();
    expect(cuidado).toBeUndefined();
  });

  it("status e texto de quando", () => {
    expect(statusDe(d(-1), HOJE)).toEqual({ status: "atrasado", diasAte: -1 });
    expect(statusDe(HOJE, HOJE)).toEqual({ status: "hoje", diasAte: 0 });
    expect(statusDe(d(7), HOJE).status).toBe("logo");
    expect(statusDe(d(8), HOJE).status).toBe("em-dia");
    expect(statusDe(undefined, HOJE)).toEqual({ status: "sem-data" });
    expect(quandoTexto({ status: "atrasado", diasAte: -1, proxima: d(-1) })).toBe("venceu ontem");
    expect(quandoTexto({ status: "atrasado", diasAte: -2, proxima: d(-2) })).toBe("venceu há 2 dias");
    expect(quandoTexto({ status: "logo", diasAte: 1, proxima: d(1) })).toBe("amanhã");
    expect(quandoTexto({ status: "em-dia", diasAte: 200, proxima: "2027-04-17" })).toBe("17/04/2027");
  });
});

describe("remédio de todo dia", () => {
  const rem = (m: Partial<Cuidado>): Cuidado => ({ id: "r1", petId: "p1", tipo: "remedio", nome: "Apoquel", horarios: ["20:00", "08:00"], ...m });
  it("as doses de hoje vêm por horário; tratamento encerrado, arquivado ou de outro pet não entra", () => {
    expect(dosesDoDia("p1", [rem({ dose: "1 comp." })], HOJE).map((x) => [x.id, x.hora, x.label])).toEqual([
      ["rem:r1:08:00", "08:00", "Apoquel · 1 comp."], ["rem:r1:20:00", "20:00", "Apoquel · 1 comp."],
    ]);
    expect(dosesDoDia("p1", [rem({ ate: d(-1) })], HOJE)).toEqual([]);
    expect(dosesDoDia("p1", [rem({ ate: HOJE })], HOJE)).toHaveLength(2);
    expect(dosesDoDia("p1", [rem({ arquivado: true })], HOJE)).toEqual([]);
    expect(dosesDoDia("p1", [rem({ petId: "p2" })], HOJE)).toEqual([]);
    expect(dosesDoDia("p1", [rem({ horarios: ["8h", "25:00"] })], HOJE)).toEqual([]);
  });

  it("o dia do pet junta a rotina e as doses, com o que já foi marcado", () => {
    const itens = rotaDeHoje(pet(), null, [rem({})], { p1: { walk: true, "rem:r1:08:00": true } }, HOJE);
    expect(itens.find((i) => i.id === "walk")?.feito).toBe(true);
    expect(itens.filter((i) => i.tipo === "remedio").map((i) => [i.hora, i.feito])).toEqual([["08:00", true], ["20:00", false]]);
  });
});

describe("começo pronto por espécie e fase da vida", () => {
  it("cachorro adulto: polivalente e raiva todo ano, vermífugo a cada 3 meses, antipulgas, check-up anual", () => {
    const s = sugerirCuidados({ species: "Cachorro", birthday: "2022-01-01" }, HOJE);
    expect(s.map((x) => [x.nome, x.intervaloDias])).toEqual([
      ["V8 ou V10", 365], ["Antirrábica", 365], ["Vermífugo", 90], ["Antipulgas e carrapatos", 30], ["Check-up", 365],
    ]);
  });
  it("filhote: série de 3 doses, vermífugo todo mês, sem check-up (a série já leva ao vet)", () => {
    const s = sugerirCuidados({ species: "Cachorro", birthday: "2026-08-01" }, HOJE);
    expect(s[0]).toMatchObject({ nome: "V8 ou V10", doses: 3, intervaloSerie: 21, intervaloDias: 365 });
    expect(s.find((x) => x.tipo === "vermifugo")?.intervaloDias).toBe(30);
    expect(s.some((x) => x.tipo === "consulta")).toBe(false);
  });
  it("idoso: check-up a cada 6 meses; gato: V4 ou V5; outros bichos: só check-up anual", () => {
    expect(sugerirCuidados({ species: "Gato", faixa: "idoso", birthday: "" }, HOJE).find((x) => x.tipo === "consulta")?.intervaloDias).toBe(180);
    expect(sugerirCuidados({ species: "Gato", birthday: "2020-01-01" }, HOJE)[0].nome).toBe("V4 ou V5");
    expect(sugerirCuidados({ species: "calopsita", birthday: "" }, HOJE).map((x) => x.tipo)).toEqual(["consulta"]);
  });
  it("as sugestões viram cuidados SEM data (sugerido) — nada de data inventada", () => {
    const cs = cuidadosDasSugestoes("p1", sugerirCuidados({ species: "Cachorro", birthday: "" }, HOJE), new Date(2026, 8, 29, 10));
    expect(cs).toHaveLength(5);
    expect(cs.every((c) => c.sugerido && c.petId === "p1" && !c.proxima)).toBe(true);
    expect(new Set(cs.map((c) => c.id)).size).toBe(5);
  });
  it("a rotina padrão do cachorro tem o passeio com o id das insígnias", () => {
    expect(rotinaPadraoDe("cao").find((t) => t.id === "walk")?.label).toBe("Passeio");
  });
});

describe("mandar a carteirinha (texto pro WhatsApp)", () => {
  it("monta o texto do RG e da carteirinha, inclusive do formato antigo, sem inventar nada", async () => {
    const { textoDaCarteirinha } = await import("@/lib/pet-compartilhar");
    const thor = pet({ species: "cachorro", breed: "Golden", weight: "28 kg", birthday: "2021-04-15", sexo: "macho", castrado: true, chip: "985112004567890", alergias: "frango", vetNome: "Dra. Paula" });
    const regs = [
      reg({ id: "a", type: "vaccine", name: "V10", date: d(-340), nextDate: d(25), obs: "lote 2231" }),
      reg({ id: "b", type: "deworming", name: "Drontal", date: d(-95), nextDate: d(-5) }),
    ];
    const linhas = linhasDaCarteirinha("p1", [{ id: "r1", petId: "p1", tipo: "remedio", nome: "Apoquel", dose: "1 comp.", horarios: ["20:00"] }], regs, HOJE);
    const t = textoDaCarteirinha(thor, linhas, undefined, HOJE);
    expect(t).toContain("🐾 Carteirinha de Thor");
    expect(t).toContain("cachorro · Golden · macho · castrado · 5 anos e 5 meses");
    expect(t).toContain("Peso: 28 kg");
    expect(t).toContain("Microchip: 985112004567890");
    expect(t).toContain("Alergias e cuidados: frango");
    expect(t).toContain("VACINAS\n• V10 — última 24/10/2025 · próxima 24/10/2026 · todo ano (lote 2231)");
    expect(t).toContain("• Drontal — última 26/06/2026 · venceu 24/09/2026 · a cada 3 meses");
    expect(t).toContain("• Apoquel 1 comp. — 20:00 · uso contínuo");
    expect(t).toContain("Veterinário: Dra. Paula");
    expect(textoDaCarteirinha(pet(), [], undefined, HOJE)).toContain("Nenhuma vacina ou cuidado registrado ainda.");
  });
});
