/**
 * Relações, Onda 1 (29/09) — a conta pura: datas do ano, idade, 29/02, ano
 * desconhecido, datas repetidas do app antigo, manter contato e os avisos da
 * faixa 1900000. Fuso do Brasil antes de qualquer Date (os bugs de data do
 * módulo sempre foram de UTC).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, expect, it } from "vitest";
import {
  ANO_SEM_ANO, circuloDaRelacao, circuloDe, datasDoAno, datasValidas, diasEntre, ehDiaValido, haQuanto, lerReais, linkSeguro,
  mensagemDeParabens, momentosValidos, montarAniversario, pessoasPraFalar, pessoasValidas, presentesValidos, proximaOcorrencia,
  proximasDatas, quandoFalta, rotuloDoFaz, situacaoDoContato, sugestaoUsada, COMECO_PRONTO, type Momento, type Pessoa,
} from "@/lib/relacoes";
import {
  LEMBRETE_RELACOES_PADRAO, algumLembreteRelacoes, assinaturaDasRelacoes, lerLembreteRelacoes, planejarRelacoes, type DadosDasRelacoes,
} from "@/lib/relacoes-lembrete";
import { localDayKey } from "@/lib/utils";

const dia = (a: number, m: number, d: number) => new Date(a, m - 1, d);
const pessoa = (p: Partial<Pessoa> & { id: string; name: string }): Pessoa => ({ relation: "", birthday: "", notes: "", ...p });

describe("datas", () => {
  it("valida o dia do calendário (31/04 não, 29/02 só em bissexto)", () => {
    expect(ehDiaValido("2000-02-29")).toBe(true);
    expect(ehDiaValido("2001-02-29")).toBe(false);
    expect(ehDiaValido("1990-04-31")).toBe(false);
    expect(ehDiaValido("10/05/1990")).toBe(false);
    expect(ehDiaValido("")).toBe(false);
  });

  it("monta o aniversário sem ano no ano 2000 (bissexto: 29/02 cabe)", () => {
    expect(montarAniversario(29, 2, null)).toBe(`${ANO_SEM_ANO}-02-29`);
    expect(montarAniversario(10, 5, 1990)).toBe("1990-05-10");
    expect(montarAniversario(31, 4, 1990)).toBe("");
    expect(montarAniversario(29, 2, 2001)).toBe("");
  });

  it("próxima ocorrência: hoje conta como hoje; 29/02 em ano comum cai em 28/02", () => {
    expect(proximaOcorrencia(9, 29, dia(2026, 9, 29))).toEqual(dia(2026, 9, 29));
    expect(proximaOcorrencia(9, 28, dia(2026, 9, 29))).toEqual(dia(2027, 9, 28));
    expect(proximaOcorrencia(2, 29, dia(2026, 9, 29))).toEqual(dia(2027, 2, 28));
    expect(proximaOcorrencia(2, 29, dia(2027, 10, 1))).toEqual(dia(2028, 2, 29));
  });

  it("dias entre dois dias locais, sem erro de fuso à noite", () => {
    const noite = new Date(2026, 8, 29, 23, 30);
    expect(diasEntre(noite, dia(2026, 9, 30))).toBe(1);
    expect(diasEntre(noite, dia(2026, 9, 29))).toBe(0);
  });

  it("idade que a pessoa FAZ; sem ano, nada de idade; 'faz N anos' das datas de casal é conta, não título", () => {
    const hoje = dia(2026, 9, 29);
    const itens = datasDoAno(
      [pessoa({ id: "a", name: "Ju", birthday: "1997-10-02" }), pessoa({ id: "b", name: "Tia", birthday: "2000-06-16", semAno: true })],
      datasValidas([{ id: "d1", title: "1 ano de namoro", person: "Rafa", date: "2023-10-20", type: "anniversary" }]),
      hoje,
    );
    const ju = itens.find((i) => i.titulo === "Ju")!;
    expect(ju.dias).toBe(3);
    expect(ju.faz).toBe(29);
    expect(rotuloDoFaz(ju)).toBe("faz 29");
    expect(itens.find((i) => i.titulo === "Tia")!.faz).toBeNull();
    const namoro = itens.find((i) => i.id === "d1")!;
    expect(namoro.tipo).toBe("casal");
    expect(rotuloDoFaz(namoro)).toBe("3 anos juntos");
    // ordem: o mais perto primeiro
    expect(itens.map((i) => i.titulo)).toEqual(["Ju", "1 ano de namoro", "Tia"]);
  });

  it("a data 'aniversário' do app antigo que repete o da pessoa aparece UMA vez", () => {
    const hoje = dia(2026, 9, 29);
    const itens = datasDoAno(
      [pessoa({ id: "1", name: "Mãe", birthday: "1965-08-12" })],
      datasValidas([
        { id: "x", title: "Aniversário da mãe", person: "mãe", date: "2026-08-12", type: "birthday" }, // mesmo dia: some
        { id: "y", title: "Aniversário do padrinho", person: "Zé", date: "2026-03-03", type: "birthday" }, // outra pessoa: fica
      ]),
      hoje,
    );
    expect(itens.map((i) => i.id)).toEqual(["y", "bday-1"]);
  });

  it("próximas: as da janela de 30 dias, ou as 3 mais perto se a janela tem menos", () => {
    const hoje = dia(2026, 9, 29);
    const itens = datasDoAno([
      pessoa({ id: "1", name: "A", birthday: "1990-10-01" }),
      pessoa({ id: "2", name: "B", birthday: "1990-12-01" }),
      pessoa({ id: "3", name: "C", birthday: "1990-03-01" }),
      pessoa({ id: "4", name: "D", birthday: "1990-05-01" }),
    ], [], hoje);
    expect(proximasDatas(itens, 30, 3).map((i) => i.titulo)).toEqual(["A", "B", "C"]);
  });

  it("textos de tempo", () => {
    expect(quandoFalta(0)).toBe("hoje");
    expect(quandoFalta(1)).toBe("amanhã");
    expect(quandoFalta(26)).toBe("em 26 dias");
    expect(quandoFalta(45)).toBe("em 6 semanas");
    expect(quandoFalta(300)).toBe("em 10 meses");
    expect(haQuanto(1)).toBe("ontem");
    expect(haQuanto(36)).toBe("há 5 semanas");
    expect(haQuanto(400)).toBe("há mais de 1 ano");
  });
});

describe("formato antigo continua abrindo (chave nunca muda de tipo)", () => {
  it("pessoa antiga sem campo novo: lê, deduz o círculo, e o que não conhece fica", () => {
    const [mae] = pessoasValidas([{ id: "1", name: "Mãe", relation: "Família", birthday: "1965-08-12", notes: "orquídea", extraDoFuturo: 42 }]);
    expect(mae.name).toBe("Mãe");
    expect(circuloDe(mae)).toBe("familia");
    expect((mae as unknown as Record<string, unknown>).extraDoFuturo).toBe(42);
  });

  it("lixo na nuvem não derruba: não-lista, item sem id/nome, data torta", () => {
    expect(pessoasValidas(null)).toEqual([]);
    expect(pessoasValidas({ a: 1 })).toEqual([]);
    expect(pessoasValidas([null, 3, { name: "sem id" }, { id: "1", name: " " }])).toEqual([]);
    expect(pessoasValidas([{ id: "1", name: "Ana", birthday: "31/02" }])[0].birthday).toBe("");
    expect(datasValidas([{ id: "1", title: "x", date: "" }])).toEqual([]);
    expect(presentesValidos([{ id: "1", idea: "livro", status: "???" }])[0].status).toBe("idea");
    expect(momentosValidos([{ id: "1", date: "2026-09-01", person: "Ana", description: "oi" }])[0].tipo).toBe("momento");
  });

  it("círculo pela relação digitada", () => {
    expect(circuloDaRelacao("Namorada")).toBe("amor");
    expect(circuloDaRelacao("minha mãe")).toBe("familia");
    expect(circuloDaRelacao("Irmãzinha")).toBe("familia");
    expect(circuloDaRelacao("Amiga da faculdade")).toBe("amigos");
    expect(circuloDaRelacao("Cliente")).toBe("trabalho");
    expect(circuloDaRelacao("")).toBe("outros");
  });
});

describe("manter contato", () => {
  const hoje = dia(2026, 9, 29);
  const carol = pessoa({ id: "c", name: "Carol", cadencia: 14, cadenciaDesde: "2026-06-01" });
  const momentos: Momento[] = momentosValidos([
    { id: "1", date: "2026-08-24", person: "carol", description: "Ela ia começar no emprego novo", tipo: "conversa" }, // pelo nome (dado antigo)
    { id: "2", date: "2026-10-10", person: "Carol", description: "futuro não conta" },
  ]);

  it("vence na última conversa + a frequência; momento com a pessoa conta como contato", () => {
    const s = situacaoDoContato(carol, momentos, hoje);
    expect(s.ultimo).toBe("2026-08-24");
    expect(s.desde).toBe(36);
    expect(s.vence).toBe("2026-09-07");
    expect(s.devido).toBe(true);
    expect(s.atraso).toBe(22);
  });

  it("sem conversa registrada, conta a partir do dia em que a frequência foi escolhida", () => {
    const nova = pessoa({ id: "n", name: "Bia", cadencia: 30, cadenciaDesde: "2026-09-20" });
    const s = situacaoDoContato(nova, [], hoje);
    expect(s.ultimo).toBeNull();
    expect(s.vence).toBe("2026-10-20");
    expect(s.devido).toBe(false);
  });

  it("sem frequência, nunca está 'devendo'", () => {
    expect(situacaoDoContato(pessoa({ id: "x", name: "X" }), momentos, hoje).devido).toBe(false);
  });

  it("a lista de quem está na hora: o mais atrasado (proporcional) primeiro", () => {
    const vo = pessoa({ id: "v", name: "Vó", cadencia: 7, cadenciaDesde: "2026-09-01" }); // venceu 08/09: 21 dias = 3× a frequência
    const lista = pessoasPraFalar([carol, vo, pessoa({ id: "z", name: "Z" })], momentos, hoje);
    expect(lista.map((x) => x.pessoa.name)).toEqual(["Vó", "Carol"]);
  });

  it("o começo pronto sabe qual papel já foi usado", () => {
    const mae = COMECO_PRONTO.find((s) => s.id === "mae")!;
    expect(sugestaoUsada(mae, [pessoa({ id: "1", name: "Dona Rita", relation: "mãe" })])).toBe(true);
    expect(sugestaoUsada(mae, [pessoa({ id: "1", name: "Mãe", relation: "Família" })])).toBe(false);
  });
});

describe("presentes e mensagens", () => {
  it("lê preço do jeito que se digita no Brasil", () => {
    expect(lerReais("89,90")).toBe(89.9);
    expect(lerReais("R$ 1.299,00")).toBe(1299);
    expect(lerReais("59.9")).toBe(59.9);
    expect(lerReais("")).toBeNull();
    expect(lerReais("abc")).toBeNull();
  });
  it("link sem protocolo vira https; javascript: não passa", () => {
    expect(linkSeguro("amazon.com.br/livro")).toBe("https://amazon.com.br/livro");
    expect(linkSeguro("javascript:alert(1)")).toBeNull();
    expect(linkSeguro("")).toBeNull();
  });
  it("parabéns com o primeiro nome", () => {
    expect(mensagemDeParabens("Ana Clara Souza")).toMatch(/^Feliz aniversário, Ana!/);
  });
});

describe("avisos de Relações (faixa 1900000)", () => {
  const BASE = 1900000;
  const hojeKey = "2026-09-29";
  const dados = (prefs: DadosDasRelacoes["prefs"], extra: Partial<DadosDasRelacoes> = {}): DadosDasRelacoes => ({
    prefs,
    pessoas: pessoasValidas([
      { id: "ju", name: "Ju", birthday: "1997-10-02" },
      { id: "vo", name: "Vó Cida", birthday: "1946-10-02" },
      { id: "carol", name: "Carol", birthday: "", cadencia: 14, cadenciaDesde: "2026-06-01" },
    ]),
    momentos: momentosValidos([{ id: "m", date: "2026-09-10", person: "Carol", pessoaId: "carol", description: "Conversamos", tipo: "conversa" }]),
    datas: [],
    presentes: [],
    ...extra,
  });

  it("nascem desligados: prefs vazias, tortas ou antigas não ligam nada", () => {
    expect(lerLembreteRelacoes(undefined)).toEqual(LEMBRETE_RELACOES_PADRAO);
    expect(lerLembreteRelacoes("x")).toEqual(LEMBRETE_RELACOES_PADRAO);
    expect(lerLembreteRelacoes({ noDia: { ligado: "sim", hora: "25:00" } })).toEqual(LEMBRETE_RELACOES_PADRAO);
    expect(algumLembreteRelacoes(LEMBRETE_RELACOES_PADRAO)).toBe(false);
    expect(planejarRelacoes(dados(LEMBRETE_RELACOES_PADRAO), BASE, new Date(2026, 8, 29, 8))).toEqual([]);
    expect(assinaturaDasRelacoes(dados(LEMBRETE_RELACOES_PADRAO))).toBe(false);
  });

  it("no dia: um aviso por dia, dois aniversários juntos; com a idade quando tem ano", () => {
    const prefs = { noDia: { ligado: true, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: false, hora: "19:30" } };
    const so1 = dados(prefs, { pessoas: pessoasValidas([{ id: "ju", name: "Ju", birthday: "1997-10-02" }]) });
    const [a] = planejarRelacoes(so1, BASE, new Date(2026, 8, 29, 8));
    expect(a.quando).toEqual(new Date(2026, 9, 2, 9, 0));
    expect(a.title).toBe("🎂 Ju faz 29 anos hoje");
    expect(a.id).toBe(BASE);
    const juntos = planejarRelacoes(dados(prefs), BASE, new Date(2026, 8, 29, 8));
    expect(juntos).toHaveLength(1);
    expect(juntos[0].title).toBe("🎂 Hoje tem 2 aniversários");
    expect(juntos[0].body).toMatch(/Ju e Vó Cida/);
  });

  it("uma semana antes: com as ideias de presente ainda não compradas; sem ideia, convida a guardar uma", () => {
    const prefs = { noDia: { ligado: false, hora: "09:00" }, semana: { ligado: true, hora: "12:00" }, contato: { ligado: false, hora: "19:30" } };
    const d = dados(prefs, {
      pessoas: pessoasValidas([{ id: "ju", name: "Ju", birthday: "1997-10-12" }, { id: "bia", name: "Bia", birthday: "1990-10-20" }]),
      presentes: presentesValidos([
        { id: "1", person: "Ju", pessoaId: "ju", idea: "A hora da estrela", link: "", status: "idea" },
        { id: "2", person: "ju", idea: "Vale de massagem", link: "", status: "idea" }, // dado antigo, pelo nome
        { id: "3", person: "Ju", pessoaId: "ju", idea: "Caneca", link: "", status: "bought" }, // comprado: não entra
      ]),
    });
    const [ju, bia] = planejarRelacoes(d, BASE, new Date(2026, 8, 29, 8));
    expect(ju.quando).toEqual(new Date(2026, 9, 5, 12, 0));
    expect(ju.title).toBe("🎁 Ju faz aniversário daqui a uma semana");
    expect(ju.body).toBe("Ideias guardadas: A hora da estrela e Vale de massagem.");
    expect(bia.quando).toEqual(new Date(2026, 9, 13, 12, 0));
    expect(bia.body).toBe("Ainda sem ideia de presente — toca pra guardar uma.");
    // o aniversário que já está a menos de 7 dias não ganha aviso de "uma semana antes"
    const perto = dados(prefs, { pessoas: pessoasValidas([{ id: "x", name: "Lia", birthday: "1990-10-02" }]) });
    expect(planejarRelacoes(perto, BASE, new Date(2026, 8, 29, 8))).toEqual([]);
  });

  it("no dia: hoje com a hora já passada não agenda (nada no passado)", () => {
    const prefs = { noDia: { ligado: true, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: false, hora: "19:30" } };
    const d = dados(prefs, { pessoas: pessoasValidas([{ id: "x", name: "Bia", birthday: "1990-09-29" }]) });
    expect(planejarRelacoes(d, BASE, new Date(2026, 8, 29, 10))).toEqual([]);
    expect(planejarRelacoes(d, BASE, new Date(2026, 8, 29, 8))).toHaveLength(1);
  });

  it("manter contato: no dia em que vence e de 7 em 7 dias depois — nunca todo dia", () => {
    const prefs = { noDia: { ligado: false, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: true, hora: "19:30" } };
    // Carol: última conversa 10/09, a cada 14 dias → vence 24/09; em 29/09 está 5 dias atrasada
    const avisos = planejarRelacoes(dados(prefs), BASE, new Date(2026, 8, 29, 8));
    expect(avisos.map((a) => localDayKey(a.quando))).toEqual(["2026-10-01", "2026-10-08"]);
    expect(avisos[0].title).toBe("💌 Que tal mandar um oi pra Carol?");
    expect(avisos[0].body).toBe("A última conversa foi há 3 semanas.");
    expect(avisos.every((a) => a.quando.getHours() === 19 && a.quando.getMinutes() === 30)).toBe(true);
  });

  it("registrar a conversa hoje tira o aviso (o plano refeito não tem mais a Carol)", () => {
    const prefs = { noDia: { ligado: false, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: true, hora: "19:30" } };
    const d = dados(prefs);
    const depois = { ...d, momentos: [...d.momentos, ...momentosValidos([{ id: "n", date: hojeKey, person: "Carol", pessoaId: "carol", description: "Conversamos", tipo: "conversa" }])] };
    expect(planejarRelacoes(depois, BASE, new Date(2026, 8, 29, 8))).toEqual([]);
    expect(assinaturaDasRelacoes(depois)).not.toEqual(assinaturaDasRelacoes(d));
  });

  it("ids na faixa própria, em ordem, e no máximo 20", () => {
    const prefs = { noDia: { ligado: true, hora: "09:00" }, semana: { ligado: false, hora: "12:00" }, contato: { ligado: true, hora: "19:30" } };
    const muitas = pessoasValidas(Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, birthday: montarAniversario(((i * 3) % 28) + 1, ((i % 2) + 10), 1990) })));
    const avisos = planejarRelacoes({ ...dados(prefs), pessoas: muitas }, BASE, new Date(2026, 8, 29, 8));
    expect(avisos.length).toBeLessThanOrEqual(20);
    avisos.forEach((a, i) => { expect(a.id).toBe(BASE + i); expect(a.id < BASE + 10000).toBe(true); });
    for (let i = 1; i < avisos.length; i++) expect(avisos[i].quando.getTime()).toBeGreaterThanOrEqual(avisos[i - 1].quando.getTime());
  });
});
